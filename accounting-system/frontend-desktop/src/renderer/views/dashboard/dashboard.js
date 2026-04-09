let refreshBtn;
let lastUpdatedEl;
let lastStats = null;
let chartPeriod = '7';
let ar = {};
const pageI18n = window.i18n?.createPageHelpers ? window.i18n.createPageHelpers(() => ar) : null;

function t(key, fallback = '') {
    return pageI18n ? pageI18n.t(key, fallback) : fallback;
}

function fmt(template, values = {}) {
    return pageI18n ? pageI18n.fmt(template, values) : String(template || '');
}

document.addEventListener('DOMContentLoaded', async () => {
    if (window.i18n && typeof window.i18n.loadArabicDictionary === 'function') {
        ar = await window.i18n.loadArabicDictionary();
    }
    renderPage();
    bindEvents();
    loadDashboardStats();
});

function getNavHTML() {
    if (window.navManager && typeof window.navManager.getTopNavHTML === 'function') {
        return window.navManager.getTopNavHTML(t);
    }
    return '';
}

function renderPage() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${getNavHTML()}

        <main class="content">
            <section class="dashboard-hero">
                <div class="hero-shapes">
                    <span class="hero-shape shape-1"></span>
                    <span class="hero-shape shape-2"></span>
                    <span class="hero-shape shape-3"></span>
                    <span class="hero-shape shape-4"></span>
                    <span class="hero-shape shape-5"></span>
                </div>
                <div class="hero-content">
                    <h1>${t('dashboard.title', 'لوحة التحكم')}</h1>
                    <p>${t('dashboard.subtitle', 'نظرة عامة على أداء نشاطك التجاري')}</p>
                </div>
                <div class="hero-bottom">
                    <div class="last-updated" id="lastUpdated">
                        <i class="fas fa-clock"></i> ${t('dashboard.lastUpdate', 'آخر تحديث: —')}
                    </div>
                    <div class="dashboard-actions">
                        <button id="refreshBtn" class="btn-refresh">
                            <i class="fas fa-sync-alt"></i> ${t('dashboard.refreshData', 'تحديث البيانات')}
                        </button>
                    </div>
                </div>
            </section>

            <!-- Quick Actions (Top) -->
            <section class="quick-actions-grid">
                <a href="../sales/index.html" class="action-card">
                    <div class="action-icon"><i class="fas fa-shopping-cart"></i></div>
                    <span class="action-label">${t('dashboard.newSaleInvoice', 'فاتورة بيع جديدة')}</span>
                </a>
                <a href="../purchases/index.html" class="action-card">
                    <div class="action-icon"><i class="fas fa-shopping-bag"></i></div>
                    <span class="action-label">${t('dashboard.newPurchaseInvoice', 'فاتورة شراء جديدة')}</span>
                </a>
                <a href="../items/items.html" class="action-card">
                    <div class="action-icon"><i class="fas fa-plus-circle"></i></div>
                    <span class="action-label">${t('dashboard.addItem', 'إضافة صنف')}</span>
                </a>
                <a href="../customers/index.html" class="action-card">
                    <div class="action-icon"><i class="fas fa-user-plus"></i></div>
                    <span class="action-label">${t('dashboard.addCustomer', 'إضافة عميل')}</span>
                </a>
                <a href="../reports/index.html" class="action-card">
                    <div class="action-icon"><i class="fas fa-chart-pie"></i></div>
                    <span class="action-label">${t('dashboard.reportsLink', 'التقارير')}</span>
                </a>
            </section>

            <!-- Today Summary -->
            <h3 class="section-title"><i class="fas fa-calendar-day"></i> ${t('dashboard.todaySummary', 'ملخص اليوم')}</h3>
            <div class="today-summary">
                <div class="today-stat">
                    <div class="today-stat-icon today-invoices"><i class="fas fa-file-invoice"></i></div>
                    <div class="today-stat-info">
                        <span class="today-stat-value" id="todayInvoices">—</span>
                        <span class="today-stat-label">${t('dashboard.todayInvoices', 'فواتير اليوم')}</span>
                    </div>
                </div>
                <div class="today-stat">
                    <div class="today-stat-icon today-sales"><i class="fas fa-cash-register"></i></div>
                    <div class="today-stat-info">
                        <span class="today-stat-value" id="todaySales">—</span>
                        <span class="today-stat-label">${t('dashboard.todaySalesTotal', 'مبيعات اليوم')}</span>
                    </div>
                </div>
                <div class="today-stat">
                    <div class="today-stat-icon today-collections"><i class="fas fa-hand-holding-usd"></i></div>
                    <div class="today-stat-info">
                        <span class="today-stat-value" id="todayCollections">—</span>
                        <span class="today-stat-label">${t('dashboard.todayCollections', 'تحصيلات اليوم')}</span>
                    </div>
                </div>
                <div class="today-stat">
                    <div class="today-stat-icon today-payments"><i class="fas fa-money-bill-wave"></i></div>
                    <div class="today-stat-info">
                        <span class="today-stat-value" id="todayPayments">—</span>
                        <span class="today-stat-label">${t('dashboard.todayPayments', 'مدفوعات اليوم')}</span>
                    </div>
                </div>
            </div>

            <!-- Financial Metrics Grid -->
            <section class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-header">
                        <div class="metric-icon"><i class="fas fa-chart-line"></i></div>
                    </div>
                    <h3 class="metric-value" id="salesMonth">—</h3>
                    <p class="metric-label">${t('dashboard.salesMonth', 'مبيعات الشهر')}</p>
                    <div class="metric-trend" id="salesMonthTrend"></div>
                </div>
                <div class="metric-card">
                    <div class="metric-header">
                        <div class="metric-icon"><i class="fas fa-shopping-basket"></i></div>
                    </div>
                    <h3 class="metric-value" id="purchasesMonth">—</h3>
                    <p class="metric-label">${t('dashboard.purchasesMonth', 'مشتريات الشهر')}</p>
                    <div class="metric-trend" id="purchasesMonthTrend"></div>
                </div>
                <div class="metric-card">
                    <div class="metric-header">
                        <div class="metric-icon"><i class="fas fa-coins"></i></div>
                    </div>
                    <h3 class="metric-value" id="netProfit">—</h3>
                    <p class="metric-label">${t('dashboard.netProfit', 'صافي الربح التقديري')}</p>
                </div>
                <div class="metric-card">
                    <div class="metric-header">
                        <div class="metric-icon"><i class="fas fa-landmark"></i></div>
                    </div>
                    <h3 class="metric-value" id="treasuryBalance">—</h3>
                    <p class="metric-label">${t('dashboard.treasuryBalance', 'رصيد الخزينة')}</p>
                </div>
                <div class="metric-card">
                    <div class="metric-header">
                        <div class="metric-icon"><i class="fas fa-boxes"></i></div>
                    </div>
                    <h3 class="metric-value" id="stockValue">—</h3>
                    <p class="metric-label">${t('dashboard.stockValue', 'إجمالي قيمة المخزون')}</p>
                </div>
                <div class="metric-card">
                    <div class="metric-header">
                        <div class="metric-icon"><i class="fas fa-tags"></i></div>
                    </div>
                    <h3 class="metric-value" id="itemsCount">—</h3>
                    <p class="metric-label">${t('dashboard.itemsCount', 'عدد الأصناف المسجلة')}</p>
                </div>
                <div class="metric-card">
                    <div class="metric-header">
                        <div class="metric-icon"><i class="fas fa-hand-holding-usd"></i></div>
                    </div>
                    <h3 class="metric-value" id="receivables">—</h3>
                    <p class="metric-label">${t('dashboard.receivables', 'المستحق على العملاء')}</p>
                </div>
                <div class="metric-card">
                    <div class="metric-header">
                        <div class="metric-icon"><i class="fas fa-file-invoice-dollar"></i></div>
                    </div>
                    <h3 class="metric-value" id="payables">—</h3>
                    <p class="metric-label">${t('dashboard.payables', 'المستحق للموردين')}</p>
                </div>
            </section>

            <!-- Chart Section -->
            <section class="chart-section card">
                <div class="chart-header">
                    <h3 class="section-title" style="margin: 0;"><i class="fas fa-chart-bar"></i> ${t('dashboard.chartTitle', 'حركة المبيعات والمشتريات')}</h3>
                    <div class="chart-controls">
                        <div class="chart-legend">
                            <span class="legend-item"><span class="legend-color legend-sales"></span> ${t('dashboard.salesLabel', 'المبيعات')}</span>
                            <span class="legend-item"><span class="legend-color legend-purchases"></span> ${t('dashboard.purchasesLabel', 'المشتريات')}</span>
                        </div>
                        <div class="chart-toggle">
                            <button class="chart-btn active" data-period="7">${t('dashboard.last7Days', 'آخر 7 أيام')}</button>
                            <button class="chart-btn" data-period="30">${t('dashboard.last30Days', 'آخر 30 يوم')}</button>
                        </div>
                    </div>
                </div>
                <canvas id="dashChart"></canvas>
            </section>

            <!-- Middle Grid: Recent Transactions + Top Items -->
            <div class="dashboard-middle-grid">
                <section class="card">
                    <h3 class="section-title" style="margin-top: 0;"><i class="fas fa-history"></i> ${t('dashboard.recentTransactions', 'آخر المعاملات')}</h3>
                    <div class="recent-table-wrap">
                        <table class="recent-table">
                            <thead>
                                <tr>
                                    <th>${t('dashboard.invoiceNum', 'رقم الفاتورة')}</th>
                                    <th>${t('dashboard.date', 'التاريخ')}</th>
                                    <th>${t('dashboard.typeLbl', 'النوع')}</th>
                                    <th>${t('dashboard.party', 'الطرف')}</th>
                                    <th>${t('dashboard.amount', 'المبلغ')}</th>
                                </tr>
                            </thead>
                            <tbody id="recentTransBody">
                                <tr><td colspan="5" style="text-align: center;">${t('dashboard.analyzingData', 'جاري تحليل البيانات...')}</td></tr>
                            </tbody>
                        </table>
                    </div>
                </section>
                <section class="card">
                    <h3 class="section-title" style="margin-top: 0;"><i class="fas fa-trophy"></i> ${t('dashboard.topItems', 'أكثر الأصناف مبيعاً')}</h3>
                    <div id="topItemsList" class="top-items-list">
                        <p style="text-align: center; color: var(--text-secondary);">${t('dashboard.analyzingData', 'جاري تحليل البيانات...')}</p>
                    </div>
                </section>
            </div>

            <!-- Bottom Grid: Alerts + System Status -->
            <div class="dashboard-bottom-grid">
                <section class="card">
                    <h3 class="section-title" style="margin-top: 0;"><i class="fas fa-bell"></i> ${t('dashboard.alertsTitle', 'تنبيهات')}</h3>
                    <ul class="alerts-list" id="alertsList">
                        <li>${t('dashboard.analyzingData', 'جاري تحليل البيانات...')}</li>
                    </ul>
                </section>
                
                <section class="card">
                    <h3 class="section-title" style="margin-top: 0;"><i class="fas fa-info-circle"></i> ${t('dashboard.systemStatusTitle', 'حالة النظام')}</h3>
                    <div class="system-status-grid">
                        <div class="status-row">
                            <span>${t('dashboard.connectionStatus', 'حالة الاتصال')}</span>
                            <span style="color: #10b981; font-weight: bold;">${t('dashboard.connected', 'متصل')} <i class="fas fa-check-circle"></i></span>
                        </div>
                        <div class="status-row">
                            <span>${t('dashboard.appVersion', 'نسخة البرنامج')}</span>
                            <span style="font-weight: bold;">v1.1.0</span>
                        </div>
                        <div class="status-row">
                            <span>${t('dashboard.customersCount', 'قاعدة العملاء')}</span>
                            <span style="font-weight: bold;" id="customersCount">—</span>
                        </div>
                        <div class="status-row">
                            <span>${t('dashboard.suppliersCount', 'شبكة الموردين')}</span>
                            <span style="font-weight: bold;" id="suppliersCount">—</span>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    `;
}

function money(val) {
    return (val || 0).toFixed(2) + ' ' + t('common.currency.egpSymbol', 'ج.م');
}

function trendHTML(percent) {
    if (percent > 0) return `<span class="trend-up"><i class="fas fa-arrow-up"></i> ${percent}%</span>`;
    if (percent < 0) return `<span class="trend-down"><i class="fas fa-arrow-down"></i> ${Math.abs(percent)}%</span>`;
    return `<span class="trend-same">— ${t('dashboard.trendSame', 'ثابت')}</span>`;
}

function formatNum(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return Math.round(n).toString();
}

function bindEvents() {
    refreshBtn = document.getElementById('refreshBtn');
    lastUpdatedEl = document.getElementById('lastUpdated');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadDashboardStats);
    }
    startRealTimeClock();

    // Chart period toggle
    document.querySelectorAll('.chart-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            chartPeriod = btn.dataset.period;
            if (lastStats && lastStats.chartData) renderChart(lastStats.chartData);
        });
    });

    // Redraw chart on resize
    window.addEventListener('resize', () => {
        if (lastStats && lastStats.chartData) renderChart(lastStats.chartData);
    });
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

function renderAlerts(alerts) {
    const list = document.getElementById('alertsList');
    if (!list) return;

    const items = [];

    if (alerts.lowStockItems && alerts.lowStockItems.length > 0) {
        alerts.lowStockItems.forEach(item => {
            items.push(`<li class="alert-item alert-warning"><i class="fas fa-exclamation-triangle"></i> ${fmt(t('dashboard.alerts.lowStock', '⚠️ {name} — المتبقي: {qty} (حد الطلب: {reorder})'), { name: item.name, qty: item.stock_quantity, reorder: item.reorder_level })}</li>`);
        });
    }

    if (alerts.highReceivables && alerts.highReceivables.length > 0) {
        alerts.highReceivables.forEach(item => {
            items.push(`<li class="alert-item alert-info"><i class="fas fa-coins"></i> ${fmt(t('dashboard.alerts.highReceivable', '💰 {name} — مستحقات: {amount} ج.م'), { name: item.name, amount: item.amount.toFixed(2) })}</li>`);
        });
    }

    if (alerts.oldInvoices && alerts.oldInvoices.length > 0) {
        alerts.oldInvoices.forEach(inv => {
            items.push(`<li class="alert-item alert-danger"><i class="fas fa-clock"></i> ${fmt(t('dashboard.alerts.oldInvoice', 'فاتورة ({number}) بمبلغ {amount} ج.م متأخرة منذ {days} يوم'), { number: inv.invoice_number, amount: inv.amount.toFixed(2), days: inv.days_old })}</li>`);
        });
    }

    if (items.length === 0) {
        items.push(`<li class="alert-item alert-success"><i class="fas fa-check-circle"></i> ${t('dashboard.alerts.noAlerts', '✅ لا توجد تنبيهات — كل شيء على ما يرام!')}</li>`);
    }

    list.innerHTML = items.join('');
}

function renderRecentTransactions(transactions) {
    const tbody = document.getElementById('recentTransBody');
    if (!tbody) return;

    if (!transactions || transactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary);">${t('dashboard.noTransactions', 'لا توجد معاملات بعد')}</td></tr>`;
        return;
    }

    tbody.innerHTML = transactions.map(tx => `
        <tr>
            <td><strong>${tx.invoice_number || '—'}</strong></td>
            <td>${tx.date || '—'}</td>
            <td><span class="type-badge type-${tx.type}">${tx.type === 'sale' ? t('dashboard.saleType', 'بيع') : t('dashboard.purchaseType', 'شراء')}</span></td>
            <td>${tx.party_name || '—'}</td>
            <td><strong>${(tx.amount || 0).toFixed(2)}</strong></td>
        </tr>
    `).join('');
}

function renderTopItems(topItems) {
    const container = document.getElementById('topItemsList');
    if (!container) return;

    if (!topItems || topItems.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: var(--text-secondary);">${t('dashboard.noSales', 'لا توجد مبيعات بعد')}</p>`;
        return;
    }

    container.innerHTML = `
        <table class="recent-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>${t('dashboard.itemName', 'الصنف')}</th>
                    <th>${t('dashboard.qtySold', 'الكمية')}</th>
                    <th>${t('dashboard.totalValue', 'القيمة')}</th>
                </tr>
            </thead>
            <tbody>
                ${topItems.map((item, i) => `
                    <tr>
                        <td><span class="top-item-rank">${i + 1}</span></td>
                        <td>${item.name}</td>
                        <td>${item.total_qty}</td>
                        <td><strong>${item.total_value.toFixed(2)}</strong></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderChart(chartData) {
    const canvas = document.getElementById('dashChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 20, bottom: 45, left: 65 };

    const days = parseInt(chartPeriod);
    const now = new Date();

    // Build daily data maps
    const salesMap = {};
    const purchasesMap = {};
    (chartData.dailySales || []).forEach(d => { salesMap[d.date] = d.total; });
    (chartData.dailyPurchases || []).forEach(d => { purchasesMap[d.date] = d.total; });

    const labels = [];
    const salesData = [];
    const purchasesData = [];

    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000);
        const dateStr = d.toISOString().slice(0, 10);
        labels.push(d.getDate() + '/' + (d.getMonth() + 1));
        salesData.push(salesMap[dateStr] || 0);
        purchasesData.push(purchasesMap[dateStr] || 0);
    }

    const maxVal = Math.max(...salesData, ...purchasesData, 100);
    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;

    ctx.clearRect(0, 0, width, height);

    // Get theme text color
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#888';

    // Grid lines
    ctx.strokeStyle = 'rgba(128,128,128,0.12)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = padding.top + (plotH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
    }

    // Y-axis labels
    ctx.fillStyle = textColor;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
        const y = padding.top + (plotH / 4) * i;
        const val = maxVal - (maxVal / 4) * i;
        ctx.fillText(formatNum(val), padding.left - 8, y + 4);
    }

    // Bars
    const barGroupWidth = plotW / days;
    const barWidth = Math.min(Math.max(barGroupWidth * 0.3, 4), 24);
    const gap = Math.max(barWidth * 0.15, 2);

    for (let i = 0; i < days; i++) {
        const x = padding.left + barGroupWidth * i + barGroupWidth / 2;

        // Sales bar
        const sH = Math.max((salesData[i] / maxVal) * plotH, 0);
        if (sH > 0) {
            const sg = ctx.createLinearGradient(0, padding.top + plotH - sH, 0, padding.top + plotH);
            sg.addColorStop(0, '#34d875');
            sg.addColorStop(1, '#11998e');
            ctx.fillStyle = sg;
            drawRoundRect(ctx, x - barWidth - gap / 2, padding.top + plotH - sH, barWidth, sH, 3);
        }

        // Purchases bar
        const pH = Math.max((purchasesData[i] / maxVal) * plotH, 0);
        if (pH > 0) {
            const pg = ctx.createLinearGradient(0, padding.top + plotH - pH, 0, padding.top + plotH);
            pg.addColorStop(0, '#ff9966');
            pg.addColorStop(1, '#ff5e62');
            ctx.fillStyle = pg;
            drawRoundRect(ctx, x + gap / 2, padding.top + plotH - pH, barWidth, pH, 3);
        }

        // X-axis labels
        const labelStep = days <= 7 ? 1 : Math.ceil(days / 10);
        if (i % labelStep === 0) {
            ctx.fillStyle = textColor;
            ctx.textAlign = 'center';
            ctx.font = '10px sans-serif';
            ctx.fillText(labels[i], x, padding.top + plotH + 20);
        }
    }

    // X-axis line
    ctx.strokeStyle = 'rgba(128,128,128,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + plotH);
    ctx.lineTo(width - padding.right, padding.top + plotH);
    ctx.stroke();
}

function drawRoundRect(ctx, x, y, w, h, r) {
    if (h <= 0 || w <= 0) return;
    r = Math.min(r, h / 2, w / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
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

        // Today summary
        const ts = stats.todaySummary || {};
        document.getElementById('todayInvoices').textContent = ts.invoiceCount || 0;
        document.getElementById('todaySales').textContent = money(ts.salesTotal);
        document.getElementById('todayCollections').textContent = money(ts.collections);
        document.getElementById('todayPayments').textContent = money(ts.payments);

        // Main metrics
        document.getElementById('salesMonth').textContent = money(stats.salesMonth);
        document.getElementById('purchasesMonth').textContent = money(stats.purchasesMonth);
        document.getElementById('netProfit').textContent = money(stats.netProfit);
        document.getElementById('treasuryBalance').textContent = money(stats.treasuryBalance);
        document.getElementById('stockValue').textContent = money(stats.stockValue);
        document.getElementById('itemsCount').textContent = stats.itemsCount || 0;
        document.getElementById('receivables').textContent = money(stats.receivables);
        document.getElementById('payables').textContent = money(stats.payables);

        // System status counts
        document.getElementById('customersCount').textContent = stats.customersCount || 0;
        document.getElementById('suppliersCount').textContent = stats.suppliersCount || 0;

        // Trends
        if (stats.trends) {
            const smTrend = document.getElementById('salesMonthTrend');
            const pmTrend = document.getElementById('purchasesMonthTrend');
            if (smTrend) smTrend.innerHTML = trendHTML(stats.trends.salesMonth);
            if (pmTrend) pmTrend.innerHTML = trendHTML(stats.trends.purchasesMonth);
        }

        // Chart
        if (stats.chartData) renderChart(stats.chartData);

        // Recent transactions
        renderRecentTransactions(stats.recentTransactions);

        // Top items
        renderTopItems(stats.topItems);

        // Alerts
        if (stats.alerts) renderAlerts(stats.alerts);
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
        const list = document.getElementById('alertsList');
        if (list) list.innerHTML = `<li>${t('dashboard.loadError', 'تعذر تحميل البيانات، حاول مرة أخرى.')}</li>`;
    } finally {
        if (refreshBtn) {
            refreshBtn.disabled = false;
            if (icon) icon.classList.remove('refresh-spin');
        }
    }
}
