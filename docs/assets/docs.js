/*
 * BitsyJS docs template - shared behaviour.
 * Theme, mobile navigation, copy buttons, sidebar filter, on-page TOC.
 * Everything degrades to plain links and static markup without JavaScript.
 */

(function () {
    "use strict";

    const THEME_KEY = "bitsy-docs-theme";
    const LIGHT_CODE_THEME = "hljs-theme-light";
    const DARK_CODE_THEME = "hljs-theme-dark";

    /** Returns true when the stored or system theme is dark. */
    function prefersDark() {
        try {
            const stored = localStorage.getItem(THEME_KEY);
            if (stored === "dark" || stored === "light") {
                return stored === "dark";
            }
        } catch (error) {
            /* storage can be unavailable, fall through to the OS preference */
        }

        return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }

    /** Applies a theme to the document, the toggles and the code theme links. */
    function applyTheme(dark, persist) {
        const root = document.documentElement;

        root.classList.toggle("theme-dark", dark);
        root.classList.toggle("theme-light", !dark);
        root.style.colorScheme = dark ? "dark" : "light";

        document.querySelectorAll("[data-theme-toggle]").forEach(function (button) {
            button.setAttribute("aria-pressed", String(dark));
            button.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
            button.title = dark ? "Switch to light theme" : "Switch to dark theme";
        });

        const lightTheme = document.getElementById(LIGHT_CODE_THEME);
        const darkTheme = document.getElementById(DARK_CODE_THEME);

        if (lightTheme && darkTheme) {
            lightTheme.disabled = dark;
            darkTheme.disabled = !dark;
        }

        const themeColor = document.querySelector('meta[name="theme-color"]');
        if (themeColor) {
            themeColor.setAttribute("content", dark ? "#0b0e13" : "#ffffff");
        }

        if (persist) {
            try {
                localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
            } catch (error) {
                /* the theme still applies for this page view */
            }
        }
    }

    /** Wires every theme toggle on the page. */
    function setupTheme() {
        applyTheme(prefersDark(), false);

        document.querySelectorAll("[data-theme-toggle]").forEach(function (button) {
            button.addEventListener("click", function () {
                applyTheme(!document.documentElement.classList.contains("theme-dark"), true);
            });
        });
    }

    /** Announces a short message to assistive technology. */
    function announce(message) {
        const region = document.getElementById("docs-live");
        if (region) {
            region.textContent = "";
            window.setTimeout(function () {
                region.textContent = message;
            }, 40);
        }
    }

    /** Copies text, preferring the async clipboard API. */
    function copyText(text) {
        return navigator.clipboard && window.isSecureContext
            ? navigator.clipboard.writeText(text).catch(function () {
                  return legacyCopy(text);
              })
            : legacyCopy(text);
    }

    /** Falls back to a hidden textarea when the clipboard API is refused. */
    function legacyCopy(text) {
        return new Promise(function (resolve, reject) {
            const textarea = document.createElement("textarea");
            textarea.value = text;
            textarea.setAttribute("readonly", "");
            textarea.style.position = "fixed";
            textarea.style.opacity = "0";
            document.body.appendChild(textarea);
            textarea.select();

            try {
                const copied = document.execCommand("copy");
                document.body.removeChild(textarea);
                copied ? resolve() : reject(new Error("copy failed"));
            } catch (error) {
                document.body.removeChild(textarea);
                reject(error);
            }
        });
    }

    /** Marks a copy control as copied for a moment. */
    function markCopied(button) {
        const label = button.querySelector("[data-copy-label]");
        const original = label ? label.textContent : "";

        button.classList.add("is-copied");
        if (label) {
            label.textContent = "Copied";
        }

        window.setTimeout(function () {
            button.classList.remove("is-copied");
            if (label) {
                label.textContent = original;
            }
        }, 1600);
    }

    /** Wires every copy control: install strips and code frames. */
    function setupCopyButtons() {
        document.querySelectorAll("[data-copy-target]").forEach(function (button) {
            button.addEventListener("click", function () {
                const target = document.getElementById(button.getAttribute("data-copy-target"));
                if (!target) {
                    return;
                }

                copyText(target.textContent.trim())
                    .then(function () {
                        markCopied(button);
                        announce("Command copied to the clipboard");
                    })
                    .catch(function () {
                        announce("Could not copy the command");
                    });
            });
        });

        document.querySelectorAll("[data-copy-code]").forEach(function (button) {
            button.addEventListener("click", function () {
                const frame = button.closest(".docs-code");
                const code = frame ? frame.querySelector("code") : null;
                if (!code) {
                    return;
                }

                copyText(code.textContent.trim())
                    .then(function () {
                        markCopied(button);
                        announce("Code copied to the clipboard");
                    })
                    .catch(function () {
                        announce("Could not copy the code");
                    });
            });
        });
    }

    /** Opens and closes the small-screen navigation panel. */
    function setupMobileMenu() {
        const button = document.querySelector("[data-menu-button]");
        const panel = document.getElementById("docs-mobile-nav");

        if (!button || !panel) {
            return;
        }

        function setOpen(open) {
            panel.hidden = !open;
            button.setAttribute("aria-expanded", String(open));
            button.setAttribute("aria-label", open ? "Close menu" : "Open menu");
        }

        button.addEventListener("click", function () {
            setOpen(panel.hidden);
        });

        panel.addEventListener("click", function (event) {
            if (event.target.closest("a")) {
                setOpen(false);
            }
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && !panel.hidden) {
                setOpen(false);
                button.focus();
            }
        });

        window.addEventListener("resize", function () {
            if (window.innerWidth >= 860 && !panel.hidden) {
                setOpen(false);
            }
        });
    }

    /** Filters the sidebar navigation on the guide page. */
    function setupSidebarFilter() {
        const input = document.querySelector("[data-doc-search]");
        if (!input) {
            return;
        }

        const items = Array.prototype.slice.call(document.querySelectorAll("[data-nav-item]"));
        const groups = Array.prototype.slice.call(document.querySelectorAll("[data-nav-group]"));
        const empty = document.querySelector("[data-nav-empty]");

        function filter() {
            const query = input.value.trim().toLowerCase();
            let matches = 0;

            items.forEach(function (item) {
                const haystack = item.getAttribute("data-nav-item").toLowerCase();
                const visible = !query || haystack.indexOf(query) !== -1;
                item.hidden = !visible;
                if (visible) {
                    matches += 1;
                }
            });

            groups.forEach(function (group) {
                group.hidden = group.querySelector("[data-nav-item]:not([hidden])") === null;
            });

            if (empty) {
                empty.hidden = matches > 0;
            }
        }

        input.addEventListener("input", filter);

        input.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                input.value = "";
                filter();
                input.blur();
            }
        });

        document.addEventListener("keydown", function (event) {
            const target = event.target;
            const typing =
                target instanceof HTMLElement &&
                (target.tagName === "INPUT" ||
                    target.tagName === "TEXTAREA" ||
                    target.tagName === "SELECT" ||
                    target.isContentEditable);

            if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
                event.preventDefault();
                const details = input.closest("details");
                if (details && !details.open) {
                    details.open = true;
                }
                input.focus();
                input.select();
            }
        });
    }

    /** Closes the mobile browse disclosure after following a link. */
    function setupBrowseLinks() {
        const browse = document.querySelector(".docs-browse");
        if (!browse) {
            return;
        }

        browse.addEventListener("click", function (event) {
            if (event.target.closest("a") && window.innerWidth <= 960) {
                browse.open = false;
            }
        });
    }

    /** Highlights the current section in both on-page tables of contents. */
    function setupScrollSpy() {
        const headings = Array.prototype.slice.call(document.querySelectorAll(".docs-prose h2[id]"));
        const links = Array.prototype.slice.call(document.querySelectorAll("[data-toc-link]"));

        if (headings.length === 0 || links.length === 0) {
            return;
        }

        function setActive(id) {
            links.forEach(function (link) {
                const active = link.getAttribute("href") === "#" + id;
                link.classList.toggle("is-active", active);
                if (active) {
                    link.setAttribute("aria-current", "true");
                } else {
                    link.removeAttribute("aria-current");
                }
            });
        }

        function update() {
            const header = document.querySelector(".docs-header");
            const offset = (header ? header.getBoundingClientRect().bottom : 0) + 24;
            let current = headings[0].id;

            headings.forEach(function (heading) {
                if (heading.getBoundingClientRect().top <= offset + 4) {
                    current = heading.id;
                }
            });

            setActive(current);
        }

        let frame = 0;
        function onScroll() {
            if (frame) {
                return;
            }
            frame = window.requestAnimationFrame(function () {
                frame = 0;
                update();
            });
        }

        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        update();
    }

    /** Runs highlight.js when the page includes it. */
    function setupHighlighting() {
        if (window.hljs && typeof window.hljs.highlightAll === "function") {
            window.hljs.highlightAll();
        }
    }

    setupTheme();
    setupHighlighting();
    setupCopyButtons();
    setupMobileMenu();
    setupSidebarFilter();
    setupBrowseLinks();
    setupScrollSpy();
})();
