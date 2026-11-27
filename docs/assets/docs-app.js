import { computed, signal } from "./bitsy.min.js";

import { cdn, groups as navigationSource, gzip, version } from "./docs-data.js";

const activeKey = document.body.dataset.doc || "";

const activeGroup = activeKey.split("/")[0] || "";

const root = activeKey ? "../" : "";

const query = signal("");

const groups = navigationSource.map((group) => ({
    ...group,
    items: group.items.map((item) => ({
        ...item,
        href: `../${item.key}.html`,
        current: item.key === activeKey,
    })),
}));

function matches(item, normalizedQuery) {
    if (!normalizedQuery) {
        return true;
    }

    return `${item.title} ${item.keywords}`.toLowerCase().includes(normalizedQuery);
}

export function visibleItems(groupId) {
    const normalizedQuery = query().trim().toLowerCase();
    const group = groups.find((entry) => entry.id === groupId);

    return group ? group.items.filter((item) => matches(item, normalizedQuery)) : [];
}

const visibleCount = computed(() => groups.reduce((total, group) => total + visibleItems(group.id).length, 0));

export function docsData() {
    return {
        query,
        visibleItems,
        visibleCount,
        activeGroup,
        root,
        version,
        gzip,
        cdn,
    };
}
