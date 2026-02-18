async function loadNavigation(configPath = '../../assets/config/navigation.json') {
    const response = await fetch(configPath);
    if (!response.ok) {
        throw new Error(`Failed to load navigation config: ${response.status}`);
    }
    return response.json();
}

function isActiveLink(href) {
    if (!href) return false;
    const current = window.location.pathname.replace(/\\/g, '/');
    const target = new URL(href, window.location.href).pathname.replace(/\\/g, '/');
    return current.endsWith(target);
}

function buildNavigationHtml(items) {
    return items
        .map((item) => {
            const activeClass = isActiveLink(item.href) ? 'active' : '';
            return `<a class="nav-item ${activeClass}" href="${item.href}" data-nav-id="${item.id}">${item.label}</a>`;
        })
        .join('');
}

async function renderNavigation(targetSelector, configPath) {
    const target = document.querySelector(targetSelector);
    if (!target) return;

    try {
        const items = await loadNavigation(configPath);
        target.innerHTML = buildNavigationHtml(items);
    } catch (error) {
        console.error('[navManager] failed to render navigation', error);
    }
}

window.navManager = {
    loadNavigation,
    renderNavigation
};
