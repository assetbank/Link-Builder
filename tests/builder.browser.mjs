import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';

let browser;
const origin = 'http://127.0.0.1:4179';
before(async () => { browser = await chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); });

async function setup(width = 1440) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    await context.route(`${origin}/**`, async route => {
        let pathname = new URL(route.request().url()).pathname;
        if (pathname.endsWith('/')) pathname += 'index.html';
        const file = resolve(`.${pathname}`);
        if (!file.startsWith(`${process.cwd()}/`)) return route.abort();
        const contentType = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
            '.mjs': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml' }[extname(file)];
        await route.fulfill({ contentType, body: await readFile(file) });
    });
    await context.route('https://**/*', route => route.fulfill({ contentType: 'text/plain', body: 'Synthetic destination' }));
    await context.addInitScript(() => {
        window.copiedLinks = [];
        Object.defineProperty(navigator, 'clipboard', { value: {
            writeText: async value => { window.copiedLinks.push(value); }
        } });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin);
    return { context, page, errors };
}

test('existing metaproperty, tag and status URLs are preserved', async () => {
    const { context, page, errors } = await setup();
    try {
        assert(await page.locator('#panel1 .copy-link-btn').isDisabled());
        const open = page.locator('#panel1 .open-link');
        assert(await open.isVisible());
        assert(await open.isDisabled());
        assert.equal(await open.getAttribute('href'), null);
        assert.equal(await open.getAttribute('tabindex'), '-1');
        await page.getByLabel('Portal URL', { exact: true }).fill('https://portal.example/assets');
        assert.equal(await page.locator('#baseURL').inputValue(), 'portal.example');
        await page.getByLabel('Metaproperty 1', { exact: true }).fill('Campaign.Name');
        assert(await page.locator('#panel1 .copy-link-btn').isDisabled());
        await page.getByLabel('Option 1', { exact: true }).fill('Spring Launch');
        assert(await open.isEnabled());
        assert.equal(await open.getAttribute('tabindex'), null);
        await page.getByLabel('Tag 1', { exact: true }).fill('Summer & café');
        await page.locator('#status-grid-1').getByRole('button', { name: 'Archived', exact: true }).click();
        assert.equal(await page.locator('#output a').getAttribute('href'),
            'https://portal.example/search/set/?resetsearch&field=metaproperty_Campaign.Name&value=Spring_Launch&field=tags&value=Summer%20%26%20caf%C3%A9&field=archive&value=1&filterType=add');
        await page.getByLabel('Metaproperty 1', { exact: true }).fill('');
        assert.match(await page.locator('#output a').getAttribute('href'), /\/search\/media\/\?resetsearch&field=tags/);
        assert.equal(await page.getByRole('button', { name: 'Archived', exact: true }).getAttribute('aria-pressed'), 'true');
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

test('Boolean search reproduces the captured multi-keyword and metaproperty URL', async () => {
    const { context, page, errors } = await setup();
    try {
        await page.locator('#baseURL').fill('jakob-spott.bynder.com');
        await page.locator('#field1').fill('Asset_Type');
        await page.locator('#value1').fill('Image');
        await page.getByLabel('Keyword 1', { exact: true }).fill('test');
        await page.getByLabel('Keyword 2', { exact: true }).fill('08');
        await page.getByRole('button', { name: 'Add keyword', exact: true }).click();
        await page.getByLabel('Keyword 3', { exact: true }).fill(' test ');
        const expected = 'https://jakob-spott.bynder.com/search/set/?resetsearch&field=metaproperty_Asset_Type&value=Image&filterType=add&field=singletext&value=test&filterType=add&field=singletext&value=08&filterType=add';
        assert.equal(await page.locator('#output a').getAttribute('href'), expected);
        await page.locator('#panel1 .copy-link-btn').click();
        assert.deepEqual(await page.evaluate(() => window.copiedLinks), [expected]);
        assert.equal(await page.locator('#panel1 .open-link').getAttribute('href'), expected);
        await page.locator('#tab1').focus();
        await page.keyboard.press('ArrowRight');
        assert(await page.locator('#tab3').evaluate(el => el === document.activeElement));
        assert.equal(await page.locator('#tab3').getAttribute('aria-selected'), 'true');
        assert(await page.locator('#panel1').isHidden());
        await page.keyboard.press('Home');
        assert(await page.locator('#panel1').isVisible());
        assert.equal(await page.locator('#output a').getAttribute('href'), expected);
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

test('one keyword combines with metaproperties and public rights using the captured URL', async () => {
    const { context, page, errors } = await setup(390);
    try {
        await page.locator('#baseURL').fill('dam.bynder.com');
        await page.locator('#field1').fill('Tier1type');
        await page.locator('#value1').fill('Image');
        await page.locator('#keyword1').fill('header');
        await page.getByRole('button', { name: 'Public', exact: true }).click();
        assert.equal(await page.locator('#output a').getAttribute('href'),
            'https://dam.bynder.com/search/set/?resetsearch&field=metaproperty_Tier1type&value=Image&filterType=add&field=singletext&value=header&filterType=add&field=isPublic&value=true&filterType=add');
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
});

test('combined text, tags and rights preserve query characters and clear without stale links', async () => {
    const { context, page } = await setup();
    try {
        await page.locator('#baseURL').fill('portal.example');
        const query = 'café & sun #1 = 50% + \"blue\"';
        await page.getByRole('button', { name: 'Add keyword', exact: true }).click();
        await page.getByLabel('Keyword 3', { exact: true }).fill(query);
        await page.locator('#tag1').fill('Campaign & launch');
        await page.getByRole('button', { name: 'Limited usage', exact: true }).click();
        let url = new URL(await page.locator('#output a').getAttribute('href'));
        assert.equal(url.pathname, '/search/set/');
        assert.deepEqual(url.searchParams.getAll('field'), ['tags', 'singletext', 'keyVisual']);
        assert.deepEqual(url.searchParams.getAll('value'), ['Campaign & launch', query, '1']);
        assert.deepEqual(url.searchParams.getAll('filterType'), ['add', 'add', 'add']);
        assert.equal(url.hash, '');
        await page.getByLabel('Keyword 3', { exact: true }).fill('');
        await page.locator('#tag1').fill('metaproperty_literal');
        url = new URL(await page.locator('#output a').getAttribute('href'));
        assert.equal(url.pathname, '/search/media/');
        assert(!url.searchParams.getAll('field').includes('singletext'));
        await page.getByRole('button', { name: 'Limited usage', exact: true }).click();
        await page.locator('#tag1').fill('');
        assert(await page.locator('#panel1 .copy-link-btn').isDisabled());
        assert(await page.locator('#panel1 .open-link').isVisible());
        assert(await page.locator('#panel1 .open-link').isDisabled());
        assert.equal(await page.locator('#panel1 .open-link').getAttribute('href'), null);
        assert.equal(await page.locator('#output a').count(), 0);
        await page.locator('#keyword1').fill(query);
        url = new URL(await page.locator('#output a').getAttribute('href'));
        assert.deepEqual(url.searchParams.getAll('field'), ['singletext']);
        assert.equal(url.searchParams.get('value'), query);
        await page.locator('#baseURL').fill('not-a-domain');
        assert(await page.locator('#panel1 .copy-link-btn').isDisabled());
        assert.equal(await page.locator('#output a').count(), 0);
    } finally { await context.close(); }
});

test('added and deleted rows keep labels, values and keyboard focus', async () => {
    const { context, page } = await setup(390);
    try {
        await page.getByRole('button', { name: 'Add metaproperty', exact: true }).click();
        const field = page.getByLabel('Metaproperty 2', { exact: true });
        assert(await field.evaluate(el => el === document.activeElement));
        await field.fill('Brand');
        await page.getByLabel('Option 2', { exact: true }).fill('Blue');
        await page.getByRole('button', { name: 'Remove metaproperty 1', exact: true }).click();
        assert.equal(await page.getByLabel('Metaproperty 1', { exact: true }).inputValue(), 'Brand');
        assert.equal(await page.getByLabel('Option 1', { exact: true }).inputValue(), 'Blue');
        assert(await page.getByLabel('Metaproperty 1', { exact: true }).evaluate(el => el === document.activeElement));
        await page.getByRole('button', { name: 'Add tags', exact: true }).click();
        assert(await page.getByLabel('Tag 3', { exact: true }).evaluate(el => el === document.activeElement));
        await page.getByRole('button', { name: 'Remove tags 1 and 2', exact: true }).click();
        assert.equal(await page.locator('#tag-rows input').count(), 2);
        assert.equal(await page.locator('.builder input').evaluateAll(inputs => inputs.filter(input => input.labels.length === 0).length), 0);
    } finally { await context.close(); }
});

test('copy and open are separate; copy failure leaves an actionable fallback', async () => {
    const { context, page } = await setup();
    try {
        await page.locator('#baseURL').fill('portal.example');
        await page.locator('#tag1').fill('Launch');
        const link = await page.locator('#output a').getAttribute('href');
        const copy = page.locator('#panel1 .copy-link-btn');
        await copy.click();
        assert.equal(await copy.textContent(), 'Copied');
        assert.equal(await page.locator('#output a').getAttribute('href'), link);
        assert.deepEqual(await page.evaluate(() => window.copiedLinks), [link]);
        assert.equal(context.pages().length, 1);
        const pending = context.waitForEvent('page');
        await page.locator('#panel1 .open-link').click();
        const opened = await pending;
        await opened.waitForURL(link);
        assert.deepEqual(await page.evaluate(() => window.copiedLinks), [link]);
        await opened.close();
        await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('Denied'); }; });
        await copy.click();
        assert.match(await page.locator('#panel1 .copy-status').textContent(), /copy it manually/);
        assert.equal(await page.locator('#output a').getAttribute('href'), link);
    } finally { await context.close(); }
});

test('a delayed clipboard result cannot restore an outdated URL', async () => {
    const { context, page } = await setup();
    try {
        await page.locator('#baseURL').fill('portal.example');
        await page.locator('#tag1').fill('Old');
        await page.evaluate(() => { navigator.clipboard.writeText = () => new Promise(resolve => { window.finishCopy = resolve; }); });
        await page.locator('#panel1 .copy-link-btn').click();
        await page.locator('#tag1').fill('New');
        await page.evaluate(() => window.finishCopy());
        assert.match(await page.locator('#output a').getAttribute('href'), /value=New/);
        assert.equal(await page.locator('#panel1 .copy-link-btn').textContent(), 'Copy link');
        assert.equal(await page.locator('#panel1 .copy-status').textContent(), '');
    } finally { await context.close(); }
});

test('responsive controls remain on-screen and shared header matches the terms page', async () => {
    for (const width of [320, 390, 768, 1440]) {
        const { context, page } = await setup(width);
        try {
            const issues = await page.locator('.builder input:visible, .builder button:visible, .builder .output-container:visible').evaluateAll(elements =>
                elements.filter(el => { const r = el.getBoundingClientRect(); return r.x < 0 || r.right > innerWidth; }).map(el => el.id || el.className));
            assert.deepEqual(issues, [], `${width}px controls outside viewport`);
            assert.equal(await page.locator('#status-grid-1').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), width <= 690 ? 2 : 4);
            const header = await page.locator('.header').boundingBox();
            const logo = await page.locator('.logo').boundingBox();
            await page.goto(`${origin}/terms/`);
            assert.deepEqual(await page.locator('.header').boundingBox(), header);
            assert.deepEqual(await page.locator('.logo').boundingBox(), logo);
        } finally { await context.close(); }
    }
});


test('compact defaults keep copy and the full link accessible while scrolling', async () => {
    for (const width of [390, 1440]) {
        const { context, page, errors } = await setup(width);
        try {
            await page.setViewportSize({ width, height: 740 });
            assert.equal(await page.locator('.metaproperty-row').count(), 1);
            assert.equal(await page.locator('.tag-row').count(), 1);
            assert.equal(await page.locator('.keyword-row').count(), 2);
            await page.locator('#baseURL').fill('portal.example');
            await page.locator('#tag1').fill('Launch');
            const copy = page.locator('#panel1 .copy-link-btn');
            const withinViewport = async () => {
                const box = await copy.boundingBox();
                assert(box && box.y >= 0 && box.y + box.height <= 740);
            };
            await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
            await withinViewport();
            await copy.click();
            assert.match((await page.evaluate(() => window.copiedLinks)).at(-1), /value=Launch/);
            await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
            await withinViewport();
            await page.locator('#keyword1').fill('long keyword '.repeat(50));
            const expected = await page.locator('#output a').getAttribute('href');
            await page.getByRole('button', { name: 'View full link', exact: true }).click();
            assert(await page.locator('#output a').isVisible());
            assert.equal(await page.locator('.result-toggle').getAttribute('aria-expanded'), 'true');
            await withinViewport();
            await copy.click();
            assert.equal((await page.evaluate(() => window.copiedLinks)).at(-1), expected);
            await page.getByRole('button', { name: 'Collapse link', exact: true }).click();
            await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('Denied'); }; });
            await copy.click();
            assert(await page.locator('#output a').isVisible());
            assert.equal(await page.locator('.result-toggle').getAttribute('aria-expanded'), 'true');
            assert.match(await page.locator('.copy-status').textContent(), /copy it manually/);
            await withinViewport();
            await page.locator('#tab3').click();
            assert(await copy.isHidden());
            await page.locator('#tab1').click();
            await withinViewport();
            assert.deepEqual(errors, []);
        } finally { await context.close(); }
    }
});
