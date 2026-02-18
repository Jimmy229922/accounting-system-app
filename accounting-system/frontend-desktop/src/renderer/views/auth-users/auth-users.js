let authUsersForm, authUsernameInput, authPasswordInput, authConfirmPasswordInput, authActivateNowInput;
let authUsersStatusEl, authUsersTableWrap, authUsersNotice;
let authUsersTotalStat, authUsersActiveStat, authUsersInactiveStat, authUsersTableMeta;
let ar = {};

const AUTH_SESSION_KEY = 'auth_session_token';

function t(key, fallback = '') {
    if (window.i18n && typeof window.i18n.getText === 'function') {
        return window.i18n.getText(ar, key, fallback);
    }
    return fallback;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function getAuthSessionToken() {
    try {
        if (window.electronAPI && typeof window.electronAPI.getAuthSessionToken === 'function') {
            const tokenFromMain = await window.electronAPI.getAuthSessionToken();
            if (tokenFromMain) {
                return tokenFromMain;
            }
        }
    } catch (error) {
        // Fallback to localStorage below.
    }

    try {
        return localStorage.getItem(AUTH_SESSION_KEY) || '';
    } catch (error) {
        return '';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    if (window.i18n && typeof window.i18n.loadArabicDictionary === 'function') {
        ar = await window.i18n.loadArabicDictionary();
    }

    renderPage();
    initializeElements();
    await loadAuthUsersSection();
});

function renderPage() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <nav class="top-nav">
            <div class="nav-brand">${t('common.nav.brand')}</div>
            <ul class="nav-links">
                <li><a href="../dashboard/index.html">${t('common.nav.dashboard')}</a></li>
                <li class="dropdown">
                    <a href="#">${t('common.nav.masterData')}</a>
                    <div class="dropdown-content">
                        <a href="../items/units.html">${t('common.nav.units')}</a>
                        <a href="../items/items.html">${t('common.nav.items')}</a>
                        <a href="../customers/index.html">${t('common.nav.customersSuppliers')}</a>
                        <a href="../opening-balance/index.html">${t('common.nav.openingBalance')}</a>
                        <a href="../auth-users/index.html" class="active">${t('common.nav.userManagement', 'إدارة المستخدمين')}</a>
                    </div>
                </li>
                <li class="dropdown">
                    <a href="#">${t('common.nav.sales')}</a>
                    <div class="dropdown-content">
                        <a href="../sales/index.html">${t('common.nav.salesInvoice')}</a>
                        <a href="../sales-returns/index.html">${t('common.nav.salesReturns')}</a>
                    </div>
                </li>
                <li class="dropdown">
                    <a href="#">${t('common.nav.purchases')}</a>
                    <div class="dropdown-content">
                        <a href="../purchases/index.html">${t('common.nav.purchaseInvoice')}</a>
                        <a href="../purchase-returns/index.html">${t('common.nav.purchaseReturns')}</a>
                    </div>
                </li>
                <li><a href="../inventory/index.html">${t('common.nav.inventory')}</a></li>
                <li><a href="../finance/index.html">${t('common.nav.finance')}</a></li>
                <li><a href="../payments/receipt.html">${t('common.nav.receipt')}</a></li>
                <li><a href="../payments/payment.html">${t('common.nav.payment')}</a></li>
                <li class="dropdown">
                    <a href="#">${t('common.nav.reports')}</a>
                    <div class="dropdown-content">
                        <a href="../reports/index.html">${t('common.nav.generalReports')}</a>
                        <a href="../customer-reports/index.html">${t('common.nav.customerStatement')}</a>
                        <a href="../reports/debtor-creditor/index.html">${t('common.nav.debtorCreditor')}</a>
                    </div>
                </li>
                <li><a href="../settings/index.html">${t('common.nav.settings')}</a></li>
            </ul>
        </nav>

        <main class="content">
            <div class="users-page">
                <section class="users-hero">
                    <div class="users-hero-main">
                        <div class="users-hero-icon" aria-hidden="true"><i class="fas fa-user-shield"></i></div>
                        <div>
                            <h1>${t('authUsers.title', 'إدارة المستخدمين')}</h1>
                            <p class="users-subtitle">${t('authUsers.subtitle', 'إدارة حسابات الموظفين (إضافة، تفعيل/تعطيل، وتغيير كلمة المرور).')}</p>
                        </div>
                    </div>
                    <div class="users-hero-stats">
                        <div class="users-stat-card">
                            <span>${t('authUsers.stats.total', 'إجمالي الحسابات')}</span>
                            <strong id="authUsersTotalStat">0</strong>
                        </div>
                        <div class="users-stat-card stat-active">
                            <span>${t('authUsers.stats.active', 'الحسابات المفعلة')}</span>
                            <strong id="authUsersActiveStat">0</strong>
                        </div>
                        <div class="users-stat-card stat-inactive">
                            <span>${t('authUsers.stats.inactive', 'الحسابات غير المفعلة')}</span>
                            <strong id="authUsersInactiveStat">0</strong>
                        </div>
                    </div>
                </section>

                <div id="authUsersNotice" class="users-notice notice-info">${t('authUsers.loadingPermissions', 'جارٍ تحميل صلاحيات الحساب...')}</div>

                <div id="authUsersAdminPanel" hidden>
                    <section class="users-card">
                        <div class="users-card-head">
                            <h2>${t('authUsers.addUser', 'إضافة مستخدم')}</h2>
                            <span class="users-card-hint">${t('authUsers.formHint', 'املأ البيانات ثم اضغط إضافة.')}</span>
                        </div>

                        <form id="authUsersForm" class="users-form">
                            <div class="form-group">
                                <label for="authUsername">${t('authUsers.username', 'اسم المستخدم')}</label>
                                <input id="authUsername" type="text" class="form-control" autocomplete="off" required>
                            </div>
                            <div class="form-group">
                                <label for="authPassword">${t('authUsers.password', 'كلمة المرور')}</label>
                                <input id="authPassword" type="password" class="form-control" autocomplete="new-password" required>
                            </div>
                            <div class="form-group">
                                <label for="authConfirmPassword">${t('authUsers.confirmPassword', 'تأكيد كلمة المرور')}</label>
                                <input id="authConfirmPassword" type="password" class="form-control" autocomplete="new-password" required>
                            </div>
                            <div class="users-form-actions">
                                <label class="form-check-line" for="authActivateNow">
                                    <input id="authActivateNow" type="checkbox" checked>
                                    ${t('authUsers.activateNow', 'تفعيل الحساب مباشرة بعد الإنشاء')}
                                </label>
                                <button type="submit" class="btn-secondary users-submit-btn">
                                    <i class="fas fa-user-plus" aria-hidden="true"></i>
                                    <span>${t('authUsers.addUser', 'إضافة مستخدم')}</span>
                                </button>
                            </div>
                        </form>
                    </section>

                    <small id="authUsersStatus" class="status-text"></small>

                    <section class="users-card users-list-card">
                        <div class="users-card-head">
                            <h2>${t('authUsers.listTitle', 'قائمة المستخدمين')}</h2>
                            <span id="authUsersTableMeta" class="users-table-meta">${t('authUsers.tableMeta', 'يتم عرض 0 مستخدم')}</span>
                        </div>
                        <div id="authUsersTableWrap" class="users-table-wrap"></div>
                    </section>
                </div>
            </div>
        </main>
    `;
}

function initializeElements() {
    authUsersForm = document.getElementById('authUsersForm');
    authUsernameInput = document.getElementById('authUsername');
    authPasswordInput = document.getElementById('authPassword');
    authConfirmPasswordInput = document.getElementById('authConfirmPassword');
    authActivateNowInput = document.getElementById('authActivateNow');
    authUsersStatusEl = document.getElementById('authUsersStatus');
    authUsersTableWrap = document.getElementById('authUsersTableWrap');
    authUsersNotice = document.getElementById('authUsersNotice');
    authUsersTotalStat = document.getElementById('authUsersTotalStat');
    authUsersActiveStat = document.getElementById('authUsersActiveStat');
    authUsersInactiveStat = document.getElementById('authUsersInactiveStat');
    authUsersTableMeta = document.getElementById('authUsersTableMeta');

    if (authUsersForm) {
        authUsersForm.addEventListener('submit', handleCreateAuthUser);
    }
}

function setNotice(message, type = 'info') {
    if (!authUsersNotice) return;
    authUsersNotice.textContent = message || '';
    authUsersNotice.classList.remove('notice-info', 'notice-success', 'notice-warning', 'notice-error');
    authUsersNotice.classList.add(`notice-${type}`);
}

function setStatus(element, message, type = 'info') {
    if (!element) return;
    element.textContent = message || '';
    element.classList.remove('status-info', 'status-success', 'status-error');

    if (!message) return;
    if (type === 'error') {
        element.classList.add('status-error');
        return;
    }
    if (type === 'success') {
        element.classList.add('status-success');
        return;
    }
    element.classList.add('status-info');
}

function updateUsersStats(users = []) {
    const safeUsers = Array.isArray(users) ? users : [];
    const total = safeUsers.length;
    const active = safeUsers.filter((user) => Boolean(user?.isActive)).length;
    const inactive = total - active;

    if (authUsersTotalStat) authUsersTotalStat.textContent = total.toString();
    if (authUsersActiveStat) authUsersActiveStat.textContent = active.toString();
    if (authUsersInactiveStat) authUsersInactiveStat.textContent = inactive.toString();
    if (authUsersTableMeta) {
        authUsersTableMeta.textContent = t('authUsers.tableMeta', 'يتم عرض {count} مستخدم').replace('{count}', total);
    }
}

async function loadAuthUsersSection() {
    const api = window.electronAPI || {};
    const adminPanel = document.getElementById('authUsersAdminPanel');
    const sessionToken = await getAuthSessionToken();

    if (!api.getActiveAuthUser || !api.getAuthUsers) {
        setNotice(t('authUsers.notAvailable', 'إدارة المستخدمين غير متاحة في هذا الإصدار.'), 'error');
        updateUsersStats([]);
        return;
    }

    if (!sessionToken) {
        setNotice(t('authUsers.sessionExpired', 'جلسة الدخول غير متاحة. يرجى تسجيل الدخول مرة أخرى.'), 'warning');
        updateUsersStats([]);
        return;
    }

    try {
        const activeUser = await api.getActiveAuthUser({ sessionToken });
        if (!activeUser) {
            setNotice(t('authUsers.loginRequired', 'يرجى تسجيل الدخول مرة أخرى.'), 'warning');
            updateUsersStats([]);
            return;
        }

        if (!activeUser.isAdmin) {
            setNotice(t('authUsers.notAdmin', 'حسابك ليس أدمن. إدارة المستخدمين متاحة لحساب الأدمن فقط.'), 'warning');
            updateUsersStats([]);
            return;
        }

        setNotice(t('authUsers.currentAdmin', 'الأدمن الحالي: {username}').replace('{username}', activeUser.username), 'success');
        if (adminPanel) {
            adminPanel.hidden = false;
        }
        await refreshAuthUsers();
    } catch (error) {
        setNotice(t('authUsers.loadError', 'حدث خطأ أثناء تحميل المستخدمين.'), 'error');
        setStatus(authUsersStatusEl, error.message || 'خطأ غير متوقع', 'error');
        updateUsersStats([]);
    }
}

function formatDateForUi(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('ar-EG');
}

function renderAuthUsersTable(users, activeUserId) {
    if (!authUsersTableWrap) return;

    if (!Array.isArray(users) || users.length === 0) {
        authUsersTableWrap.innerHTML = `
            <div class="users-empty">
                <i class="fas fa-user-slash" aria-hidden="true"></i>
                <span>${t('authUsers.noUsers', 'لا يوجد مستخدمون.')}</span>
            </div>
        `;
        return;
    }

    const rows = users.map((user) => {
        const isCurrent = Number(user.id) === Number(activeUserId);
        const roleText = user.isAdmin ? t('authUsers.admin', 'أدمن') : t('authUsers.employee', 'موظف');
        const statusText = user.isActive ? t('authUsers.active', 'مفعل') : t('authUsers.inactive', 'غير مفعل');
        const toggleText = user.isActive ? t('authUsers.deactivate', 'تعطيل') : t('authUsers.activate', 'تفعيل');
        const toggleClass = user.isActive ? 'btn-warning btn-sm' : 'btn-secondary btn-sm';
        const toggleIcon = user.isActive ? 'fa-user-slash' : 'fa-user-check';
        const disableToggle = isCurrent && user.isActive ? 'disabled' : '';
        const roleClass = user.isAdmin ? 'chip-admin' : 'chip-employee';
        const statusClass = user.isActive ? 'chip-active' : 'chip-inactive';
        const currentTag = isCurrent ? `<span class="users-you-tag">${t('authUsers.you', '(أنت)')}</span>` : '';
        const safeUsername = escapeHtml(user.username);

        return `
            <tr class="${isCurrent ? 'is-current-user' : ''}">
                <td>
                    <div class="user-name-cell">
                        <span class="user-name">${safeUsername}</span>
                        ${currentTag}
                    </div>
                </td>
                <td><span class="users-chip ${roleClass}">${roleText}</span></td>
                <td><span class="users-chip ${statusClass}">${statusText}</span></td>
                <td>${formatDateForUi(user.lastLoginAt)}</td>
                <td class="users-actions-cell">
                    <button type="button" class="${toggleClass}" data-action="toggle" data-id="${user.id}" data-active="${user.isActive ? 1 : 0}" ${disableToggle}>
                        <i class="fas ${toggleIcon}" aria-hidden="true"></i>
                        <span>${toggleText}</span>
                    </button>
                    <button type="button" class="btn-secondary btn-sm" data-action="reset-password" data-id="${user.id}">
                        <i class="fas fa-key" aria-hidden="true"></i>
                        <span>${t('authUsers.changePassword', 'تغيير كلمة السر')}</span>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    authUsersTableWrap.innerHTML = `
        <table class="users-table">
            <thead>
                <tr>
                    <th>${t('authUsers.tableHeaders.username', 'اسم المستخدم')}</th>
                    <th>${t('authUsers.tableHeaders.role', 'النوع')}</th>
                    <th>${t('authUsers.tableHeaders.status', 'الحالة')}</th>
                    <th>${t('authUsers.tableHeaders.lastLogin', 'آخر دخول')}</th>
                    <th>${t('authUsers.tableHeaders.actions', 'إجراءات')}</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;

    authUsersTableWrap.querySelectorAll('button[data-action="toggle"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const userId = Number(btn.dataset.id);
            const currentlyActive = Number(btn.dataset.active) === 1;
            await handleToggleAuthUser(userId, !currentlyActive);
        });
    });

    authUsersTableWrap.querySelectorAll('button[data-action="reset-password"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const userId = Number(btn.dataset.id);
            await handleResetAuthUserPassword(userId);
        });
    });
}

async function refreshAuthUsers() {
    const sessionToken = await getAuthSessionToken();
    if (!sessionToken) {
        setStatus(authUsersStatusEl, t('authUsers.toast.sessionExpired', 'انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى.'), 'error');
        updateUsersStats([]);
        return;
    }

    setStatus(authUsersStatusEl, t('authUsers.toast.loadingUsers', 'جارٍ تحميل المستخدمين...'), 'info');
    const result = await window.electronAPI.getAuthUsers({ sessionToken });
    if (!result.success) {
        setStatus(authUsersStatusEl, result.error || t('authUsers.toast.loadError', 'تعذر تحميل المستخدمين.'), 'error');
        updateUsersStats([]);
        return;
    }

    renderAuthUsersTable(result.users, result.activeUserId);
    updateUsersStats(result.users);
    setStatus(
        authUsersStatusEl,
        t('authUsers.toast.totalUsers', 'إجمالي المستخدمين: {count}').replace('{count}', result.users.length),
        'success'
    );
}

async function handleCreateAuthUser(event) {
    event.preventDefault();
    setStatus(authUsersStatusEl, '');
    const sessionToken = await getAuthSessionToken();

    if (!sessionToken) {
        setStatus(authUsersStatusEl, t('authUsers.toast.sessionExpired', 'انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى.'), 'error');
        return;
    }

    const username = (authUsernameInput?.value || '').trim();
    const password = authPasswordInput?.value || '';
    const confirmPassword = authConfirmPasswordInput?.value || '';
    const isActive = Boolean(authActivateNowInput?.checked);

    if (!username || !password) {
        setStatus(authUsersStatusEl, t('authUsers.toast.usernamePasswordRequired', 'يرجى إدخال اسم المستخدم وكلمة المرور.'), 'error');
        return;
    }

    if (password !== confirmPassword) {
        setStatus(authUsersStatusEl, t('authUsers.toast.passwordMismatch', 'كلمة المرور وتأكيدها غير متطابقين.'), 'error');
        return;
    }

    const result = await window.electronAPI.createAuthUser({ sessionToken, username, password, isActive });
    if (!result.success) {
        setStatus(authUsersStatusEl, result.error || t('authUsers.toast.createError', 'تعذر إضافة المستخدم.'), 'error');
        return;
    }

    authUsersForm.reset();
    if (authActivateNowInput) {
        authActivateNowInput.checked = true;
    }

    setStatus(
        authUsersStatusEl,
        t('authUsers.toast.createSuccess', 'تم إنشاء المستخدم {username} بنجاح.').replace('{username}', result.user?.username || username),
        'success'
    );
    await refreshAuthUsers();
}

async function handleToggleAuthUser(userId, isActive) {
    const sessionToken = await getAuthSessionToken();
    if (!sessionToken) {
        setStatus(authUsersStatusEl, t('authUsers.toast.sessionExpired', 'انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى.'), 'error');
        return;
    }

    const actionText = isActive ? t('authUsers.activate', 'تفعيل') : t('authUsers.deactivate', 'تعطيل');
    setStatus(authUsersStatusEl, t('authUsers.toast.activating', 'جارٍ {action} المستخدم...').replace('{action}', actionText), 'info');

    const result = await window.electronAPI.setAuthUserActive({ sessionToken, userId, isActive });
    if (!result.success) {
        setStatus(authUsersStatusEl, result.error || t('authUsers.toast.toggleError', 'تعذر {action} المستخدم.').replace('{action}', actionText), 'error');
        return;
    }

    setStatus(authUsersStatusEl, t('authUsers.toast.toggleSuccess', 'تم {action} المستخدم بنجاح.').replace('{action}', actionText), 'success');
    await refreshAuthUsers();
}

async function handleResetAuthUserPassword(userId) {
    const newPassword = prompt(t('authUsers.newPasswordPrompt', 'اكتب كلمة المرور الجديدة (6 أحرف أو أكثر):'));
    if (newPassword === null) {
        return;
    }

    const sessionToken = await getAuthSessionToken();
    if (!sessionToken) {
        setStatus(authUsersStatusEl, t('authUsers.toast.sessionExpired', 'انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى.'), 'error');
        return;
    }

    setStatus(authUsersStatusEl, t('authUsers.toast.updatingPassword', 'جارٍ تحديث كلمة المرور...'), 'info');
    const result = await window.electronAPI.resetAuthUserPassword({ sessionToken, userId, newPassword });
    if (!result.success) {
        setStatus(authUsersStatusEl, result.error || t('authUsers.toast.passwordUpdateError', 'تعذر تحديث كلمة المرور.'), 'error');
        return;
    }

    setStatus(authUsersStatusEl, t('authUsers.toast.passwordUpdateSuccess', 'تم تحديث كلمة المرور بنجاح.'), 'success');
    await refreshAuthUsers();
}

