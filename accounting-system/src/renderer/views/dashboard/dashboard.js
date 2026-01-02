let refreshBtn;
let lastUpdatedEl;
let lastStats = null;

document.addEventListener('DOMContentLoaded', () => {
    renderPage();
    bindEvents();
    loadDashboardStats();
});

function renderPage() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <nav class="top-nav">
            <div class="nav-brand">نظام المحاسبة</div>
            <ul class="nav-links">
                <li><a href="#" class="active">لوحة التحكم</a></li>
                <li class="dropdown">
                    <a href="#">البيانات الأساسية</a>
                    <div class="dropdown-content">
                        <a href="../items/units.html">الوحدات</a>
                        <a href="../items/items.html">الأصناف</a>
                        <a href="../customers/index.html">العملاء والموردين</a>
                        <a href="../opening-balance/index.html">بيانات أول المدة</a>
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
                <li><a href="../settings/index.html">الإعدادات</a></li>
            </ul>
        </nav>

        <main class="content">
            <section class="dashboard-hero">
                <div>
                    <h1>لوحة التحكم</h1>
                    <p>لمحة سريعة عن وضع المخزن والعملاء والموردين.</p>
                    <div class="last-updated" id="lastUpdated">آخر تحديث: —</div>
                </div>
                <div class="dashboard-actions">
                    <button id="refreshBtn" class="btn-refresh">تحديث الإحصائيات</button>
                </div>
            </section>

            <section class="metrics-grid">
                <div class="metric-card">
                    <p class="metric-label">إجمالي قيمة المخزن</p>
                    <div class="metric-value" id="stockValue">—</div>
                    <span class="metric-pill">قيمة المخزون</span>
                </div>
                <div class="metric-card">
                    <p class="metric-label">عدد الأصناف</p>
                    <div class="metric-value" id="itemsCount">—</div>
                    <span class="metric-pill">إدارة الأصناف</span>
                </div>
                <div class="metric-card">
                    <p class="metric-label">عدد العملاء</p>
                    <div class="metric-value" id="customersCount">—</div>
                    <span class="metric-pill">علاقات العملاء</span>
                </div>
                <div class="metric-card">
                    <p class="metric-label">عدد الموردين</p>
                    <div class="metric-value" id="suppliersCount">—</div>
                    <span class="metric-pill">شبكة التوريد</span>
                </div>
            </section>

            <section class="insights-card">
                <h3 class="insights-title">ملاحظات سريعة</h3>
                <ul class="insights-list" id="insightsList">
                    <li>جاري تحميل البيانات...</li>
                </ul>
            </section>
        </main>
    `;
}

function bindEvents() {
    refreshBtn = document.getElementById('refreshBtn');
    lastUpdatedEl = document.getElementById('lastUpdated');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadDashboardStats);
    }
}

function updateTimestamp() {
    const now = new Date();
    const formatted = now.toLocaleString('ar-EG');
    if (lastUpdatedEl) {
        lastUpdatedEl.textContent = `آخر تحديث: ${formatted}`;
    }
}

function renderInsights(stats) {
    const insights = [];

    if (stats.itemsCount === 0) {
        insights.push('لم تتم إضافة أصناف بعد. ابدأ بإضافة الأصناف لتتبع المخزون.');
    } else {
        insights.push(`لديك ${stats.itemsCount} صنف. احرص على تحديث الأسعار والمخزون بانتظام.`);
    }

    if (stats.customersCount === 0) {
        insights.push('لا يوجد عملاء مسجلون حتى الآن. أضف أول عميل لبدء الفواتير.');
    } else {
        insights.push(`شبكة عملائك تضم ${stats.customersCount} عميل${stats.customersCount > 2 ? 'اً' : ''}.`);
    }

    if (stats.suppliersCount === 0) {
        insights.push('لا يوجد موردون مسجلون. أضف مورداً لتحديث المشتريات والمخزون.');
    } else {
        insights.push(`عدد الموردين المسجلين ${stats.suppliersCount}. تابع التوريد لضمان توافر الأصناف.`);
    }

    if (stats.stockValue > 0) {
        insights.push(`قيمة المخزون الحالية ${stats.stockValue.toFixed(2)} ج.م. راجع الأصناف ذات الحركة البطيئة لتحسين التدفق.`);
    } else {
        insights.push('قيمة المخزون 0. أضف الأصناف أو حدث الكميات لتظهر القيمة الحقيقية.');
    }

    const list = document.getElementById('insightsList');
    if (!list) return;
    list.innerHTML = insights.map(text => `<li>${text}</li>`).join('');
}

async function loadDashboardStats() {
    try {
        if (refreshBtn) refreshBtn.disabled = true;
        const stats = await window.electronAPI.getDashboardStats();
        lastStats = stats;

        document.getElementById('customersCount').textContent = stats.customersCount;
        document.getElementById('suppliersCount').textContent = stats.suppliersCount;
        document.getElementById('itemsCount').textContent = stats.itemsCount;
        document.getElementById('stockValue').textContent = `${stats.stockValue.toFixed(2)} ج.م`;

        updateTimestamp();
        renderInsights(stats);
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
        const list = document.getElementById('insightsList');
        if (list) list.innerHTML = '<li>تعذر تحميل البيانات، حاول مرة أخرى.</li>';
    } finally {
        if (refreshBtn) refreshBtn.disabled = false;
    }
}
