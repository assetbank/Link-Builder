import { validPortal, metadataOnly, matchesMessage } from './picker-common.mjs';

// Public OAuth client and callback used by Bynder's UCV distribution. There is no
// client secret. PKCE binds the code to this window; we deliberately omit offline.
const CLIENT_ID = '42b1eefa-d754-4802-b9c4-bf80d6ab6052';
const CALLBACK_ORIGIN = 'https://d8ejoa1fys2rk.cloudfront.net';
const CALLBACK = `${CALLBACK_ORIGIN}/5.0.5/modules/compactview/loginCompleted.html`;
const SDK_URL = 'https://ucv.bynder.com/5.0.5/modules/compactview/bynder-compactview-6-latest.js';
// Fail closed if the moving vendor URL changes. Review and test before updating.
const SDK_INTEGRITY = 'sha384-fYswkozP4tA9tRp63wAIOZv222ztXSwr8jkTZ/bouNr6PeQfTNIqXTD8sW6zwtUf';
const MAX_SESSION_MS = 15 * 60 * 1000;
const params = new URLSearchParams(location.hash.slice(1));
const domain = params.get('portal');
const request = params.get('request');
const button = document.getElementById('connect');
const status = document.getElementById('connection-status');
let token = '';
let popup;
let stopped = false;
let expiryTimer;
let cancelLogin = () => {};
let sdkPromise;
const controller = new AbortController();

function send(type, extra = {}) {
    parent.postMessage({ channel: 'link-builder-picker', request, type, ...extra }, location.origin);
}

function stop() {
    stopped = true;
    token = '';
    clearTimeout(expiryTimer);
    controller.abort();
    cancelLogin();
    try { popup?.close(); } catch { /* Already closed. */ }
}

window.addEventListener('pagehide', stop);
window.addEventListener('message', event => {
    if (matchesMessage(event, parent, location.origin, request) && event.data.type === 'close') stop();
});

function random() {
    return base64url(crypto.getRandomValues(new Uint8Array(32)));
}
function base64url(bytes) {
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function portalFetch(path, options = {}) {
    const response = await fetch(`https://${domain}/${path}`, {
        ...options, credentials: 'omit', redirect: 'error', cache: 'no-store', signal: controller.signal
    });
    if (!response.ok) throw new Error('The portal could not complete this request.');
    return response.json();
}

function authorizationCode(loginWindow, state) {
    return new Promise((resolve, reject) => {
        const finish = (error, code) => {
            clearTimeout(timeout);
            clearInterval(closed);
            window.removeEventListener('message', receive);
            cancelLogin = () => {};
            error ? reject(error) : resolve(code);
        };
        const receive = event => {
            if (event.origin !== CALLBACK_ORIGIN || event.source !== loginWindow || typeof event.data !== 'string') return;
            const result = new URLSearchParams(event.data);
            if (result.get('state') !== state) return;
            const code = result.get('code');
            if (result.has('error') || !code || code.length > 4096) finish(new Error('Sign-in was not completed.'));
            else finish(null, code);
        };
        const timeout = setTimeout(() => finish(new Error('Sign-in timed out. Please try again.')), 120000);
        const closed = setInterval(() => {
            if (loginWindow.closed) finish(new Error('Sign-in window closed. Please try again.'));
        }, 500);
        cancelLogin = () => finish(new Error('Connection closed.'));
        window.addEventListener('message', receive);
    });
}

function loadSDK() {
    if (!sdkPromise) sdkPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = SDK_URL;
        script.integrity = SDK_INTEGRITY;
        script.crossOrigin = 'anonymous';
        script.referrerPolicy = 'no-referrer';
        script.onload = () => window.BynderCompactView?.open ? resolve() : reject(new Error('Asset browser unavailable.'));
        script.onerror = () => reject(new Error('The asset browser could not be verified or loaded. Please try again later.'));
        document.head.appendChild(script);
    });
    return sdkPromise;
}

async function connect() {
    // Open synchronously in the click handler so browser popup protection works.
    popup = window.open('about:blank', `bynder-${request}`, 'popup,width=570,height=700');
    if (!popup) {
        status.textContent = 'Allow the sign-in popup, then try again.';
        return;
    }
    popup.document.title = 'Connecting to Bynder';
    popup.document.body.textContent = `Connecting to ${domain}…`;
    button.disabled = true;
    status.textContent = `Connecting to ${domain}…`;
    try {
        const verifier = random();
        const state = random();
        const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
        // This supports Bynder portals, including custom domains; not WebDAM.
        const portal = await portalFetch('feeds/media/is-bynder-portal/');
        if (!portal || typeof portal !== 'object' || portal.webdam) throw new Error('Please enter a Bynder portal.');
        const auth = new URL(`https://${domain}/v6/authentication/oauth2/auth`);
        auth.search = new URLSearchParams({
            client_id: CLIENT_ID, redirect_uri: CALLBACK, response_type: 'code',
            scope: 'asset:read collection:read meta.assetbank:read',
            code_challenge: challenge, code_challenge_method: 'S256', state
        });
        if (stopped || popup.closed) throw new Error('Connection closed.');
        const pendingCode = authorizationCode(popup, state);
        popup.location.href = auth.href;
        const code = await pendingCode;
        popup.close();
        const result = await portalFetch('v6/authentication/oauth2/token', {
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', Accept: 'application/json' },
            body: new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: CALLBACK,
                grant_type: 'authorization_code', code, code_verifier: verifier })
        });
        const expiresIn = Number(result.expires_in);
        if (typeof result.access_token !== 'string' || !result.access_token ||
            !Number.isFinite(expiresIn) || expiresIn <= 5) throw new Error('The portal returned an invalid or expired session.');
        token = result.access_token;
        // Never keep or use a refresh token, even if a portal returns one anyway.
        delete result.access_token;
        delete result.refresh_token;
        if (stopped) { token = ''; return; }
        expiryTimer = setTimeout(() => {
            stop();
            send('expired');
        }, Math.min(MAX_SESSION_MS, (expiresIn - 5) * 1000));
        await loadSDK();
        if (stopped) return;
        document.getElementById('connect-panel').hidden = true;
        window.BynderCompactView.open({
            container: document.getElementById('picker'),
            portal: { url: domain, editable: false },
            authentication: { getAccessToken: () => token, hideLogout: false },
            mode: 'SingleSelect', noCache: true, resetStoreOnMount: true,
            hideExternalAccess: true, enableDATPermissionManagement: true,
            assetFieldSelection: 'name tags metaproperties { nodes { name options { name } } }',
            onLogout: () => { stop(); send('closed'); },
            onSuccess: assets => {
                if (stopped) return;
                try {
                    if (!Array.isArray(assets) || assets.length !== 1) throw new Error('Choose one asset.');
                    const asset = metadataOnly(assets[0]);
                    stop();
                    send('selected', { asset });
                } catch {
                    stop();
                    send('error', { message: 'This asset has unsupported or excessive metadata. Please enter the fields manually.' });
                }
            }
        });
    } catch (error) {
        try { popup?.close(); } catch { /* Already closed. */ }
        token = '';
        clearTimeout(expiryTimer);
        if (stopped) return;
        status.textContent = error.message || 'Unable to connect. Please try again.';
        button.disabled = false;
    }
}

if (parent === window || !validPortal(domain) || !/^[a-f0-9-]{36}$/.test(request ?? '')) {
    status.textContent = 'Open the asset browser from Link Builder.';
} else {
    // Add a second policy before any network requests. Policies intersect: SDK
    // API calls can only reach the explicitly selected portal, not telemetry.
    const policy = document.createElement('meta');
    policy.httpEquiv = 'Content-Security-Policy';
    policy.content = `connect-src https://${domain}`;
    document.head.appendChild(policy);
    status.textContent = `Sign in to ${domain} to select an asset.`;
    button.textContent = `Connect to ${domain}`;
    button.disabled = false;
    button.addEventListener('click', connect);
    send('ready');
}
