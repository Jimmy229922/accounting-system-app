let refreshBtn;
let lastUpdatedEl;
let startDateInput;
let endDateInput;
let applyFilterBtn;
let clearFilterBtn;
let periodLabelEl;
let lastStats = null;
let chartPeriod = '7';
let ar = {};
let currentFilters = { startDate: '', endDate: '' };
let spiritualRotationTimer = null;
let currentSpiritualIndex = 0;
const DASHBOARD_SPIRITUAL_ROTATION_ITEMS = [
    {
        type: 'verse',
        label: 'آية كريمة',
        icon: 'fa-book-open',
        text: '﴿وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا • وَيَرْزُقْهُ مِنْ حَيْثُ لَا يَحْتَسِبُ﴾'
    },
    {
        type: 'dhikr',
        label: 'دعاء وبركة',
        icon: 'fa-hands-praying',
        text: '«اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا، وَرِزْقًا طَيِّبًا، وَعَمَلًا مُتَقَبَّلًا»'
    },
    {
        type: 'verse',
        label: 'آية كريمة',
        icon: 'fa-book-open',
        text: '﴿وَإِذْ تَأَذَّنَ رَبُّكُمْ لَئِن شَكَرْتُمْ لَأَزِيدَنَّكُمْ﴾'
    },
    {
        type: 'dhikr',
        label: 'دعاء وبركة',
        icon: 'fa-hands-praying',
        text: '«اللَّهُمَّ اكْفِنِي بِحَلَالِكَ عَنْ حَرَامِكَ، وَأَغْنِنِي بِفَضْلِكَ عَمَّنْ سِوَاكَ»'
    },
    {
        type: 'verse',
        label: 'آية كريمة',
        icon: 'fa-book-open',
        text: '﴿إِنَّ اللَّهَ هُوَ الرَّزَّاقُ ذُو الْقُوَّةِ الْمَتِينُ﴾'
    },
    {
        type: 'dhikr',
        label: 'دعاء وبركة',
        icon: 'fa-hands-praying',
        text: '«اللَّهُمَّ بَارِكْ لَنَا فِيمَا رَزَقْتَنَا وَاقْنَعْنَا بِهِ»'
    },
    {
        type: 'verse',
        label: 'آية كريمة',
        icon: 'fa-book-open',
        text: '﴿وَقُلِ اعْمَلُوا فَسَيَرَى اللَّهُ عَمَلَكُمْ وَرَسُولُهُ وَالْمُؤْمِنُونَ﴾'
    },
    {
        type: 'dhikr',
        label: 'ذكر وتوكل',
        icon: 'fa-star-and-crescent',
        text: '«بِسْمِ اللَّهِ، تَوَكَّلْتُ عَلَى اللَّهِ، وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ»'
    },
    {
        type: 'verse',
        label: 'آية كريمة',
        icon: 'fa-book-open',
        text: '﴿وَمَا بِكُم مِّن نِّعْمَةٍ فَمِنَ اللَّهِ﴾'
    },
    {
        type: 'dhikr',
        label: 'تسبيح وذكر',
        icon: 'fa-star-and-crescent',
        text: '«سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ»'
    },
    {
        type: 'verse',
        label: 'آية كريمة',
        icon: 'fa-book-open',
        text: '﴿وَأَحَلَّ اللَّهُ الْبَيْعَ وَحَرَّمَ الرِّبَا﴾'
    },
    {
        type: 'dhikr',
        label: 'حمد وشكر',
        icon: 'fa-star-and-crescent',
        text: '«الْحَمْدُ لِلَّهِ حَمْدًا كَثِيرًا طَيِّبًا مُبَارَكًا فِيهِ»'
    }
];

function getLocalYMD(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

const initToday = new Date();
const initFirstDay = new Date(initToday.getFullYear(), initToday.getMonth(), 1);
currentFilters.startDate = getLocalYMD(initFirstDay);
currentFilters.endDate = getLocalYMD(initToday);

const { t, fmt } = window.i18n?.createPageHelpers?.(() => ar) || { t: (k, f = '') => f, fmt: (t, v = {}) => String(t || '') };
const dashboardRender = window.dashboardPageRender;

document.addEventListener('DOMContentLoaded', async () => {
    try {
    if (window.i18n && typeof window.i18n.loadArabicDictionary === 'function') {
        ar = await window.i18n.loadArabicDictionary();
    }

    dashboardRender.renderPage({ t, getNavHTML });
    bindEvents();
    loadDashboardStats();
    } catch (error) {
        console.error('Initialization Error:', error);
        if (window.toast && typeof window.toast.error === 'function') {
            window.toast.error(t('alerts.initError', 'حدث خطأ أثناء تهيئة الصفحة، يرجى إعادة التحميل'));
        }
    }
});

function getNavHTML() {
    if (window.navManager && typeof window.navManager.getTopNavHTML === 'function') {
        return window.navManager.getTopNavHTML(t);
    }
    return '';
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

function formatDateForUi(value) {
    if (!value) return '';
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('ar-EG');
}

function getPeriodText(filters = currentFilters) {
    const startDate = filters.startDate || '';
    const endDate = filters.endDate || '';
    if (!startDate && !endDate) return t('dashboard.allPeriods', 'كل الفترات');
    const startText = startDate ? formatDateForUi(startDate) : '';
    const endText = endDate ? formatDateForUi(endDate) : '';
    if (startDate && endDate) return `من ${startText} إلى ${endText}`;
    if (startDate) return `من ${startText}`;
    return `حتى ${endText}`;
}

function updatePeriodLabel(filters = currentFilters) {
    if (!periodLabelEl) return;
    periodLabelEl.textContent = getPeriodText(filters);
}

function getFilterValues() {
    return {
        startDate: startDateInput && startDateInput.value ? startDateInput.value : '',
        endDate: endDateInput && endDateInput.value ? endDateInput.value : ''
    };
}

function applyDashboardFilters() {
    currentFilters = getFilterValues();
    loadDashboardStats(currentFilters);
}

function clearDashboardFilters() {
    const tObj = new Date();
    const fObj = new Date(tObj.getFullYear(), tObj.getMonth(), 1);
    const sStr = getLocalYMD(fObj);
    const eStr = getLocalYMD(tObj);
    
    if (startDateInput) startDateInput.value = sStr;
    if (endDateInput) endDateInput.value = eStr;
    currentFilters = { startDate: sStr, endDate: eStr };
    loadDashboardStats(currentFilters);
}

function bindEvents() {
    refreshBtn = document.getElementById('refreshBtn');
    lastUpdatedEl = document.getElementById('lastUpdated');
    startDateInput = document.getElementById('dashboardFromDate');
    endDateInput = document.getElementById('dashboardToDate');
    
    if (startDateInput && !startDateInput.value) {
        startDateInput.value = currentFilters.startDate;
    }
    if (endDateInput && !endDateInput.value) {
        endDateInput.value = currentFilters.endDate;
    }

    applyFilterBtn = document.getElementById('dashboardApplyBtn');
    clearFilterBtn = document.getElementById('dashboardClearBtn');
    periodLabelEl = document.getElementById('dashboardPeriod');

    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => loadDashboardStats(currentFilters));
    }

    if (applyFilterBtn) {
        applyFilterBtn.addEventListener('click', applyDashboardFilters);
    }

    if (clearFilterBtn) {
        clearFilterBtn.addEventListener('click', clearDashboardFilters);
    }

    updatePeriodLabel();

    startRealTimeClock();
    startSpiritualBannerRotation();

    document.querySelectorAll('.chart-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.chart-btn').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            chartPeriod = btn.dataset.period;
            if (lastStats && lastStats.chartData) renderChart(lastStats.chartData);
        });
    });

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

function buildShuffledSpiritualQueue(totalCount, lastShownIndex = -1) {
    const indices = Array.from({ length: totalCount }, (_, idx) => idx);
    for (let i = indices.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = indices[i];
        indices[i] = indices[j];
        indices[j] = temp;
    }
    if (indices.length > 1 && indices[0] === lastShownIndex) {
        const swapIdx = 1 + Math.floor(Math.random() * (indices.length - 1));
        const first = indices[0];
        indices[0] = indices[swapIdx];
        indices[swapIdx] = first;
    }
    return indices;
}

function pullNextSpiritualIndex() {
    const totalCount = DASHBOARD_SPIRITUAL_ROTATION_ITEMS.length;
    if (!totalCount) return 0;

    const queueKey = 'dashboard_spiritual_shuffle_queue';
    const lastIdxKey = 'dashboard_spiritual_last_index';
    let queue = [];
    let lastShown = -1;

    try {
        const rawLast = sessionStorage.getItem(lastIdxKey);
        if (rawLast !== null && rawLast !== '') {
            const parsedLast = Number(rawLast);
            if (Number.isInteger(parsedLast) && parsedLast >= 0 && parsedLast < totalCount) {
                lastShown = parsedLast;
            }
        }
        const rawQueue = sessionStorage.getItem(queueKey);
        if (rawQueue) {
            const parsedQueue = JSON.parse(rawQueue);
            if (Array.isArray(parsedQueue)) {
                queue = parsedQueue.filter((idx) => Number.isInteger(idx) && idx >= 0 && idx < totalCount);
            }
        }
    } catch (_err) {
        queue = [];
    }

    if (!queue.length) {
        queue = buildShuffledSpiritualQueue(totalCount, lastShown);
    }

    const nextIndex = queue.shift();
    currentSpiritualIndex = Number.isInteger(nextIndex) ? nextIndex : 0;

    try {
        sessionStorage.setItem(queueKey, JSON.stringify(queue));
        sessionStorage.setItem(lastIdxKey, String(currentSpiritualIndex));
    } catch (_err) {}

    return currentSpiritualIndex;
}

function startSpiritualBannerRotation() {
    const bannerEl = document.getElementById('heroSpiritualBanner');
    const badgeEl = document.getElementById('heroSpiritualBadge');
    const textEl = document.getElementById('heroSpiritualText');
    if (!bannerEl || !badgeEl || !textEl || !DASHBOARD_SPIRITUAL_ROTATION_ITEMS.length) return;

    const renderItem = (index) => {
        const item = DASHBOARD_SPIRITUAL_ROTATION_ITEMS[index % DASHBOARD_SPIRITUAL_ROTATION_ITEMS.length];
        if (!item) return;
        badgeEl.innerHTML = `<i class="fas ${item.icon}"></i> ${item.label}`;
        badgeEl.dataset.type = item.type;
        textEl.textContent = item.text;
    };

    renderItem(pullNextSpiritualIndex());

    if (spiritualRotationTimer) {
        clearInterval(spiritualRotationTimer);
    }

    spiritualRotationTimer = setInterval(() => {
        bannerEl.classList.add('is-fading');
        setTimeout(() => {
            renderItem(pullNextSpiritualIndex());
            bannerEl.classList.remove('is-fading');
        }, 280);
    }, 12000);
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

    const days = parseInt(chartPeriod, 10);
    const now = new Date();

    const salesMap = {};
    const purchasesMap = {};
    (chartData.dailySales || []).forEach((d) => { salesMap[d.date] = d.total; });
    (chartData.dailyPurchases || []).forEach((d) => { purchasesMap[d.date] = d.total; });

    const labels = [];
    const salesData = [];
    const purchasesData = [];

    for (let i = days - 1; i >= 0; i -= 1) {
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

    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#888';

    ctx.strokeStyle = 'rgba(128,128,128,0.12)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
        const y = padding.top + (plotH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
    }

    ctx.fillStyle = textColor;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i += 1) {
        const y = padding.top + (plotH / 4) * i;
        const val = maxVal - (maxVal / 4) * i;
        ctx.fillText(formatNum(val), padding.left - 8, y + 4);
    }

    const barGroupWidth = plotW / days;
    const barWidth = Math.min(Math.max(barGroupWidth * 0.3, 4), 24);
    const gap = Math.max(barWidth * 0.15, 2);

    for (let i = 0; i < days; i += 1) {
        const x = padding.left + barGroupWidth * i + barGroupWidth / 2;

        const sH = Math.max((salesData[i] / maxVal) * plotH, 0);
        if (sH > 0) {
            const sg = ctx.createLinearGradient(0, padding.top + plotH - sH, 0, padding.top + plotH);
            sg.addColorStop(0, '#34d875');
            sg.addColorStop(1, '#11998e');
            ctx.fillStyle = sg;
            drawRoundRect(ctx, x - barWidth - gap / 2, padding.top + plotH - sH, barWidth, sH, 3);
        }

        const pH = Math.max((purchasesData[i] / maxVal) * plotH, 0);
        if (pH > 0) {
            const pg = ctx.createLinearGradient(0, padding.top + plotH - pH, 0, padding.top + plotH);
            pg.addColorStop(0, '#ff9966');
            pg.addColorStop(1, '#ff5e62');
            ctx.fillStyle = pg;
            drawRoundRect(ctx, x + gap / 2, padding.top + plotH - pH, barWidth, pH, 3);
        }

        const labelStep = days <= 7 ? 1 : Math.ceil(days / 10);
        if (i % labelStep === 0) {
            ctx.fillStyle = textColor;
            ctx.textAlign = 'center';
            ctx.font = '10px sans-serif';
            ctx.fillText(labels[i], x, padding.top + plotH + 20);
        }
    }

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

async function loadDashboardStats(filters = currentFilters) {
    let icon;
    try {
        if (refreshBtn) {
            refreshBtn.disabled = true;
            icon = refreshBtn.querySelector('i');
            if (icon) icon.classList.add('refresh-spin');
        }

        updatePeriodLabel(filters);
        const stats = await window.electronAPI.getDashboardStats(filters);
        lastStats = stats;

        const ts = stats.todaySummary || {};
        document.getElementById('todayInvoices').textContent = ts.invoiceCount || 0;
        document.getElementById('todaySales').textContent = money(ts.salesTotal);
        document.getElementById('todayCollections').textContent = money(ts.collections);
        document.getElementById('todayPayments').textContent = money(ts.payments);

        document.getElementById('salesMonth').textContent = money(stats.salesMonth);
        document.getElementById('purchasesMonth').textContent = money(stats.purchasesMonth);
        document.getElementById('netProfit').textContent = money(stats.netProfit);
        const shareEl = document.getElementById('shareForGod');
        if (shareEl) shareEl.textContent = money(stats.shareForGod);
        const finalProfitEl = document.getElementById('finalNetProfit');
        if (finalProfitEl) finalProfitEl.textContent = money(stats.finalNetProfit);
        document.getElementById('treasuryBalance').textContent = money(stats.treasuryBalance);
        document.getElementById('stockValue').textContent = money(stats.stockValue);
        document.getElementById('itemsCount').textContent = stats.itemsCount || 0;
        document.getElementById('receivables').textContent = money(stats.receivables);
        document.getElementById('payables').textContent = money(stats.payables);

        document.getElementById('customersCount').textContent = stats.customersCount || 0;
        document.getElementById('suppliersCount').textContent = stats.suppliersCount || 0;

        if (stats.trends) {
            const smTrend = document.getElementById('salesMonthTrend');
            const pmTrend = document.getElementById('purchasesMonthTrend');
            if (smTrend) smTrend.innerHTML = trendHTML(stats.trends.salesMonth);
            if (pmTrend) pmTrend.innerHTML = trendHTML(stats.trends.purchasesMonth);
        }

        if (stats.chartData) renderChart(stats.chartData);

        dashboardRender.renderRecentTransactions({ transactions: stats.recentTransactions, t });
        dashboardRender.renderTopItems({ topItems: stats.topItems, t });

        if (stats.alerts) {
            dashboardRender.renderAlerts({ alerts: stats.alerts, t, fmt });
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
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

window.showNetProfitDetails = function() {
    if (!lastStats || !lastStats.profitDetails) return;

    let modal = document.getElementById('profitDetailsModal');
    if (modal) modal.remove();

    const p = lastStats.profitDetails;
    const periodText = getPeriodText();
    const m = (val) => Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ج.م';

    modal = document.createElement('div');
    modal.id = 'profitDetailsModal';
    modal.className = 'confirm-dialog-overlay';
    modal.style.zIndex = '999999';

    modal.innerHTML = `
        <div class="confirm-dialog-card profit-modal-card" style="width: min(980px, 96vw); max-width: 980px;">
            <div class="confirm-dialog-header profit-modal-header">
                <div class="profit-modal-title-group">
                    <span class="profit-modal-icon"><i class="fas fa-calculator"></i></span>
                    <div>
                        <h3 class="profit-modal-title">تفاصيل مجمل الربح للإيضاح</h3>
                        <span class="profit-modal-period"><i class="fas fa-calendar-alt"></i> ${t('dashboard.periodLabel', 'الفترة')}: ${periodText}</span>
                    </div>
                </div>
                <button type="button" class="profit-modal-close" onclick="document.getElementById('profitDetailsModal').remove()" aria-label="إغلاق"><i class="fas fa-times"></i></button>
            </div>

            <div class="profit-modal-body">
                <div class="profit-modal-grid">
                    <div class="profit-section-card card-sales">
                        <h4 class="profit-section-title text-emerald"><i class="fas fa-shopping-cart"></i> أولاً: المبيعات الفعّالة (الفترة المحددة)</h4>
                        <div class="profit-rows-wrap">
                            <div class="profit-row">
                                <span class="profit-row-label">إجمالي الفواتير:</span>
                                <strong class="profit-row-value">${m(p.salesTotalMonth)}</strong>
                            </div>
                            <div class="profit-row">
                                <span class="profit-row-label text-danger">- مردودات (مرتجعات):</span>
                                <strong class="profit-row-value text-danger">${m(p.salesReturnsTotalMonth)}</strong>
                            </div>
                        </div>
                        <div class="profit-row profit-row-total">
                            <span class="text-sky">= صافي المبيعات:</span>
                            <strong class="profit-total-num text-sky">${m(p.salesMonth)}</strong>
                        </div>
                    </div>

                    <div class="profit-section-card card-cogs">
                        <h4 class="profit-section-title text-amber"><i class="fas fa-boxes"></i> ثانياً: تكلفة المبيعات (رأس المال)</h4>
                        <div class="profit-rows-wrap">
                            <div class="profit-row">
                                <span class="profit-row-label">تكلفة البضاعة الخارجة:</span>
                                <strong class="profit-row-value">${m(p.cogsMonthSales)}</strong>
                            </div>
                            <div class="profit-row">
                                <span class="profit-row-label text-emerald">- تكلفة المرتجعات:</span>
                                <strong class="profit-row-value text-emerald">${m(p.cogsMonthReturns)}</strong>
                            </div>
                        </div>
                        <div class="profit-row profit-row-total">
                            <span class="text-amber">= التكلفة الفعلية (المخصومة):</span>
                            <strong class="profit-total-num text-amber">${m(p.cogsMonth)}</strong>
                        </div>
                    </div>

                    <div class="profit-section-card card-expenses">
                        <h4 class="profit-section-title text-danger"><i class="fas fa-receipt"></i> ثالثاً: الخوارج المسجلة (المخصومة)</h4>
                        <div class="profit-rows-wrap">
                            <div class="profit-row">
                                <span class="profit-row-label">مجمل الربح (قبل الخوارج):</span>
                                <strong class="profit-row-value">${m(p.grossProfit)}</strong>
                            </div>
                            <div class="profit-row">
                                <span class="profit-row-label text-danger">- مصروفات وخوارج الفترة:</span>
                                <strong class="profit-row-value text-danger">${m(p.expensesTotalMonth)}</strong>
                            </div>
                        </div>
                        <div class="profit-row profit-row-total">
                            <span class="text-danger">= إجمالي الخوارج المخصومة:</span>
                            <strong class="profit-total-num text-danger">${m(p.expensesTotalMonth)}</strong>
                        </div>
                    </div>

                    <div class="profit-section-card card-net-before">
                        <h4 class="profit-section-title profit-before-god-title"><i class="fas fa-coins"></i> رابعاً: صافي الربح التقديري (بعد الخوارج)</h4>
                        <div class="profit-rows-wrap">
                            <div class="profit-row">
                                <span class="profit-row-label">مجمل الربح المتحقق:</span>
                                <strong class="profit-row-value">${m(p.grossProfit)}</strong>
                            </div>
                            <div class="profit-row">
                                <span class="profit-row-label text-danger">- إجمالي الخوارج المخصومة:</span>
                                <strong class="profit-row-value text-danger">${m(p.expensesTotalMonth)}</strong>
                            </div>
                        </div>
                        <div class="profit-row profit-row-total">
                            <span class="profit-before-god-title">= الربح قبل استقطاع نسبة لله:</span>
                            <strong class="profit-total-num profit-before-god-value">${m(p.netProfit)}</strong>
                        </div>
                    </div>

                    <div class="profit-section-card card-god-share">
                        <h4 class="profit-section-title share-god-title"><i class="fas fa-hand-holding-heart"></i> خامساً: المستقطع لوجه الله (10%)</h4>
                        <div class="profit-rows-wrap">
                            <div class="profit-row">
                                <span class="profit-row-label">صافي الربح الخاضع للنسبة:</span>
                                <strong class="profit-row-value">${m(p.netProfit)}</strong>
                            </div>
                            <div class="profit-row">
                                <span class="profit-row-label share-god-title">نسبة الاستقطاع التلقائية:</span>
                                <strong class="profit-row-value share-god-title">10%</strong>
                            </div>
                        </div>
                        <div class="profit-row profit-row-total">
                            <span class="share-god-title">= المستقطع لوجه الله:</span>
                            <strong class="profit-total-num share-god-value">${m(p.shareForGod)}</strong>
                        </div>
                    </div>

                    <div class="profit-section-card final-profit-box">
                        <h4 class="profit-section-title final-profit-title"><i class="fas fa-award"></i> سادساً: صافي الربح النهائي (بعد الـ 10% لله)</h4>
                        <div class="profit-rows-wrap">
                            <div class="profit-row">
                                <span class="profit-row-label">صافي الربح (بعد الخوارج):</span>
                                <strong class="profit-row-value">${m(p.netProfit)}</strong>
                            </div>
                            <div class="profit-row">
                                <span class="profit-row-label share-god-title">- المستقطع لوجه الله (10%):</span>
                                <strong class="profit-row-value share-god-title">${m(p.shareForGod)}</strong>
                            </div>
                        </div>
                        <div class="profit-row profit-row-total">
                            <span class="profit-before-god-title">= صافي الربح النهائي:</span>
                            <strong class="final-profit-value">${m(p.finalNetProfit)}</strong>
                        </div>
                    </div>
                </div>
            </div>

            <div class="confirm-dialog-actions profit-modal-footer">
                <button type="button" onclick="document.getElementById('profitDetailsModal').remove()" class="confirm-dialog-btn confirm profit-modal-done-btn">فهمت، إغلاق</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('show'));
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
};

(function() {
    if (!document.getElementById('profitDetailsModalStyle')) {
        const s = document.createElement('style');
        s.id = 'profitDetailsModalStyle';
        s.innerHTML = `
        :root {
            --final-profit-color: #047857;
            --share-god-color: #0284c7;
        }
        [data-theme="dark"] {
            --final-profit-color: #10b981;
            --share-god-color: #38bdf8;
        }
        .confirm-dialog-overlay {
            position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
            padding: 16px; background: rgba(15, 23, 42, 0.72); backdrop-filter: blur(5px);
            opacity: 0; transition: opacity 0.2s ease;
        }
        .confirm-dialog-overlay.show { opacity: 1; }
        .confirm-dialog-card.profit-modal-card {
            width: min(980px, 96vw) !important;
            max-width: 980px !important;
            max-height: 95vh;
            overflow: hidden;
            padding: 0;
            background: var(--card-bg, #0f172a);
            border: 1px solid var(--border-color, rgba(148, 163, 184, 0.22));
            border-radius: 18px;
            box-shadow: 0 25px 60px -12px rgba(0, 0, 0, 0.55);
            color: var(--text-color, #fff);
            direction: rtl;
            display: flex;
            flex-direction: column;
        }
        .profit-modal-header {
            background: linear-gradient(135deg, rgba(14, 165, 233, 0.1), rgba(16, 185, 129, 0.08));
            border-bottom: 1px solid var(--border-color, rgba(148, 163, 184, 0.16));
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 14px 22px;
        }
        .profit-modal-title-group {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .profit-modal-icon {
            width: 40px;
            height: 40px;
            border-radius: 12px;
            background: linear-gradient(135deg, #0ea5e9, #2563eb);
            color: #fff;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 1.1rem;
            box-shadow: 0 6px 14px rgba(14, 165, 233, 0.28);
            flex-shrink: 0;
        }
        .profit-modal-title {
            margin: 0 0 2px 0;
            font-size: 1.15rem;
            font-weight: 800;
            color: var(--text-color, #fff);
            white-space: nowrap;
        }
        .profit-modal-period {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 0.82rem;
            font-weight: 600;
            color: var(--share-god-color, #0284c7);
            white-space: nowrap;
        }
        .profit-modal-close {
            width: 34px;
            height: 34px;
            border-radius: 10px;
            border: 1px solid var(--border-color, rgba(148, 163, 184, 0.24));
            background: var(--secondary-bg, rgba(15, 23, 42, 0.5));
            color: var(--text-muted, #94a3b8);
            cursor: pointer;
            font-size: 1.05rem;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }
        .profit-modal-close:hover {
            background: rgba(239, 68, 68, 0.14);
            color: #ef4444;
            border-color: rgba(239, 68, 68, 0.35);
        }
        .profit-modal-body {
            padding: 16px 22px;
            white-space: normal !important;
            overflow-y: auto;
        }
        .profit-modal-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            grid-auto-rows: 1fr;
            gap: 12px;
            align-items: stretch;
        }
        .profit-section-card {
            background: var(--secondary-bg, rgba(15, 23, 42, 0.55));
            border: 1px solid var(--border-color, rgba(148, 163, 184, 0.18));
            border-radius: 14px;
            padding: 14px 18px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            height: 100%;
            box-sizing: border-box;
        }
        .profit-section-card.card-net-before {
            background: rgba(16, 185, 129, 0.05);
            border-color: rgba(16, 185, 129, 0.26);
        }
        .profit-section-card.card-god-share {
            background: rgba(2, 132, 199, 0.06);
            border-color: rgba(2, 132, 199, 0.28);
        }
        .profit-section-card.final-profit-box {
            background: linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(5, 150, 105, 0.05));
            border: 2px solid #059669;
        }
        [data-theme="dark"] .profit-section-card.final-profit-box {
            border-color: #10b981 !important;
        }
        .profit-section-title {
            margin: 0 0 8px 0;
            font-size: 0.94rem;
            font-weight: 800;
            display: flex;
            align-items: center;
            gap: 7px;
            white-space: nowrap;
        }
        .profit-rows-wrap {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .text-emerald { color: #10b981; }
        .text-amber { color: #f59e0b; }
        .text-danger { color: #ef4444; }
        .text-sky { color: #0ea5e9; }
        .profit-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
            font-size: 0.9rem;
            line-height: 1.5;
        }
        .profit-row-label {
            color: var(--text-muted, #94a3b8);
            font-weight: 600;
            white-space: nowrap;
        }
        .profit-row-value {
            color: var(--text-color, #fff);
            font-weight: 700;
            white-space: nowrap;
        }
        .profit-row-total {
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px dashed var(--border-color, rgba(148, 163, 184, 0.22));
            font-weight: 700;
            white-space: nowrap;
        }
        .profit-total-num {
            font-size: 1.12rem;
            font-weight: 800;
            white-space: nowrap;
        }
        .profit-before-god-title {
            color: var(--final-profit-color, #047857);
            white-space: nowrap;
        }
        .profit-before-god-value {
            color: var(--final-profit-color, #047857);
            font-size: 1.15rem;
            font-weight: 800;
            white-space: nowrap;
        }
        .share-god-title {
            color: var(--share-god-color, #0284c7);
            font-weight: 700;
            white-space: nowrap;
        }
        .share-god-value {
            color: var(--share-god-color, #0284c7);
            font-size: 1.15rem;
            font-weight: 800;
            white-space: nowrap;
        }
        .final-profit-title {
            color: var(--final-profit-color, #047857);
            white-space: nowrap;
        }
        .final-profit-title i {
            color: #059669;
        }
        .final-profit-value {
            color: var(--final-profit-color, #047857);
            font-size: 1.24rem;
            font-weight: 800;
            white-space: nowrap;
        }
        .profit-modal-footer {
            border-top: 1px solid var(--border-color, rgba(148, 163, 184, 0.16));
            padding: 12px 22px;
            text-align: center;
            display: flex;
            justify-content: center;
            background: var(--secondary-bg, rgba(15, 23, 42, 0.35));
        }
        .profit-modal-done-btn {
            width: 100%;
            max-width: 220px;
            min-height: 38px;
            border-radius: 10px;
            font-weight: 700;
        }
        @media (max-width: 768px) {
            .profit-modal-grid {
                grid-template-columns: 1fr;
            }
        }
        .interactive-card:hover { transform: translateY(-4px); box-shadow: 0 10px 20px rgba(0,0,0,0.3); border-color: rgba(56, 189, 248, 0.4) !important; }
        `;
        document.head.appendChild(s);
    }
})();

