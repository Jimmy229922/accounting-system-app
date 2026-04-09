let authUsersForm, authUsernameInput, authPasswordInput, authConfirmPasswordInput, authActivateNowInput;
let authUsersStatusEl, authUsersTableWrap, authUsersNotice;
let authUsersTotalStat, authUsersActiveStat, authUsersInactiveStat, authUsersTableMeta;
let ar = {};
const pageI18n = window.i18n?.createPageHelpers ? window.i18n.createPageHelpers(() => ar) : null;

const AUTH_SESSION_KEY = 'auth_session_token';

function t(key, fallback = '') {
    return pageI18n ? pageI18n.t(key, fallback) : fallback;
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

            <!-- Password Reset Modal -->
            <div id="resetPasswordModal" class="rp-modal-overlay">
                <div class="rp-modal">
                    <div class="rp-modal-header">
                        <h3><i class="fas fa-key"></i> ${t('authUsers.changePassword', 'تغيير كلمة السر')}</h3>
                        <button type="button" class="rp-modal-close" id="rpModalClose">&times;</button>
                    </div>
                    <form id="resetPasswordForm" class="rp-modal-body">
                        <input type="hidden" id="rpUserId" value="">
                        <div class="form-group">
                            <label for="rpNewPassword">${t('authUsers.newPassword', 'كلمة المرور الجديدة')}</label>
                            <input id="rpNewPassword" type="password" class="form-control" autocomplete="new-password" minlength="6" required>
                        </div>
                        <div class="form-group">
                            <label for="rpConfirmPassword">${t('authUsers.confirmNewPassword', 'تأكيد كلمة المرور الجديدة')}</label>
                            <input id="rpConfirmPassword" type="password" class="form-control" autocomplete="new-password" minlength="6" required>
                        </div>
                        <div class="rp-modal-actions">
                            <button type="submit" class="btn-secondary users-submit-btn">
                                <i class="fas fa-check"></i> ${t('authUsers.savePassword', 'حفظ كلمة المرور')}
                            </button>
                            <button type="button" class="btn-cancel" id="rpModalCancel">${t('common.cancel', 'إلغاء')}</button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- Permissions Modal -->
            <div id="permissionsModal" class="rp-modal-overlay">
                <div class="rp-modal perm-modal">
                    <div class="rp-modal-header">
                        <h3><i class="fas fa-shield-alt"></i> ${t('authUsers.permissions.manage', 'إدارة الصلاحيات')} — <span id="permUserName"></span></h3>
                        <button type="button" class="rp-modal-close" id="permModalClose">&times;</button>
                    </div>
                    <div class="rp-modal-body perm-modal-body">
                        <input type="hidden" id="permUserId" value="">
                        <div id="permAdminNote" class="perm-admin-note" style="display:none;">
                            <i class="fas fa-info-circle"></i> ${t('authUsers.permissions.adminNote', 'حسابات الأدمن تمتلك جميع الصلاحيات تلقائياً.')}
                        </div>
                        <div class="perm-actions-row">
                            <button type="button" class="btn-sm btn-secondary" id="permSelectAll">
                                <i class="fas fa-check-double"></i> ${t('authUsers.permissions.selectAll', 'تحديد الكل')}
                            </button>
                            <button type="button" class="btn-sm btn-secondary" id="permDeselectAll">
                                <i class="fas fa-times"></i> ${t('authUsers.permissions.deselectAll', 'إلغاء تحديد الكل')}
                            </button>
                        </div>
                        <div class="perm-table-wrap">
                            <table class="perm-table">
                                <thead>
                                    <tr>
                                        <th>${t('authUsers.permissions.page', 'الصفحة')}</th>
                                        <th>${t('authUsers.permissions.view', 'عرض')}</th>
                                        <th>${t('authUsers.permissions.add', 'إضافة')}</th>
                                        <th>${t('authUsers.permissions.edit', 'تعديل')}</th>
                                        <th>${t('authUsers.permissions.delete', 'حذف')}</th>
                                    </tr>
                                </thead>
                                <tbody id="permTableBody"></tbody>
                            </table>
                        </div>
                        <div class="rp-modal-actions">
                            <button type="button" class="btn-secondary users-submit-btn" id="permSaveBtn">
                                <i class="fas fa-save"></i> ${t('authUsers.permissions.save', 'حفظ الصلاحيات')}
                            </button>
                            <button type="button" class="btn-cancel" id="permModalCancel">${t('common.cancel', 'إلغاء')}</button>
                        </div>
                    </div>
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

    // Password reset modal events
    const rpModal = document.getElementById('resetPasswordModal');
    const rpForm = document.getElementById('resetPasswordForm');
    const rpCloseBtn = document.getElementById('rpModalClose');
    const rpCancelBtn = document.getElementById('rpModalCancel');

    if (rpCloseBtn) rpCloseBtn.addEventListener('click', closeResetPasswordModal);
    if (rpCancelBtn) rpCancelBtn.addEventListener('click', closeResetPasswordModal);
    if (rpModal) rpModal.addEventListener('click', (e) => {
        if (e.target === rpModal) closeResetPasswordModal();
    });
    if (rpForm) rpForm.addEventListener('submit', submitResetPassword);

    // Permissions modal events
    const permModal = document.getElementById('permissionsModal');
    const permCloseBtn = document.getElementById('permModalClose');
    const permCancelBtn = document.getElementById('permModalCancel');
    const permSaveBtn = document.getElementById('permSaveBtn');
    const permSelectAll = document.getElementById('permSelectAll');
    const permDeselectAll = document.getElementById('permDeselectAll');

    if (permCloseBtn) permCloseBtn.addEventListener('click', closePermissionsModal);
    if (permCancelBtn) permCancelBtn.addEventListener('click', closePermissionsModal);
    if (permModal) permModal.addEventListener('click', (e) => {
        if (e.target === permModal) closePermissionsModal();
    });
    if (permSaveBtn) permSaveBtn.addEventListener('click', savePermissions);
    if (permSelectAll) permSelectAll.addEventListener('click', () => toggleAllPermissions(true));
    if (permDeselectAll) permDeselectAll.addEventListener('click', () => toggleAllPermissions(false));
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
                    <button type="button" class="btn-secondary btn-sm btn-permissions" data-action="permissions" data-id="${user.id}" data-username="${safeUsername}" data-is-admin="${user.isAdmin ? 1 : 0}">
                        <i class="fas fa-shield-alt" aria-hidden="true"></i>
                        <span>${t('authUsers.permissions.title', 'الصلاحيات')}</span>
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

    authUsersTableWrap.querySelectorAll('button[data-action="permissions"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const userId = Number(btn.dataset.id);
            const username = btn.dataset.username;
            const isAdmin = Number(btn.dataset.isAdmin) === 1;
            await handleOpenPermissions(userId, username, isAdmin);
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

function handleResetAuthUserPassword(userId) {
    const rpModal = document.getElementById('resetPasswordModal');
    const rpUserId = document.getElementById('rpUserId');
    const rpNewPassword = document.getElementById('rpNewPassword');
    const rpConfirmPassword = document.getElementById('rpConfirmPassword');

    if (!rpModal) return;
    rpUserId.value = userId;
    rpNewPassword.value = '';
    rpConfirmPassword.value = '';
    rpModal.classList.add('active');
    rpNewPassword.focus();
}

function closeResetPasswordModal() {
    const rpModal = document.getElementById('resetPasswordModal');
    if (rpModal) rpModal.classList.remove('active');
}

async function submitResetPassword(event) {
    event.preventDefault();
    const userId = Number(document.getElementById('rpUserId').value);
    const newPassword = document.getElementById('rpNewPassword').value;
    const confirmPassword = document.getElementById('rpConfirmPassword').value;

    if (!newPassword || newPassword.length < 6) {
        setStatus(authUsersStatusEl, t('authUsers.toast.passwordTooShort', 'كلمة المرور يجب أن تكون 6 أحرف أو أكثر.'), 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        setStatus(authUsersStatusEl, t('authUsers.toast.passwordMismatch', 'كلمة المرور وتأكيدها غير متطابقين.'), 'error');
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

    closeResetPasswordModal();
    setStatus(authUsersStatusEl, t('authUsers.toast.passwordUpdateSuccess', 'تم تحديث كلمة المرور بنجاح.'), 'success');
    await refreshAuthUsers();
}

const PERMISSION_PAGES = [
    'dashboard', 'customers', 'items', 'sales', 'purchases',
    'sales-returns', 'purchase-returns', 'treasury', 'reports',
    'customer-reports', 'inventory', 'opening-balance', 'settings', 'finance'
];

function getPageLabel(page) {
    return t(`authUsers.permissions.pages.${page}`, page);
}

async function handleOpenPermissions(userId, username, isAdmin) {
    const permModal = document.getElementById('permissionsModal');
    const permUserId = document.getElementById('permUserId');
    const permUserName = document.getElementById('permUserName');
    const permAdminNote = document.getElementById('permAdminNote');
    const permTableBody = document.getElementById('permTableBody');

    if (!permModal) return;
    permUserId.value = userId;
    permUserName.textContent = username;

    if (isAdmin) {
        permAdminNote.style.display = '';
    } else {
        permAdminNote.style.display = 'none';
    }

    permTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">${t('authUsers.permissions.loading', 'جارٍ تحميل الصلاحيات...')}</td></tr>`;
    permModal.classList.add('active');

    const sessionToken = await getAuthSessionToken();
    if (!sessionToken) {
        permTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">${t('authUsers.toast.sessionExpired', 'انتهت الجلسة.')}</td></tr>`;
        return;
    }

    const result = await window.electronAPI.getUserPermissions({ sessionToken, userId });
    if (!result.success) {
        permTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">${result.error || t('authUsers.permissions.loadError', 'تعذر تحميل الصلاحيات.')}</td></tr>`;
        return;
    }

    renderPermissionsTable(result.permissions, isAdmin);
}

function renderPermissionsTable(permissions, isAdmin) {
    const permTableBody = document.getElementById('permTableBody');
    if (!permTableBody) return;

    const rows = PERMISSION_PAGES.map((page) => {
        const perm = permissions.find((p) => p.page === page) || {};
        const viewChecked = isAdmin || perm.can_view ? 'checked' : '';
        const addChecked = isAdmin || perm.can_add ? 'checked' : '';
        const editChecked = isAdmin || perm.can_edit ? 'checked' : '';
        const deleteChecked = isAdmin || perm.can_delete ? 'checked' : '';
        const disabled = isAdmin ? 'disabled' : '';

        return `
            <tr data-page="${page}">
                <td class="perm-page-name">${getPageLabel(page)}</td>
                <td><input type="checkbox" class="perm-cb" data-perm="can_view" ${viewChecked} ${disabled}></td>
                <td><input type="checkbox" class="perm-cb" data-perm="can_add" ${addChecked} ${disabled}></td>
                <td><input type="checkbox" class="perm-cb" data-perm="can_edit" ${editChecked} ${disabled}></td>
                <td><input type="checkbox" class="perm-cb" data-perm="can_delete" ${deleteChecked} ${disabled}></td>
            </tr>
        `;
    }).join('');

    permTableBody.innerHTML = rows;
}

function toggleAllPermissions(checked) {
    const checkboxes = document.querySelectorAll('#permTableBody .perm-cb:not(:disabled)');
    checkboxes.forEach((cb) => { cb.checked = checked; });
}

function closePermissionsModal() {
    const permModal = document.getElementById('permissionsModal');
    if (permModal) permModal.classList.remove('active');
}

async function savePermissions() {
    const userId = Number(document.getElementById('permUserId').value);
    if (!userId) return;

    const sessionToken = await getAuthSessionToken();
    if (!sessionToken) {
        setStatus(authUsersStatusEl, t('authUsers.toast.sessionExpired', 'انتهت الجلسة.'), 'error');
        return;
    }

    const rows = document.querySelectorAll('#permTableBody tr[data-page]');
    const permissions = [];
    rows.forEach((row) => {
        const page = row.dataset.page;
        const canView = row.querySelector('[data-perm="can_view"]')?.checked || false;
        const canAdd = row.querySelector('[data-perm="can_add"]')?.checked || false;
        const canEdit = row.querySelector('[data-perm="can_edit"]')?.checked || false;
        const canDelete = row.querySelector('[data-perm="can_delete"]')?.checked || false;
        permissions.push({ page, can_view: canView, can_add: canAdd, can_edit: canEdit, can_delete: canDelete });
    });

    setStatus(authUsersStatusEl, t('authUsers.permissions.saving', 'جارٍ حفظ الصلاحيات...'), 'info');

    const result = await window.electronAPI.updateUserPermissions({ sessionToken, userId, permissions });
    if (!result.success) {
        showToast(result.error || t('authUsers.permissions.saveError', 'تعذر حفظ الصلاحيات.'), 'error');
        return;
    }

    closePermissionsModal();
    showToast(t('authUsers.permissions.saved', 'تم حفظ الصلاحيات بنجاح'), 'success');
}

