let ar = {};
const t = (key, fallback = '') => window.i18n?.getText(ar, key, fallback) ?? fallback;
const fmt = (template, values) => template.replace(/\{(\w+)\}/g, (_, k) => values[k] ?? '');

function getViewVoucherRequest() {
    const params = new URLSearchParams(window.location.search);
    const viewId = (params.get('viewId') || '').trim();
    const voucher = (params.get('voucher') || '').trim();
    return { viewId, voucher };
}

async function handleVoucherViewRequest() {
    const { viewId, voucher } = getViewVoucherRequest();
    if (!viewId && !voucher) return;

    try {
        const transactions = await window.electronAPI.getTreasuryTransactions();
        let target = null;

        if (viewId) {
            target = transactions.find((tr) => String(tr.id) === String(viewId) && tr.type === 'expense');
        }

        if (!target && voucher) {
            target = transactions.find(
                (tr) => tr.type === 'expense' && String(tr.voucher_number || '').trim() === voucher
            );
        }

        if (!target) {
            if (voucher) {
                document.getElementById('paymentNumber').value = voucher;
                await searchVoucher();
            }
            showToast(t('payment.toast.voucherNotFound', 'تعذر العثور على سند السداد المطلوب.'), 'warning');
            return;
        }

        if (target.transaction_date) {
            document.getElementById('date').value = String(target.transaction_date).split('T')[0];
        }

        if (target.voucher_number) {
            document.getElementById('paymentNumber').value = target.voucher_number;
        }

        if (target.customer_id) {
            document.getElementById('supplier').value = String(target.customer_id);
            handleSupplierChange();
        }

        document.getElementById('amount').value = Number(target.amount || 0).toFixed(2);
        document.getElementById('description').value = target.description || '';
        updatePaymentPreview();

        if (target.voucher_number) {
            await searchVoucher();
        }

        showToast(t('payment.toast.loadedFromReport', 'تم فتح سند السداد المطلوب.'), 'success');
    } catch (error) {
        console.error('Error loading payment voucher from report:', error);
    }
}

function getNavHTML() {
    return `
        <nav class="top-nav">
            <div class="nav-brand">${t('common.appName', 'نظام المحاسبة')}</div>
            <ul class="nav-links">
                <li><a href="../../views/dashboard/index.html">${t('common.nav.dashboard', 'لوحة التحكم')}</a></li>
                <li class="dropdown">
                    <a href="#">${t('common.nav.masterData', 'البيانات الأساسية')}</a>
                    <div class="dropdown-content">
                        <a href="../../views/items/units.html">${t('common.nav.units', 'الوحدات')}</a>
                        <a href="../../views/items/items.html">${t('common.nav.items', 'الأصناف')}</a>
                        <a href="../../views/customers/index.html">${t('common.nav.customers', 'العملاء والموردين')}</a>
                        <a href="../../views/opening-balance/index.html">${t('common.nav.openingBalance', 'بيانات أول المدة')}</a>
                        <a href="../../views/auth-users/index.html">${t('common.nav.userManagement', 'إدارة المستخدمين')}</a>
                    </div>
                </li>
                <li class="dropdown">
                    <a href="#">${t('common.nav.sales', 'المبيعات')}</a>
                    <div class="dropdown-content">
                        <a href="../../views/sales/index.html">${t('common.nav.salesInvoice', 'فاتورة المبيعات')}</a>
                        <a href="../../views/sales-returns/index.html">${t('common.nav.salesReturns', 'مردودات المبيعات')}</a>
                    </div>
                </li>
                <li class="dropdown">
                    <a href="#">${t('common.nav.purchases', 'المشتريات')}</a>
                    <div class="dropdown-content">
                        <a href="../../views/purchases/index.html">${t('common.nav.purchasesInvoice', 'فاتورة المشتريات')}</a>
                        <a href="../../views/purchase-returns/index.html">${t('common.nav.purchaseReturns', 'مردودات المشتريات')}</a>
                    </div>
                </li>
                <li><a href="../../views/inventory/index.html">${t('common.nav.inventory', 'المخزن')}</a></li>
                <li><a href="../../views/finance/index.html">${t('common.nav.finance', 'المالية')}</a></li>
                <li><a href="receipt.html">${t('common.nav.receipt', 'تحصيل من عميل')}</a></li>
                <li><a href="payment.html" class="active">${t('common.nav.payment', 'سداد لمورد')}</a></li>
                <li class="dropdown">
                    <a href="#">${t('common.nav.reports', 'التقارير')}</a>
                    <div class="dropdown-content">
                        <a href="../../views/reports/index.html">${t('common.nav.generalReports', 'التقارير العامة')}</a>
                        <a href="../../views/customer-reports/index.html">${t('common.nav.customerReports', 'تقارير العملاء')}</a>
                        <a href="../../views/reports/debtor-creditor/index.html">${t('common.nav.debtorCreditor', 'كشف المدين والدائن')}</a>
                    </div>
                </li>
                <li><a href="../../views/settings/index.html">${t('common.nav.settings', 'الإعدادات')}</a></li>
            </ul>
        </nav>`;
}

let allSuppliers = [];
let selectedSupplier = null;
let recentTransactions = [];
let supplierAutocomplete = null;

document.addEventListener('DOMContentLoaded', async () => {
    ar = await window.i18n?.loadArabicDictionary?.() || {};
    renderPage();
    initializeElements();
    await loadData();
    await handleVoucherViewRequest();
});

function renderPage() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${getNavHTML()}

        <div class="content">
            <div class="page-header receipt-header">
                <div>
                    <h1 class="page-title payment">
                        <i class="fas fa-hand-holding-dollar"></i>
                        ${t('payment.pageTitle', 'سداد نقدية لمورد')}
                    </h1>
                    <p class="page-subtitle">${t('payment.pageSubtitle', 'سجل عملية السداد بسرعة مع متابعة واضحة للرصيد قبل وبعد السداد.')}</p>
                </div>
            </div>

            <div class="stats-row">
                <div class="stat-card warning">
                    <i class="fas fa-money-bill-transfer"></i>
                    <div class="stat-value" id="todayPayments">0.00</div>
                    <div class="stat-label">${t('payment.stats.todayPayments', 'مدفوعات اليوم')}</div>
                </div>
                <div class="stat-card info">
                    <i class="fas fa-truck"></i>
                    <div class="stat-value" id="totalCreditors">0</div>
                    <div class="stat-label">${t('payment.stats.creditorsCount', 'موردين عليهم رصيد')}</div>
                </div>
                <div class="stat-card success">
                    <i class="fas fa-coins"></i>
                    <div class="stat-value" id="totalCredits">0.00</div>
                    <div class="stat-label">${t('payment.stats.totalCredits', 'إجمالي الأرصدة المستحقة')}</div>
                </div>
            </div>

            <div class="receipt-layout">
                <div class="form-card receipt-form-card">
                    <div class="card-header">
                        <i class="fas fa-file-invoice-dollar"></i>
                        <div>
                            <h2>${t('payment.formTitle', 'بيانات سند السداد')}</h2>
                            <p class="card-subtitle">${t('payment.formSubtitle', 'املأ بيانات السند ثم راجع الرصيد قبل الحفظ.')}</p>
                        </div>
                    </div>

                    <form id="paymentForm" class="receipt-form">
                        <div class="receipt-form-layout">
                            <div class="voucher-panel voucher-meta-panel">
                                <div class="voucher-panel-head">
                                    <i class="fas fa-receipt"></i>
                                    <span>${t('payment.voucherInfo', 'معلومات السند')}</span>
                                </div>
                                <div class="compact-meta-grid">
                                    <div class="form-group compact-field">
                                        <label><i class="fas fa-calendar"></i> ${t('payment.dateLabel', 'التاريخ')}</label>
                                        <input type="date" id="date" class="form-control" required>
                                    </div>
                                    <div class="form-group compact-field">
                                        <label><i class="fas fa-receipt"></i> ${t('payment.paymentNumberLabel', 'رقم السند')}</label>
                                        <div class="voucher-search-wrapper">
                                            <input type="text" id="paymentNumber" class="form-control" list="voucherSuggestions" placeholder="${t('payment.autoPlaceholder', 'تلقائي')}" autocomplete="off">
                                            <datalist id="voucherSuggestions"></datalist>
                                            <button type="button" class="btn-voucher-search" id="voucherSearchBtn" title="${t('payment.searchVoucher', 'بحث برقم السند')}">
                                                <i class="fas fa-search"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div id="voucherSearchResult" class="voucher-search-result" style="display:none;"></div>
                            </div>

                            <div class="voucher-panel voucher-details-panel">
                                <div class="voucher-panel-head">
                                    <i class="fas fa-user-check"></i>
                                    <span>${t('payment.paymentDetails', 'تفاصيل السداد')}</span>
                                </div>
                                <div class="details-grid">
                                    <div class="form-group">
                                        <label><i class="fas fa-truck"></i> ${t('payment.supplierLabel', 'المورد')}</label>
                                        <div class="input-with-icon supplier-field-shell">
                                            <select id="supplier" class="form-control" required>
                                                <option value="">${t('payment.searchPlaceholder', 'ابحث...')}</option>
                                            </select>
                                            <i class="fas fa-truck"></i>
                                        </div>
                                    </div>

                                    <div class="form-group amount-block">
                                        <label><i class="fas fa-money-bill"></i> ${t('payment.paymentAmount', 'مبلغ السداد')}</label>
                                        <div class="input-with-icon amount-field-shell">
                                            <input type="number" id="amount" class="form-control amount-input payment-amount-input" step="0.01" min="0.01" placeholder="0.00" inputmode="decimal" required>
                                            <i class="fas fa-pound-sign"></i>
                                        </div>
                                    </div>
                                </div>

                                <div class="quick-actions receipt-quick-actions">
                                    <button type="button" class="quick-btn" onclick="setQuickAmount(100)"><i class="fas fa-plus"></i> 100</button>
                                    <button type="button" class="quick-btn" onclick="setQuickAmount(500)"><i class="fas fa-plus"></i> 500</button>
                                    <button type="button" class="quick-btn" onclick="setQuickAmount(1000)"><i class="fas fa-plus"></i> 1000</button>
                                    <button type="button" class="quick-btn" onclick="payFullBalance()"><i class="fas fa-check-double"></i> ${t('payment.fullBalanceBtn', 'كامل الرصيد')}</button>
                                </div>

                                <div class="receipt-balance-preview" id="paymentBalancePreview">
                                    <div class="preview-item">
                                        <span class="preview-label">${t('payment.currentBalanceLabel', 'الرصيد الحالي')}</span>
                                        <strong class="preview-value" id="previewCurrentBalance">-</strong>
                                    </div>
                                    <div class="preview-divider"></div>
                                    <div class="preview-item">
                                        <span class="preview-label">${t('payment.afterPaymentLabel', 'بعد السداد')}</span>
                                        <strong class="preview-value" id="previewAfterBalance">-</strong>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="form-group">
                            <label><i class="fas fa-sticky-note"></i> ${t('payment.descriptionLabel', 'البيان / ملاحظات')}</label>
                            <textarea id="description" class="form-control" rows="3" placeholder="${t('payment.descriptionPlaceholder', 'مثال: دفعة على الحساب - سند صرف')}"></textarea>
                        </div>

                        <button type="submit" class="btn-submit payment" id="submitBtn">
                            <i class="fas fa-save"></i>
                            ${t('payment.submitBtn', 'حفظ عملية السداد')}
                        </button>
                    </form>
                </div>

                <div class="receipt-side-stack">
                    <div class="info-card receipt-info-card" id="supplierInfoCard">
                        <div class="placeholder-card">
                            <i class="fas fa-truck"></i>
                            <p>${t('payment.selectSupplierPrompt', 'اختر مورد لعرض بياناته')}</p>
                        </div>
                    </div>

                    <div class="info-card receipt-help-card">
                        <h3><i class="fas fa-lightbulb"></i> ${t('payment.quickNotes', 'ملاحظات سريعة')}</h3>
                        <ul>
                            <li>${t('payment.quickNote1Prefix', 'الرصيد الموجب يعني:')} <strong>${t('payment.quickNote1Bold', 'عليه')}</strong> ${t('payment.quickNote1Suffix', 'رصيد مستحق.')}</li>
                            <li>${t('payment.quickNote2', 'استخدم زر <strong>كامل الرصيد</strong> لتعبئة المبلغ تلقائيا.')}</li>
                            <li>${t('payment.quickNote3', 'يمكن كتابة بيان واضح لتسهيل المراجعة لاحقا.')}</li>
                        </ul>
                    </div>
                </div>
            </div>

            <div class="recent-section">
                <div class="section-header">
                    <i class="fas fa-history"></i>
                    <h3>${t('payment.recentTransactionsTitle', 'آخر عمليات السداد')}</h3>
                </div>
                <div class="transactions-list" id="recentTransactions">
                    <div class="no-transactions">
                        <i class="fas fa-inbox"></i>
                        <p>${t('payment.noRecentTransactions', 'لا توجد عمليات سداد حديثة')}</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function initializeElements() {
    document.getElementById('date').valueAsDate = new Date();
    generatePaymentNumber();
    document.getElementById('paymentForm').addEventListener('submit', handleSubmit);
    document.getElementById('supplier').addEventListener('change', handleSupplierChange);
    document.getElementById('amount').addEventListener('input', updatePaymentPreview);
    document.getElementById('voucherSearchBtn').addEventListener('click', searchVoucher);
}

async function loadData() {
    try {
        const customers = await window.electronAPI.getCustomers();
        allSuppliers = customers.filter((c) => c.type === 'supplier' || c.type === 'both');

        const select = document.getElementById('supplier');
        select.innerHTML = `<option value="">${t('payment.searchPlaceholder', 'ابحث...')}</option>`;
        allSuppliers.forEach((s) => {
            const option = document.createElement('option');
            option.value = s.id;
            option.textContent = `${s.name} ${s.balance > 0 ? fmt(t('payment.owedSuffix', '(عليه: {amount})'), {amount: s.balance.toFixed(2)}) : ''}`;
            select.appendChild(option);
        });

        // Load voucher suggestions
        const transactions = await window.electronAPI.getTreasuryTransactions();
        const datalist = document.getElementById('voucherSuggestions');
        datalist.innerHTML = '';
        const paymentTransactions = transactions.filter(t => t.type === 'expense' && t.voucher_number).slice(0, 20);
        paymentTransactions.forEach(t => {
            const option = document.createElement('option');
            option.value = t.voucher_number;
            datalist.appendChild(option);
        });

        if (supplierAutocomplete) {
            supplierAutocomplete.refresh();
        } else {
            supplierAutocomplete = new Autocomplete(select);
        }

        recentTransactions = transactions.filter((tr) => tr.type === 'expense' && tr.customer_id).slice(0, 5);

        renderRecentTransactions();
        calculateStats();
    } catch (error) {
        console.error('Error loading data:', error);
        showToast(t('payment.toast.loadError', 'حدث خطأ في تحميل البيانات'), 'error');
    }
}

async function generatePaymentNumber() {
    try {
        const transactions = await window.electronAPI.getTreasuryTransactions();
        const paymentCount = transactions.filter((tr) => tr.type === 'expense').length;
        document.getElementById('paymentNumber').value = `PY-${String(paymentCount + 1).padStart(4, '0')}`;
    } catch (error) {
        document.getElementById('paymentNumber').value = `PY-${Date.now()}`;
    }
}

function handleSupplierChange() {
    const supplierId = document.getElementById('supplier').value;
    if (!supplierId) {
        renderSupplierPlaceholder();
        updatePaymentPreview();
        return;
    }

    selectedSupplier = allSuppliers.find((s) => s.id == supplierId);
    if (selectedSupplier) {
        renderSupplierInfo(selectedSupplier);
        updatePaymentPreview();
    }
}

function renderSupplierInfo(supplier) {
    const card = document.getElementById('supplierInfoCard');
    const balanceClass = supplier.balance > 0 ? 'positive' : supplier.balance < 0 ? 'negative' : 'zero';
    const balanceHint = supplier.balance > 0 ? t('payment.balanceHintDebit', 'عليه رصيد مستحق السداد') : supplier.balance < 0 ? t('payment.balanceHintCredit', 'له رصيد دائن') : t('payment.balanceHintZero', 'لا يوجد رصيد');

    card.innerHTML = `
        <div class="entity-avatar supplier">
            <i class="fas fa-truck"></i>
        </div>
        <div class="entity-name">${supplier.name}</div>
        <div class="entity-type">${t('payment.entityType', 'مورد')}</div>
        ${supplier.phone || supplier.address ? `
            <div class="entity-contact">
                ${supplier.phone ? `<span><i class="fas fa-phone"></i> ${supplier.phone}</span>` : ''}
                ${supplier.address ? `<span><i class="fas fa-map-marker-alt"></i> ${supplier.address}</span>` : ''}
            </div>
        ` : ''}
        <div class="balance-display">
            <div class="balance-label">${t('payment.currentBalanceLabel', 'الرصيد الحالي')}</div>
            <div class="balance-amount ${balanceClass}">${Math.abs(supplier.balance).toFixed(2)} ج.م</div>
            <div class="balance-hint">${balanceHint}</div>
        </div>
        <div class="entity-actions">
            <a href="../../views/customer-reports/index.html?customerId=${supplier.id}" class="btn-action primary">
                <i class="fas fa-file-alt"></i>
                ${t('payment.accountStatement', 'كشف حساب')}
            </a>
            <a href="../../views/purchases/index.html" class="btn-action secondary">
                <i class="fas fa-shopping-basket"></i>
                ${t('payment.newPurchaseInvoice', 'فاتورة شراء')}
            </a>
        </div>
    `;
}

function renderSupplierPlaceholder() {
    const card = document.getElementById('supplierInfoCard');
    card.innerHTML = `
        <div class="placeholder-card">
            <i class="fas fa-truck"></i>
            <p>${t('payment.selectSupplierPrompt', 'اختر مورد لعرض بياناته')}</p>
        </div>
    `;
    selectedSupplier = null;
    updatePaymentPreview();
}

function formatBalancePreview(balance) {
    if (balance > 0) {
        return `${balance.toFixed(2)} ${t('payment.balanceOwed', 'عليه')}`;
    }
    if (balance < 0) {
        return `${Math.abs(balance).toFixed(2)} ${t('payment.balanceCredit', 'له')}`;
    }
    return `0.00 ${t('payment.balanceBalanced', 'متزن')}`;
}

function updatePaymentPreview() {
    const currentEl = document.getElementById('previewCurrentBalance');
    const afterEl = document.getElementById('previewAfterBalance');
    if (!currentEl || !afterEl) return;

    if (!selectedSupplier) {
        currentEl.textContent = '-';
        afterEl.textContent = '-';
        return;
    }

    const currentBalance = Number(selectedSupplier.balance) || 0;
    const amount = Number.parseFloat(document.getElementById('amount').value) || 0;
    const afterBalance = currentBalance - amount;

    currentEl.textContent = formatBalancePreview(currentBalance);
    afterEl.textContent = formatBalancePreview(afterBalance);
}

function renderRecentTransactions() {
    const container = document.getElementById('recentTransactions');

    if (recentTransactions.length === 0) {
        container.innerHTML = `
            <div class="no-transactions">
                <i class="fas fa-inbox"></i>
                <p>${t('payment.noRecentTransactions', 'لا توجد عمليات سداد حديثة')}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = recentTransactions
        .map((tr) => {
            const supplier = allSuppliers.find((s) => s.id == tr.customer_id);
            return `
                <div class="transaction-item">
                    <div class="transaction-info">
                        <div class="transaction-icon expense">
                            <i class="fas fa-arrow-up"></i>
                        </div>
                        <div class="transaction-details">
                            <h4>${supplier?.name || t('payment.unknownSupplier', 'مورد غير معروف')}</h4>
                            <span>${tr.transaction_date} - ${tr.description || t('payment.defaultDescription', 'سداد نقدية')}</span>
                        </div>
                    </div>
                    <div class="transaction-amount expense">-${tr.amount.toFixed(2)}</div>
                </div>
            `;
        })
        .join('');
}

function calculateStats() {
    const today = new Date().toISOString().split('T')[0];

    const todayPayments = recentTransactions
        .filter((tr) => tr.transaction_date === today)
        .reduce((sum, tr) => sum + tr.amount, 0);
    document.getElementById('todayPayments').textContent = todayPayments.toFixed(2);

    const creditors = allSuppliers.filter((s) => s.balance > 0);
    document.getElementById('totalCreditors').textContent = creditors.length;

    const totalCredits = creditors.reduce((sum, s) => sum + s.balance, 0);
    document.getElementById('totalCredits').textContent = totalCredits.toFixed(2);
}

function setQuickAmount(amount) {
    document.getElementById('amount').value = amount;
    document.getElementById('amount').focus();
    updatePaymentPreview();
}

function payFullBalance() {
    if (selectedSupplier && selectedSupplier.balance > 0) {
        document.getElementById('amount').value = selectedSupplier.balance.toFixed(2);
        document.getElementById('description').value = t('payment.fullBalanceDescription', 'سداد كامل المستحق');
        updatePaymentPreview();
    } else {
        showToast(t('payment.toast.selectSupplierWithBalance', 'اختر مورد عليه رصيد مستحق'), 'warning');
    }
}

async function handleSubmit(e) {
    e.preventDefault();

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${t('payment.toast.saving', 'جاري الحفظ...')}`;

    try {
        const data = {
            type: 'expense',
            date: document.getElementById('date').value,
            customer_id: document.getElementById('supplier').value,
            amount: parseFloat(document.getElementById('amount').value),
            voucher_number: document.getElementById('paymentNumber').value,
            description:
                document.getElementById('description').value ||
                fmt(t('payment.defaultDescriptionTemplate', 'سداد نقدية - سند رقم {number}'), {number: document.getElementById('paymentNumber').value})
        };

        if (!data.customer_id || !data.amount || data.amount <= 0) {
            showToast(t('payment.toast.fillRequired', 'يرجى ملء جميع الحقول المطلوبة'), 'error');
            return;
        }

        const result = await window.electronAPI.addTreasuryTransaction(data);

        if (result.success) {
            showToast(t('payment.toast.saveSuccess', 'تم حفظ عملية السداد بنجاح'), 'success');
            document.getElementById('paymentForm').reset();
            document.getElementById('date').valueAsDate = new Date();
            generatePaymentNumber();
            renderSupplierPlaceholder();
            if (supplierAutocomplete) supplierAutocomplete.refresh();
            loadData();
        } else {
            showToast(fmt(t('payment.toast.saveError', 'حدث خطأ: {error}'), {error: result.error}), 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast(t('payment.toast.unexpectedError', 'حدث خطأ غير متوقع'), 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class="fas fa-save"></i> ${t('payment.submitBtn', 'حفظ عملية السداد')}`;
    }
}

function showToast(message, type = 'info') {
    if (typeof Toast !== 'undefined') {
        Toast.show(message, type);
    } else {
        alert(message);
    }
}

async function searchVoucher() {
    const voucherNumber = document.getElementById('paymentNumber').value.trim();
    const resultContainer = document.getElementById('voucherSearchResult');
    if (!voucherNumber) {
        resultContainer.style.display = 'none';
        return;
    }
    try {
        const res = await window.electronAPI.searchTreasuryByVoucher(voucherNumber);
        const results = Array.isArray(res?.results)
            ? res.results.filter((tr) => tr.type === 'expense')
            : [];

        if (res.success && results.length > 0) {
            resultContainer.style.display = 'block';
            resultContainer.innerHTML = `
                <div class="voucher-result-header">
                    <i class="fas fa-file-alt"></i>
                    <span>${t('payment.searchResults', 'نتائج البحث')} (${results.length})</span>
                    <button type="button" class="btn-close-search" onclick="document.getElementById('voucherSearchResult').style.display='none'">&times;</button>
                </div>
                ${results.map(tr => `
                    <div class="voucher-result-item">
                        <div class="voucher-result-row">
                            <span class="voucher-result-label">${t('payment.voucherNumberLabel', 'رقم السند')}:</span>
                            <strong>${tr.voucher_number || '—'}</strong>
                        </div>
                        <div class="voucher-result-row">
                            <span class="voucher-result-label">${t('payment.dateLabel', 'التاريخ')}:</span>
                            <span>${tr.transaction_date}</span>
                        </div>
                        <div class="voucher-result-row">
                            <span class="voucher-result-label">${t('payment.supplierLabel', 'المورد')}:</span>
                            <span>${tr.customer_name || '—'}</span>
                        </div>
                        <div class="voucher-result-row">
                            <span class="voucher-result-label">${t('payment.paymentAmount', 'المبلغ')}:</span>
                            <strong>${tr.amount.toFixed(2)} ج.م</strong>
                        </div>
                        <div class="voucher-result-row">
                            <span class="voucher-result-label">${t('payment.descriptionLabel', 'البيان')}:</span>
                            <span>${tr.description || '—'}</span>
                        </div>
                    </div>
                `).join('')}
            `;
        } else {
            resultContainer.style.display = 'block';
            resultContainer.innerHTML = `
                <div class="voucher-result-header">
                    <i class="fas fa-search"></i>
                    <span>${t('payment.noSearchResults', 'لا توجد نتائج')}</span>
                    <button type="button" class="btn-close-search" onclick="document.getElementById('voucherSearchResult').style.display='none'">&times;</button>
                </div>
            `;
        }
    } catch (err) {
        console.error(err);
    }
}
