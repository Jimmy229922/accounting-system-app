let companyNameInput, companyAddressInput, companyPhoneInput, invoiceFooterInput, settingsForm;
let backupBtn, restoreBtn, backupStatusEl, restoreStatusEl;

document.addEventListener('DOMContentLoaded', () => {
    renderPage();
    initializeElements();
    loadSettings();
});

function renderPage() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <nav class="top-nav">
            <div class="nav-brand">نظام المحاسبة</div>
            <ul class="nav-links">
                <li><a href="../dashboard/index.html">لوحة التحكم</a></li>
                <li class="dropdown">
                    <a href="#">البيانات الأساسية</a>
                    <div class="dropdown-content">
                        <a href="../items/units.html">الوحدات</a>
                        <a href="../items/items.html">الأصناف</a>
                        <a href="../customers/index.html">العملاء والموردين</a>
                    </div>
                </li>
                <li><a href="../sales/index.html">المبيعات</a></li>
                <li><a href="../purchases/index.html">المشتريات</a></li>
                <li><a href="../inventory/index.html">المخزن</a></li>
                <li><a href="../finance/index.html">المالية</a></li>
                <li class="dropdown">
                    <a href="#">التقارير</a>
                    <div class="dropdown-content">
                        <a href="../reports/index.html">التقارير العامة</a>
                        <a href="../customer-reports/index.html">تقارير العملاء</a>
                    </div>
                </li>
                <li><a href="#" class="active">الإعدادات</a></li>
            </ul>
        </nav>

        <main class="content">
            <div class="settings-container">
                <h1>إعدادات النظام</h1>
                <form id="settingsForm">
                    <div class="form-group">
                        <label>اسم الشركة / المؤسسة</label>
                        <input type="text" id="companyName" class="form-control" placeholder="أدخل اسم الشركة">
                    </div>
                    <div class="form-group">
                        <label>العنوان</label>
                        <input type="text" id="companyAddress" class="form-control" placeholder="أدخل العنوان">
                    </div>
                    <div class="form-group">
                        <label>رقم الهاتف</label>
                        <input type="text" id="companyPhone" class="form-control" placeholder="أدخل رقم الهاتف">
                    </div>
                    <div class="form-group">
                        <label>ملاحظات أسفل الفاتورة</label>
                        <textarea id="invoiceFooter" class="form-control" rows="3" placeholder="نص يظهر أسفل الفواتير"></textarea>
                    </div>
                    <button type="submit" class="btn-save">حفظ الإعدادات</button>
                </form>

                <h2 class="section-title">النسخ الاحتياطي واستعادة البيانات</h2>
                <div class="card-grid">
                    <div class="card">
                        <h3>إنشاء نسخة احتياطية</h3>
                        <p>احفظ نسخة منفصلة تحتوي على جميع بيانات النظام في موقع من اختيارك.</p>
                        <button id="backupBtn" class="btn-secondary">إنشاء نسخة احتياطية الآن</button>
                        <small id="backupStatus" class="status-text"></small>
                    </div>
                    <div class="card">
                        <h3>إعادة توجيه البيانات من نسخة</h3>
                        <p>استبدل قاعدة البيانات الحالية بملف نسخة احتياطية محفوظ لديك، ثم سيعاد تشغيل النظام.</p>
                        <button id="restoreBtn" class="btn-warning">استعادة من نسخة احتياطية</button>
                        <small id="restoreStatus" class="status-text"></small>
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

    settingsForm.addEventListener('submit', saveSettings);
    backupBtn.addEventListener('click', handleBackup);
    restoreBtn.addEventListener('click', handleRestore);
}

async function loadSettings() {
    const settings = await window.electronAPI.getSettings();
    if (settings) {
        companyNameInput.value = settings.companyName || '';
        companyAddressInput.value = settings.companyAddress || '';
        companyPhoneInput.value = settings.companyPhone || '';
        invoiceFooterInput.value = settings.invoiceFooter || '';
    }
}

async function saveSettings(e) {
    e.preventDefault();
    const settings = {
        companyName: companyNameInput.value,
        companyAddress: companyAddressInput.value,
        companyPhone: companyPhoneInput.value,
        invoiceFooter: invoiceFooterInput.value
    };

    const result = await window.electronAPI.saveSettings(settings);
    if (result.success) {
        alert('تم حفظ الإعدادات بنجاح');
    } else {
        alert('حدث خطأ أثناء الحفظ');
    }
}

function setStatus(element, message, isError = false) {
    if (!element) return;
    element.textContent = message || '';
    element.style.color = isError ? '#b91c1c' : '#111827';
}

async function handleBackup() {
    setStatus(backupStatusEl, 'جاري إنشاء النسخة الاحتياطية...');
    const result = await window.electronAPI.backupDatabase();

    if (result.success) {
        setStatus(backupStatusEl, `تم حفظ النسخة في: ${result.path}`);
    } else if (result.canceled) {
        setStatus(backupStatusEl, 'تم إلغاء العملية.');
    } else {
        setStatus(backupStatusEl, `تعذر إنشاء النسخة الاحتياطية: ${result.error || 'خطأ غير معروف'}`, true);
    }
}

async function handleRestore() {
    const confirmRestore = confirm('سيتم استبدال البيانات الحالية بالنسخة التي ستختارها، ثم سيعاد تشغيل النظام. هل تريد المتابعة؟');
    if (!confirmRestore) return;

    setStatus(restoreStatusEl, 'جاري استعادة البيانات من النسخة المختارة...');
    const result = await window.electronAPI.restoreDatabase();

    if (result.success) {
        setStatus(restoreStatusEl, 'تم الاستعادة بنجاح. سيتم إعادة تشغيل النظام الآن لعرض البيانات.');
        await window.electronAPI.restartApp();
    } else if (result.canceled) {
        setStatus(restoreStatusEl, 'تم إلغاء العملية.');
    } else {
        setStatus(restoreStatusEl, `تعذر الاستعادة: ${result.error || 'خطأ غير معروف'}`, true);
        if (result.needsRestart) {
            alert('حدث خطأ أثناء الاستعادة. سيتم إعادة تشغيل النظام لضمان سلامة البيانات.');
            await window.electronAPI.restartApp();
        }
    }
}
