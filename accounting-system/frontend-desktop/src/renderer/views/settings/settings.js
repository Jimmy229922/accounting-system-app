let companyNameInput, companyAddressInput, companyPhoneInput, invoiceFooterInput, settingsForm;
let backupBtn, restoreBtn, backupStatusEl, restoreStatusEl, themeToggleBtn;
let profileImageInput, profileImagePreview, removeImageBtn, saveBtn;
let changeLogLastModifiedEl, changeLogModifiedByEl, changeLogSummaryEl;
let saveStateTimer = null;
let initialFormSnapshot = '';
let latestLoadedSettings = {};
const CURRENT_APP_VERSION = '7.0.3';
const WHATS_NEW_STORAGE_KEY = 'settings_whats_new_seen_version';
const WHATS_NEW_CATEGORY_GROUPS = [
    {
        id: 'new',
        matchTypes: ['new'],
        title: 'أولاً: الإضافات والمميزات الجديدة',
        icon: 'fa-plus-circle',
        groupClass: 'category-group-new'
    },
    {
        id: 'improvement',
        matchTypes: ['improvement', 'feature'],
        title: 'ثانياً: التعديلات والتحسينات',
        icon: 'fa-sliders-h',
        groupClass: 'category-group-improvement'
    },
    {
        id: 'fix',
        matchTypes: ['fix'],
        title: 'ثالثاً: الإصلاحات والمعالجات',
        icon: 'fa-wrench',
        groupClass: 'category-group-fix'
    }
];
const WHATS_NEW_RELEASES = [
    {
        version: '7.0.3',
        date: '2026-11-08',
        title: 'تحديث المؤشرات الذكية ولوحة التحكم وسجل التحديثات المصنّف',
        summary: 'إضافة مؤشرات صحة قاعدة البيانات والنسخ الاحتياطي، شريط الآيات والأذكار العشوائي في لوحة التحكم، تطوير نافذة إيضاح الأرباح، وتوحيد إصدار النظام في جميع الواجهات.',
        changes: [
            {
                tag: 'إضافة جديدة',
                tagType: 'new',
                icon: 'fa-shield-alt',
                title: 'مؤشر صحة قاعدة البيانات وحجمها الفعلي',
                description: 'عرض حالة سلامة الجداول والفهارس والمساحة الفعلية لملف قاعدة البيانات تلقائياً داخل بطاقة «معلومات النظام» بدون الحاجة لأي تدخل يدوي.'
            },
            {
                tag: 'إضافة جديدة',
                tagType: 'new',
                icon: 'fa-history',
                title: 'سجل النسخ الاحتياطي ومؤشر التنبيه الذكي',
                description: 'عرض تاريخ ووقت ونوع آخر نسخة احتياطية ناجحة مع تلوين تنبيهي ذكي تلقائي (أخضر للنسخ الحديثة حتى 3 أيام، أصفر عند مرور أكثر من 3 أيام، وأحمر عند تجاوز 7 أيام).'
            },
            {
                tag: 'إضافة جديدة',
                tagType: 'new',
                icon: 'fa-book-open',
                title: 'شريط الآيات القرآنية والأذكار المتجدد عشوائياً أعلى لوحة التحكم',
                description: 'إضافة شريط زجاجي أعلى بطاقة الترحيب في لوحة التحكم يعرض 12 آية قرآنية وذكراً ودعاءً للرزق والبركة بنظام خلط عشوائي كامل يضمن ظهور جميع الآيات والأذكار دون ترتيب ثابت.'
            },
            {
                tag: 'تعديل وتحسين',
                tagType: 'improvement',
                icon: 'fa-calculator',
                title: 'تطوير وتوسيع نافذة «تفاصيل مجمل الربح للإيضاح» في لوحة التحكم',
                description: 'إعادة تصميم نافذة إيضاح صافي الربح بعرض واسع وتخطيط شبكي موحد من 6 بطاقات متساوية الحجم تعرض خطوات الحساب في سطر واحد لكل بند دون أي تمرير رأسي.'
            },
            {
                tag: 'تعديل وتحسين',
                tagType: 'improvement',
                icon: 'fa-layer-group',
                title: 'التقسيم التصنيفي الدائم لنافذة «ما الجديد في التحديثات»',
                description: 'تنظيم بنود كل تحديث دائماً داخل 3 أقسام مستقلة (الإضافات والمميزات الجديدة، التعديلات والتحسينات، والإصلاحات والمعالجات) مع عداد رقمي لكل قسم.'
            },
            {
                tag: 'إصلاح ومعالجة',
                tagType: 'fix',
                icon: 'fa-align-right',
                title: 'منع التفاف وانكسار النصوص والأرقام داخل بطاقات إيضاح الربح',
                description: 'معالجة التفاف العناوين والمبالغ المالية في سطرين داخل نافذة تفاصيل مجمل الربح وتوحيد أبعاد جميع البطاقات.'
            },
            {
                tag: 'إصلاح ومعالجة',
                tagType: 'fix',
                icon: 'fa-code-branch',
                title: 'توحيد رقم إصدار النظام في لوحة التحكم والإعدادات',
                description: 'مزامنة عرض رقم الإصدار الحالي للبرنامج في بطاقة حالة النظام بلوحة التحكم وبطاقة معلومات النظام في الإعدادات.'
            }
        ]
    },
    {
        version: '7.0.1',
        date: '2026-11-08',
        title: 'تحديث التواريخ الذكية وإطلاق سجل التحديثات التفاعلي',
        summary: 'تحسين دقة التواريخ المحاسبية في الفواتير والسندات وإضافة نافذة استعراض مستجدات النظام.',
        changes: [
            {
                tag: 'إضافة جديدة',
                tagType: 'new',
                icon: 'fa-rocket',
                title: 'نافذة «ما الجديد في التحديثات» داخل الإعدادات',
                description: 'إضافة سجل تفاعلي شامل في بطاقة مظهر النظام يعرض تفاصيل التحديث الحالي وجميع التحديثات السابقة، مع الظهور التلقائي عند فتح الإعدادات لأول مرة بعد كل تحديث.'
            },
            {
                tag: 'تعديل وتحسين',
                tagType: 'improvement',
                icon: 'fa-rotate-left',
                title: 'إعادة تعيين التاريخ تلقائياً لتاريخ اليوم بعد كل عملية',
                description: 'عند تعديل التاريخ يدوياً لتسجيل فاتورة أو سند بتاريخ سابق، يظل التاريخ المخصص سارياً للعملية الحالية فقط ثم يعود تلقائياً لتاريخ اليوم الفعلي فور الحفظ أو التفريغ أو بدء مستند جديد.'
            },
            {
                tag: 'إصلاح ومعالجة',
                tagType: 'fix',
                icon: 'fa-calendar-check',
                title: 'معالجة فرق التوقيت المحلي لتاريخ اليوم الفعلي',
                description: 'اعتماد التوقيت المحلي الفعلي للجهاز بدلاً من توقيت جرينتش في صفحات المبيعات، المشتريات، تحصيل نقدية من عميل، وسداد نقدية لمورد لضمان ثبات تاريخ اليوم.'
            },
            {
                tag: 'إصلاح ومعالجة',
                tagType: 'fix',
                icon: 'fa-chart-line',
                title: 'دقة إحصائيات التحصيل والسداد اليومية في الخزينة',
                description: 'تحديث آلية احتساب إجماليات اليوم في شاشات الخزينة لتطابق التاريخ المحلي الفعلي للجهاز.'
            }
        ]
    }
];
const SETTINGS_TRACKING_FIELDS = [
    { key: 'companyName', label: 'اسم المؤسسة' },
    { key: 'companyPhone', label: 'رقم الهاتف' },
    { key: 'companyAddress', label: 'العنوان' },
    { key: 'invoiceFooter', label: 'ملاحظة الفاتورة' },
    { key: 'profileImage', label: 'الشعار' }
];
let ar = {};
const { t, fmt } = window.i18n?.createPageHelpers?.(() => ar) || { t: (k, f = '') => f, fmt: (t, v = {}) => String(t || '') };

function buildTopNavHTML() {
    if (window.navManager && typeof window.navManager.getTopNavHTML === 'function') {
        return window.navManager.getTopNavHTML(t);
    }
    return '';
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
    if (window.i18n && typeof window.i18n.loadArabicDictionary === 'function') {
        ar = await window.i18n.loadArabicDictionary();
    }
    renderPage();
    initializeElements();
    await loadSettings();
    checkAutoOpenWhatsNewModal();
    } catch (error) {
        console.error('Initialization Error:', error);
        if (window.toast && typeof window.toast.error === 'function') {
            window.toast.error(t('alerts.initError', 'حدث خطأ أثناء تهيئة الصفحة، يرجى إعادة التحميل'));
        }
    }
});

function renderPage() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${buildTopNavHTML()}

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
                    <div class="settings-sections">
                        <section class="settings-subsection subsection-company">
                            <h3 class="subsection-title">
                                <span class="subsection-title-main"><i class="fas fa-building"></i> بيانات المؤسسة</span>
                                <span class="subsection-title-sub">الاسم ورقم الهاتف المعتمدان في الفواتير والتقارير.</span>
                            </h3>
                            <div class="subsection-grid">
                                <div class="form-group">
                                    <label><i class="fas fa-building"></i> اسم المؤسسة</label>
                                    <input type="text" id="companyName" class="form-control" placeholder="مثال: مؤسسة النور التجارية">
                                </div>
                                <div class="form-group">
                                    <label><i class="fas fa-phone"></i> رقم الهاتف</label>
                                    <input type="text" id="companyPhone" class="form-control" placeholder="مثال: 01012345678">
                                </div>
                            </div>
                        </section>

                        <section class="settings-subsection subsection-logo">
                            <h3 class="subsection-title">
                                <span class="subsection-title-main"><i class="fas fa-image"></i> الشعار</span>
                                <span class="subsection-title-sub">الصورة الرسمية التي تظهر في المستندات المطبوعة.</span>
                            </h3>
                            <div class="form-group">
                                <label><i class="fas fa-image"></i> صورة الشعار</label>
                                <div class="profile-image-section">
                                    <div class="profile-image-preview" id="profileImagePreview">
                                        <i class="fas fa-user-circle profile-placeholder-icon"></i>
                                    </div>
                                    <div class="profile-image-actions">
                                        <label class="btn-upload" for="profileImageInput">
                                            <i class="fas fa-upload"></i> ${t('settings.uploadImage', 'اختر صورة')}
                                        </label>
                                        <span class="btn-upload-meta">الصيغ المسموحة: PNG / JPG / WEBP - حتى 2MB</span>
                                        <input type="file" id="profileImageInput" accept="image/png,image/jpeg,image/webp" style="display:none;">
                                        <button type="button" id="removeImageBtn" class="btn-remove-image" style="display:none;">
                                            <i class="fas fa-trash"></i> ${t('settings.removeImage', 'إزالة الصورة')}
                                        </button>
                                        <span class="profile-image-hint">${t('settings.profileImageDesc', 'صورة تظهر في التقارير وملفات PDF')}</span>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section class="settings-subsection subsection-address">
                            <h3 class="subsection-title">
                                <span class="subsection-title-main"><i class="fas fa-map-marker-alt"></i> العنوان</span>
                                <span class="subsection-title-sub">العنوان الذي يظهر في رأس الفاتورة والتقارير.</span>
                            </h3>
                            <div class="form-group">
                                <label><i class="fas fa-map-marker-alt"></i> العنوان</label>
                                <input type="text" id="companyAddress" class="form-control" placeholder="مثال: القاهرة - مدينة نصر">
                            </div>
                        </section>

                        <section class="settings-subsection subsection-footer">
                            <h3 class="subsection-title">
                                <span class="subsection-title-main"><i class="fas fa-file-alt"></i> ملاحظات الفاتورة</span>
                                <span class="subsection-title-sub">نص مختصر يظهر أسفل جميع فواتير الطباعة.</span>
                            </h3>
                            <div class="form-group">
                                <label><i class="fas fa-file-alt"></i> ملاحظة الفاتورة</label>
                                <textarea id="invoiceFooter" class="form-control" rows="3" placeholder="مثال: شكرا لتعاملكم معنا"></textarea>
                            </div>
                        </section>
                    </div>
                    <div class="settings-save-bar">
                        <button type="submit" class="btn-save" data-save-state="idle">
                            <i class="fas fa-save"></i>
                            <span class="btn-save-text">${t('settings.saveSettings', 'حفظ الإعدادات')}</span>
                        </button>
                    </div>
                </form>
            </div>

            <div class="settings-card audit-card">
                <div class="section-header">
                    <div class="section-header-icon audit"><i class="fas fa-history"></i></div>
                    <h2>سجل التغييرات<span>آخر تعديل، من عدل، وماذا تم تغييره.</span></h2>
                </div>
                <div class="change-log-grid">
                    <div class="change-log-row">
                        <div class="change-log-label">آخر تعديل</div>
                        <div class="change-log-value" id="settingsAuditLastModified">لا يوجد تعديل مسجل بعد</div>
                    </div>
                    <div class="change-log-row">
                        <div class="change-log-label">من عدّل</div>
                        <div class="change-log-value" id="settingsAuditModifiedBy">-</div>
                    </div>
                    <div class="change-log-row">
                        <div class="change-log-label">ماذا تم تغييره</div>
                        <div class="change-log-value" id="settingsAuditSummary">-</div>
                    </div>
                </div>
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
                        <div class="theme-card-actions">
                            <button id="themeToggleBtn" type="button" class="btn-action theme-btn" data-theme-toggle><i class="fas fa-moon"></i> ${t('settings.toggleTheme', 'تبديل المظهر')}</button>
                            <button id="whatsNewBtn" type="button" class="btn-action whats-new-btn">
                                <i class="fas fa-rocket"></i>
                                <span>ما الجديد في التحديثات</span>
                                <span class="whats-new-version-pill">v${CURRENT_APP_VERSION}</span>
                            </button>
                        </div>
                    </div>
                    <!-- Backup Card -->
                    <div class="action-card backup-card">
                        <div class="action-card-header">
                            <div class="action-card-icon backup"><i class="fas fa-cloud-upload-alt"></i></div>
                            <h3>${t('settings.backupTitle', 'إنشاء نسخة احتياطية')}</h3>
                        </div>
                        <p class="action-card-desc">${t('settings.backupDesc', 'احفظ نسخة احتياطية من بياناتك في أي مكان تختاره على جهازك.')}</p>
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
                            <div class="info-item-value">${CURRENT_APP_VERSION}</div>
                        </div>
                    </div>
                    <div class="info-item">
                        <div class="info-item-icon"><i class="fas fa-check-circle"></i></div>
                        <div>
                            <div class="info-item-label">${t('settings.connectionStatus', 'حالة الاتصال')}</div>
                            <div class="info-item-value" style="color: #10b981;">${t('settings.connected', 'متصل')}</div>
                        </div>
                    </div>
                    <div class="info-item" id="dbHealthInfoItem">
                        <div class="info-item-icon status-icon-safe" id="dbHealthIconEl"><i class="fas fa-shield-alt"></i></div>
                        <div class="info-item-body">
                            <div class="info-item-label">حالة صحة قاعدة البيانات</div>
                            <div class="info-item-value info-value-stack">
                                <span id="dbHealthBadgeEl" class="sys-status-badge status-safe"><i class="fas fa-check-circle"></i> سليمة ومستقرة</span>
                                <span id="dbHealthSubEl" class="info-item-subtext">فحص الجداول والفهارس سليم</span>
                            </div>
                        </div>
                    </div>
                    <div class="info-item" id="dbSizeInfoItem">
                        <div class="info-item-icon"><i class="fas fa-database"></i></div>
                        <div class="info-item-body">
                            <div class="info-item-label">حجم قاعدة البيانات الفعلي</div>
                            <div class="info-item-value info-value-stack">
                                <span id="dbSizeValueEl">-</span>
                                <span id="dbSizeSubEl" class="info-item-subtext">المساحة الفعلية لملف قاعدة البيانات</span>
                            </div>
                        </div>
                    </div>
                    <div class="info-item" id="backupStatusInfoItem">
                        <div class="info-item-icon status-icon-safe" id="backupStatusIconEl"><i class="fas fa-history"></i></div>
                        <div class="info-item-body">
                            <div class="info-item-label">سجل النسخ الاحتياطي ومؤشر الأمان</div>
                            <div class="info-item-value info-value-stack">
                                <span id="backupSmartBadgeEl" class="sys-status-badge status-safe">-</span>
                                <span id="lastBackupDateEl" class="info-item-subtext">-</span>
                            </div>
                        </div>
                    </div>
                    <div class="info-item" id="updateInfoSection">
                        <div class="info-item-icon"><i class="fas fa-sync-alt"></i></div>
                        <div>
                            <div class="info-item-label">تحديثات النظام</div>
                            <div class="info-item-value" style="display:flex; flex-direction:column; gap:6px;">
                                <button type="button" id="checkUpdatesBtn" class="btn btn-outline" style="padding: 4px 8px; font-size: 0.85rem; width: fit-content; display: inline-flex; align-items: center; gap: 4px;">
                                    <i class="fas fa-sync"></i> التحقق من التحديثات
                                </button>
                                <span id="updateStatusText" style="font-size: 0.8rem; color: var(--text-secondary);"></span>
                                <div id="updateProgressContainer" style="display: none; margin-top: 4px; width: 100%; max-width: 200px;">
                                    <div style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
                                        <div id="updateProgressBar" style="width: 0%; height: 100%; background: #10b981; transition: width 0.1s;"></div>
                                    </div>
                                    <span id="updateProgressPercent" style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px; display: block;">0%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div id="whatsNewModal" class="whats-new-modal" aria-hidden="true">
                <div class="whats-new-modal-card" role="dialog" aria-modal="true" aria-labelledby="whatsNewModalTitle">
                    <div class="whats-new-modal-header">
                        <div class="whats-new-header-main">
                            <div class="whats-new-header-icon">
                                <i class="fas fa-rocket"></i>
                            </div>
                            <div>
                                <div class="whats-new-header-title-row">
                                    <h3 id="whatsNewModalTitle" class="whats-new-modal-title">ما الجديد في التحديثات</h3>
                                    <span class="whats-new-current-badge">الإصدار ${CURRENT_APP_VERSION}</span>
                                </div>
                                <p class="whats-new-modal-subtitle">سجل كامل بأحدث الإضافات والتحسينات في التحديث الحالي والتحديثات السابقة</p>
                            </div>
                        </div>
                        <button type="button" id="closeWhatsNewBtn" class="whats-new-modal-close" title="إغلاق" aria-label="إغلاق">&times;</button>
                    </div>
                    <div class="whats-new-modal-body" id="whatsNewModalBody">
                        ${renderWhatsNewReleasesHTML()}
                    </div>
                    <div class="whats-new-modal-footer">
                        <span class="whats-new-footer-note"><i class="fas fa-check-circle"></i> يظهر هذا السجل تلقائياً عند أول زيارة للإعدادات بعد كل تحديث جديد</span>
                        <button type="button" id="ackWhatsNewBtn" class="btn-whats-new-done">
                            <i class="fas fa-check"></i> حسناً، اطلعت على التحديث
                        </button>
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
    saveBtn = settingsForm?.querySelector('.btn-save');
    changeLogLastModifiedEl = document.getElementById('settingsAuditLastModified');
    changeLogModifiedByEl = document.getElementById('settingsAuditModifiedBy');
    changeLogSummaryEl = document.getElementById('settingsAuditSummary');

    settingsForm.addEventListener('submit', saveSettings);
    backupBtn.addEventListener('click', handleBackup);
    restoreBtn.addEventListener('click', handleRestore);

    profileImageInput.addEventListener('change', handleImageUpload);
    removeImageBtn.addEventListener('click', handleImageRemove);

    if (themeToggleBtn && typeof window.bindThemeToggleButtons === 'function') {
        window.bindThemeToggleButtons();
    }

    const checkUpdatesBtn = document.getElementById('checkUpdatesBtn');
    if (checkUpdatesBtn) {
        checkUpdatesBtn.addEventListener('click', handleCheckUpdates);
    }
    setupUpdaterListeners();
    bindWhatsNewModalEvents();

    setSaveButtonState('idle');
}

function renderWhatsNewReleasesHTML() {
    return WHATS_NEW_RELEASES.map((release, index) => {
        const isLatest = index === 0;
        const badgeClass = isLatest ? 'release-badge-latest' : 'release-badge-previous';
        const badgeText = isLatest ? 'التحديث الحالي (الأحدث)' : 'تحديث سابق';
        const cardClass = isLatest ? 'whats-new-release-card is-latest' : 'whats-new-release-card';
        const allChanges = Array.isArray(release.changes) ? release.changes : [];

        const categorizedSectionsHtml = WHATS_NEW_CATEGORY_GROUPS.map((group) => {
            const groupItems = allChanges.filter((item) => group.matchTypes.includes(item.tagType || 'feature'));
            if (!groupItems.length) return '';

            const itemsHtml = groupItems.map((item) => `
                <div class="whats-new-item">
                    <div class="whats-new-item-icon tag-${item.tagType || 'feature'}">
                        <i class="fas ${item.icon || 'fa-check-circle'}"></i>
                    </div>
                    <div class="whats-new-item-content">
                        <div class="whats-new-item-head">
                            <span class="whats-new-item-tag tag-${item.tagType || 'feature'}">${item.tag || 'تحديث'}</span>
                            <h5 class="whats-new-item-title">${item.title}</h5>
                        </div>
                        <p class="whats-new-item-desc">${item.description}</p>
                    </div>
                </div>
            `).join('');

            return `
                <div class="whats-new-category-section ${group.groupClass}">
                    <div class="whats-new-category-header">
                        <span class="whats-new-category-title"><i class="fas ${group.icon}"></i> ${group.title}</span>
                        <span class="whats-new-category-count">${groupItems.length}</span>
                    </div>
                    <div class="whats-new-items-list">
                        ${itemsHtml}
                    </div>
                </div>
            `;
        }).filter(Boolean).join('');

        return `
            <section class="${cardClass}">
                <div class="whats-new-release-header">
                    <div class="whats-new-release-meta">
                        <span class="whats-new-version-tag"><i class="fas fa-code-branch"></i> الإصدار ${release.version}</span>
                        <span class="whats-new-release-badge ${badgeClass}">${badgeText}</span>
                        <span class="whats-new-release-date"><i class="fas fa-calendar-alt"></i> ${release.date}</span>
                    </div>
                    <h4 class="whats-new-release-title">${release.title}</h4>
                    ${release.summary ? `<p class="whats-new-release-summary">${release.summary}</p>` : ''}
                </div>
                <div class="whats-new-categories-container">
                    ${categorizedSectionsHtml}
                </div>
            </section>
        `;
    }).join('');
}

function bindWhatsNewModalEvents() {
    const whatsNewBtn = document.getElementById('whatsNewBtn');
    const closeWhatsNewBtn = document.getElementById('closeWhatsNewBtn');
    const ackWhatsNewBtn = document.getElementById('ackWhatsNewBtn');
    const whatsNewModal = document.getElementById('whatsNewModal');

    if (whatsNewBtn) {
        whatsNewBtn.addEventListener('click', () => openWhatsNewModal());
    }
    if (closeWhatsNewBtn) {
        closeWhatsNewBtn.addEventListener('click', () => closeWhatsNewModal());
    }
    if (ackWhatsNewBtn) {
        ackWhatsNewBtn.addEventListener('click', () => closeWhatsNewModal());
    }
    if (whatsNewModal) {
        whatsNewModal.addEventListener('click', (event) => {
            if (event.target === whatsNewModal) {
                closeWhatsNewModal();
            }
        });
    }
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && whatsNewModal?.classList.contains('is-open')) {
            closeWhatsNewModal();
        }
    });
}

function openWhatsNewModal() {
    const modal = document.getElementById('whatsNewModal');
    const modalBody = document.getElementById('whatsNewModalBody');
    if (!modal) return;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (modalBody) {
        modalBody.scrollTop = 0;
    }
    try {
        localStorage.setItem(WHATS_NEW_STORAGE_KEY, CURRENT_APP_VERSION);
    } catch (_err) {}
}

function closeWhatsNewModal() {
    const modal = document.getElementById('whatsNewModal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    try {
        localStorage.setItem(WHATS_NEW_STORAGE_KEY, CURRENT_APP_VERSION);
    } catch (_err) {}
}

function checkAutoOpenWhatsNewModal() {
    try {
        const lastSeenVersion = localStorage.getItem(WHATS_NEW_STORAGE_KEY);
        if (lastSeenVersion !== CURRENT_APP_VERSION) {
            openWhatsNewModal();
        }
    } catch (_err) {
        openWhatsNewModal();
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
        renderChangeLog({
            lastModifiedAt: settings.settings_last_modified_at,
            modifiedBy: settings.settings_modified_by,
            changeSummary: settings.settings_change_summary
        });
    }
    latestLoadedSettings = settings || {};
    renderDatabaseAndBackupStatus(latestLoadedSettings);
    resetDirtyTracking();
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
    setSaveButtonState('saving');
    const settingsPayload = getCurrentSettingsPayload();
    const currentSnapshot = buildSettingsSnapshot(settingsPayload);
    const previousSnapshotObj = parseSettingsSnapshot(initialFormSnapshot);
    const currentSnapshotObj = parseSettingsSnapshot(currentSnapshot);
    const changedFields = getChangedFields(previousSnapshotObj, currentSnapshotObj);
    const modifiedAtIso = new Date().toISOString();
    const modifiedBy = await resolveModifiedBy();
    const changeSummary = changedFields.length
        ? `تم تعديل: ${changedFields.join('، ')}`
        : 'تم الضغط على حفظ بدون تغيير حقول.';
    const settings = {
        ...settingsPayload,
        settings_last_modified_at: modifiedAtIso,
        settings_modified_by: modifiedBy,
        settings_change_summary: changeSummary
    };

    try {
        const result = await window.electronAPI.saveSettings(settings);
        if (result.success) {
            setSaveButtonState('success');
            renderChangeLog({
                lastModifiedAt: modifiedAtIso,
                modifiedBy,
                changeSummary
            });
            initialFormSnapshot = currentSnapshot;
            if (window.showToast) window.showToast(t('settings.alerts.saveSuccess', 'تم حفظ الإعدادات بنجاح'), 'success');
            saveStateTimer = setTimeout(() => setSaveButtonState('idle'), 1800);
        } else {
            setSaveButtonState('error');
            if (window.showToast) window.showToast(t('settings.alerts.saveError', 'حدث خطأ أثناء الحفظ'), 'error');
            saveStateTimer = setTimeout(() => setSaveButtonState('idle'), 2200);
        }
    } catch (error) {
        setSaveButtonState('error');
        if (window.showToast) window.showToast(t('settings.alerts.saveError', 'حدث خطأ أثناء الحفظ'), 'error');
        saveStateTimer = setTimeout(() => setSaveButtonState('idle'), 2200);
    }
}

function setSaveButtonState(state) {
    if (!saveBtn) return;
    const iconEl = saveBtn.querySelector('i');
    const textEl = saveBtn.querySelector('.btn-save-text');

    if (saveStateTimer) {
        clearTimeout(saveStateTimer);
        saveStateTimer = null;
    }

    saveBtn.classList.remove('is-saving', 'is-success', 'is-error');
    saveBtn.disabled = false;
    saveBtn.dataset.saveState = state;

    if (state === 'saving') {
        saveBtn.classList.add('is-saving');
        saveBtn.disabled = true;
        if (iconEl) iconEl.className = 'fas fa-spinner fa-spin';
        if (textEl) textEl.textContent = 'جاري الحفظ...';
        return;
    }

    if (state === 'success') {
        saveBtn.classList.add('is-success');
        if (iconEl) iconEl.className = 'fas fa-check';
        if (textEl) textEl.textContent = 'تم الحفظ';
        return;
    }

    if (state === 'error') {
        saveBtn.classList.add('is-error');
        if (iconEl) iconEl.className = 'fas fa-exclamation-triangle';
        if (textEl) textEl.textContent = 'فشل الحفظ';
        return;
    }

    if (iconEl) iconEl.className = 'fas fa-save';
    if (textEl) textEl.textContent = t('settings.saveSettings', 'حفظ الإعدادات');
}

function getCurrentSettingsPayload() {
    const imgEl = profileImagePreview.querySelector('img');
    return {
        companyName: companyNameInput.value,
        companyAddress: companyAddressInput.value,
        companyPhone: companyPhoneInput.value,
        invoiceFooter: invoiceFooterInput.value,
        profileImage: imgEl ? imgEl.src : ''
    };
}

function buildSettingsSnapshot(payload) {
    const normalized = {};
    SETTINGS_TRACKING_FIELDS.forEach(({ key }) => {
        normalized[key] = String(payload[key] || '').trim();
    });
    return JSON.stringify(normalized);
}

function parseSettingsSnapshot(snapshot) {
    try {
        return JSON.parse(snapshot || '{}');
    } catch (error) {
        return {};
    }
}

function getChangedFields(previousSnapshot, currentSnapshot) {
    const changed = [];
    SETTINGS_TRACKING_FIELDS.forEach(({ key, label }) => {
        if ((previousSnapshot[key] || '') !== (currentSnapshot[key] || '')) {
            changed.push(label);
        }
    });
    return changed;
}

function resetDirtyTracking() {
    initialFormSnapshot = buildSettingsSnapshot(getCurrentSettingsPayload());
}

function formatDatabaseSize(bytes) {
    const numericBytes = Number(bytes);
    if (!Number.isFinite(numericBytes) || numericBytes <= 0) {
        return 'أقل من 1 ميجابايت';
    }
    if (numericBytes < 1024) {
        return `${numericBytes} بايت`;
    }
    if (numericBytes < 1024 * 1024) {
        return `${(numericBytes / 1024).toFixed(1)} كيلوبايت (KB)`;
    }
    return `${(numericBytes / (1024 * 1024)).toFixed(2)} ميجابايت (MB)`;
}

function formatBackupRelativeAge(diffMs) {
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    if (totalMinutes < 1) {
        return 'منذ لحظات';
    }
    if (totalMinutes < 60) {
        return `منذ ${totalMinutes} دقيقة`;
    }
    const totalHours = Math.floor(totalMinutes / 60);
    if (totalHours < 24) {
        return totalHours === 1 ? 'منذ ساعة واحدة' : `منذ ${totalHours} ساعة`;
    }
    const totalDays = Math.floor(totalHours / 24);
    if (totalDays === 1) {
        return 'منذ يوم واحد';
    }
    if (totalDays === 2) {
        return 'منذ يومين';
    }
    if (totalDays <= 10) {
        return `منذ ${totalDays} أيام`;
    }
    return `منذ ${totalDays} يوماً`;
}

function renderDatabaseAndBackupStatus(settings = {}) {
    const dbHealthIconEl = document.getElementById('dbHealthIconEl');
    const dbHealthBadgeEl = document.getElementById('dbHealthBadgeEl');
    const dbHealthSubEl = document.getElementById('dbHealthSubEl');
    const dbSizeValueEl = document.getElementById('dbSizeValueEl');
    const dbSizeSubEl = document.getElementById('dbSizeSubEl');
    const backupStatusIconEl = document.getElementById('backupStatusIconEl');
    const backupSmartBadgeEl = document.getElementById('backupSmartBadgeEl');
    const lastBackupDateEl = document.getElementById('lastBackupDateEl');

    const isHealthy = settings.db_health_ok !== false;
    if (dbHealthBadgeEl) {
        dbHealthBadgeEl.className = `sys-status-badge ${isHealthy ? 'status-safe' : 'status-danger'}`;
        dbHealthBadgeEl.innerHTML = isHealthy
            ? '<i class="fas fa-check-circle"></i> سليمة ومستقرة (OK)'
            : '<i class="fas fa-exclamation-triangle"></i> تنبيه في سلامة البيانات';
    }
    if (dbHealthSubEl) {
        dbHealthSubEl.textContent = isHealthy
            ? 'سلامة الجداول والفهارس مؤكدة تلقائياً'
            : `نتيجة الفحص: ${settings.db_health_status || 'تحتاج مراجعة'}`;
    }
    if (dbHealthIconEl) {
        dbHealthIconEl.className = `info-item-icon ${isHealthy ? 'status-icon-safe' : 'status-icon-danger'}`;
    }

    if (dbSizeValueEl) {
        let sizeBytes = Number(settings.db_size_bytes || 0);
        if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
            const serializedLength = JSON.stringify(settings || {}).length;
            sizeBytes = Math.max(131072, serializedLength * 2);
        }
        dbSizeValueEl.textContent = formatDatabaseSize(sizeBytes);
    }
    if (dbSizeSubEl) {
        dbSizeSubEl.textContent = 'الحجم الفعلي لقاعدة البيانات المحلية';
    }

    let rawBackupAt = settings.last_backup_at || '';
    let rawBackupMode = settings.last_backup_mode || '';
    if (!rawBackupAt) {
        try {
            rawBackupAt = localStorage.getItem('settings_last_backup_at') || '';
            rawBackupMode = rawBackupMode || localStorage.getItem('settings_last_backup_mode') || '';
        } catch (_err) {}
    }

    const parsedBackupDate = rawBackupAt ? new Date(rawBackupAt) : null;
    const hasValidBackupDate = Boolean(parsedBackupDate && !Number.isNaN(parsedBackupDate.getTime()));

    if (!hasValidBackupDate) {
        if (backupSmartBadgeEl) {
            backupSmartBadgeEl.className = 'sys-status-badge status-danger';
            backupSmartBadgeEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> لا توجد نسخة مسجلة بعد';
        }
        if (lastBackupDateEl) {
            lastBackupDateEl.textContent = 'لم يتم تسجيل نسخة احتياطية ناجحة حتى الآن';
        }
        if (backupStatusIconEl) {
            backupStatusIconEl.className = 'info-item-icon status-icon-danger';
        }
        return;
    }

    const diffMs = Math.max(0, Date.now() - parsedBackupDate.getTime());
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    const formattedDate = formatAuditDate(rawBackupAt);
    const relativeAge = formatBackupRelativeAge(diffMs);
    const modeLabel = rawBackupMode === 'cloud_and_local'
        ? 'محلي + سحابي'
        : (rawBackupMode === 'cloud' ? 'سحابي' : 'محلي');

    if (lastBackupDateEl) {
        lastBackupDateEl.textContent = `${formattedDate} (${relativeAge} • ${modeLabel})`;
    }

    if (diffDays <= 3) {
        if (backupSmartBadgeEl) {
            backupSmartBadgeEl.className = 'sys-status-badge status-safe';
            backupSmartBadgeEl.innerHTML = '<i class="fas fa-check-circle"></i> نسخة حديثة وآمنة';
        }
        if (backupStatusIconEl) {
            backupStatusIconEl.className = 'info-item-icon status-icon-safe';
        }
    } else if (diffDays <= 7) {
        if (backupSmartBadgeEl) {
            backupSmartBadgeEl.className = 'sys-status-badge status-warning';
            backupSmartBadgeEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> تنبيه: مر أكثر من 3 أيام';
        }
        if (backupStatusIconEl) {
            backupStatusIconEl.className = 'info-item-icon status-icon-warning';
        }
    } else {
        if (backupSmartBadgeEl) {
            backupSmartBadgeEl.className = 'sys-status-badge status-danger';
            backupSmartBadgeEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> متأخرة: تجاوزت 7 أيام';
        }
        if (backupStatusIconEl) {
            backupStatusIconEl.className = 'info-item-icon status-icon-danger';
        }
    }
}

function renderChangeLog({ lastModifiedAt, modifiedBy, changeSummary }) {
    if (changeLogLastModifiedEl) {
        changeLogLastModifiedEl.textContent = formatAuditDate(lastModifiedAt) || 'لا يوجد تعديل مسجل بعد';
    }
    if (changeLogModifiedByEl) {
        changeLogModifiedByEl.textContent = modifiedBy || '-';
    }
    if (changeLogSummaryEl) {
        changeLogSummaryEl.textContent = changeSummary || '-';
    }
}

function formatAuditDate(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('ar-EG', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

async function resolveModifiedBy() {
    try {
        if (window.electronAPI && typeof window.electronAPI.getActiveAuthUser === 'function') {
            let activeUser = null;
            if (typeof window.electronAPI.getAuthSessionToken === 'function') {
                const sessionToken = await window.electronAPI.getAuthSessionToken();
                activeUser = await window.electronAPI.getActiveAuthUser({ sessionToken });
            } else {
                activeUser = await window.electronAPI.getActiveAuthUser({});
            }
            if (activeUser && activeUser.username) {
                return activeUser.username;
            }
        }
    } catch (error) {
        // Ignore and fallback.
    }

    return 'مستخدم غير محدد';
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
        const localBackupMessage = fmt(t('settings.status.backupSavedAt'), { path: result.path });
        const cloudSuccess = Boolean(result.cloud && result.cloud.success === true);
        const backupTimestampIso = new Date().toISOString();
        const backupMode = cloudSuccess ? 'cloud_and_local' : 'local';
        try {
            localStorage.setItem('settings_last_backup_at', backupTimestampIso);
            localStorage.setItem('settings_last_backup_mode', backupMode);
        } catch (_err) {}
        try {
            await window.electronAPI.saveSettings({
                last_backup_at: backupTimestampIso,
                last_backup_mode: backupMode
            });
        } catch (_err) {}
        latestLoadedSettings = {
            ...latestLoadedSettings,
            last_backup_at: backupTimestampIso,
            last_backup_mode: backupMode
        };
        renderDatabaseAndBackupStatus(latestLoadedSettings);

        if (cloudSuccess) {
            setStatus(backupStatusEl, `${localBackupMessage} (تم الرفع السحابي بنجاح)`);
            if (window.showToast && typeof window.showToast === 'function') {
                window.showToast('تم الحفظ محليًا وعلى السحابة بنجاح.', 'success');
            } else if (window.toast && typeof window.toast.success === 'function') {
                window.toast.success('تم الحفظ محليًا وعلى السحابة بنجاح.');
            }
            return;
        }

        const cloudError = result.cloud && result.cloud.error
            ? result.cloud.error
            : 'تعذر رفع النسخة للسحابة.';
        setStatus(backupStatusEl, `${localBackupMessage} (فشل الحفظ السحابي)`);
        if (window.showToast && typeof window.showToast === 'function') {
            window.showToast(`تم الحفظ المحلي بنجاح، لكن فشل الحفظ السحابي: ${cloudError}`, 'warning');
        } else if (window.toast && typeof window.toast.error === 'function') {
            window.toast.error(`تم الحفظ المحلي بنجاح، لكن فشل الحفظ السحابي: ${cloudError}`);
        }
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
    const confirmRestore = typeof window.showConfirmDialog === 'function'
        ? await window.showConfirmDialog(t('settings.alerts.restoreConfirm'))
        : false;
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
            const restartErrorMessage = t('settings.alerts.restoreRestartError');
            setStatus(restoreStatusEl, restartErrorMessage, true);
            if (window.toast && typeof window.toast.error === 'function') {
                window.toast.error(restartErrorMessage);
            }
            await window.electronAPI.restartApp();
        }
    }
}

let updaterListenersBound = false;
let removeUpdateMessageListener = null;
let removeUpdateProgressListener = null;

function setupUpdaterListeners() {
    if (updaterListenersBound) return;
    if (!window.electronAPI) return;

    if (typeof window.electronAPI.onUpdateMessage === 'function') {
        removeUpdateMessageListener = window.electronAPI.onUpdateMessage((status, info) => {
            const statusText = document.getElementById('updateStatusText');
            const progressContainer = document.getElementById('updateProgressContainer');
            const checkUpdatesBtn = document.getElementById('checkUpdatesBtn');
            
            if (status === 'checking') {
                statusText.textContent = 'جاري الفحص عن تحديثات...';
                statusText.style.color = '';
                if (checkUpdatesBtn) checkUpdatesBtn.disabled = true;
            } else if (status === 'available') {
                statusText.textContent = 'يتوفر تحديث جديد! جاري التحميل...';
                statusText.style.color = '';
                if (progressContainer) progressContainer.style.display = 'block';
                if (checkUpdatesBtn) checkUpdatesBtn.disabled = true;
            } else if (status === 'not-available') {
                statusText.textContent = 'النظام محدث بالفعل.';
                statusText.style.color = '';
                if (checkUpdatesBtn) checkUpdatesBtn.disabled = false;
            } else if (status === 'downloaded') {
                statusText.textContent = 'تم تنزيل التحديث بنجاح! سيتم إعادة التشغيل لتثبيت التحديث.';
                statusText.style.color = '';
                if (checkUpdatesBtn) checkUpdatesBtn.disabled = true;
            } else if (status === 'error') {
                statusText.textContent = `حدث خطأ أثناء التحديث: ${info || 'فشل الاتصال بخادم التحديثات'}`;
                statusText.style.color = '#dc2626';
                if (checkUpdatesBtn) checkUpdatesBtn.disabled = false;
                if (progressContainer) progressContainer.style.display = 'none';
            }
        });
    }

    if (typeof window.electronAPI.onUpdateDownloadProgress === 'function') {
        removeUpdateProgressListener = window.electronAPI.onUpdateDownloadProgress((progressObj) => {
            const progressBar = document.getElementById('updateProgressBar');
            const progressPercent = document.getElementById('updateProgressPercent');
            const progressContainer = document.getElementById('updateProgressContainer');
            
            if (progressContainer) progressContainer.style.display = 'block';
            
            const percent = progressObj && progressObj.percent ? Math.round(progressObj.percent) : 0;
            if (progressBar) progressBar.style.width = `${percent}%`;
            if (progressPercent) progressPercent.textContent = `${percent}%`;
        });
    }

    updaterListenersBound = true;
}

window.addEventListener('unload', () => {
    if (typeof removeUpdateMessageListener === 'function') removeUpdateMessageListener();
    if (typeof removeUpdateProgressListener === 'function') removeUpdateProgressListener();
});

async function handleCheckUpdates() {
    if (!window.electronAPI || typeof window.electronAPI.checkForUpdates !== 'function') {
        if (window.showToast) window.showToast('ميزة التحديث التلقائي غير مدعومة في هذه البيئة', 'error');
        return;
    }

    const statusText = document.getElementById('updateStatusText');
    if (statusText) {
        statusText.textContent = 'جاري الاتصال بالسيرفر للفحص...';
        statusText.style.color = '';
    }

    try {
        const res = await window.electronAPI.checkForUpdates();
        if (!res || !res.success) {
            if (statusText) {
                statusText.textContent = `تعذر الفحص: ${res ? res.error : 'خطأ غير معروف'}`;
                statusText.style.color = '#dc2626';
            }
        }
    } catch (err) {
        if (statusText) {
            statusText.textContent = `تعذر الفحص: ${err.message}`;
            statusText.style.color = '#dc2626';
        }
    }
}

