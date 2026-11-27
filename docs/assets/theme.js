/*
 * Applies the saved or system theme before the first paint.
 *
 * This file is loaded synchronously from <head>, before the body is parsed,
 * so the page never flashes the light theme when the saved theme is dark.
 * Keep it tiny and dependency-free.
 *
 * The docs site requires modern browsers, so it uses const and block scope
 * instead of the older var-based copy this file replaces.
 */
(function () {
    "use strict";

    const THEME_KEY = "bitsy-docs-theme";

    try {
        const stored = localStorage.getItem(THEME_KEY);
        const dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
        const root = document.documentElement;

        root.classList.toggle("theme-dark", dark);
        root.classList.toggle("theme-light", !dark);
        root.style.colorScheme = dark ? "dark" : "light";

        if (dark) {
            document.getElementById("hljs-theme-light").disabled = true;
            document.getElementById("hljs-theme-dark").disabled = false;
        }
    } catch {
        /* storage can be unavailable; keep the light theme for this page view */
    }
})();
