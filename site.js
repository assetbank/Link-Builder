'use strict';

// Run in the head so the saved theme is applied before the first paint.
const themeKey = 'link-builder-theme';
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
function readTheme() {
    try {
        const value = localStorage.getItem(themeKey);
        return value === 'light' || value === 'dark' ? value : null;
    } catch { return null; }
}
let themePreference = readTheme();
let themeRevision = 0;
function applyTheme() {
    const dark = themePreference ? themePreference === 'dark' : systemTheme.matches;
    const root = document.documentElement;
    const theme = dark ? 'dark' : 'light';
    if (root.dataset.theme && root.dataset.theme !== theme) {
        // Change text and surfaces together, then restore normal hover transitions.
        root.classList.add('theme-changing');
        const revision = ++themeRevision;
        requestAnimationFrame(() => requestAnimationFrame(() => {
            if (revision === themeRevision) root.classList.remove('theme-changing');
        }));
    }
    root.dataset.theme = theme;
    const toggle = document.querySelector('.theme-toggle');
    if (toggle) {
        toggle.setAttribute('aria-pressed', String(dark));
        toggle.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
    }
}
applyTheme();
systemTheme.addEventListener('change', applyTheme);
window.addEventListener('storage', event => {
    if (event.key === themeKey || event.key === null) {
        themePreference = readTheme();
        applyTheme();
    }
});
window.addEventListener('pageshow', event => {
    if (event.persisted) {
        themePreference = readTheme();
        applyTheme();
    }
});

// Remove credentials and portal preferences left by the previous UCV integration.
// This clears local copies; it does not revoke historical server-side grants.
try {
    for (const key of ['cvrt', 'cvad', 'cvp', 'jwt', 'jwt_expiry', 'jwt_loading', 'jwt_access_token']) {
        localStorage.removeItem(key);
    }
} catch { /* Storage may be disabled by the browser. */ }

document.addEventListener('DOMContentLoaded', () => {
    applyTheme();
    document.querySelector('.theme-toggle')?.addEventListener('click', () => {
        themePreference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem(themeKey, themePreference); } catch { /* Keep the choice for this page when storage is unavailable. */ }
        applyTheme();
    });
    const header = document.querySelector('.header');
    let lastScrollY = window.scrollY;
    window.addEventListener('scroll', () => {
        header?.classList.toggle('hidden', window.scrollY > lastScrollY);
        lastScrollY = window.scrollY;
    }, { passive: true });
});
