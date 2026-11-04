'use strict';

// Remove credentials and portal preferences left by the previous UCV integration.
// This clears local copies; it does not revoke historical server-side grants.
try {
    for (const key of ['cvrt', 'cvad', 'cvp', 'jwt', 'jwt_expiry', 'jwt_loading', 'jwt_access_token']) {
        localStorage.removeItem(key);
    }
} catch { /* Storage may be disabled by the browser. */ }

document.addEventListener('DOMContentLoaded', () => {
    const logo = document.querySelector('.logo');
    logo?.addEventListener('click', () => window.open('https://support.bynder.com', '_blank', 'noopener,noreferrer'));
    const header = document.querySelector('.header');
    let lastScrollY = window.scrollY;
    window.addEventListener('scroll', () => {
        header?.classList.toggle('hidden', window.scrollY > lastScrollY);
        lastScrollY = window.scrollY;
    }, { passive: true });
    document.getElementById(location.pathname.startsWith('/terms') ? 'nav-terms' : 'nav-home')?.classList.add('active');
});
