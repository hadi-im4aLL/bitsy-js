/**
 * BitsyJS documentation data.
 *
 * The docs site uses its own library for the shared shell: b-view loads the
 * partials, b-for renders the navigation, b-if filters it and b-on writes the
 * search query. This module is the single source for the navigation and the
 * version shown in the partials.
 */
import { computed, signal } from "./bitsy.min.js";

import { groups as navigationSource, gzip, version } from "./docs-data.js";

/** Active page key taken from the body, for example "features/signals". */
const activeKey = document.body.dataset.doc || "";

/** Active group id, for example "features". */
const activeGroup = activeKey.split("/")[0] || "";

/** Relative prefix back to the docs root. */
const root = activeKey ? "../" : "";

/** Search query for the sidebar. */
const query = signal("");

/** Navigation groups with absolute-from-page-root hrefs and the active flag. */
const groups = navigationSource.map((group) => ({
    ...group,
    items: group.items.map((item) => ({
        ...item,
        href: `../${item.key}.html`,
        current: item.key === activeKey,
    })),
}));

/** Returns true when one nav item matches the current query. */
function matches(item, normalizedQuery) {
    if (!normalizedQuery) {
        return true;
    }

    return `${item.title} ${item.keywords}`.toLowerCase().includes(normalizedQuery);
}

/** Returns the visible items of one group for the current query. */
export function visibleItems(groupId) {
    const normalizedQuery = query().trim().toLowerCase();
    const group = groups.find((entry) => entry.id === groupId);

    return group ? group.items.filter((item) => matches(item, normalizedQuery)) : [];
}

/** Number of items matching the current query, across every group. */
const visibleCount = computed(() => groups.reduce((total, group) => total + visibleItems(group.id).length, 0));

/** Returns the data every docs page passes to its BitsyJS instance. */
export function docsData() {
    return {
        query,
        visibleItems,
        visibleCount,
        activeGroup,
        root,
        version,
        gzip,
    };
}
