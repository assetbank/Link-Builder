import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createHash } from 'node:crypto';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const SDK_URL = 'https://ucv.bynder.com/5.0.5/modules/compactview/bynder-compactview-6-latest.js';
const CALLBACK = 'https://d8ejoa1fys2rk.cloudfront.net/5.0.5/modules/compactview/loginCompleted.html';
let server, browser, origin, sdk;

before(async () => {
    sdk = process.env.UCV_SDK_PATH ? await readFile(process.env.UCV_SDK_PATH) : Buffer.from(await (await fetch(SDK_URL)).arrayBuffer());
    const picker = await readFile('picker.mjs', 'utf8');
    assert(picker.includes(`sha384-${createHash('sha384').update(sdk).digest('base64')}`), 'SDK fixture must match production integrity');
    server = createServer(async (req, res) => {
        try {
            let path = new URL(req.url, 'http://local').pathname;
            if (path.endsWith('/')) path += 'index.html';
            const file = resolve(`.${path}`);
            if (!file.startsWith(`${process.cwd()}/`)) throw new Error('Invalid path');
            const body = await readFile(file);
            res.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }[extname(file)] || 'application/octet-stream');
            res.end(body);
        } catch { res.writeHead(404).end(); }
    });
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await new Promise(r => server?.close(r)); });

async function setup({ realSDK = false, badIntegrity = false, holdLogin = false, colorScheme = 'light' } = {}) {
    const context = await browser.newContext({ colorScheme });
    const requests = [], errors = [];
    let authParams, exchange;
    context.on('request', request => requests.push(request.url()));
    await context.addInitScript(({ realSDK }) => {
        if (location.pathname === '/') {
            localStorage.setItem('cvrt', 'legacy-refresh-secret');
            localStorage.setItem('cvad', 'old.example');
        }
        if (!realSDK) Object.defineProperty(window, 'BynderCompactView', {
            configurable: true,
            set() { this.__testSDK = { open: options => { this.__testOptions = options; } }; },
            get() { return this.__testSDK; }
        });
    }, { realSDK });
    await context.route('https://**/*', async route => {
        const req = route.request(), url = new URL(req.url());
        const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
        if (url.origin === 'https://portal.example') {
            if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
            if (url.pathname.endsWith('is-bynder-portal/')) return route.fulfill({ json: { webdam: false }, headers: cors });
            if (url.pathname.endsWith('/auth')) {
                authParams = url.searchParams;
                if (holdLogin) return route.fulfill({ contentType: 'text/html', body: 'Synthetic login awaiting completion' });
                return route.fulfill({ status: 302, headers: { Location: `${CALLBACK}?state=${authParams.get('state')}&code=synthetic-code` } });
            }
            if (url.pathname.endsWith('/token')) {
                exchange = new URLSearchParams(req.postData());
                return route.fulfill({ json: { access_token: 'synthetic-access-secret', refresh_token: 'never-store-this', expires_in: 3600 }, headers: cors });
            }
            return route.fulfill({ json: { data: {}, errors: [] }, headers: cors });
        }
        if (url.href.startsWith(CALLBACK)) return route.fulfill({ contentType: 'text/html', body: `<script>window.opener.postMessage(location.search.slice(1), '${origin}');</script>` });
        if (url.href === SDK_URL) return route.fulfill({ contentType: 'text/javascript', headers: cors, body: badIntegrity ? 'throw new Error("tampered SDK executed")' : sdk });
        return route.fulfill({ contentType: 'text/css', body: '', headers: cors });
    });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin);
    await page.locator('#baseURL').fill('portal.example');
    await page.locator('[data-target="panel3"]').click();
    await page.locator('#ucv-open-btn').click();
    const frame = await (await page.locator('#ucv-container iframe').elementHandle()).contentFrame();
    await frame.locator('#connect').waitFor({ state: 'visible' });
    return { context, page, frame, requests, errors, auth: () => authParams, exchange: () => exchange };
}

async function signIn(env) {
    await env.frame.locator('#connect').click();
    await env.frame.waitForFunction(() => window.__testOptions || document.querySelector('#connect-panel').hidden);
}

test('OAuth uses PKCE without offline scope; import is minimized; no tokens persist', async () => {
    const env = await setup();
    try {
        await env.page.locator('#tab1').click();
        await env.page.locator('#keyword1').fill('header');
        await env.page.locator('#tab3').click();
        await signIn(env);
        assert(!env.auth().get('scope').includes('offline'));
        assert.equal(env.auth().get('code_challenge_method'), 'S256');
        assert.equal(createHash('sha256').update(env.exchange().get('code_verifier')).digest('base64url'), env.auth().get('code_challenge'));
        assert.equal(env.exchange().get('code'), 'synthetic-code');
        assert.equal(await env.frame.evaluate(() => window.__testOptions.authentication.getAccessToken()), 'synthetic-access-secret');
        assert.equal(await env.page.evaluate(() => localStorage.getItem('cvrt')), null);
        const storage = await env.page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
        assert(!storage.includes('secret') && !storage.includes('never-store'));
        await env.frame.evaluate(() => window.__testOptions.onSuccess([{ name: 'Synthetic asset', tags: ['<img src=x onerror=alert(1)>'], metaproperties: { nodes: [{ name: 'Campaign', options: [{ name: 'Launch' }] }] }, originalUrl: 'https://private.example/secret' }]));
        await env.page.waitForFunction(() => document.querySelector('#output a'));
        assert.equal(await env.page.locator('#ucv-container iframe').count(), 0);
        assert.equal(await env.page.locator('#metaproperty-rows input').first().inputValue(), 'Campaign');
        const importedLink = new URL(await env.page.locator('#output a').getAttribute('href'));
        assert(importedLink.searchParams.getAll('field').includes('singletext'));
        assert(importedLink.searchParams.getAll('value').includes('header'));
        assert.equal(await env.page.locator('#keyword1').inputValue(), 'header');
        assert.equal(await env.page.locator('#tag-rows input').first().inputValue(), '<img src=x onerror=alert(1)>');
        assert.equal(await env.page.locator('#tag-rows img').count(), 0);
        assert(!await env.page.locator('#output a').getAttribute('href').then(href => href.includes('private.example')));
        assert(!env.requests.some(url => /google-analytics|googletagmanager|sentry/.test(url)));
        assert.deepEqual(env.errors, []);
    } finally { await env.context.close(); }
});

test('closing the picker closes pending login; changing portals destroys the session', async () => {
    const env = await setup({ holdLogin: true });
    try {
        const popupPromise = env.context.waitForEvent('page');
        await env.frame.locator('#connect').click();
        const popup = await popupPromise;
        await popup.waitForURL('https://portal.example/**');
        const closed = popup.waitForEvent('close', { timeout: 5000 });
        await env.page.locator('#ucv-open-btn').click();
        await closed;
        assert.equal(await env.page.locator('#ucv-container iframe').count(), 0);
        await env.page.locator('#ucv-open-btn').click();
        await env.page.locator('#baseURL').fill('other.example');
        assert.equal(await env.page.locator('#ucv-container iframe').count(), 0);
    } finally { await env.context.close(); }
});

test('wrong-source metadata messages are ignored and CSP blocks telemetry', async () => {
    const env = await setup();
    try {
        const request = new URLSearchParams(new URL(env.frame.url()).hash.slice(1)).get('request');
        await env.page.evaluate(request => window.postMessage({ channel: 'link-builder-picker', request, type: 'selected', asset: { name: 'forged', tags: ['secret'] } }, location.origin), request);
        await env.page.evaluate(() => new Promise(resolve => setTimeout(resolve, 50)));
        assert.equal(await env.page.locator('#ucv-container iframe').count(), 1);
        assert.equal(await env.frame.evaluate(async () => {
            try { await fetch('https://telemetry.example/collect'); return false; } catch { return true; }
        }), true);
        assert(!env.requests.some(url => url.startsWith('https://telemetry.example')));
    } finally { await env.context.close(); }
});

test('tampered SDK fails closed', async () => {
    const env = await setup({ badIntegrity: true });
    try {
        await env.frame.locator('#connect').click();
        await env.frame.waitForFunction(() => document.querySelector('#connection-status').textContent.includes('could not be verified'));
        assert(!env.errors.includes('tampered SDK executed'));
        assert.equal(await env.frame.evaluate(() => window.__testOptions), undefined);
    } finally { await env.context.close(); }
});

test('OAuth callback rejects wrong origin, source and state before exchanging a code', async () => {
    const env = await setup({ holdLogin: true });
    try {
        const pendingPopup = env.context.waitForEvent('page');
        await env.frame.locator('#connect').click();
        const popup = await pendingPopup;
        await popup.waitForURL('https://portal.example/**');
        const state = env.auth().get('state');
        // Correct window but wrong origin.
        await popup.evaluate(({ state, origin }) => opener.postMessage(`state=${state}&code=forged`, origin), { state, origin });
        // Correct callback origin/window, but wrong state.
        await popup.evaluate(url => { location.href = url; }, `${CALLBACK}?state=wrong-state&code=forged`);
        await popup.waitForURL(`${CALLBACK}?state=wrong-state&code=forged`);
        await popup.evaluate(() => new Promise(r => setTimeout(r, 50)));
        assert.equal(env.exchange(), undefined);
        // Correct callback origin/state, but a different window.
        await env.frame.evaluate(({ state, origin, callback }) => window.dispatchEvent(new MessageEvent('message', {
            origin: callback, source: parent, data: `state=${state}&code=forged`
        })), { state, origin, callback: new URL(CALLBACK).origin });
        assert.equal(env.exchange(), undefined);
        await popup.evaluate(({ state, origin }) => opener.postMessage(`state=${state}&code=synthetic-code`, origin), { state, origin });
        await env.frame.waitForFunction(() => window.__testOptions);
        assert.equal(env.exchange().get('code'), 'synthetic-code');
    } finally { await env.context.close(); }
});

test('session deadline destroys the picker and manual link generation remains usable', async () => {
    const env = await setup();
    try {
        await env.page.clock.install();
        await signIn(env);
        await env.page.clock.fastForward(15 * 60 * 1000);
        await env.page.waitForFunction(() => !document.querySelector('#ucv-container iframe'));
        assert.match(await env.page.locator('#ucv-status').textContent(), /expired/);
        await env.page.locator('[data-target="panel1"]').click();
        await env.page.locator('#field1').fill('Campaign');
        await env.page.locator('#value1').fill('Spring');
        assert.match(await env.page.locator('#output a').getAttribute('href'), /metaproperty_Campaign&value=Spring/);
    } finally { await env.context.close(); }
});

test('actual pinned SDK initializes with supplied token without persisting credentials', async () => {
    const env = await setup({ realSDK: true });
    try {
        await signIn(env);
        await env.frame.waitForFunction(() => document.querySelector('#picker').childElementCount > 0);
        const storage = await env.frame.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
        assert(!storage.includes('secret') && !storage.includes('never-store'));
        assert(!env.requests.some(url => /google-analytics|googletagmanager|sentry/.test(url)));
        assert(!env.errors.some(error => /Content Security|Refused to evaluate|not a function/.test(error)));
    } finally { await env.context.close(); }
});

test('theme changes reach the connection screen without closing the picker', async () => {
    const env = await setup({ colorScheme: 'dark' });
    try {
        assert.equal(await env.frame.locator('html').getAttribute('data-theme'), 'dark');
        assert.equal(await env.frame.locator('body').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(18, 30, 50)');
        await env.page.getByRole('button', { name: 'Dark mode', exact: true }).click();
        await env.frame.waitForFunction(() => document.documentElement.dataset.theme === 'light');
        assert.equal(await env.page.locator('#ucv-container iframe').count(), 1);
        assert(await env.frame.locator('#connect').isVisible());
        assert.deepEqual(env.errors, []);
    } finally { await env.context.close(); }
});
