# Asset picker security review

Reviewed 2026-11-03 against commit `a24f7f6` and the public deployment at https://linkbuilder.bynder.com/.

**Follow-up implementation:** This document records the original deployment's findings. Subsequent working-tree changes retain the picker with ephemeral OAuth, no offline scope, removal of Analytics, an integrity-pinned SDK, CSP, validation, and document teardown. See [PICKER_SECURITY.md](PICKER_SECURITY.md) for the new design, tests, remaining limitations, and pre-deployment checks. The original recommendation below should not be read as an assessment of those later changes.

## Recommendation

Disable the asset picker pending hardening. It does not need to be permanently removed, but its current implementation gives a simple link-building page persistent access to a user's DAM through browser-readable OAuth credentials. Keeping that capability deserves an explicitly maintained security boundary. If that maintenance is disproportionate to the feature's value, remove the picker and retain manual link building.

This is a risk assessment, not evidence of a breach. No real credentials or customer assets were accessed, and no authenticated penetration test was performed. Application code and deployment were not changed during this review.

The implementation is **Bynder Universal Compact View (UCV)**, not Binance.

## What actually happens

1. The page immediately loads Google Analytics and the Bynder UCV JavaScript bundle (`index.html:18–26`). Both execute with the link-builder page's JavaScript privileges. The picker is rendered into a DOM container, not an isolated cross-origin iframe.
2. Opening the picker passes the user-entered portal hostname into UCV (`script.js:326`). The active SDK authentication path opens the portal's OAuth login in a popup. It uses authorization code flow with PKCE/S256, randomly generated state, and an exact callback-origin check.
3. The SDK exchanges the returned code for tokens from the portal. Its requested Bynder scopes are `offline`, `asset:read`, `collection:read`, and `meta.assetbank:read`. These request read capabilities, not write capabilities, but are broader than access to the one asset selected for import. Actual access and token lifetime remain subject to server-side permissions and policy.
4. The SDK keeps an access-token getter in React state and writes the refresh token to `localStorage` as `cvrt`, alongside portal domain `cvad`. This storage belongs to **https://linkbuilder.bynder.com**, even though the JavaScript was downloaded from Bynder's CDN.
5. UCV fetches data using bearer authentication. Selecting an asset returns an object to the page; the application puts metaproperty names, option names, and tags into its inputs and constructs a search URL.
6. Closing or selecting clears the container's HTML. It does not log out, revoke authorization, or remove the persisted refresh token.

The link builder has no application backend receiving these tokens in the reviewed code. That is useful, but browser-side credential exposure remains. Normal portal login does not imply that the page sees the user's password; it does receive an authorization capability through the SDK.

## Findings

### High: persistent credentials share an origin with third-party scripts

**Evidence:** `index.html:18–26`, `script.js:326`, and active downloaded SDK path `Fb → bW → yW → JU`.

`JU` reads and writes `cvrt` through `localStorage`, and its refresh path uses that value to obtain an access token. Any JavaScript executing on the origin can read this storage, including scripts on `/terms/`, where Analytics also loads (`terms/index.html:17`). Browser storage isolation does not distinguish a third-party script from application code once both execute in the page.

An XSS flaw, compromised external script, or unauthorized site deployment could therefore steal a reusable credential, potentially exposing the user's permitted assets, collections, and metadata beyond the selected asset. This review did **not** establish such a compromise or that Google Analytics currently reads tokens. This is a confirmed exposure boundary with conditional exploitation.

The SDK also initializes a Bynder-hosted Sentry client. Actual telemetry payloads were not captured; they must be included in the network/privacy review rather than assuming the browser only communicates with the chosen portal.

OWASP specifically advises against storing authentication credentials in JavaScript-readable browser storage. [OWASP session-management guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

### Medium: closing the picker leaves authorization behind

**Evidence:** `script.js:299–305` and `333–342`.

Both close paths use `innerHTML = ""`. The SDK mounts a React root, so deleting DOM children is also not a supported React unmount and can leave state, timers, or subscriptions alive. Even the SDK auth hook's proper unmount cleanup only clears its refresh timer; it leaves `cvrt` in storage. Explicit SDK logout removes that local token, but the inspected logout function does not itself call a server revocation endpoint.

A later page load can reuse the stored refresh credential. A refresh or tab close is not a reliable disconnect. Implement an explicit disconnect, supported component teardown, cache clearing, and a documented expiry/revocation policy. Clearing local storage cannot invalidate a token that has already been copied.

### Medium: more asset information reaches the page than link building requires

**Evidence:** `script.js:326–344`; no `assetFieldSelection` is configured. Git history shows a field selection was removed in `a8f5db9` during a functional fix.

The active SDK's default selection includes descriptions, text metaproperties, original and derivative URLs, and video links as well as the needed names and tags. The single-asset query also adds `files`. Discarding unused properties in `populateFromAsset` does not stop them entering the page's JavaScript environment.

Restore and test a minimal field selection on the chosen SDK version, and project the result onto an explicit output schema. Field selection is data minimization, not an authorization boundary: the SDK still performs browsing requests, and its token remains broader. [Bynder's configuration documentation](https://developers.bynder.com/universal-compact-view).

### Medium, conditional: Analytics can receive metadata in generated links

**Evidence:** `index.html:18–23`; generated links include metadata in query parameters (`script.js:233–269`) and are rendered as clickable anchors (`script.js:179–187`).

When GA4 outbound-click measurement applies, it sends the full destination URL as `link_url`. Thus clicking a generated portal link can send its metadata-bearing URL to Google. Whether this occurs here depends on the property's enhanced-measurement and cross-domain configuration, which was not accessed. No such event was sent as part of this review. `rel="noreferrer"` protects the navigation referrer, not Analytics' ability to inspect the link.

Remove Analytics from any page that handles imported metadata or shares the credential-bearing origin. Merely disabling an outbound-click event does not isolate credentials from the loaded script. [Google's outbound-click documentation](https://support.google.com/analytics/answer/9216061?hl=en), [full-URL parameter definition](https://support.google.com/analytics/answer/13784088?hl=en).

### Medium: mutable SDK dependency and missing CSP

**Evidence:** `index.html:26` loads `bynder-compactview-5-latest.js` without integrity metadata. The live response had no Content-Security-Policy header, and the HTML contains no CSP meta policy.

The `5.0.5` directory does not pin the actual bundle: `5-latest` is a moving major-version distribution. The vendor currently documents a 6.x distribution and mentions security fixes in the 6.0 release. This does not prove a specific exploitable vulnerability in the inspected 5.x bundle, but warrants a supported-version review and controlled upgrades. [Bynder release history](https://developers.bynder.com/universal-compact-view).

Use a reviewed, pinned dependency, preferably a controlled local bundle if licensing permits. If using cross-origin Subresource Integrity, verify CDN CORS support; the inspected response did not contain an Access-Control-Allow-Origin header. Add a tested CSP with narrowly allowed scripts, connections, frames, and other required resources. Remove/refactor inline scripts and handlers as needed. A CSP does not make an intentionally allowed script unable to read tokens. [MDN integrity guidance](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Subresource_Integrity).

Existing production protections include HTTPS, HSTS, `X-Frame-Options: SAMEORIGIN`, and `X-Content-Type-Options: nosniff`. Their presence was verified; absence of all security headers is not a finding.

### Privacy statements contradict the implementation

**Evidence:** `terms/index.html:99–106`.

The claim that asset data and session information are inaccessible to the service is inaccurate for this frontend. Metadata is deliberately imported, and the SDK stores a credential on the service's origin. The claim that all input is discarded on refresh is also too broad: at least the portal domain and refresh token persist. The blanket assertion that user input never reaches an external server does not describe the picker requests or opening generated links, and Analytics requires separate verification.

Rewrite these statements to distinguish application servers, browser processing/storage, Bynder API/authentication requests, telemetry, and user-initiated link sharing. The selected metadata is accessible to the page even if no backend database exists. This is a technical accuracy finding, not a legal-compliance conclusion.

## A proportionate path to keeping the feature

1. **Contain immediately:** disable both the picker UI and its SDK load pending remediation. Remove unnecessary third-party JavaScript from pages sharing the credential origin. Provide a one-time cleanup of the old picker storage on that origin, and agree with Bynder on whether existing grants should be revoked. Disabling the button alone leaves both the loaded SDK and historical storage in place.
2. **Isolate authentication:** preferably put the picker on a dedicated, controlled origin with no Analytics, tag manager, or unrelated application scripts. Embed or open it using a vendor-supported flow. Return only validated metadata through a message channel that checks exact origin, expected source window, and a per-request nonce. Never return tokens. A different URL path, Shadow DOM, or a same-origin iframe is not credential isolation.
3. **Limit retained authority:** ask Bynder for the supported approach to ephemeral authentication, refresh-token rotation/lifetime, and revocation. Do not assume `noCache`, `resetStoreOnMount`, or a newer SDK version changes token storage. Do not monkey-patch browser storage as a security boundary. If persistent browser credentials cannot meet the requirements, use an approved integration with server-managed tokens or remove the picker. A backend would add operating costs and should only be introduced if this convenience justifies it.
4. **Reduce and validate data:** select only required fields where supported, filter the returned object before crossing into the main page, bound field counts/lengths, and use input `.value`/text nodes. Limit supported portal destinations to approved tenants or a verified tenant registry, including legitimate custom domains. The existing hostname regex and the SDK's portal probe are not proof of domain ownership. Bind imports to the portal that opened the picker and invalidate stale responses on portal changes.
5. **Control delivery and behavior:** use a maintained pinned SDK, effective CSP, documented telemetry, proper disconnect/teardown, and accurate user-facing disclosures. Keep deployment access protected through MFA, reviewed changes, and restricted publishing credentials; those settings were not available in this review.

A dedicated origin protects credentials from the main page, but does not prevent the parent page from seeing metadata that the user intentionally imports. That transfer must be acceptable to the asset owner. If this utility should never be entrusted with DAM authorization or confidential metadata, remove the integration.

## Verification required before re-enabling

Use a dedicated low-privilege test account and synthetic assets to verify:

- Requested/granted scopes, token lifetime, refresh rotation, logout, and revocation with Bynder.
- Storage before/after authentication, import, close, reload, disconnect, and switching portals/accounts.
- All outbound traffic during login, browse, selection, error, and generated-link click, including Analytics and SDK telemetry.
- The main page cannot read picker credentials and rejects forged, stale, or wrong-origin messages.
- No cross-portal data reuse, and imported fields/URLs do not bypass portal access controls.
- CSP enforcement and login-popup compatibility in supported browsers; least-privilege and revoked users receive the expected denials.

These are release criteria, not checks completed against customer accounts during this review. No actual token expiry, server revocation behavior, or permitted asset set was inferred from the frontend alone.

## Evidence and reproducibility

- Live `index.html` and `script.js` were downloaded and byte-compared with this checkout; both matched.
- The exact SDK URL in `index.html` was downloaded on 2026-11-03. Size: 4,770,751 bytes. SHA-256: `6fbdb4a3e2de770855bd19671f82e43e5a3e48330ea9f88823ce5e0b2f9cad94`. Its response reported last modification on 2026-06-09. Findings refer to these bytes, not necessarily the bundle served when the picker was originally added.
- The exported `open` function was traced into the active authentication hook; token storage was not inferred solely from unused bundled code.
- That exact hook was executed in an isolated Node VM with mocked React state/browser storage and synthetic tokens. Four assertions passed: token/domain persistence; readability by another script in the same execution context; persistence after hook cleanup; and local-token removal on explicit SDK logout. This is a focused function-level validation, not an authenticated browser test.
- Session-local evidence: `/tmp/linkbuilder-ucv.js`, `/tmp/linkbuilder-sdk-headers.txt`, `/tmp/linkbuilder-live-headers.txt`, and `/tmp/linkbuilder-auth-audit.cjs`. Re-run the synthetic check with `node /tmp/linkbuilder-auth-audit.cjs` while those files remain available.
- No demonstrated attribute-injection/XSS exploit was found in the application's metadata insertion path. Existing quote escaping should not be described as a proven bypass; DOM-property assignment remains a worthwhile simplification.
- No real login, asset API calls, credential extraction, consent change, deployment, or application-code modification was performed.
