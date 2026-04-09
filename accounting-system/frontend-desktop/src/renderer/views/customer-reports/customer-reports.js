let customerSelect, reportContainer, totalSalesEl, totalPurchasesEl, totalReceiptsEl, totalPaymentsOutEl, totalSalesReturnsEl, totalPurchaseReturnsEl, customerReportTableBody, balanceFooterEl;
let customerAutocomplete = null;
let ar = {};
const pageI18n = window.i18n?.createPageHelpers ? window.i18n.createPageHelpers(() => ar) : null;
const CUR = 'ج.م';
function formatCurrency(v) { return parseFloat(v || 0).toFixed(2) + ' ' + CUR; }

function t(key, fallback = '') {
    return pageI18n ? pageI18n.t(key, fallback) : fallback;
}

function fmt(template, values = {}) {
    return pageI18n ? pageI18n.fmt(template, values) : String(template || '');
}

function getNavHTML() {
    if (window.navManager && typeof window.navManager.getTopNavHTML === 'function') {
        return window.navManager.getTopNavHTML(t);
    }
    return '';
}

document.addEventListener('DOMContentLoaded', async () => {
    if (window.i18n && typeof window.i18n.loadArabicDictionary === 'function') {
        ar = await window.i18n.loadArabicDictionary();
    }
    renderPage();
    initializeElements();
    loadCustomers();
});

function renderPage() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${getNavHTML()}

        <div class="content">
            <!-- Page Hero -->
            <div class="page-hero">
                <div class="page-hero-right">
                    <div class="page-hero-icon"><i class="fas fa-chart-line"></i></div>
                    <div>
                        <h1>${t('customerReports.title', 'تقارير العملاء')}</h1>
                        <p>${t('customerReports.subtitle', 'عرض تفصيلي لحركة العمليات والأرصدة لكل عميل')}</p>
                    </div>
                </div>
            </div>

            <!-- Selection Card -->
            <div class="selection-card">
                <div class="form-group" style="flex:2; min-width: 250px;">
                    <label><i class="fas fa-user"></i> ${t('customerReports.selectCustomer', 'اختر العميل')}</label>
                    <select id="customerSelect" class="form-control">
                        <option value="">${t('customerReports.selectCustomerPlaceholder', 'اختر العميل...')}</option>
                    </select>
                </div>
                <div class="form-group date-group">
                    <label><i class="fas fa-calendar-alt"></i> ${t('customerReports.dateFrom', 'من تاريخ')}</label>
                    <input type="date" id="dateFrom" class="form-control">
                </div>
                <div class="form-group date-group">
                    <label><i class="fas fa-calendar-alt"></i> ${t('customerReports.dateTo', 'إلى تاريخ')}</label>
                    <input type="date" id="dateTo" class="form-control">
                </div>
                <div class="form-group" style="flex: 0 0 auto; align-self: flex-end;">
                    <button id="showReportBtn" class="btn-show-report">
                        <i class="fas fa-search"></i> ${t('customerReports.showReport', 'عرض التقرير')}
                    </button>
                </div>
            </div>

            <!-- Empty State -->
            <div id="emptyState" class="empty-state">
                <i class="fas fa-users"></i>
                <h3>${t('customerReports.emptyTitle', 'اختر عميل لعرض تقريره')}</h3>
                <p>${t('customerReports.emptyDesc', 'قم باختيار عميل من القائمة أعلاه لعرض جميع العمليات والأرصدة')}</p>
            </div>

            <!-- Report Container (hidden by default) -->
            <div id="reportContainer" class="report-container">
                <!-- Print Header (visible only when printing) -->
                <div class="print-header" id="printHeader">
                    <div class="print-header-top">
                        <div class="print-header-logo" id="printHeaderLogo"></div>
                        <div class="print-header-company">
                            <h2>${t('customerReports.accountStatement', 'كشف حساب')}</h2>
                            <div class="print-company-name" id="printCompanyName"></div>
                            <div class="print-company-info" id="printCompanyInfo"></div>
                        </div>
                        <div class="print-header-logo-placeholder"></div>
                    </div>
                    <div class="print-header-details">
                        <div class="print-detail">
                            <span class="print-detail-label">${t('customerReports.printCustomer', 'العميل')}:</span>
                            <span class="print-detail-value" id="printCustomerName">—</span>
                        </div>
                        <div class="print-detail">
                            <span class="print-detail-label">${t('customerReports.printPeriod', 'الفترة')}:</span>
                            <span class="print-detail-value" id="printPeriod">—</span>
                        </div>
                        <div class="print-detail">
                            <span class="print-detail-label">${t('customerReports.printDate', 'تاريخ الطباعة')}:</span>
                            <span class="print-detail-value" id="printDate">—</span>
                        </div>
                    </div>
                </div>
                <!-- Summary Cards -->
                <div class="summary-strip">
                    <div class="summary-card">
                        <div class="sc-icon sales"><i class="fas fa-shopping-cart"></i></div>
                        <div>
                            <div class="sc-label">${t('customerReports.totalSales', 'إجمالي المبيعات')}</div>
                            <div class="sc-value" id="totalSales">0.00</div>
                        </div>
                    </div>
                    <div class="summary-card">
                        <div class="sc-icon purchase"><i class="fas fa-shopping-bag"></i></div>
                        <div>
                            <div class="sc-label">${t('customerReports.totalPurchases', 'إجمالي المشتريات')}</div>
                            <div class="sc-value" id="totalPurchases">0.00</div>
                        </div>
                    </div>
                    <div class="summary-card">
                        <div class="sc-icon receipts"><i class="fas fa-hand-holding-usd"></i></div>
                        <div>
                            <div class="sc-label">${t('customerReports.totalReceipts', 'إجمالي التحصيلات')}</div>
                            <div class="sc-value" id="totalReceipts">0.00</div>
                        </div>
                    </div>
                    <div class="summary-card">
                        <div class="sc-icon payments-out"><i class="fas fa-money-bill-wave"></i></div>
                        <div>
                            <div class="sc-label">${t('customerReports.totalPaymentsOut', 'إجمالي السداد')}</div>
                            <div class="sc-value" id="totalPaymentsOut">0.00</div>
                        </div>
                    </div>
                    <div class="summary-card">
                        <div class="sc-icon sales-return"><i class="fas fa-undo"></i></div>
                        <div>
                            <div class="sc-label">${t('customerReports.totalSalesReturns', 'مردودات المبيعات')}</div>
                            <div class="sc-value" id="totalSalesReturns">0.00</div>
                        </div>
                    </div>
                    <div class="summary-card">
                        <div class="sc-icon purchase-return"><i class="fas fa-undo"></i></div>
                        <div>
                            <div class="sc-label">${t('customerReports.totalPurchaseReturns', 'مردودات المشتريات')}</div>
                            <div class="sc-value" id="totalPurchaseReturns">0.00</div>
                        </div>
                    </div>
                </div>

                <!-- Transactions Table -->
                <div class="table-card">
                    <div class="table-card-header">
                        <h3><i class="fas fa-list-alt"></i> ${t('customerReports.transactionLog', 'سجل العمليات')}</h3>
                        <div class="header-actions">
                            <button class="btn-icon no-print" title="${t('customerReports.savePdfBtn', 'حفظ PDF')}" onclick="savePDF()">
                                <i class="fas fa-file-pdf"></i>
                            </button>
                        </div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>${t('customerReports.tableHeaders.date', 'التاريخ')}</th>
                                <th>${t('customerReports.tableHeaders.type', 'نوع الحركة')}</th>
                                <th>${t('customerReports.tableHeaders.docNumber', 'رقم المستند')}</th>
                                <th>${t('customerReports.tableHeaders.description', 'البيان')}</th>
                                <th>${t('customerReports.tableHeaders.debit', 'مدين')}</th>
                                <th>${t('customerReports.tableHeaders.credit', 'دائن')}</th>
                                <th>${t('customerReports.tableHeaders.runningBalance', 'الرصيد')}</th>
                            </tr>
                        </thead>
                        <tbody id="customerReportTableBody"></tbody>
                    </table>
                    <div class="balance-footer" id="balanceFooter"></div>
                </div>
                <!-- Print Summary (visible only in print) -->
                <div class="print-summary" id="printSummary">
                    <table class="print-summary-table">
                        <thead>
                            <tr>
                                <th>${t('customerReports.summaryDebit', 'إجمالي المدين')}</th>
                                <th>${t('customerReports.summaryCredit', 'إجمالي الدائن')}</th>
                                <th>${t('customerReports.summaryNet', 'صافي الحركة')}</th>
                                <th>${t('customerReports.summaryOpening', 'رصيد أول المدة')}</th>
                                <th>${t('customerReports.summaryClosing', 'الرصيد الختامي')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td id="summaryDebit">0.00</td>
                                <td id="summaryCredit">0.00</td>
                                <td id="summaryNet">0.00</td>
                                <td id="summaryOpening">0.00</td>
                                <td id="summaryClosing">0.00</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function initializeElements() {
    customerSelect = document.getElementById('customerSelect');
    reportContainer = document.getElementById('reportContainer');
    totalSalesEl = document.getElementById('totalSales');
    totalPurchasesEl = document.getElementById('totalPurchases');
    totalReceiptsEl = document.getElementById('totalReceipts');
    totalPaymentsOutEl = document.getElementById('totalPaymentsOut');
    totalSalesReturnsEl = document.getElementById('totalSalesReturns');
    totalPurchaseReturnsEl = document.getElementById('totalPurchaseReturns');
    customerReportTableBody = document.getElementById('customerReportTableBody');
    balanceFooterEl = document.getElementById('balanceFooter');

    // Set default date range: from = first day of current year, to = tomorrow
    const now = new Date();
    const yearStart = `${now.getFullYear()}-01-01`;
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    document.getElementById('dateFrom').value = yearStart;
    document.getElementById('dateTo').value = tomorrowStr;

    const triggerLoad = () => {
        const customerId = customerSelect.value;
        if (customerId) {
            document.getElementById('emptyState').style.display = 'none';
            reportContainer.style.display = 'block';
            loadCustomerReport(customerId);
        } else {
            reportContainer.style.display = 'none';
            document.getElementById('emptyState').style.display = '';
        }
    };

    document.getElementById('showReportBtn').addEventListener('click', triggerLoad);
}

async function loadCustomers() {
    const customers = await window.electronAPI.getCustomers();
    customerSelect.innerHTML = `<option value="">${t('customerReports.selectCustomerPlaceholder', 'اختر العميل...')}</option>`;

    const grouped = { customer: [], supplier: [], both: [] };
    customers.forEach(c => {
        const key = (c.type === 'supplier') ? 'supplier' : (c.type === 'both') ? 'both' : 'customer';
        grouped[key].push(c);
    });

    const sections = [
        { key: 'customer', label: 'العملاء' },
        { key: 'supplier', label: 'الموردين' },
        { key: 'both',     label: 'عميل ومورد' }
    ];

    sections.forEach(sec => {
        if (grouped[sec.key].length === 0) return;
        const optgroup = document.createElement('optgroup');
        optgroup.label = sec.label;
        grouped[sec.key].forEach(customer => {
            const option = document.createElement('option');
            option.value = customer.id;
            option.textContent = customer.name;
            optgroup.appendChild(option);
        });
        customerSelect.appendChild(optgroup);
    });

    // Initialize autocomplete for customer search
    if (customerAutocomplete) {
        customerAutocomplete.refresh();
    } else {
        customerAutocomplete = new Autocomplete(customerSelect);
    }

    // Check for URL param
    const urlParams = new URLSearchParams(window.location.search);
    const customerId = urlParams.get('customerId');
    if (customerId) {
        customerSelect.value = customerId;
        if (customerAutocomplete) customerAutocomplete.refresh();
        if (customerSelect.value === customerId) {
            document.getElementById('showReportBtn').click();
        }
    }
}

async function loadCustomerReport(customerId) {
    const startDate = document.getElementById('dateFrom').value || undefined;
    const endDate = document.getElementById('dateTo').value || undefined;

    const result = await window.electronAPI.getCustomerDetailedStatement({ customerId, startDate, endDate });

    if (!result || !result.success) {
        customerReportTableBody.innerHTML = `
            <tr class="no-data-row">
                <td colspan="8">
                    <i class="fas fa-exclamation-triangle"></i>
                    ${(result && result.error) || t('customerReports.unexpectedError', 'حدث خطأ غير متوقع')}
                </td>
            </tr>`;
        return;
    }

    const { transactions, totals } = result;

    // Update summary cards
    totalSalesEl.textContent = formatCurrency(totals.totalSales);
    totalPurchasesEl.textContent = formatCurrency(totals.totalPurchases);
    totalReceiptsEl.textContent = formatCurrency(totals.totalPaymentsIn);
    totalPaymentsOutEl.textContent = formatCurrency(totals.totalPaymentsOut);
    totalSalesReturnsEl.textContent = formatCurrency(totals.totalSalesReturns);
    totalPurchaseReturnsEl.textContent = formatCurrency(totals.totalPurchaseReturns);

    // Update print header
    const selectedOption = customerSelect.options[customerSelect.selectedIndex];
    document.getElementById('printCustomerName').textContent = selectedOption ? selectedOption.textContent : '—';
    const fromDate = document.getElementById('dateFrom').value;
    const toDate = document.getElementById('dateTo').value;
    let periodText = t('customerReports.allPeriods', 'كل الفترات');
    if (fromDate && toDate) periodText = `${fromDate}  إلى  ${toDate}`;
    else if (fromDate) periodText = `من ${fromDate}`;
    else if (toDate) periodText = `حتى ${toDate}`;
    document.getElementById('printPeriod').textContent = periodText;
    document.getElementById('printDate').textContent = new Date().toLocaleDateString('ar-EG');

    // Load company info and profile image for print header
    try {
        const settings = await window.electronAPI.getSettings();
        if (settings) {
            const companyNameEl = document.getElementById('printCompanyName');
            const companyInfoEl = document.getElementById('printCompanyInfo');
            const logoEl = document.getElementById('printHeaderLogo');
            if (companyNameEl) companyNameEl.textContent = settings.companyName || '';
            let infoText = '';
            if (settings.companyAddress) infoText += settings.companyAddress;
            if (settings.companyPhone) infoText += (infoText ? ' | ' : '') + settings.companyPhone;
            if (companyInfoEl) companyInfoEl.textContent = infoText;
            if (logoEl && settings.profileImage) {
                logoEl.innerHTML = `<img src="${settings.profileImage}" alt="logo">`;
            } else if (logoEl) {
                logoEl.innerHTML = '';
            }
        }
    } catch(e) { /* ignore */ }

    // Build table rows
    customerReportTableBody.innerHTML = '';

    // Opening balance row
    if (totals.openingBalance !== 0) {
        const obRow = document.createElement('tr');
        obRow.className = 'opening-row';
        const obClass = totals.openingBalance > 0 ? 'positive' : 'negative';
        const obLabel = totals.openingBalance > 0
            ? t('customerReports.balanceForUs', '(لنا)')
            : t('customerReports.balanceAgainstUs', '(علينا)');
        obRow.innerHTML = `
            <td colspan="5" class="ob-label">
                <i class="fas fa-flag"></i>
                ${t('customerReports.openingBalance', 'رصيد أول المدة')}
            </td>
            <td></td>
            <td></td>
            <td class="running-bal ${obClass}">${formatCurrency(Math.abs(totals.openingBalance))} ${obLabel}</td>
        `;
        customerReportTableBody.appendChild(obRow);
    }

    if (transactions.length === 0 && totals.openingBalance === 0) {
        customerReportTableBody.innerHTML = `
            <tr class="no-data-row">
                <td colspan="8">
                    <i class="fas fa-inbox"></i>
                    ${t('customerReports.noTransactions', 'لا توجد عمليات لهذا العميل')}
                </td>
            </tr>`;
    } else {
        transactions.forEach((item, idx) => {
            const mainRow = document.createElement('tr');
            mainRow.className = `trans-main-row trans-type-${item.type}`;
            let typeBadge = '';
            let debitVal = '';
            let creditVal = '';
            const hasDetails = ['sales', 'purchase', 'sales_return', 'purchase_return'].includes(item.type);
            const rowId = `items-${idx}`;

            if (item.type === 'sales') {
                typeBadge = `<span class="badge badge-sales"><i class="fas fa-shopping-cart"></i> ${t('customerReports.salesBadge', 'مبيعات')}</span>`;
                debitVal = item.debit ? formatCurrency(item.debit) : '';
            } else if (item.type === 'purchase') {
                typeBadge = `<span class="badge badge-purchase"><i class="fas fa-shopping-bag"></i> ${t('customerReports.purchaseBadge', 'مشتريات')}</span>`;
                creditVal = item.credit ? formatCurrency(item.credit) : '';
            } else if (item.type === 'payment_in') {
                typeBadge = `<span class="badge badge-receipt"><i class="fas fa-hand-holding-usd"></i> ${t('customerReports.receiptBadge', 'تحصيل')}</span>`;
                creditVal = item.credit ? formatCurrency(item.credit) : '';
            } else if (item.type === 'payment_out') {
                typeBadge = `<span class="badge badge-payment"><i class="fas fa-money-bill-wave"></i> ${t('customerReports.paymentBadge', 'سداد')}</span>`;
                debitVal = item.debit ? formatCurrency(item.debit) : '';
            } else if (item.type === 'sales_return') {
                typeBadge = `<span class="badge badge-sales-return"><i class="fas fa-undo"></i> ${t('customerReports.salesReturnBadge', 'مردود مبيعات')}</span>`;
                creditVal = item.credit ? formatCurrency(item.credit) : '';
            } else if (item.type === 'purchase_return') {
                typeBadge = `<span class="badge badge-purchase-return"><i class="fas fa-undo"></i> ${t('customerReports.purchaseReturnBadge', 'مردود مشتريات')}</span>`;
                debitVal = item.debit ? formatCurrency(item.debit) : '';
            }

            // Running balance
            const rb = item.running_balance;
            const rbClass = rb > 0 ? 'positive' : rb < 0 ? 'negative' : '';
            const rbLabel = rb > 0 ? t('customerReports.balanceForUs', '(لنا)')
                          : rb < 0 ? t('customerReports.balanceAgainstUs', '(علينا)') : '';
            const rbText = `${formatCurrency(Math.abs(rb))} ${rbLabel}`;

            // Toggle button for detail rows (lazy loaded)
            const toggleBtn = hasDetails
                ? `<button class="btn-toggle" onclick="toggleItems('${rowId}', this, '${item.type}', ${item.id})" title="${t('customerReports.showItems', 'عرض الأصناف')}"><i class="fas fa-chevron-down"></i></button>`
                : '';

            mainRow.innerHTML = `
                <td class="idx-cell">${idx + 1} ${toggleBtn}</td>
                <td>${item.trans_date}</td>
                <td>${typeBadge}</td>
                <td>${item.doc_number || '—'}</td>
                <td class="notes-cell">${item.notes || '—'}</td>
                <td class="amt-cell"><span class="amount debit">${debitVal}</span></td>
                <td class="amt-cell"><span class="amount credit">${creditVal}</span></td>
                <td class="running-bal ${rbClass}">${rbText}</td>
            `;
            customerReportTableBody.appendChild(mainRow);

            // Placeholder detail row (loaded lazily on first expand)
            if (hasDetails) {
                const detailRow = document.createElement('tr');
                detailRow.id = rowId;
                detailRow.className = 'items-detail-row';
                detailRow.dataset.loaded = 'false';
                detailRow.innerHTML = `<td colspan="8"><div class="items-loading"><i class="fas fa-spinner fa-spin"></i> ${t('customerReports.loadingItems', 'جاري تحميل الأصناف...')}</div></td>`;
                customerReportTableBody.appendChild(detailRow);
            }
        });
    }

    // Closing balance footer
    const balance = totals.closingBalance;
    let balClass = 'zero';
    let balText = formatCurrency(balance);
    let balLabel = '';
    if (balance > 0) {
        balClass = 'positive';
        balLabel = t('customerReports.balanceForUs', '(لنا)');
    } else if (balance < 0) {
        balClass = 'negative';
        balText = formatCurrency(Math.abs(balance));
        balLabel = t('customerReports.balanceAgainstUs', '(علينا)');
    }
    balanceFooterEl.innerHTML = `
        <span class="bf-label"><i class="fas fa-coins"></i> ${t('customerReports.closingBalance', 'الرصيد الختامي')}</span>
        <span class="bf-value ${balClass}">${balText} ${balLabel}</span>
    `;

    // Populate print summary table
    const totalDebit = totals.totalSales + totals.totalPaymentsOut + totals.totalPurchaseReturns;
    const totalCredit = totals.totalPurchases + totals.totalPaymentsIn + totals.totalSalesReturns;
    const netMovement = totalDebit - totalCredit;
    document.getElementById('summaryDebit').textContent = formatCurrency(totalDebit);
    document.getElementById('summaryCredit').textContent = formatCurrency(totalCredit);
    const netEl = document.getElementById('summaryNet');
    const netLabel = netMovement > 0 ? t('customerReports.balanceForUs', '(لنا)')
                   : netMovement < 0 ? t('customerReports.balanceAgainstUs', '(علينا)') : '';
    netEl.textContent = `${formatCurrency(Math.abs(netMovement))} ${netLabel}`;
    netEl.className = netMovement > 0 ? 'net-positive' : netMovement < 0 ? 'net-negative' : '';
    document.getElementById('summaryOpening').textContent = `${formatCurrency(Math.abs(totals.openingBalance))} ${totals.openingBalance > 0 ? t('customerReports.balanceForUs', '(لنا)') : totals.openingBalance < 0 ? t('customerReports.balanceAgainstUs', '(علينا)') : ''}`;
    document.getElementById('summaryClosing').textContent = `${balText} ${balLabel}`;
}

// Lazy loading item details on toggle
window.toggleItems = async (rowId, btn, type, id) => {
    const row = document.getElementById(rowId);
    if (!row) return;
    const isHidden = !row.classList.contains('expanded');
    row.classList.toggle('expanded', isHidden);
    const icon = btn.querySelector('i');
    icon.className = isHidden ? 'fas fa-chevron-up' : 'fas fa-chevron-down';

    // Load details on first expand
    if (isHidden && row.dataset.loaded === 'false') {
        const result = await window.electronAPI.getStatementItemDetails({ type, id });
        if (result && result.success && result.details.length > 0) {
            let itemsHTML = `
                <td colspan="8">
                    <div class="items-detail-box">
                        <table class="items-inner-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>${t('customerReports.itemHeaders.name', 'الصنف')}</th>
                                    <th>${t('customerReports.itemHeaders.unit', 'الوحدة')}</th>
                                    <th>${t('customerReports.itemHeaders.qty', 'الكمية')}</th>
                                    <th>${t('customerReports.itemHeaders.price', 'السعر')}</th>
                                    <th>${t('customerReports.itemHeaders.total', 'الإجمالي')}</th>
                                </tr>
                            </thead>
                            <tbody>`;
            result.details.forEach((itm, i) => {
                itemsHTML += `
                                <tr>
                                    <td>${i + 1}</td>
                                    <td>${itm.item_name}</td>
                                    <td>${itm.unit_name || '—'}</td>
                                    <td>${itm.quantity}</td>
                                    <td>${formatCurrency(itm.price || 0)}</td>
                                    <td>${formatCurrency(itm.total_price || 0)}</td>
                                </tr>`;
            });
            itemsHTML += `
                            </tbody>
                        </table>
                    </div>
                </td>`;
            row.innerHTML = itemsHTML;
        } else {
            row.innerHTML = `<td colspan="8"><div class="items-loading">${t('customerReports.noItems', 'لا توجد أصناف')}</div></td>`;
        }
        row.dataset.loaded = 'true';
    }
};

window.deleteTransaction = async (id) => {
    if (confirm(t('customerReports.deleteTransactionConfirm', 'هل أنت متأكد من حذف هذه العملية المالية؟'))) {
        try {
            const result = await window.electronAPI.deleteTreasuryTransaction(id);
            if (result.success) {
                if (window.showToast) window.showToast(t('customerReports.deleteSuccess', 'تم الحذف بنجاح'), 'success');
                else alert(t('customerReports.deleteSuccess', 'تم الحذف بنجاح'));
                const customerId = document.getElementById('customerSelect').value;
                if (customerId) loadCustomerReport(customerId);
            } else {
                alert(fmt(t('customerReports.deleteError', 'حدث خطأ: {error}'), { error: result.error }));
            }
        } catch (error) {
            console.error(error);
            alert(t('customerReports.unexpectedError', 'حدث خطأ غير متوقع'));
        }
    }
};

window.editInvoice = (id, type) => {
    if (type === 'sales') {
        window.location.href = `../sales/index.html?editId=${id}`;
    } else if (type === 'purchase') {
        window.location.href = `../purchases/index.html?editId=${id}`;
    }
};

window.deleteInvoice = async (id, type) => {
    if (confirm(t('customerReports.deleteInvoiceConfirm', 'هل أنت متأكد من حذف هذه الفاتورة؟ سيتم إلغاء جميع التأثيرات المالية والمخزنية.'))) {
        try {
            const result = await window.electronAPI.deleteInvoice(id, type);
            if (result.success) {
                if (window.showToast) window.showToast(t('customerReports.deleteSuccess', 'تم الحذف بنجاح'), 'success');
                else alert(t('customerReports.deleteSuccess', 'تم الحذف بنجاح'));
                const customerId = document.getElementById('customerSelect').value;
                if (customerId) loadCustomerReport(customerId);
            } else {
                alert(fmt(t('customerReports.deleteError', 'حدث خطأ: {error}'), { error: result.error }));
            }
        } catch (error) {
            console.error('Error deleting invoice:', error);
            alert(t('customerReports.unexpectedError', 'حدث خطأ غير متوقع'));
        }
    }
};

window.deleteSalesReturn = async (id) => {
    if (confirm(t('customerReports.deleteReturnConfirm', 'هل أنت متأكد من حذف هذا المرتجع؟'))) {
        try {
            const result = await window.electronAPI.deleteSalesReturn(id);
            if (result.success) {
                if (window.showToast) window.showToast(t('customerReports.deleteSuccess', 'تم الحذف بنجاح'), 'success');
                else alert(t('customerReports.deleteSuccess', 'تم الحذف بنجاح'));
                const customerId = document.getElementById('customerSelect').value;
                if (customerId) loadCustomerReport(customerId);
            } else {
                alert(fmt(t('customerReports.deleteError', 'حدث خطأ: {error}'), { error: result.error }));
            }
        } catch (error) {
            console.error(error);
            alert(t('customerReports.unexpectedError', 'حدث خطأ غير متوقع'));
        }
    }
};

window.deletePurchaseReturn = async (id) => {
    if (confirm(t('customerReports.deleteReturnConfirm', 'هل أنت متأكد من حذف هذا المرتجع؟'))) {
        try {
            const result = await window.electronAPI.deletePurchaseReturn(id);
            if (result.success) {
                if (window.showToast) window.showToast(t('customerReports.deleteSuccess', 'تم الحذف بنجاح'), 'success');
                else alert(t('customerReports.deleteSuccess', 'تم الحذف بنجاح'));
                const customerId = document.getElementById('customerSelect').value;
                if (customerId) loadCustomerReport(customerId);
            } else {
                alert(fmt(t('customerReports.deleteError', 'حدث خطأ: {error}'), { error: result.error }));
            }
        } catch (error) {
            console.error(error);
            alert(t('customerReports.unexpectedError', 'حدث خطأ غير متوقع'));
        }
    }
};

// Load all item details before printing/PDF export
async function loadAllItemDetails() {
    const detailRows = document.querySelectorAll('.items-detail-row[data-loaded="false"]');
    const loadPromises = [];
    detailRows.forEach(row => {
        const mainRow = row.previousElementSibling;
        if (!mainRow) return;
        const btn = mainRow.querySelector('.btn-toggle');
        if (!btn) return;
        const onclickStr = btn.getAttribute('onclick');
        const match = onclickStr ? onclickStr.match(/toggleItems\('[^']+',\s*this,\s*'([^']+)',\s*(\d+)\)/) : null;
        if (!match) return;
        const type = match[1];
        const id = parseInt(match[2]);
        const promise = window.electronAPI.getStatementItemDetails({ type, id }).then(result => {
            if (result && result.success && result.details.length > 0) {
                let html = `<td colspan="8"><div class="items-detail-box"><table class="items-inner-table"><thead><tr>
                    <th>#</th>
                    <th>${t('customerReports.itemHeaders.name', 'الصنف')}</th>
                    <th>${t('customerReports.itemHeaders.unit', 'الوحدة')}</th>
                    <th>${t('customerReports.itemHeaders.qty', 'الكمية')}</th>
                    <th>${t('customerReports.itemHeaders.price', 'السعر')}</th>
                    <th>${t('customerReports.itemHeaders.total', 'الإجمالي')}</th>
                    </tr></thead><tbody>`;
                result.details.forEach((itm, i) => {
                    html += `<tr><td>${i + 1}</td><td>${itm.item_name}</td><td>${itm.unit_name || '—'}</td><td>${itm.quantity}</td><td>${formatCurrency(itm.price || 0)}</td><td>${formatCurrency(itm.total_price || 0)}</td></tr>`;
                });
                html += `</tbody></table></div></td>`;
                row.innerHTML = html;
            } else {
                row.innerHTML = `<td colspan="8"><div class="items-loading">${t('customerReports.noItems', 'لا توجد أصناف')}</div></td>`;
            }
            row.dataset.loaded = 'true';
        });
        loadPromises.push(promise);
    });
    await Promise.all(loadPromises);
}

window.printReport = async () => {
    await loadAllItemDetails();
    window.print();
};

window.savePDF = async () => {
    await loadAllItemDetails();
    const selectedOption = customerSelect.options[customerSelect.selectedIndex];
    const customerName = selectedOption ? selectedOption.textContent.trim() : '';
    const date = new Date().toISOString().split('T')[0];
    const defaultName = `كشف_حساب_${customerName}_${date}.pdf`;
    const result = await window.electronAPI.saveCustomerReportPdf({ defaultName });
    if (result && result.success) {
        if (window.showToast) window.showToast(t('customerReports.pdfSaved', 'تم حفظ الملف بنجاح'), 'success');
    } else if (result && !result.canceled) {
        if (window.showToast) window.showToast(t('customerReports.pdfError', 'حدث خطأ أثناء الحفظ'), 'error');
    }
};
