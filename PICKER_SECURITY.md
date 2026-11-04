# Asset picker hardening

The picker remains available. It now uses a short-lived local session instead of the SDK's default persistent OAuth session. No backend or new hosting service is needed.

## Authentication and data flow

1. The main page creates a fresh same-origin picker document with a random request ID and the explicitly entered portal domain. Loading the main page does not load the SDK or contact a portal.
2. The user clicks Connect. A portal login popup uses OAuth authorization code flow with PKCE/S256, random state, and the public UCV client ID and callback from Bynder's distribution. There is no client secret. The code receiver checks the exact callback origin, popup window, and state.
3. Requested scopes are `asset:read collection:read meta.assetbank:read`. `offline` and transformation scopes are omitted. A probe checks for a Bynder portal; this is a compatibility check, not proof of domain ownership. Users should enter only their trusted portal. WebDAM is not supported by this connection flow.
4. The access token stays in a module closure. Any refresh token unexpectedly returned by the portal is discarded. The SDK receives the token through its documented `authentication.getAccessToken` interface, bypassing its default persistent authentication flow.
5. The SDK requests the asset name, tags, and metaproperty/option names. It can still fetch previews, file details, and other browsing data. Both the picker and the parent project the selected object onto the allowed fields, validate its types, and enforce size limits. Input values are assigned through DOM properties.
6. Selection, close/disconnect, portal change, navigation, SDK logout, or the session deadline destroys the picker document. The parent accepts only messages from that document, the exact site origin, and the current request. The local session lasts no more than 15 minutes or the token's stated expiry minus five seconds, whichever is earlier. Login attempts time out after two minutes. No refresh occurs.

This ends the **local connection**; it does not revoke the server-side access token or end the user's Bynder SSO session. Previously issued grants should be reviewed/revoked through Bynder if necessary. Legacy `cvrt`, `cvad`, `cvp`, and known JWT storage entries are cleared when either site page or the picker loads. Noncredential portal preferences written by the SDK are cleared on disconnect.

## Browser controls

- No Google Analytics, tag manager, or unrelated third-party scripts on the main or terms page.
- Main and terms pages have a CSP permitting local scripts and no fetch/XHR connections. Inline scripts/handlers were removed; inline styles remain allowed for existing UI and SDK styling. Existing deployment headers must be retained.
- The picker has its own CSP, tightened before connecting so fetch/XHR can reach only the selected HTTPS portal. Sentry and other telemetry connections are blocked. Bynder CDN styles/fonts and HTTPS preview images remain allowed for the SDK's display.
- The SDK is loaded from Bynder's documented 6.x CDN distribution with cross-origin SRI. The exact reviewed bytes are required; a changed bundle fails closed. CDN CORS support was checked with an Origin header. No vendor source is copied or modified.
- The picker iframe exists for lifecycle/CSP control. It is **same-origin**, not a security isolation boundary. A compromised site deployment or arbitrary script execution can still misuse a currently active access token or read imported metadata. CSP and SRI reduce attack opportunities, not all consequences of executing trusted code. Deployment access protection remains necessary.
- A `no-referrer` policy is applied, and generated links retain `noopener noreferrer`. Metadata intentionally embedded in copied/opened URLs can still appear in browser history, destination logs, and wherever users share it.

## SDK pin and maintenance

Reviewed on 2026-11-03:

- URL: `https://ucv.bynder.com/5.0.5/modules/compactview/bynder-compactview-6-latest.js`
- SHA-256: `2d1fb12f987abc78c351857c79fc29ac8262ef42e28d4d8cbee469ee3bd68785`
- SRI: `sha384-fYswkozP4tA9tRp63wAIOZv222ztXSwr8jkTZ/bouNr6PeQfTNIqXTD8sW6zwtUf`

The `6-latest` URL is mutable. When it changes, review the new authentication/storage behavior and release notes, update the hash in `picker.mjs`, and rerun all tests plus a test-account login. Do not remove the integrity check to restore availability. Manual link building continues if the SDK is unavailable.

Public OAuth client/callback values mirror the vendor SDK; they are not secrets. This implementation depends on Bynder continuing to allow that client, callback, CORS, and the reduced scopes for this integration. Confirm these with a real low-privilege test account before deploying; if Bynder requires a separately registered client, configure its approved values and callback rather than falling back to persistent authentication.

## Tests

Run `npm ci`, `npx playwright install chromium`, `npm test`, and `npm run test:browser`.

The browser suite downloads the public SDK and verifies its hash before using it. To run offline with previously reviewed bytes, set `UCV_SDK_PATH` to the downloaded bundle. All portal, login, token, and asset responses are synthetic; no account credentials or customer assets are used. Most workflow tests substitute the SDK UI callback after the genuine bundle passes integrity checks. A separate smoke test initializes the actual SDK with the supplied synthetic token. That smoke test does not exercise a real asset catalogue.

Tests cover portal/metadata validation, stripping unused properties, source/origin/request checks, PKCE, OAuth callback rejection, no offline scope, no persisted credentials, legacy cleanup, literal handling of HTML-like tags, popup/session teardown, expiry, CSP network blocking, SDK integrity failure, actual SDK initialization, and manual link generation.

Before publishing, use a low-privilege test account to confirm actual sign-in/SSO, granted scopes and expiry, asset browsing/import for standard and custom portal domains, and logout. Inspect network traffic and storage through the complete flow. In particular, verify the minimal asset-field selection and any portal-specific preview/API hosts under CSP. The synthetic tests do not establish server-side permission enforcement or revocation behavior.

No deployment was performed as part of this implementation.
