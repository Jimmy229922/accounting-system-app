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
                <li><a href="../payments/receipt.html">تحصيل من عميل</a></li>
                <li><a href="../payments/payment.html">سداد لمورد</a></li>
                <li class="dropdown">
                    <a href="#">التقارير</a>
                    <div class="dropdown-content">
                        <a href="../reports/index.html">التقارير العامة</a>
                        <a href="../customer-reports/index.html">تقارير العملاء</a>
                        <a href="../reports/debtor-creditor/index.html">كشف المدين والدائن</a>
                    </div>
                </li>
                <li><a href="../settings/index.html">الإعدادات</a></li>
            </ul>
        </nav>

        <main class="content">
            <section class="dashboard-hero">
                <div>
                    <h1>لوحة التحكم</h1>
                    <p>نظرة عامة على أداء نشاطك التجاري</p>
                    <div class="last-updated" id="lastUpdated">
                        <i class="fas fa-clock"></i> آخر تحديث: —
                    </div>
                </div>
                <div class="dashboard-actions">
                    <button id="refreshBtn" class="btn-refresh">
                        <i class="fas fa-sync-alt"></i> تحديث البيانات
                    </button>
                </div>
            </section>

            <!-- Stats Grid -->
            <section class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-header">
                        <div class="metric-icon"><i class="fas fa-boxes"></i></div>
                    </div>
                    <h3 class="metric-value" id="stockValue">—</h3>
                    <p class="metric-label">إجمالي قيمة المخزون</p>
                </div>
                
                <div class="metric-card">
                    <div class="metric-header">
                        <div class="metric-icon"><i class="fas fa-tags"></i></div>
                    </div>
                    <h3 class="metric-value" id="itemsCount">—</h3>
                    <p class="metric-label">عدد الأصناف المسجلة</p>
                </div>

                <div class="metric-card">
                    <div class="metric-header">
                        <div class="metric-icon"><i class="fas fa-users"></i></div>
                    </div>
                    <h3 class="metric-value" id="customersCount">—</h3>
                    <p class="metric-label">قاعدة العملاء</p>
                </div>

                <div class="metric-card">
                    <div class="metric-header">
                        <div class="metric-icon"><i class="fas fa-truck"></i></div>
                    </div>
                    <h3 class="metric-value" id="suppliersCount">—</h3>
                    <p class="metric-label">شبكة الموردين</p>
                </div>
            </section>

            <!-- Quick Actions -->
            <h3 class="section-title"><i class="fas fa-bolt"></i> إجراءات سريعة</h3>
            <section class="quick-actions-grid">
                <a href="../sales/index.html" class="action-card">
                    <div class="action-icon"><i class="fas fa-shopping-cart"></i></div>
                    <span class="action-label">فاتورة بيع جديدة</span>
                </a>
                <a href="../purchases/index.html" class="action-card">
                    <div class="action-icon"><i class="fas fa-shopping-bag"></i></div>
                    <span class="action-label">فاتورة شراء جديدة</span>
                </a>
                <a href="../items/items.html" class="action-card">
                    <div class="action-icon"><i class="fas fa-plus-circle"></i></div>
                    <span class="action-label">إضافة صنف</span>
                </a>
                <a href="../customers/index.html" class="action-card">
                    <div class="action-icon"><i class="fas fa-user-plus"></i></div>
                    <span class="action-label">إضافة عميل</span>
                </a>
                <a href="../reports/index.html" class="action-card">
                    <div class="action-icon"><i class="fas fa-chart-pie"></i></div>
                    <span class="action-label">التقارير</span>
                </a>
            </section>

            <!-- Insights & Activity -->
            <div class="dashboard-bottom-grid">
                <section class="card">
                    <h3 class="section-title" style="margin-top: 0;"><i class="fas fa-lightbulb"></i> رؤى وملاحظات</h3>
                    <ul class="insights-list" id="insightsList">
                        <li>جاري تحليل البيانات...</li>
                    </ul>
                </section>
                
                <section class="card">
                    <h3 class="section-title" style="margin-top: 0;"><i class="fas fa-info-circle"></i> حالة النظام</h3>
                    <div style="display: flex; flex-direction: column; gap: 15px;">
                        <div style="display: flex; justify-content: space-between; padding: 10px; background: var(--bg-color); border-radius: 8px;">
                            <span>حالة الاتصال</span>
                            <span style="color: #10b981; font-weight: bold;">متصل <i class="fas fa-check-circle"></i></span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 10px; background: var(--bg-color); border-radius: 8px;">
                            <span>نسخة البرنامج</span>
                            <span style="font-weight: bold;">v1.0.0</span>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    `;
}

function bindEvents() {
    refreshBtn = document.getElementById('refreshBtn');
    lastUpdatedEl = document.getElementById('lastUpdated');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadDashboardStats);
    }
    startRealTimeClock();
}

function startRealTimeClock() {
    const update = () => {
        const now = new Date();
        const formatted = now.toLocaleString('ar-EG');
        if (lastUpdatedEl) {
            lastUpdatedEl.innerHTML = `<i class="fas fa-clock"></i> ${formatted}`;
        }
    };
    update();
    setInterval(update, 1000);
}

function updateTimestamp() {
    // Deprecated in favor of real-time clock
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
    let icon;
    try {
        if (refreshBtn) {
            refreshBtn.disabled = true;
            icon = refreshBtn.querySelector('i');
            if (icon) icon.classList.add('refresh-spin');
        }
        
        const stats = await window.electronAPI.getDashboardStats();
        lastStats = stats;

        document.getElementById('customersCount').textContent = stats.customersCount;
        document.getElementById('suppliersCount').textContent = stats.suppliersCount;
        document.getElementById('itemsCount').textContent = stats.itemsCount;
        document.getElementById('stockValue').textContent = `${stats.stockValue.toFixed(2)} ج.م`;

        // updateTimestamp(); // Removed as we use real-time clock now
        renderInsights(stats);
        
        // Simulate a small delay to let the user see the animation if the data loads too fast
        await new Promise(resolve => setTimeout(resolve, 500));
        
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
        const list = document.getElementById('insightsList');
        if (list) list.innerHTML = '<li>تعذر تحميل البيانات، حاول مرة أخرى.</li>';
    } finally {
        if (refreshBtn) {
            refreshBtn.disabled = false;
            if (icon) icon.classList.remove('refresh-spin');
        }
    }
}
