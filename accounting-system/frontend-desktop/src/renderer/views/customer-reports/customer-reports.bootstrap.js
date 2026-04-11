let customerSelect;
let reportContainer;
let totalSalesEl;
let totalPurchasesEl;
let totalReceiptsEl;
let totalPaymentsOutEl;
let totalSalesReturnsEl;
let totalPurchaseReturnsEl;
let customerReportTableBody;
let balanceFooterEl;
let customerAutocomplete = null;
let ar = {};
const { t, fmt } = window.i18n?.createPageHelpers?.(() => ar) || { t: (k, f = '') => f, fmt: (t, v = {}) => String(t || '') };
const customerReportsRender = window.customerReportsPageRender;
const CUR = 'ج.م';

function formatCurrency(v) {
    return parseFloat(v || 0).toFixed(2) + ' ' + CUR;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

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

    customerReportsRender.renderPage({ t, getNavHTML: buildTopNavHTML });
    initializeElements();
    loadCustomers();
    } catch (error) {
        console.error('Initialization Error:', error);
        if (window.toast && typeof window.toast.error === 'function') {
            window.toast.error(t('alerts.initError', 'حدث خطأ أثناء تهيئة الصفحة، يرجى إعادة التحميل'));
        }
    }
});

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

    reportContainer.addEventListener('click', (event) => {
        const actionEl = event.target.closest('[data-action]');
        if (!actionEl) return;

        const action = actionEl.dataset.action;
        if (action === 'save-pdf') {
            savePDF();
            return;
        }

        if (action === 'toggle-items') {
            toggleItems(actionEl.dataset.rowId, actionEl, actionEl.dataset.type, Number.parseInt(actionEl.dataset.id, 10));
        }
    });
}

async function loadCustomers() {
    const customers = await window.electronAPI.getCustomers();
    customerSelect.innerHTML = `<option value="">${t('customerReports.selectCustomerPlaceholder', 'اختر العميل...')}</option>`;

    const grouped = { customer: [], supplier: [], both: [] };
    customers.forEach((c) => {
        const key = (c.type === 'supplier') ? 'supplier' : (c.type === 'both') ? 'both' : 'customer';
        grouped[key].push(c);
    });

    const sections = [
        { key: 'customer', label: 'العملاء' },
        { key: 'supplier', label: 'الموردين' },
        { key: 'both', label: 'عميل ومورد' }
    ];

    sections.forEach((sec) => {
        if (grouped[sec.key].length === 0) return;
        const optgroup = document.createElement('optgroup');
        optgroup.label = sec.label;
        grouped[sec.key].forEach((customer) => {
            const option = document.createElement('option');
            option.value = customer.id;
            option.textContent = customer.name;
            optgroup.appendChild(option);
        });
        customerSelect.appendChild(optgroup);
    });

    if (customerAutocomplete) {
        customerAutocomplete.refresh();
    } else {
        customerAutocomplete = new Autocomplete(customerSelect);
    }

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

    totalSalesEl.textContent = formatCurrency(totals.totalSales);
    totalPurchasesEl.textContent = formatCurrency(totals.totalPurchases);
    totalReceiptsEl.textContent = formatCurrency(totals.totalPaymentsIn);
    totalPaymentsOutEl.textContent = formatCurrency(totals.totalPaymentsOut);
    totalSalesReturnsEl.textContent = formatCurrency(totals.totalSalesReturns);
    totalPurchaseReturnsEl.textContent = formatCurrency(totals.totalPurchaseReturns);

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
    } catch (_) {
    }

    customerReportTableBody.innerHTML = '';

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

            const rb = item.running_balance;
            const rbClass = rb > 0 ? 'positive' : rb < 0 ? 'negative' : '';
            const rbLabel = rb > 0 ? t('customerReports.balanceForUs', '(لنا)') : rb < 0 ? t('customerReports.balanceAgainstUs', '(علينا)') : '';
            const rbText = `${formatCurrency(Math.abs(rb))} ${rbLabel}`;

            const toggleBtn = hasDetails
                ? `<button class="btn-toggle" data-action="toggle-items" data-row-id="${rowId}" data-type="${item.type}" data-id="${item.id}" title="${t('customerReports.showItems', 'عرض الأصناف')}"><i class="fas fa-chevron-down"></i></button>`
                : '';
            const docNumberCellHtml = window.renderDocNumberCell
                ? window.renderDocNumberCell(item.doc_number, { numberTag: 'span' })
                : `<span>${escapeHtml(item.doc_number || '—')}</span>`;

            mainRow.innerHTML = `
                <td class="idx-cell">${idx + 1} ${toggleBtn}</td>
                <td>${item.trans_date}</td>
                <td>${typeBadge}</td>
                <td>${docNumberCellHtml}</td>
                <td class="notes-cell">${item.notes || '—'}</td>
                <td class="amt-cell"><span class="amount debit">${debitVal}</span></td>
                <td class="amt-cell"><span class="amount credit">${creditVal}</span></td>
                <td class="running-bal ${rbClass}">${rbText}</td>
            `;
            customerReportTableBody.appendChild(mainRow);

            if (hasDetails) {
                const detailRow = document.createElement('tr');
                detailRow.id = rowId;
                detailRow.className = 'items-detail-row';
                detailRow.dataset.loaded = 'false';
                detailRow.dataset.detailType = item.type;
                detailRow.dataset.detailId = String(item.id);
                detailRow.innerHTML = `<td colspan="8"><div class="items-loading"><i class="fas fa-spinner fa-spin"></i> ${t('customerReports.loadingItems', 'جاري تحميل الأصناف...')}</div></td>`;
                customerReportTableBody.appendChild(detailRow);
            }
        });
    }

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

    const totalDebit = totals.totalSales + totals.totalPaymentsOut + totals.totalPurchaseReturns;
    const totalCredit = totals.totalPurchases + totals.totalPaymentsIn + totals.totalSalesReturns;
    const netMovement = totalDebit - totalCredit;
    document.getElementById('summaryDebit').textContent = formatCurrency(totalDebit);
    document.getElementById('summaryCredit').textContent = formatCurrency(totalCredit);

    const netEl = document.getElementById('summaryNet');
    const netLabel = netMovement > 0 ? t('customerReports.balanceForUs', '(لنا)') : netMovement < 0 ? t('customerReports.balanceAgainstUs', '(علينا)') : '';
    netEl.textContent = `${formatCurrency(Math.abs(netMovement))} ${netLabel}`;
    netEl.className = netMovement > 0 ? 'net-positive' : netMovement < 0 ? 'net-negative' : '';

    document.getElementById('summaryOpening').textContent = `${formatCurrency(Math.abs(totals.openingBalance))} ${totals.openingBalance > 0 ? t('customerReports.balanceForUs', '(لنا)') : totals.openingBalance < 0 ? t('customerReports.balanceAgainstUs', '(علينا)') : ''}`;
    document.getElementById('summaryClosing').textContent = `${balText} ${balLabel}`;
}

async function toggleItems(rowId, btn, type, id) {
    const row = document.getElementById(rowId);
    if (!row) return;

    const isHidden = !row.classList.contains('expanded');
    row.classList.toggle('expanded', isHidden);
    const icon = btn.querySelector('i');
    icon.className = isHidden ? 'fas fa-chevron-up' : 'fas fa-chevron-down';

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
}

async function deleteTransaction(id) {
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
}

function editInvoice(id, type) {
    if (type === 'sales') {
        window.location.href = `../sales/index.html?editId=${id}`;
    } else if (type === 'purchase') {
        window.location.href = `../purchases/index.html?editId=${id}`;
    }
}

async function deleteInvoice(id, type) {
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
}

async function deleteSalesReturn(id) {
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
}

async function deletePurchaseReturn(id) {
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
}

window.printReport = async () => {
    await window.customerReportsUtils.loadAllItemDetails({ t, formatCurrency });
    window.print();
};

window.savePDF = async () => {
    await window.customerReportsUtils.loadAllItemDetails({ t, formatCurrency });
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
