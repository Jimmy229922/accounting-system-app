let typeFilter, customerFilter, startDateInput, endDateInput, searchBtn, resetBtn, reportsTableBody;
let reportsStatusEl, heroResultCountEl, lastUpdatedLabelEl;
let voucherModalEl, voucherModalBodyEl, voucherModalTitleEl, voucherModalSubtitleEl;
let customerAutocomplete = null;
let ar = {};
let currentReports = [];
let allCustomers = [];
let currentPage = 1;
const PAGE_SIZE = 20;
const CUR = 'ج.م';

function formatCurrency(v) {
    return parseFloat(v || 0).toFixed(2) + ' ' + CUR;
}

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

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatDateForUi(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return escapeHtml(value);
    return date.toLocaleDateString('ar-EG');
}

function formatDateTimeForUi(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return escapeHtml(value);
    return date.toLocaleString('ar-EG');
}

function setStatus(message, type = 'info') {
    if (!reportsStatusEl) return;
    reportsStatusEl.textContent = message || '';
    reportsStatusEl.classList.remove('status-info', 'status-success', 'status-warning', 'status-error');

    if (!message) {
        reportsStatusEl.classList.add('status-hidden');
        return;
    }

    reportsStatusEl.classList.remove('status-hidden');
    reportsStatusEl.classList.add(`status-${type}`);
}

function setDefaultDateRange() {
    if (!startDateInput || !endDateInput) return;

    const now = new Date();
    const firstDayOfYear = `${now.getFullYear()}-01-01`;
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    startDateInput.value = firstDayOfYear;
    endDateInput.value = tomorrow.toISOString().split('T')[0];
}

function updateLastUpdatedLabel() {
    if (!lastUpdatedLabelEl) return;

    const now = new Date();
    lastUpdatedLabelEl.textContent = now.toLocaleString('ar-EG', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
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
                <a href="#" class="active">${t('common.nav.reports', 'التقارير')}</a>
                <div class="dropdown-content">
                    <a href="../reports/index.html">${t('common.nav.generalReports', 'التقارير العامة')}</a>
                    <a href="../customer-reports/index.html">${t('common.nav.customerReports', 'تقارير العملاء')}</a>
                    <a href="../reports/debtor-creditor/index.html">${t('common.nav.debtorCreditor', 'كشف المدين والدائن')}</a>
                </div>
            </li>
            <li><a href="../settings/index.html">${t('common.nav.settings', 'الإعدادات')}</a></li>
        </ul>
    </nav>`;
}

document.addEventListener('DOMContentLoaded', async () => {
    if (window.i18n && typeof window.i18n.loadArabicDictionary === 'function') {
        ar = await window.i18n.loadArabicDictionary();
    }

    renderPage();
    initializeElements();
    setDefaultDateRange();
    await loadCustomers();
    await loadReports();
});

function renderPage() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${getNavHTML()}

        <main class="content reports-content">
            <div class="reports-page">
                <section class="reports-hero">
                    <div class="reports-hero-main">
                        <div class="page-hero-icon"><i class="fas fa-chart-bar"></i></div>
                        <div>
                            <span class="hero-eyebrow">${t('reports.hero.label', 'لوحة متابعة الفواتير')}</span>
                            <h1>${t('reports.title', 'التقارير العامة')}</h1>
                            <p>${t('reports.subtitle', 'عرض وإدارة جميع فواتير المبيعات والمشتريات')}</p>
                        </div>
                    </div>

                    <div class="hero-stats">
                        <div class="hero-stat-card">
                            <span>${t('reports.hero.currentResults', 'النتائج الحالية')}</span>
                            <strong id="heroResultCount">0</strong>
                        </div>
                        <div class="hero-stat-card">
                            <span>${t('reports.hero.lastRefresh', 'آخر تحديث')}</span>
                            <strong id="lastUpdatedLabel">-</strong>
                        </div>
                    </div>
                </section>

                <div id="reportsStatus" class="reports-status status-info">
                    ${t('reports.loading', 'جارٍ تحميل البيانات...')}
                </div>

                <section class="summary-strip" aria-label="${t('reports.summary.title', 'ملخص التقارير')}">
                    <article class="summary-card card-total">
                        <div class="sc-icon"><i class="fas fa-file-invoice"></i></div>
                        <div>
                            <div class="sc-label">${t('reports.summary.totalInvoices', 'إجمالي الفواتير')}</div>
                            <div class="sc-value" id="totalInvoices">0</div>
                        </div>
                    </article>

                    <article class="summary-card card-sales">
                        <div class="sc-icon"><i class="fas fa-arrow-up"></i></div>
                        <div>
                            <div class="sc-label">${t('reports.summary.salesCount', 'فواتير المبيعات')}</div>
                            <div class="sc-value" id="salesCount">0</div>
                        </div>
                    </article>

                    <article class="summary-card card-purchase">
                        <div class="sc-icon"><i class="fas fa-arrow-down"></i></div>
                        <div>
                            <div class="sc-label">${t('reports.summary.purchaseCount', 'فواتير المشتريات')}</div>
                            <div class="sc-value" id="purchaseCount">0</div>
                        </div>
                    </article>

                    <article class="summary-card card-amount">
                        <div class="sc-icon"><i class="fas fa-coins"></i></div>
                        <div>
                            <div class="sc-label">${t('reports.summary.totalAmount', 'إجمالي المبالغ')}</div>
                            <div class="sc-value" id="totalAmount">0.00 ${CUR}</div>
                        </div>
                    </article>

                    <article class="summary-card card-sales-return">
                        <div class="sc-icon"><i class="fas fa-undo"></i></div>
                        <div>
                            <div class="sc-label">${t('reports.summary.salesReturnCount', 'مردودات المبيعات')}</div>
                            <div class="sc-value" id="salesReturnCount">0</div>
                        </div>
                    </article>

                    <article class="summary-card card-purchase-return">
                        <div class="sc-icon"><i class="fas fa-undo"></i></div>
                        <div>
                            <div class="sc-label">${t('reports.summary.purchaseReturnCount', 'مردودات المشتريات')}</div>
                            <div class="sc-value" id="purchaseReturnCount">0</div>
                        </div>
                    </article>

                    <article class="summary-card card-receipt">
                        <div class="sc-icon"><i class="fas fa-hand-holding-usd"></i></div>
                        <div>
                            <div class="sc-label">${t('reports.summary.receiptCount', 'سندات التحصيل')}</div>
                            <div class="sc-value" id="receiptCount">0</div>
                        </div>
                    </article>

                    <article class="summary-card card-payment">
                        <div class="sc-icon"><i class="fas fa-money-bill-wave"></i></div>
                        <div>
                            <div class="sc-label">${t('reports.summary.paymentCount', 'سندات السداد')}</div>
                            <div class="sc-value" id="paymentCount">0</div>
                        </div>
                    </article>
                </section>

                <section class="filters-panel">
                    <div class="filters-head">
                        <h2>${t('reports.filtersTitle', 'تصفية السجل')}</h2>
                        <p>${t('reports.filtersSubtitle', 'اختر نوع الفاتورة والعميل والفترة الزمنية ثم اضغط بحث.')}</p>
                    </div>

                    <div class="filters-grid">
                        <div class="form-group">
                            <label for="typeFilter"><i class="fas fa-filter"></i> ${t('reports.invoiceType', 'نوع الفاتورة')}</label>
                            <select id="typeFilter" class="form-control">
                                <option value="all">${t('reports.allTypes', 'الكل')}</option>
                                <option value="sales">${t('reports.salesType', 'مبيعات')}</option>
                                <option value="purchase">${t('reports.purchaseType', 'مشتريات')}</option>
                                <option value="sales_return">${t('reports.salesReturnType', 'مردودات مبيعات')}</option>
                                <option value="purchase_return">${t('reports.purchaseReturnType', 'مردودات مشتريات')}</option>
                                <option value="receipt">${t('reports.receiptType', 'سندات تحصيل')}</option>
                                <option value="payment">${t('reports.paymentType', 'سندات سداد')}</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="customerFilter"><i class="fas fa-user"></i> ${t('reports.customerSupplier', 'العميل / المورد')}</label>
                            <select id="customerFilter" class="form-control">
                                <option value="">${t('reports.allCustomers', 'الكل')}</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="startDate"><i class="fas fa-calendar-alt"></i> ${t('reports.fromDate', 'من تاريخ')}</label>
                            <input type="date" id="startDate" class="form-control">
                        </div>

                        <div class="form-group">
                            <label for="endDate"><i class="fas fa-calendar-alt"></i> ${t('reports.toDate', 'إلى تاريخ')}</label>
                            <input type="date" id="endDate" class="form-control">
                        </div>
                    </div>

                    <div class="filters-actions">
                        <button id="resetBtn" type="button" class="btn-secondary">
                            <i class="fas fa-undo"></i>
                            <span>${t('reports.resetFilters', 'إعادة ضبط')}</span>
                        </button>
                        <button id="searchBtn" type="button" class="btn-primary">
                            <i class="fas fa-search"></i>
                            <span>${t('reports.search', 'بحث')}</span>
                        </button>
                    </div>
                </section>

                <section class="table-card">
                    <div class="table-card-header">
                        <h3><i class="fas fa-list"></i> ${t('reports.tableTitle', 'سجل الفواتير')}</h3>
                        <div class="header-actions">
                            <span id="resultCount" class="result-count"></span>
                        </div>
                    </div>

                    <div class="table-wrap">
                        <table class="table reports-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>${t('reports.tableHeaders.date', 'التاريخ')}</th>
                                    <th>${t('reports.tableHeaders.invoiceNumber', 'رقم الفاتورة')}</th>
                                    <th>${t('reports.tableHeaders.type', 'النوع')}</th>
                                    <th>${t('reports.tableHeaders.customerSupplier', 'العميل / المورد')}</th>
                                    <th>${t('reports.tableHeaders.amount', 'المبلغ')}</th>
                                    <th>${t('reports.tableHeaders.actions', 'إجراءات')}</th>
                                </tr>
                            </thead>
                            <tbody id="reportsTableBody"></tbody>
                        </table>
                    </div>

                    <div id="paginationBar" class="pagination-bar" style="display: none;">
                        <div class="pagination-info" id="paginationInfo"></div>
                        <div class="pagination-btns" id="paginationBtns"></div>
                    </div>
                </section>
            </div>

            <div id="voucherModal" class="voucher-modal-overlay" aria-hidden="true">
                <div class="voucher-modal" role="dialog" aria-modal="true" aria-labelledby="voucherModalTitle">
                    <div class="voucher-modal-header">
                        <div class="voucher-modal-title-wrap">
                            <div class="voucher-modal-icon"><i class="fas fa-receipt"></i></div>
                            <div>
                                <h3 id="voucherModalTitle">${t('reports.voucherPreviewTitle', 'عرض السند')}</h3>
                                <p id="voucherModalSubtitle">${t('reports.loading', 'جارٍ تحميل البيانات...')}</p>
                            </div>
                        </div>
                        <button type="button" class="voucher-modal-close" id="voucherModalCloseBtn" aria-label="${t('reports.close', 'إغلاق')}">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>

                    <div class="voucher-modal-content" id="voucherModalBody">
                        <div class="voucher-modal-loading">
                            <i class="fas fa-spinner fa-spin"></i>
                            <span>${t('reports.loading', 'جارٍ تحميل البيانات...')}</span>
                        </div>
                    </div>

                    <div class="voucher-modal-footer">
                        <button type="button" class="btn-primary" id="voucherModalPrintBtn">
                            <i class="fas fa-print"></i>
                            <span>${t('reports.printVoucher', 'طباعة السند')}</span>
                        </button>
                        <button type="button" class="btn-secondary" id="voucherModalCloseBtnFooter">
                            ${t('reports.close', 'إغلاق')}
                        </button>
                    </div>
                </div>
            </div>
        </main>
    `;
}

function initializeElements() {
    typeFilter = document.getElementById('typeFilter');
    customerFilter = document.getElementById('customerFilter');
    startDateInput = document.getElementById('startDate');
    endDateInput = document.getElementById('endDate');
    searchBtn = document.getElementById('searchBtn');
    resetBtn = document.getElementById('resetBtn');
    reportsTableBody = document.getElementById('reportsTableBody');
    reportsStatusEl = document.getElementById('reportsStatus');
    heroResultCountEl = document.getElementById('heroResultCount');
    lastUpdatedLabelEl = document.getElementById('lastUpdatedLabel');

    voucherModalEl = document.getElementById('voucherModal');
    voucherModalBodyEl = document.getElementById('voucherModalBody');
    voucherModalTitleEl = document.getElementById('voucherModalTitle');
    voucherModalSubtitleEl = document.getElementById('voucherModalSubtitle');

    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            currentPage = 1;
            loadReports();
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (typeFilter) typeFilter.value = 'all';
            if (customerFilter) customerFilter.value = '';
            setDefaultDateRange();
            currentPage = 1;
            loadReports();
        });
    }

    if (reportsTableBody) {
        reportsTableBody.addEventListener('click', handleTableAction);
    }

    const closeBtn = document.getElementById('voucherModalCloseBtn');
    const closeBtnFooter = document.getElementById('voucherModalCloseBtnFooter');
    const printBtn = document.getElementById('voucherModalPrintBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeVoucherModal);
    if (closeBtnFooter) closeBtnFooter.addEventListener('click', closeVoucherModal);
    if (printBtn) printBtn.addEventListener('click', printVoucherFromModal);

    if (voucherModalEl) {
        voucherModalEl.addEventListener('click', (event) => {
            if (event.target === voucherModalEl) {
                closeVoucherModal();
            }
        });
    }

    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && voucherModalEl?.classList.contains('is-open')) {
            closeVoucherModal();
        }
    });
}

async function loadCustomers() {
    try {
        const customers = await window.electronAPI.getCustomers();
        allCustomers = Array.isArray(customers) ? customers : [];
        customerFilter.innerHTML = `<option value="">${t('reports.allCustomers', 'الكل')}</option>`;

        allCustomers.forEach((customer) => {
            const option = document.createElement('option');
            option.value = customer.id;
            option.textContent = customer.name;
            customerFilter.appendChild(option);
        });

        if (customerAutocomplete) {
            customerAutocomplete.refresh();
        } else if (typeof Autocomplete !== 'undefined') {
            customerAutocomplete = new Autocomplete(customerFilter);
        }
    } catch (error) {
        console.error(error);
        setStatus(t('reports.customerLoadError', 'تعذر تحميل قائمة العملاء والموردين.'), 'warning');
    }
}

function updateSummary(reports) {
    const safeReports = Array.isArray(reports) ? reports : [];
    const salesCount = safeReports.filter((r) => r.type === 'sales').length;
    const purchaseCount = safeReports.filter((r) => r.type === 'purchase').length;
    const salesReturnCount = safeReports.filter((r) => r.type === 'sales_return').length;
    const purchaseReturnCount = safeReports.filter((r) => r.type === 'purchase_return').length;
    const receiptCount = safeReports.filter((r) => r.type === 'receipt').length;
    const paymentCount = safeReports.filter((r) => r.type === 'payment').length;
    const totalAmount = safeReports.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);

    document.getElementById('totalInvoices').textContent = safeReports.length;
    document.getElementById('salesCount').textContent = salesCount;
    document.getElementById('purchaseCount').textContent = purchaseCount;
    document.getElementById('salesReturnCount').textContent = salesReturnCount;
    document.getElementById('purchaseReturnCount').textContent = purchaseReturnCount;
    document.getElementById('receiptCount').textContent = receiptCount;
    document.getElementById('paymentCount').textContent = paymentCount;
    document.getElementById('totalAmount').textContent = formatCurrency(totalAmount);

    if (heroResultCountEl) {
        heroResultCountEl.textContent = String(safeReports.length);
    }
}

function getTypeMeta(type) {
    if (type === 'sales') {
        return {
            badge: `<span class="badge badge-sales"><i class="fas fa-arrow-up"></i> ${t('reports.salesType', 'مبيعات')}</span>`,
            amountClass: 'amount-sales',
            rowClass: 'row-sales'
        };
    }

    if (type === 'purchase') {
        return {
            badge: `<span class="badge badge-purchase"><i class="fas fa-arrow-down"></i> ${t('reports.purchaseType', 'مشتريات')}</span>`,
            amountClass: 'amount-purchase',
            rowClass: 'row-purchase'
        };
    }

    if (type === 'sales_return') {
        return {
            badge: `<span class="badge badge-sales-return"><i class="fas fa-undo"></i> ${t('reports.salesReturnType', 'مردودات مبيعات')}</span>`,
            amountClass: 'amount-sales-return',
            rowClass: 'row-sales-return'
        };
    }

    if (type === 'receipt') {
        return {
            badge: `<span class="badge badge-receipt"><i class="fas fa-hand-holding-usd"></i> ${t('reports.receiptType', 'سندات تحصيل')}</span>`,
            amountClass: 'amount-receipt',
            rowClass: 'row-receipt'
        };
    }

    if (type === 'payment') {
        return {
            badge: `<span class="badge badge-payment"><i class="fas fa-money-bill-wave"></i> ${t('reports.paymentType', 'سندات سداد')}</span>`,
            amountClass: 'amount-payment',
            rowClass: 'row-payment'
        };
    }

    return {
        badge: `<span class="badge badge-purchase-return"><i class="fas fa-undo"></i> ${t('reports.purchaseReturnType', 'مردودات مشتريات')}</span>`,
        amountClass: 'amount-purchase-return',
        rowClass: 'row-purchase-return'
    };
}

async function loadReports() {
    const filters = {
        type: typeFilter.value,
        customerId: customerFilter.value,
        startDate: startDateInput.value,
        endDate: endDateInput.value
    };

    setStatus(t('reports.loading', 'جارٍ تحميل البيانات...'), 'info');
    if (searchBtn) searchBtn.disabled = true;

    try {
        const reports = await window.electronAPI.getAllReports(filters);
        currentReports = Array.isArray(reports) ? reports : [];
        updateSummary(currentReports);
        renderReports(currentReports);

        if (currentReports.length === 0) {
            setStatus(t('reports.noDataHint', 'لا توجد فواتير مطابقة لمعايير البحث الحالية.'), 'warning');
        } else {
            setStatus(fmt(t('reports.resultCount', '{count} فاتورة'), { count: currentReports.length }), 'success');
        }

        updateLastUpdatedLabel();
    } catch (error) {
        console.error(error);
        setStatus(t('reports.loadError', 'حدث خطأ أثناء تحميل البيانات'), 'error');
        if (window.showToast) {
            window.showToast(t('reports.loadError', 'حدث خطأ أثناء تحميل البيانات'), 'error');
        }
    } finally {
        if (searchBtn) searchBtn.disabled = false;
    }
}

function renderReports(reports) {
    reportsTableBody.innerHTML = '';
    const resultCountEl = document.getElementById('resultCount');

    if (!Array.isArray(reports) || reports.length === 0) {
        reportsTableBody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <h3>${t('reports.noDataTitle', 'لا توجد فواتير')}</h3>
                        <p>${t('reports.noDataDesc', 'لم يتم العثور على فواتير مطابقة لمعايير البحث')}</p>
                    </div>
                </td>
            </tr>`;

        resultCountEl.textContent = '';
        document.getElementById('paginationBar').style.display = 'none';
        return;
    }

    const totalPages = Math.ceil(reports.length / PAGE_SIZE);
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageData = reports.slice(start, end);

    resultCountEl.textContent = fmt(t('reports.resultCount', '{count} فاتورة'), { count: reports.length });

    pageData.forEach((report, idx) => {
        const row = document.createElement('tr');
        const typeMeta = getTypeMeta(report.type);
        const safeDate = formatDateForUi(report.invoice_date);
        const safeInvoiceNo = escapeHtml(report.invoice_number || report.id || '-');
        const safeCustomer = escapeHtml(report.customer_name || '-');

        row.className = typeMeta.rowClass;
        row.innerHTML = `
            <td class="index-col">${start + idx + 1}</td>
            <td class="date-col">${safeDate}</td>
            <td><strong>${safeInvoiceNo}</strong></td>
            <td>${typeMeta.badge}</td>
            <td class="name-col">${safeCustomer}</td>
            <td class="amount ${typeMeta.amountClass}">${formatCurrency(report.total_amount)}</td>
            <td>
                <div class="row-actions">
                    ${report.type === 'receipt' || report.type === 'payment' ? `
                    <button type="button" class="btn-sm btn-edit" data-action="view" data-id="${report.id}" data-type="${report.type}">
                        <i class="fas fa-eye"></i> ${t('reports.viewBtn', 'عرض')}
                    </button>
                    ` : `
                    <button type="button" class="btn-sm btn-edit" data-action="edit" data-id="${report.id}" data-type="${report.type}">
                        <i class="fas fa-edit"></i> ${t('reports.editBtn', 'تعديل')}
                    </button>
                    <button type="button" class="btn-sm btn-delete" data-action="delete" data-id="${report.id}" data-type="${report.type}">
                        <i class="fas fa-trash"></i> ${t('reports.deleteBtn', 'حذف')}
                    </button>
                    `}
                </div>
            </td>
        `;

        reportsTableBody.appendChild(row);
    });

    renderPagination(reports.length, totalPages);
}

function renderPagination(total, totalPages) {
    const paginationBar = document.getElementById('paginationBar');
    const paginationInfo = document.getElementById('paginationInfo');
    const paginationBtns = document.getElementById('paginationBtns');

    if (totalPages <= 1) {
        paginationBar.style.display = 'none';
        return;
    }

    paginationBar.style.display = 'flex';
    const start = (currentPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(currentPage * PAGE_SIZE, total);
    paginationInfo.textContent = fmt(t('reports.paginationInfo', 'عرض {start} - {end} من {total}'), {
        start,
        end,
        total
    });

    let btnsHTML = `<button type="button" ${currentPage === 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})"><i class="fas fa-chevron-right"></i></button>`;

    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    for (let i = startPage; i <= endPage; i += 1) {
        btnsHTML += `<button type="button" class="${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }

    btnsHTML += `<button type="button" ${currentPage === totalPages ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})"><i class="fas fa-chevron-left"></i></button>`;
    paginationBtns.innerHTML = btnsHTML;
}

window.goToPage = function (page) {
    currentPage = page;
    renderReports(currentReports);
};

function openVoucherModalShell() {
    if (!voucherModalEl) return;
    voucherModalEl.classList.add('is-open');
    voucherModalEl.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
}

function closeVoucherModal() {
    if (!voucherModalEl) return;
    voucherModalEl.classList.remove('is-open');
    voucherModalEl.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
}

function renderVoucherModalLoading() {
    if (!voucherModalBodyEl) return;
    voucherModalBodyEl.innerHTML = `
        <div class="voucher-modal-loading">
            <i class="fas fa-spinner fa-spin"></i>
            <span>${t('reports.loading', 'جارٍ تحميل البيانات...')}</span>
        </div>
    `;
}

function renderVoucherModalError(message) {
    if (!voucherModalBodyEl) return;
    voucherModalBodyEl.innerHTML = `
        <div class="voucher-modal-error">
            <i class="fas fa-triangle-exclamation"></i>
            <span>${escapeHtml(message || t('reports.loadError', 'حدث خطأ أثناء تحميل البيانات'))}</span>
        </div>
    `;
}

function renderVoucherModalContent(reportType, transaction, entity) {
    if (!voucherModalBodyEl) return;

    const isReceipt = reportType === 'receipt';
    const typeLabel = isReceipt
        ? t('reports.receiptType', 'سندات تحصيل')
        : t('reports.paymentType', 'سندات سداد');
    const typeClass = isReceipt ? 'voucher-type-receipt' : 'voucher-type-payment';
    const typeIcon = isReceipt ? 'fa-hand-holding-usd' : 'fa-money-bill-wave';
    const entityLabel = isReceipt
        ? t('reports.modal.customer', 'العميل')
        : t('reports.modal.supplier', 'المورد');
    const entityName = escapeHtml(entity?.name || transaction.customer_name || '-');
    const entityPhone = escapeHtml(entity?.phone || '-');
    const entityAddress = escapeHtml(entity?.address || '-');
    const notesText = escapeHtml(transaction.description || t('reports.modal.noNotes', 'لا توجد ملاحظات'));
    const voucherNumber = escapeHtml(transaction.voucher_number || '-');
    const dateText = formatDateTimeForUi(transaction.transaction_date);
    const amountText = formatCurrency(transaction.amount);

    voucherModalBodyEl.innerHTML = `
        <div class="voucher-modal-summary ${typeClass}">
            <span class="voucher-type-pill">
                <i class="fas ${typeIcon}"></i>
                ${typeLabel}
            </span>
            <strong>${t('reports.tableHeaders.invoiceNumber', 'رقم الفاتورة')}: ${voucherNumber}</strong>
        </div>

        <div class="voucher-modal-grid">
            <div class="voucher-metric">
                <span>${t('reports.tableHeaders.amount', 'المبلغ')}</span>
                <strong>${amountText}</strong>
            </div>
            <div class="voucher-metric">
                <span>${t('reports.tableHeaders.date', 'التاريخ')}</span>
                <strong>${dateText}</strong>
            </div>
            <div class="voucher-metric">
                <span>${t('reports.modal.transactionId', 'رقم العملية')}</span>
                <strong>#${escapeHtml(transaction.id)}</strong>
            </div>
        </div>

        <div class="voucher-entity-card">
            <h4><i class="fas fa-user"></i> ${entityLabel}</h4>
            <div class="voucher-entity-row">
                <span>${entityLabel}</span>
                <strong>${entityName}</strong>
            </div>
            <div class="voucher-entity-row">
                <span>${t('reports.modal.phone', 'الهاتف')}</span>
                <strong>${entityPhone}</strong>
            </div>
            <div class="voucher-entity-row">
                <span>${t('reports.modal.address', 'العنوان')}</span>
                <strong>${entityAddress}</strong>
            </div>
        </div>

        <div class="voucher-notes-card">
            <h4><i class="fas fa-sticky-note"></i> ${t('reports.modal.notes', 'البيان')}</h4>
            <p>${notesText}</p>
        </div>
    `;
}

async function openVoucherModal(reportId, reportType) {
    if (reportType !== 'receipt' && reportType !== 'payment') return;

    openVoucherModalShell();
    renderVoucherModalLoading();

    if (voucherModalTitleEl) {
        voucherModalTitleEl.textContent = reportType === 'receipt'
            ? t('reports.modal.receiptPreviewTitle', 'معاينة سند التحصيل')
            : t('reports.modal.paymentPreviewTitle', 'معاينة سند السداد');
    }

    if (voucherModalSubtitleEl) {
        voucherModalSubtitleEl.textContent = `${t('reports.modal.transactionId', 'رقم العملية')}: #${reportId}`;
    }

    try {
        const transactions = await window.electronAPI.getTreasuryTransactions();
        const expectedType = reportType === 'receipt' ? 'income' : 'expense';
        const transaction = Array.isArray(transactions)
            ? transactions.find((item) => Number(item.id) === Number(reportId) && item.type === expectedType)
            : null;

        if (!transaction) {
            renderVoucherModalError(t('reports.modal.notFound', 'تعذر العثور على السند المطلوب.'));
            return;
        }

        const entity = allCustomers.find((customer) => Number(customer.id) === Number(transaction.customer_id));
        if (voucherModalSubtitleEl) {
            voucherModalSubtitleEl.textContent = `${t('reports.tableHeaders.invoiceNumber', 'رقم الفاتورة')}: ${transaction.voucher_number || '-'}`;
        }
        renderVoucherModalContent(reportType, transaction, entity);
    } catch (error) {
        console.error(error);
        renderVoucherModalError(t('reports.modal.loadError', 'تعذر تحميل بيانات السند.'));
    }
}

function printVoucherFromModal() {
    if (!voucherModalBodyEl) return;

    const printableContent = voucherModalBodyEl.innerHTML;
    const title = voucherModalTitleEl?.textContent || t('reports.voucherPreviewTitle', 'عرض السند');
    const subtitle = voucherModalSubtitleEl?.textContent || '';
    const printWindow = window.open('', '_blank', 'width=980,height=760');

    if (!printWindow) {
        setStatus(t('reports.printPopupBlocked', 'تعذر فتح نافذة الطباعة. تأكد من السماح بالنوافذ المنبثقة.'), 'warning');
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>${escapeHtml(title)}</title>
            <style>
                body {
                    margin: 24px;
                    font-family: "Segoe UI", Tahoma, Arial, sans-serif;
                    color: #0f172a;
                    background: #f8fafc;
                }
                .print-shell {
                    max-width: 900px;
                    margin: 0 auto;
                    border: 1px solid #dbe3ed;
                    border-radius: 14px;
                    background: #fff;
                    box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08);
                    overflow: hidden;
                }
                .print-head {
                    padding: 14px 16px;
                    border-bottom: 1px solid #dbe3ed;
                    background: linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(14, 165, 233, 0.06));
                }
                .print-head h1 {
                    margin: 0;
                    font-size: 1.06rem;
                }
                .print-head p {
                    margin: 6px 0 0;
                    font-size: 0.88rem;
                    color: #64748b;
                }
                .print-body {
                    padding: 16px;
                }
                .voucher-modal-summary,
                .voucher-modal-grid,
                .voucher-entity-card,
                .voucher-notes-card {
                    border-color: #dbe3ed !important;
                    background: #f8fafc !important;
                }
                .voucher-modal-grid {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(140px, 1fr));
                    gap: 10px;
                }
                .voucher-metric,
                .voucher-entity-card,
                .voucher-notes-card {
                    border: 1px solid #dbe3ed;
                    border-radius: 11px;
                    padding: 10px;
                }
                .voucher-metric span,
                .voucher-entity-row span {
                    color: #64748b;
                    font-size: 0.82rem;
                }
                .voucher-metric strong,
                .voucher-entity-row strong {
                    color: #0f172a;
                }
                .voucher-entity-row {
                    display: flex;
                    justify-content: space-between;
                    border-bottom: 1px dashed #dbe3ed;
                    padding: 6px 0;
                }
                .voucher-entity-row:last-child {
                    border-bottom: none;
                }
                @media print {
                    body {
                        margin: 0;
                        background: #fff;
                    }
                    .print-shell {
                        border: 0;
                        box-shadow: none;
                    }
                }
            </style>
        </head>
        <body>
            <div class="print-shell">
                <div class="print-head">
                    <h1>${escapeHtml(title)}</h1>
                    <p>${escapeHtml(subtitle)}</p>
                </div>
                <div class="print-body">${printableContent}</div>
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
}

function handleTableAction(event) {
    const actionBtn = event.target.closest('[data-action]');
    if (!actionBtn) return;

    const id = actionBtn.getAttribute('data-id');
    const type = actionBtn.getAttribute('data-type');
    const action = actionBtn.getAttribute('data-action');

    if (action === 'view') {
        openVoucherModal(id, type);
        return;
    }

    if (action === 'edit') {
        let page;
        if (type === 'sales') page = '../sales/index.html';
        else if (type === 'purchase') page = '../purchases/index.html';
        else if (type === 'sales_return') page = '../sales-returns/index.html';
        else if (type === 'purchase_return') page = '../purchase-returns/index.html';
        if (page) {
            window.location.href = `${page}?editId=${id}`;
        }
    }

    if (action === 'delete') {
        deleteInvoice(id, type);
    }
}

async function deleteInvoice(id, type) {
    if (confirm(t('reports.deleteConfirm', 'هل أنت متأكد من حذف هذه الفاتورة؟ سيتم عكس جميع التأثيرات المالية والمخزنية.'))) {
        const result = await window.electronAPI.deleteInvoice(Number(id), type);
        if (result.success) {
            if (window.showToast) {
                window.showToast(t('reports.deleteSuccess', 'تم حذف الفاتورة بنجاح'), 'success');
            }
            currentPage = 1;
            loadReports();
        } else {
            const errorMessage = fmt(t('reports.deleteError', 'حدث خطأ أثناء الحذف: {error}'), { error: result.error });
            if (window.showToast) {
                window.showToast(errorMessage, 'error');
            }
            setStatus(errorMessage, 'error');
        }
    }
}













