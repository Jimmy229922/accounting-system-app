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

function normalizePath(value) {
    return String(value || '').replace(/\\/g, '/').toLowerCase();
}

function isRunningInsideShellFrame() {
    try {
        return Boolean(window.top && window.top !== window && typeof window.top.__shellNavigate === 'function');
    } catch (_err) {
        return false;
    }
}

function tryShellNavigation(targetHref) {
    try {
        if (window.top && window.top !== window && typeof window.top.__shellNavigate === 'function') {
            return window.top.__shellNavigate(targetHref) === true;
        }

        if (typeof window.__shellNavigate === 'function') {
            return window.__shellNavigate(targetHref) === true;
        }
    } catch (_err) {
        // Ignore shell bridge errors and fallback to default navigation.
    }

    return false;
}

window.__navigateWithinShell = tryShellNavigation;

function resolveViewsPrefix(pathname = window.location.pathname) {
    const normalized = normalizePath(pathname);
    if (normalized.includes('/views/reports/debtor-creditor/')) {
        return '../../';
    }
    return '../';
}

function buildTopNavItems(prefix) {
    const withPrefix = (target) => `${prefix}${target}`;
    return [
        { key: 'common.nav.dashboard', fallback: 'Dashboard', href: withPrefix('dashboard/index.html') },
        {
            key: 'common.nav.masterData',
            fallback: 'Master Data',
            children: [
                { key: 'common.nav.units', fallback: 'Units', href: withPrefix('items/units.html') },
                { key: 'common.nav.items', fallback: 'Items', href: withPrefix('items/items.html') },
                { key: 'common.nav.customersSuppliers', fallback: 'Customers & Suppliers', href: withPrefix('customers/index.html') },
                { key: 'common.nav.openingBalance', fallback: 'Opening Balance', href: withPrefix('opening-balance/index.html') },
                { key: 'common.nav.userManagement', fallback: 'User Management', href: withPrefix('auth-users/index.html') }
            ]
        },
        {
            key: 'common.nav.sales',
            fallback: 'Sales',
            children: [
                { key: 'common.nav.salesInvoice', fallback: 'Sales Invoice', href: withPrefix('sales/index.html') },
                { key: 'common.nav.salesReturns', fallback: 'Sales Returns', href: withPrefix('sales-returns/index.html') }
            ]
        },
        {
            key: 'common.nav.purchases',
            fallback: 'Purchases',
            children: [
                { key: 'common.nav.purchaseInvoice', fallback: 'Purchase Invoice', href: withPrefix('purchases/index.html') },
                { key: 'common.nav.purchaseReturns', fallback: 'Purchase Returns', href: withPrefix('purchase-returns/index.html') }
            ]
        },
        { key: 'common.nav.inventory', fallback: 'Inventory', href: withPrefix('inventory/index.html') },
        { key: 'common.nav.finance', fallback: 'Finance', href: withPrefix('finance/index.html') },
        { key: 'common.nav.receipt', fallback: 'Receipt', href: withPrefix('payments/receipt.html') },
        { key: 'common.nav.payment', fallback: 'Payment', href: withPrefix('payments/payment.html') },
        {
            key: 'common.nav.reports',
            fallback: 'Reports',
            children: [
                { key: 'common.nav.generalReports', fallback: 'General Reports', href: withPrefix('reports/index.html') },
                { key: 'common.nav.customerReports', fallback: 'Customer Reports', href: withPrefix('customer-reports/index.html') },
                { key: 'common.nav.debtorCreditor', fallback: 'Debtor & Creditor', href: withPrefix('reports/debtor-creditor/index.html') }
            ]
        },
        { key: 'common.nav.settings', fallback: 'Settings', href: withPrefix('settings/index.html') }
    ];
}

function isTopNavLinkActive(href) {
    if (!href) return false;
    try {
        const current = normalizePath(window.location.pathname);
        const target = normalizePath(new URL(href, window.location.href).pathname);
        return current.endsWith(target);
    } catch (_) {
        return false;
    }
}

function buildTopNavLink(item, t) {
    const activeClass = isTopNavLinkActive(item.href) ? ' class="active"' : '';
    return `<li><a href="${item.href}"${activeClass}>${t(item.key, item.fallback)}</a></li>`;
}

function buildTopNavDropdown(item, t) {
    const hasActiveChild = item.children.some((child) => isTopNavLinkActive(child.href));
    const activeClass = hasActiveChild ? ' class="active"' : '';
    const childrenHtml = item.children
        .map((child) => {
            const childActive = isTopNavLinkActive(child.href) ? ' class="active"' : '';
            return `<a href="${child.href}"${childActive}>${t(child.key, child.fallback)}</a>`;
        })
        .join('');

    return `
        <li class="dropdown">
            <a href="#"${activeClass}>${t(item.key, item.fallback)}</a>
            <div class="dropdown-content">
                ${childrenHtml}
            </div>
        </li>
    `;
}

function getTopNavHTML(t, options = {}) {
    if (isRunningInsideShellFrame()) {
        return '';
    }

    const translate = typeof t === 'function' ? t : ((_, fallback = '') => fallback);
    const basePrefix = options.basePrefix || resolveViewsPrefix(options.pathname);
    const wrap = options.wrap !== false;

    const items = buildTopNavItems(basePrefix);
    const linksHtml = items
        .map((item) => (item.children ? buildTopNavDropdown(item, translate) : buildTopNavLink(item, translate)))
        .join('');

    const innerHtml = `
        <div class="nav-brand">${translate('common.nav.brand', 'Accounting System')}</div>
        <ul class="nav-links">${linksHtml}</ul>
    `;

    if (!wrap) {
        return innerHtml;
    }

    return `<nav class="top-nav">${innerHtml}</nav>`;
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
    renderNavigation,
    getTopNavItems: buildTopNavItems,
    resolveViewsPrefix,
    getTopNavHTML
};

document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    // Handle only top navbar links
    const link = e.target.closest('.top-nav a');
    if (!link) return;
    
    const href = link.getAttribute('href');
    if (!href || href === '#' || href.startsWith('javascript:')) return;

    const currentUrl = new URL(window.location.href);
    const targetUrl = new URL(link.href, window.location.href);
    const isSamePage =
        normalizePath(currentUrl.pathname) === normalizePath(targetUrl.pathname) &&
        currentUrl.search === targetUrl.search &&
        currentUrl.hash === targetUrl.hash;

    if (isSamePage) {
        e.preventDefault();
        return;
    }

    // Navigate immediately without delay
    e.preventDefault();
    if (!tryShellNavigation(targetUrl.href)) {
        window.location.href = targetUrl.href;
    }
});
