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
            target = transactions.find((tr) => String(tr.id) === String(viewId) && tr.type === 'income');
        }

        if (!target && voucher) {
            target = transactions.find(
                (tr) => tr.type === 'income' && String(tr.voucher_number || '').trim() === voucher
            );
        }

        if (!target) {
            if (voucher) {
                document.getElementById('receiptNumber').value = voucher;
                await searchVoucher();
            }
            showToast(t('receipt.toast.voucherNotFound', 'تعذر العثور على سند التحصيل المطلوب.'), 'warning');
            return;
        }

        if (target.transaction_date) {
            document.getElementById('date').value = String(target.transaction_date).split('T')[0];
        }

        if (target.voucher_number) {
            document.getElementById('receiptNumber').value = target.voucher_number;
        }

        if (target.customer_id) {
            document.getElementById('customer').value = String(target.customer_id);
            handleCustomerChange();
        }

        document.getElementById('amount').value = Number(target.amount || 0).toFixed(2);
        document.getElementById('description').value = target.description || '';
        updateReceiptPreview();

        if (target.voucher_number) {
            await searchVoucher();
        }

        showToast(t('receipt.toast.loadedFromReport', 'تم فتح سند التحصيل المطلوب.'), 'success');
    } catch (error) {
        console.error('Error loading receipt voucher from report:', error);
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
                <li><a href="receipt.html" class="active">${t('common.nav.receipt', 'تحصيل من عميل')}</a></li>
                <li><a href="payment.html">${t('common.nav.payment', 'سداد لمورد')}</a></li>
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

let allCustomers = [];
let selectedCustomer = null;
let recentTransactions = [];
let customerAutocomplete = null;

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
                    <h1 class="page-title receipt">
                        <i class="fas fa-hand-holding-usd"></i>
                        ${t('receipt.pageTitle', 'تحصيل نقدية من عميل')}
                    </h1>
                    <p class="page-subtitle">${t('receipt.pageSubtitle', 'سجل عملية التحصيل بسرعة مع متابعة واضحة للرصيد قبل وبعد التحصيل.')}</p>
                </div>
            </div>

            <div class="stats-row">
                <div class="stat-card success">
                    <i class="fas fa-money-bill-wave"></i>
                    <div class="stat-value" id="todayReceipts">0.00</div>
                    <div class="stat-label">${t('receipt.stats.todayReceipts', 'تحصيلات اليوم')}</div>
                </div>
                <div class="stat-card warning">
                    <i class="fas fa-users"></i>
                    <div class="stat-value" id="totalDebtors">0</div>
                    <div class="stat-label">${t('receipt.stats.debtorsCount', 'عملاء عليهم رصيد')}</div>
                </div>
                <div class="stat-card info">
                    <i class="fas fa-coins"></i>
                    <div class="stat-value" id="totalDebts">0.00</div>
                    <div class="stat-label">${t('receipt.stats.totalDebts', 'إجمالي الأرصدة المستحقة')}</div>
                </div>
            </div>

            <div class="receipt-layout">
                <div class="form-card receipt-form-card">
                    <div class="card-header">
                        <i class="fas fa-file-invoice-dollar"></i>
                        <div>
                            <h2>${t('receipt.formTitle', 'بيانات سند التحصيل')}</h2>
                            <p class="card-subtitle">${t('receipt.formSubtitle', 'املأ بيانات السند ثم راجع الرصيد قبل الحفظ.')}</p>
                        </div>
                    </div>

                    <form id="receiptForm" class="receipt-form">
                        <div class="receipt-form-layout">
                            <div class="voucher-panel voucher-meta-panel">
                                <div class="voucher-panel-head">
                                    <i class="fas fa-receipt"></i>
                                    <span>${t('receipt.voucherInfo', 'معلومات السند')}</span>
                                </div>
                                <div class="compact-meta-grid">
                                    <div class="form-group compact-field">
                                        <label><i class="fas fa-calendar"></i> ${t('receipt.dateLabel', 'التاريخ')}</label>
                                        <input type="date" id="date" class="form-control" required>
                                    </div>
                                    <div class="form-group compact-field">
                                        <label><i class="fas fa-receipt"></i> ${t('receipt.receiptNumberLabel', 'رقم الإيصال')}</label>
                                        <div class="voucher-search-wrapper">
                                            <input type="text" id="receiptNumber" class="form-control" list="voucherSuggestions" placeholder="${t('receipt.autoPlaceholder', 'تلقائي')}" autocomplete="off">
                                            <datalist id="voucherSuggestions"></datalist>
                                            <button type="button" class="btn-voucher-search" id="voucherSearchBtn" title="${t('receipt.searchVoucher', 'بحث برقم السند')}">
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
                                    <span>${t('receipt.collectionDetails', 'تفاصيل التحصيل')}</span>
                                </div>
                                <div class="details-grid">
                                    <div class="form-group">
                                        <label><i class="fas fa-user"></i> ${t('receipt.customerLabel', 'العميل')}</label>
                                        <div class="input-with-icon customer-field-shell">
                                            <select id="customer" class="form-control" required>
                                                <option value="">${t('receipt.searchPlaceholder', 'ابحث...')}</option>
                                            </select>
                                            <i class="fas fa-user"></i>
                                        </div>
                                    </div>

                                    <div class="form-group amount-block">
                                        <label><i class="fas fa-money-bill"></i> ${t('receipt.collectionAmount', 'مبلغ التحصيل')}</label>
                                        <div class="input-with-icon amount-field-shell">
                                            <input type="number" id="amount" class="form-control amount-input receipt-amount-input" step="0.01" min="0.01" placeholder="0.00" inputmode="decimal" required>
                                            <i class="fas fa-pound-sign"></i>
                                        </div>
                                    </div>
                                </div>

                                <div class="quick-actions receipt-quick-actions">
                                    <button type="button" class="quick-btn" onclick="setQuickAmount(100)"><i class="fas fa-plus"></i> 100</button>
                                    <button type="button" class="quick-btn" onclick="setQuickAmount(500)"><i class="fas fa-plus"></i> 500</button>
                                    <button type="button" class="quick-btn" onclick="setQuickAmount(1000)"><i class="fas fa-plus"></i> 1000</button>
                                    <button type="button" class="quick-btn" onclick="payFullBalance()"><i class="fas fa-check-double"></i> ${t('receipt.fullBalanceBtn', 'كامل الرصيد')}</button>
                                </div>

                                <div class="receipt-balance-preview" id="receiptBalancePreview">
                                    <div class="preview-item">
                                        <span class="preview-label">${t('receipt.currentBalanceLabel', 'الرصيد الحالي')}</span>
                                        <strong class="preview-value" id="previewCurrentBalance">-</strong>
                                    </div>
                                    <div class="preview-divider"></div>
                                    <div class="preview-item">
                                        <span class="preview-label">${t('receipt.afterCollectionLabel', 'بعد التحصيل')}</span>
                                        <strong class="preview-value" id="previewAfterBalance">-</strong>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="form-group">
                            <label><i class="fas fa-sticky-note"></i> ${t('receipt.descriptionLabel', 'البيان / ملاحظات')}</label>
                            <textarea id="description" class="form-control" rows="3" placeholder="${t('receipt.descriptionPlaceholder', 'مثال: دفعة على الحساب - سند قبض')}"></textarea>
                        </div>

                        <button type="submit" class="btn-submit receipt" id="submitBtn">
                            <i class="fas fa-save"></i>
                            ${t('receipt.submitBtn', 'حفظ عملية التحصيل')}
                        </button>
                    </form>
                </div>

                <div class="receipt-side-stack">
                    <div class="info-card receipt-info-card" id="customerInfoCard">
                        <div class="placeholder-card">
                            <i class="fas fa-user-circle"></i>
                            <p>${t('receipt.selectCustomerPrompt', 'اختر عميل لعرض بياناته')}</p>
                        </div>
                    </div>

                    <div class="info-card receipt-help-card">
                        <h3><i class="fas fa-lightbulb"></i> ${t('receipt.quickNotes', 'ملاحظات سريعة')}</h3>
                        <ul>
                            <li>${t('receipt.quickNote1', 'الرصيد الموجب يعني: <strong>عليه</strong> رصيد مستحق.')}</li>
                            <li>${t('receipt.quickNote2', 'استخدم زر <strong>كامل الرصيد</strong> لتعبئة المبلغ تلقائيا.')}</li>
                            <li>${t('receipt.quickNote3', 'يمكن كتابة بيان واضح لتسهيل المراجعة لاحقا.')}</li>
                        </ul>
                    </div>
                </div>
            </div>

            <div class="recent-section">
                <div class="section-header">
                    <i class="fas fa-history"></i>
                    <h3>${t('receipt.recentTransactionsTitle', 'آخر عمليات التحصيل')}</h3>
                </div>
                <div class="transactions-list" id="recentTransactions">
                    <div class="no-transactions">
                        <i class="fas fa-inbox"></i>
                        <p>${t('receipt.noRecentTransactions', 'لا توجد عمليات تحصيل حديثة')}</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function initializeElements() {
    document.getElementById('date').valueAsDate = new Date();
    generateReceiptNumber();
    document.getElementById('receiptForm').addEventListener('submit', handleSubmit);
    document.getElementById('customer').addEventListener('change', handleCustomerChange);
    document.getElementById('amount').addEventListener('input', updateReceiptPreview);
    document.getElementById('voucherSearchBtn').addEventListener('click', searchVoucher);
}

async function loadData() {
    try {
        const customers = await window.electronAPI.getCustomers();
        allCustomers = customers.filter((c) => c.type === 'customer' || c.type === 'both');

        const select = document.getElementById('customer');
        select.innerHTML = '<option value="">' + t('receipt.searchPlaceholder', 'ابحث...') + '</option>';
        allCustomers.forEach((c) => {
            const option = document.createElement('option');
            option.value = c.id;
            option.textContent = `${c.name} ${c.balance > 0 ? fmt(t('receipt.owedSuffix', '(عليه: {amount})'), {amount: c.balance.toFixed(2)}) : ''}`;
            select.appendChild(option);
        });

        // Load voucher suggestions
        const transactions = await window.electronAPI.getTreasuryTransactions();
        const datalist = document.getElementById('voucherSuggestions');
        datalist.innerHTML = '';
        const receiptTransactions = transactions.filter(t => t.type === 'income' && t.voucher_number).slice(0, 20);
        receiptTransactions.forEach(t => {
            const option = document.createElement('option');
            option.value = t.voucher_number;
            datalist.appendChild(option);
        });

        if (customerAutocomplete) {
            customerAutocomplete.refresh();
        } else {
            customerAutocomplete = new Autocomplete(select);
        }

        recentTransactions = transactions.filter((tr) => tr.type === 'income' && tr.customer_id).slice(0, 5);

        renderRecentTransactions();
        calculateStats();
    } catch (error) {
        console.error('Error loading data:', error);
        showToast(t('receipt.toast.loadError', 'حدث خطأ في تحميل البيانات'), 'error');
    }
}

async function generateReceiptNumber() {
    try {
        const transactions = await window.electronAPI.getTreasuryTransactions();
        const receiptCount = transactions.filter((tr) => tr.type === 'income').length;
        document.getElementById('receiptNumber').value = `RC-${String(receiptCount + 1).padStart(4, '0')}`;
    } catch (error) {
        document.getElementById('receiptNumber').value = `RC-${Date.now()}`;
    }
}

function handleCustomerChange() {
    const customerId = document.getElementById('customer').value;
    if (!customerId) {
        renderCustomerPlaceholder();
        updateReceiptPreview();
        return;
    }

    selectedCustomer = allCustomers.find((c) => c.id == customerId);
    if (selectedCustomer) {
        renderCustomerInfo(selectedCustomer);
        updateReceiptPreview();
    }
}

function renderCustomerInfo(customer) {
    const card = document.getElementById('customerInfoCard');
    const balanceClass = customer.balance > 0 ? 'positive' : customer.balance < 0 ? 'negative' : 'zero';
    const balanceHint = customer.balance > 0 ? t('receipt.balanceHintDebit', 'عليه رصيد مستحق') : customer.balance < 0 ? t('receipt.balanceHintCredit', 'له رصيد دائن') : t('receipt.balanceHintZero', 'لا يوجد رصيد');

    card.innerHTML = `
        <div class="entity-avatar customer">
            <i class="fas fa-user"></i>
        </div>
        <div class="entity-name">${customer.name}</div>
        <div class="entity-type">${t('receipt.entityType', 'عميل')}</div>
        ${customer.phone || customer.address ? `
            <div class="entity-contact">
                ${customer.phone ? `<span><i class="fas fa-phone"></i> ${customer.phone}</span>` : ''}
                ${customer.address ? `<span><i class="fas fa-map-marker-alt"></i> ${customer.address}</span>` : ''}
            </div>
        ` : ''}
        <div class="balance-display">
            <div class="balance-label">${t('receipt.currentBalanceLabel', 'الرصيد الحالي')}</div>
            <div class="balance-amount ${balanceClass}">${Math.abs(customer.balance).toFixed(2)} ج.م</div>
            <div class="balance-hint">${balanceHint}</div>
        </div>
        <div class="entity-actions">
            <a href="../../views/customer-reports/index.html?customerId=${customer.id}" class="btn-action primary">
                <i class="fas fa-file-alt"></i>
                ${t('receipt.accountStatement', 'كشف حساب')}
            </a>
            <a href="../../views/sales/index.html" class="btn-action secondary">
                <i class="fas fa-shopping-cart"></i>
                ${t('receipt.newInvoice', 'فاتورة جديدة')}
            </a>
        </div>
    `;
}

function renderCustomerPlaceholder() {
    const card = document.getElementById('customerInfoCard');
    card.innerHTML = `
        <div class="placeholder-card">
            <i class="fas fa-user-circle"></i>
            <p>${t('receipt.selectCustomerPrompt', 'اختر عميل لعرض بياناته')}</p>
        </div>
    `;
    selectedCustomer = null;
    updateReceiptPreview();
}

function formatBalancePreview(balance) {
    if (balance > 0) {
        return `${balance.toFixed(2)} ${t('receipt.balanceOwed', 'عليه')}`;
    }
    if (balance < 0) {
        return `${Math.abs(balance).toFixed(2)} ${t('receipt.balanceCredit', 'له')}`;
    }
    return `0.00 ${t('receipt.balanceBalanced', 'متزن')}`;
}

function updateReceiptPreview() {
    const currentEl = document.getElementById('previewCurrentBalance');
    const afterEl = document.getElementById('previewAfterBalance');
    if (!currentEl || !afterEl) return;

    if (!selectedCustomer) {
        currentEl.textContent = '-';
        afterEl.textContent = '-';
        return;
    }

    const currentBalance = Number(selectedCustomer.balance) || 0;
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
                <p>${t('receipt.noRecentTransactions', 'لا توجد عمليات تحصيل حديثة')}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = recentTransactions
        .map((tr) => {
            const customer = allCustomers.find((c) => c.id == tr.customer_id);
            return `
                <div class="transaction-item">
                    <div class="transaction-info">
                        <div class="transaction-icon income">
                            <i class="fas fa-arrow-down"></i>
                        </div>
                        <div class="transaction-details">
                            <h4>${customer?.name || t('receipt.unknownCustomer', 'عميل غير معروف')}</h4>
                            <span>${tr.transaction_date} - ${tr.description || t('receipt.defaultDescription', 'تحصيل نقدية')}</span>
                        </div>
                    </div>
                    <div class="transaction-amount income">+${tr.amount.toFixed(2)}</div>
                </div>
            `;
        })
        .join('');
}

function calculateStats() {
    const today = new Date().toISOString().split('T')[0];

    const todayReceipts = recentTransactions
        .filter((tr) => tr.transaction_date === today)
        .reduce((sum, tr) => sum + tr.amount, 0);
    document.getElementById('todayReceipts').textContent = todayReceipts.toFixed(2);

    const debtors = allCustomers.filter((c) => c.balance > 0);
    document.getElementById('totalDebtors').textContent = debtors.length;

    const totalDebts = debtors.reduce((sum, c) => sum + c.balance, 0);
    document.getElementById('totalDebts').textContent = totalDebts.toFixed(2);
}

function setQuickAmount(amount) {
    document.getElementById('amount').value = amount;
    document.getElementById('amount').focus();
    updateReceiptPreview();
}

function payFullBalance() {
    if (selectedCustomer && selectedCustomer.balance > 0) {
        document.getElementById('amount').value = selectedCustomer.balance.toFixed(2);
        document.getElementById('description').value = t('receipt.fullBalanceDescription', 'سداد كامل الرصيد');
        updateReceiptPreview();
    } else {
        showToast(t('receipt.toast.selectCustomerWithBalance', 'اختر عميل عليه رصيد مستحق'), 'warning');
    }
}

async function handleSubmit(e) {
    e.preventDefault();

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + t('receipt.toast.saving', 'جاري الحفظ...');

    try {
        const data = {
            type: 'income',
            date: document.getElementById('date').value,
            customer_id: document.getElementById('customer').value,
            amount: parseFloat(document.getElementById('amount').value),
            voucher_number: document.getElementById('receiptNumber').value,
            description:
                document.getElementById('description').value ||
                fmt(t('receipt.defaultDescriptionTemplate', 'تحصيل نقدية - إيصال رقم {number}'), {number: document.getElementById('receiptNumber').value})
        };

        if (!data.customer_id || !data.amount || data.amount <= 0) {
            showToast(t('receipt.toast.fillRequired', 'يرجى ملء جميع الحقول المطلوبة'), 'error');
            return;
        }

        const result = await window.electronAPI.addTreasuryTransaction(data);

        if (result.success) {
            showToast(t('receipt.toast.saveSuccess', 'تم حفظ عملية التحصيل بنجاح'), 'success');
            document.getElementById('receiptForm').reset();
            document.getElementById('date').valueAsDate = new Date();
            generateReceiptNumber();
            renderCustomerPlaceholder();
            if (customerAutocomplete) customerAutocomplete.refresh();
            loadData();
        } else {
            showToast(fmt(t('receipt.toast.saveError', 'حدث خطأ: {error}'), {error: result.error}), 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast(t('receipt.toast.unexpectedError', 'حدث خطأ غير متوقع'), 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-save"></i> ' + t('receipt.submitBtn', 'حفظ عملية التحصيل');
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
    const voucherNumber = document.getElementById('receiptNumber').value.trim();
    const resultContainer = document.getElementById('voucherSearchResult');
    if (!voucherNumber) {
        resultContainer.style.display = 'none';
        return;
    }
    try {
        const res = await window.electronAPI.searchTreasuryByVoucher(voucherNumber);
        const results = Array.isArray(res?.results)
            ? res.results.filter((tr) => tr.type === 'income')
            : [];

        if (res.success && results.length > 0) {
            resultContainer.style.display = 'block';
            resultContainer.innerHTML = `
                <div class="voucher-result-header">
                    <i class="fas fa-file-alt"></i>
                    <span>${t('receipt.searchResults', 'نتائج البحث')} (${results.length})</span>
                    <button type="button" class="btn-close-search" onclick="document.getElementById('voucherSearchResult').style.display='none'">&times;</button>
                </div>
                ${results.map(tr => `
                    <div class="voucher-result-item">
                        <div class="voucher-result-row">
                            <span class="voucher-result-label">${t('receipt.voucherNumberLabel', 'رقم السند')}:</span>
                            <strong>${tr.voucher_number || '—'}</strong>
                        </div>
                        <div class="voucher-result-row">
                            <span class="voucher-result-label">${t('receipt.dateLabel', 'التاريخ')}:</span>
                            <span>${tr.transaction_date}</span>
                        </div>
                        <div class="voucher-result-row">
                            <span class="voucher-result-label">${t('receipt.customerLabel', 'العميل')}:</span>
                            <span>${tr.customer_name || '—'}</span>
                        </div>
                        <div class="voucher-result-row">
                            <span class="voucher-result-label">${t('receipt.collectionAmount', 'المبلغ')}:</span>
                            <strong>${tr.amount.toFixed(2)} ج.م</strong>
                        </div>
                        <div class="voucher-result-row">
                            <span class="voucher-result-label">${t('receipt.descriptionLabel', 'البيان')}:</span>
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
                    <span>${t('receipt.noSearchResults', 'لا توجد نتائج')}</span>
                    <button type="button" class="btn-close-search" onclick="document.getElementById('voucherSearchResult').style.display='none'">&times;</button>
                </div>
            `;
        }
    } catch (err) {
        console.error(err);
    }
}
