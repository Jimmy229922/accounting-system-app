let companyNameInput, companyAddressInput, companyPhoneInput, invoiceFooterInput, settingsForm;
let backupBtn, restoreBtn, backupStatusEl, restoreStatusEl, themeToggleBtn;
let profileImageInput, profileImagePreview, removeImageBtn;
let ar = {};

function t(key, fallback = '') {
    if (window.i18n && typeof window.i18n.getText === 'function') {
        return window.i18n.getText(ar, key, fallback);
    }
    return fallback;
}

function fmt(template, values = {}) {
    if (!template) return '';
    return Object.entries(values).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), template);
}

function getNavHTML() {
    return `
    <nav class="top-nav">
        <div class="nav-brand">${t('common.nav.brand', 'نظام المحاسبة')}</div>
        <ul class="nav-links">
            <li><a href="../dashboard/index.html">${t('common.nav.dashboard', 'لوحة التحكم')}</a></li>
            <li class="dropdown">
                <a href="#">${t('common.nav.masterData', 'البيانات الأساسية')}</a>
                <div class="dropdown-content">
                    <a href="../items/units.html">${t('common.nav.units', 'الوحدات')}</a>
                    <a href="../items/items.html">${t('common.nav.items', 'الأصناف')}</a>
                    <a href="../customers/index.html">${t('common.nav.customersSuppliers', 'العملاء والموردين')}</a>
                    <a href="../opening-balance/index.html">${t('common.nav.openingBalance', 'بيانات أول المدة')}</a>
                    <a href="../auth-users/index.html">${t('common.nav.userManagement', 'إدارة المستخدمين')}</a>
                </div>
            </li>
            <li class="dropdown">
                <a href="#">${t('common.nav.sales', 'المبيعات')}</a>
                <div class="dropdown-content">
                    <a href="../sales/index.html">${t('common.nav.salesInvoice', 'فاتورة المبيعات')}</a>
                    <a href="../sales-returns/index.html">${t('common.nav.salesReturns', 'مردودات المبيعات')}</a>
                </div>
            </li>
            <li class="dropdown">
                <a href="#">${t('common.nav.purchases', 'المشتريات')}</a>
                <div class="dropdown-content">
                    <a href="../purchases/index.html">${t('common.nav.purchaseInvoice', 'فاتورة المشتريات')}</a>
                    <a href="../purchase-returns/index.html">${t('common.nav.purchaseReturns', 'مردودات المشتريات')}</a>
                </div>
            </li>
            <li><a href="../inventory/index.html">${t('common.nav.inventory', 'المخزن')}</a></li>
            <li><a href="../finance/index.html">${t('common.nav.finance', 'المالية')}</a></li>
            <li><a href="../payments/receipt.html">${t('common.nav.receipt', 'تحصيل من عميل')}</a></li>
            <li><a href="../payments/payment.html">${t('common.nav.payment', 'سداد لمورد')}</a></li>
            <li class="dropdown">
                <a href="#">${t('common.nav.reports', 'التقارير')}</a>
                <div class="dropdown-content">
                    <a href="../reports/index.html">${t('common.nav.generalReports', 'التقارير العامة')}</a>
                    <a href="../customer-reports/index.html">${t('common.nav.customerReports', 'تقارير العملاء')}</a>
                    <a href="../reports/debtor-creditor/index.html">${t('common.nav.debtorCreditor', 'كشف المدين والدائن')}</a>
                </div>
            </li>
            <li><a href="#" class="active">${t('common.nav.settings', 'الإعدادات')}</a></li>
        </ul>
    </nav>`;
}

document.addEventListener('DOMContentLoaded', async () => {
    if (window.i18n && typeof window.i18n.loadArabicDictionary === 'function') {
        ar = await window.i18n.loadArabicDictionary();
    }
    renderPage();
    initializeElements();
    await loadSettings();
});

function renderPage() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${getNavHTML()}

        <main class="content">
            <!-- Page Hero -->
            <div class="page-hero">
                <div class="page-hero-right">
                    <div class="page-hero-icon"><i class="fas fa-cog"></i></div>
                    <div>
                        <h1>${t('settings.title', 'إعدادات النظام')}</h1>
                        <p>${t('settings.subtitle', 'إدارة بيانات المؤسسة والنسخ الاحتياطي ومظهر النظام')}</p>
                    </div>
                </div>
            </div>

            <!-- Company Information Section -->
            <div class="settings-card">
                <div class="section-header">
                    <div class="section-header-icon company"><i class="fas fa-building"></i></div>
                    <h2>${t('settings.companySection', 'بيانات المؤسسة')}<span>${t('settings.companySectionDesc', 'معلومات الشركة التي تظهر في الفواتير والتقارير')}</span></h2>
                </div>
                <form id="settingsForm">
                    <div class="form-grid">
                        <div class="form-group">
                            <label><i class="fas fa-building"></i> ${t('settings.companyName', 'اسم الشركة / المؤسسة')}</label>
                            <input type="text" id="companyName" class="form-control" placeholder="${t('settings.companyNamePlaceholder', 'أدخل اسم الشركة')}">
                        </div>
                        <div class="form-group">
                            <label><i class="fas fa-phone"></i> ${t('settings.phone', 'رقم الهاتف')}</label>
                            <input type="text" id="companyPhone" class="form-control" placeholder="${t('settings.phonePlaceholder', 'أدخل رقم الهاتف')}">
                        </div>
                        <div class="form-group full-width">
                            <label><i class="fas fa-image"></i> ${t('settings.profileImage', 'صورة الملف الشخصي')}</label>
                            <div class="profile-image-section">
                                <div class="profile-image-preview" id="profileImagePreview">
                                    <i class="fas fa-user-circle profile-placeholder-icon"></i>
                                </div>
                                <div class="profile-image-actions">
                                    <label class="btn-upload" for="profileImageInput">
                                        <i class="fas fa-upload"></i> ${t('settings.uploadImage', 'اختر صورة')}
                                    </label>
                                    <input type="file" id="profileImageInput" accept="image/png,image/jpeg,image/webp" style="display:none;">
                                    <button type="button" id="removeImageBtn" class="btn-remove-image" style="display:none;">
                                        <i class="fas fa-trash"></i> ${t('settings.removeImage', 'إزالة الصورة')}
                                    </button>
                                    <span class="profile-image-hint">${t('settings.profileImageDesc', 'صورة تظهر في التقارير وملفات PDF')}</span>
                                </div>
                            </div>
                        </div>
                        <div class="form-group full-width">
                            <label><i class="fas fa-map-marker-alt"></i> ${t('settings.address', 'العنوان')}</label>
                            <input type="text" id="companyAddress" class="form-control" placeholder="${t('settings.addressPlaceholder', 'أدخل العنوان')}">
                        </div>
                        <div class="form-group full-width">
                            <label><i class="fas fa-file-alt"></i> ${t('settings.invoiceFooter', 'ملاحظات أسفل الفاتورة')}</label>
                            <textarea id="invoiceFooter" class="form-control" rows="3" placeholder="${t('settings.invoiceFooterPlaceholder', 'نص يظهر أسفل الفواتير')}"></textarea>
                        </div>
                    </div>
                    <button type="submit" class="btn-save"><i class="fas fa-save"></i> ${t('settings.saveSettings', 'حفظ الإعدادات')}</button>
                </form>
            </div>

            <!-- Appearance & Backup Section -->
            <div class="settings-card">
                <div class="section-header">
                    <div class="section-header-icon appearance"><i class="fas fa-sliders-h"></i></div>
                    <h2>${t('settings.toolsSection', 'الأدوات والمظهر')}<span>${t('settings.toolsSectionDesc', 'تغيير المظهر والنسخ الاحتياطي واستعادة البيانات')}</span></h2>
                </div>
                <div class="action-cards-grid">
                    <!-- Theme Card -->
                    <div class="action-card theme-card">
                        <div class="action-card-header">
                            <div class="action-card-icon theme"><i class="fas fa-palette"></i></div>
                            <h3>${t('settings.appearanceTitle', 'مظهر النظام')}</h3>
                        </div>
                        <p class="action-card-desc">${t('settings.appearanceDesc', 'تغيير وضع العرض بين المظلم والفاتح من هنا.')}</p>
                        <button id="themeToggleBtn" class="btn-action theme-btn" data-theme-toggle><i class="fas fa-moon"></i> ${t('settings.toggleTheme', 'تبديل المظهر')}</button>
                    </div>
                    <!-- Backup Card -->
                    <div class="action-card backup-card">
                        <div class="action-card-header">
                            <div class="action-card-icon backup"><i class="fas fa-cloud-upload-alt"></i></div>
                            <h3>${t('settings.backupTitle', 'إنشاء نسخة احتياطية')}</h3>
                        </div>
                        <p class="action-card-desc">${t('settings.backupDesc', 'احفظ نسخة منفصلة تحتوي على جميع بيانات النظام في موقع من اختيارك.')}</p>
                        <button id="backupBtn" class="btn-action backup-btn"><i class="fas fa-download"></i> ${t('settings.backupNow', 'إنشاء نسخة احتياطية الآن')}</button>
                        <small id="backupStatus" class="status-text"></small>
                    </div>
                    <!-- Restore Card -->
                    <div class="action-card restore-card">
                        <div class="action-card-header">
                            <div class="action-card-icon restore"><i class="fas fa-upload"></i></div>
                            <h3>${t('settings.restoreTitle', 'إعادة توجيه البيانات من نسخة')}</h3>
                        </div>
                        <p class="action-card-desc">${t('settings.restoreDesc', 'استبدل قاعدة البيانات الحالية بملف نسخة احتياطية محفوظ لديك، ثم سيعاد تشغيل النظام.')}</p>
                        <button id="restoreBtn" class="btn-action restore-btn"><i class="fas fa-undo-alt"></i> ${t('settings.restoreNow', 'استعادة من نسخة احتياطية')}</button>
                        <small id="restoreStatus" class="status-text"></small>
                    </div>
                </div>
            </div>

            <!-- System Info Section -->
            <div class="settings-card">
                <div class="section-header">
                    <div class="section-header-icon system"><i class="fas fa-info-circle"></i></div>
                    <h2>${t('settings.systemInfoSection', 'معلومات النظام')}<span>${t('settings.systemInfoDesc', 'تفاصيل إصدار التطبيق وحالة قاعدة البيانات')}</span></h2>
                </div>
                <div class="system-info-grid">
                    <div class="info-item">
                        <div class="info-item-icon"><i class="fas fa-code-branch"></i></div>
                        <div>
                            <div class="info-item-label">${t('settings.version', 'إصدار التطبيق')}</div>
                            <div class="info-item-value">1.0.0</div>
                        </div>
                    </div>
                    <div class="info-item">
                        <div class="info-item-icon"><i class="fas fa-database"></i></div>
                        <div>
                            <div class="info-item-label">${t('settings.dbEngine', 'محرك البيانات')}</div>
                            <div class="info-item-value">SQLite</div>
                        </div>
                    </div>
                    <div class="info-item">
                        <div class="info-item-icon"><i class="fas fa-desktop"></i></div>
                        <div>
                            <div class="info-item-label">${t('settings.platform', 'المنصة')}</div>
                            <div class="info-item-value">Electron Desktop</div>
                        </div>
                    </div>
                    <div class="info-item">
                        <div class="info-item-icon"><i class="fas fa-check-circle"></i></div>
                        <div>
                            <div class="info-item-label">${t('settings.connectionStatus', 'حالة الاتصال')}</div>
                            <div class="info-item-value" style="color: #10b981;">${t('settings.connected', 'متصل')}</div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    `;
}

function initializeElements() {
    companyNameInput = document.getElementById('companyName');
    companyAddressInput = document.getElementById('companyAddress');
    companyPhoneInput = document.getElementById('companyPhone');
    invoiceFooterInput = document.getElementById('invoiceFooter');
    settingsForm = document.getElementById('settingsForm');
    backupBtn = document.getElementById('backupBtn');
    restoreBtn = document.getElementById('restoreBtn');
    backupStatusEl = document.getElementById('backupStatus');
    restoreStatusEl = document.getElementById('restoreStatus');
    themeToggleBtn = document.getElementById('themeToggleBtn');
    profileImageInput = document.getElementById('profileImageInput');
    profileImagePreview = document.getElementById('profileImagePreview');
    removeImageBtn = document.getElementById('removeImageBtn');

    settingsForm.addEventListener('submit', saveSettings);
    backupBtn.addEventListener('click', handleBackup);
    restoreBtn.addEventListener('click', handleRestore);

    profileImageInput.addEventListener('change', handleImageUpload);
    removeImageBtn.addEventListener('click', handleImageRemove);

    if (themeToggleBtn && typeof window.bindThemeToggleButtons === 'function') {
        window.bindThemeToggleButtons();
    }
}

async function loadSettings() {
    const settings = await window.electronAPI.getSettings();
    if (settings) {
        companyNameInput.value = settings.companyName || '';
        companyAddressInput.value = settings.companyAddress || '';
        companyPhoneInput.value = settings.companyPhone || '';
        invoiceFooterInput.value = settings.invoiceFooter || '';
        if (settings.profileImage) {
            showProfileImage(settings.profileImage);
        }
    }
}

function showProfileImage(dataUrl) {
    profileImagePreview.innerHTML = `<img src="${dataUrl}" alt="profile">`;
    removeImageBtn.style.display = '';
}

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
        if (window.showToast) window.showToast(t('settings.imageError', 'حدث خطأ أثناء رفع الصورة'), 'error');
        return;
    }
    const reader = new FileReader();
    reader.onload = function(ev) {
        const dataUrl = ev.target.result;
        showProfileImage(dataUrl);
        if (window.showToast) window.showToast(t('settings.imageUploaded', 'تم رفع الصورة بنجاح'), 'success');
    };
    reader.readAsDataURL(file);
}

function handleImageRemove() {
    profileImagePreview.innerHTML = '<i class="fas fa-user-circle profile-placeholder-icon"></i>';
    removeImageBtn.style.display = 'none';
    profileImageInput.value = '';
    if (window.showToast) window.showToast(t('settings.imageRemoved', 'تم إزالة الصورة'), 'info');
}

async function saveSettings(e) {
    e.preventDefault();
    const imgEl = profileImagePreview.querySelector('img');
    const settings = {
        companyName: companyNameInput.value,
        companyAddress: companyAddressInput.value,
        companyPhone: companyPhoneInput.value,
        invoiceFooter: invoiceFooterInput.value,
        profileImage: imgEl ? imgEl.src : ''
    };

    const result = await window.electronAPI.saveSettings(settings);
    if (result.success) {
        if (window.showToast) window.showToast(t('settings.alerts.saveSuccess', 'تم حفظ الإعدادات بنجاح'), 'success');
    } else {
        if (window.showToast) window.showToast(t('settings.alerts.saveError', 'حدث خطأ أثناء الحفظ'), 'error');
    }
}

function setStatus(element, message, isError = false) {
    if (!element) return;
    element.textContent = message || '';
    element.style.color = isError ? '#b91c1c' : '#111827';
}

async function handleBackup() {
    setStatus(backupStatusEl, t('settings.status.creatingBackup'));
    const result = await window.electronAPI.backupDatabase();

    if (result.success) {
        setStatus(backupStatusEl, fmt(t('settings.status.backupSavedAt'), { path: result.path }));
    } else if (result.canceled) {
        setStatus(backupStatusEl, t('settings.status.operationCanceled'));
    } else {
        setStatus(
            backupStatusEl,
            fmt(t('settings.status.backupFailed'), { error: result.error || 'Unknown error' }),
            true
        );
    }
}

async function handleRestore() {
    const confirmRestore = confirm(t('settings.alerts.restoreConfirm'));
    if (!confirmRestore) return;

    setStatus(restoreStatusEl, t('settings.status.restoring'));
    const result = await window.electronAPI.restoreDatabase();

    if (result.success) {
        setStatus(restoreStatusEl, t('settings.status.restoreSuccessRestart'));
        await window.electronAPI.restartApp();
    } else if (result.canceled) {
        setStatus(restoreStatusEl, t('settings.status.operationCanceled'));
    } else {
        setStatus(
            restoreStatusEl,
            fmt(t('settings.status.restoreFailed'), { error: result.error || 'Unknown error' }),
            true
        );

        if (result.needsRestart) {
            alert(t('settings.alerts.restoreRestartError'));
            await window.electronAPI.restartApp();
        }
    }
}


