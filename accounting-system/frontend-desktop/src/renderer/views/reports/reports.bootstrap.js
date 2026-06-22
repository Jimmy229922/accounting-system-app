let typeFilter;
let customerFilter;
let startDateInput;
let endDateInput;
let searchBtn;
let resetBtn;
let reportsTableBody;
let reportsStatusEl;
let heroResultCountEl;
let lastUpdatedLabelEl;
let voucherModalEl;
let voucherModalBodyEl;
let voucherModalTitleEl;
let voucherModalSubtitleEl;
let paginationBtnsEl;
let customerAutocomplete = null;

// Profit Report Elements
let profitCustomerNameInput;
let profitStartDateInput;
let profitEndDateInput;
let searchProfitBtn;
let profitTotalProfitEl;
let profitTableBody;
let profitDetailsModalEl;
let profitModalSubtitleEl;
let profitModalCloseBtn;
let profitDetailsTableBody;
let reportsTabsNav;

let ar = {};
const { t, fmt } = window.i18n?.createPageHelpers?.(() => ar) || { t: (k, f = '') => f, fmt: (t, v = {}) => String(t || '') };
const reportsRender = window.reportsPageRender;
let currentReports = [];
let allCustomers = [];
let currentPage = 1;
const PAGE_SIZE = 20;
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

document.addEventListener('DOMContentLoaded', async () => {
    try {
    if (window.i18n && typeof window.i18n.loadArabicDictionary === 'function') {
        ar = await window.i18n.loadArabicDictionary();
    }

    reportsRender.renderPage({ t, CUR });
    initializeElements();
    setDefaultDateRange();
    await loadCustomers();
    await loadReports();
    } catch (error) {
        console.error('Initialization Error:', error);
        if (window.toast && typeof window.toast.error === 'function') {
            window.toast.error(t('alerts.initError', 'حدث خطأ أثناء تهيئة الصفحة، يرجى إعادة التحميل'));
        }
    }
});

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
    paginationBtnsEl = document.getElementById('paginationBtns');

    profitCustomerNameInput = document.getElementById('profitCustomerName');
    profitStartDateInput = document.getElementById('profitStartDate');
    profitEndDateInput = document.getElementById('profitEndDate');
    searchProfitBtn = document.getElementById('searchProfitBtn');
    profitTotalProfitEl = document.getElementById('profitTotalProfit');
    profitTableBody = document.getElementById('profitTableBody');
    profitDetailsModalEl = document.getElementById('profitDetailsModal');
    profitModalSubtitleEl = document.getElementById('profitModalSubtitle');
    profitModalCloseBtn = document.getElementById('profitModalCloseBtn');
    profitDetailsTableBody = document.getElementById('profitDetailsTableBody');
    reportsTabsNav = document.querySelector('.reports-tabs-nav');

    if (reportsTabsNav) {
        reportsTabsNav.addEventListener('click', (e) => {
            const btn = e.target.closest('.reports-tab-btn');
            if (!btn) return;
            document.querySelectorAll('.reports-tab-btn').forEach(b => {
                b.classList.remove('active');
                b.style.background = 'transparent';
                b.style.color = 'var(--text-muted)';
            });
            btn.classList.add('active');
            btn.style.background = 'var(--primary-color)';
            btn.style.color = 'white';
            
            document.querySelectorAll('.reports-tab-content').forEach(c => {
                c.classList.remove('active');
                c.style.display = 'none';
            });
            const target = document.getElementById(btn.dataset.target);
            if (target) {
                target.classList.add('active');
                target.style.display = 'block';
            }

            if (btn.dataset.target === 'profit-reports' && !profitTableBody.hasChildNodes()) {
                setDefaultProfitDateRange();
                loadProfitReports();
            }
        });
    }

    if (searchProfitBtn) {
        searchProfitBtn.addEventListener('click', loadProfitReports);
    }

    if (profitTableBody) {
        profitTableBody.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-view-profit');
            if (!btn) return;
            const invoiceId = btn.dataset.id;
            const invoiceNumber = btn.dataset.invoiceNumber;
            openProfitDetailsModal(invoiceId, invoiceNumber);
        });
    }

    if (profitModalCloseBtn) {
        profitModalCloseBtn.addEventListener('click', closeProfitDetailsModal);
    }

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

    if (paginationBtnsEl) {
        paginationBtnsEl.addEventListener('click', (event) => {
            const btn = event.target.closest('button[data-page]');
            if (!btn || btn.disabled) return;

            const page = Number.parseInt(btn.dataset.page, 10);
            if (!Number.isFinite(page) || page < 1) return;

            currentPage = page;
            renderReports(currentReports);
        });
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
        
        if (profitCustomerNameInput) {
            profitCustomerNameInput.innerHTML = `<option value="">الكل</option>`;
        }

        allCustomers.forEach((customer) => {
            const option = document.createElement('option');
            option.value = customer.id;
            option.textContent = customer.name;
            customerFilter.appendChild(option);
            
            if (profitCustomerNameInput) {
                // Only include customer or both types in sales profit filter (exclude strict supplier)
                if (customer.type !== 'supplier') {
                    const profitOption = document.createElement('option');
                    profitOption.value = customer.name; // Backend filters by name using LIKE %name%
                    profitOption.textContent = customer.name;
                    profitCustomerNameInput.appendChild(profitOption);
                }
            }
        });

        if (customerAutocomplete) {
            customerAutocomplete.refresh();
        } else if (typeof Autocomplete !== 'undefined') {
            customerAutocomplete = new Autocomplete(customerFilter);
        }
        
        if (typeof profitCustomerAutocomplete !== 'undefined' && profitCustomerAutocomplete) {
            profitCustomerAutocomplete.refresh();
        } else if (typeof Autocomplete !== 'undefined' && profitCustomerNameInput) {
            window.profitCustomerAutocomplete = new Autocomplete(profitCustomerNameInput);
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
        const absoluteIdx = start + idx;
        const nextReport = reports[absoluteIdx + 1];
        const prevReport = reports[absoluteIdx - 1];

        const isLinkedToNext = nextReport && 
                               report.created_at === nextReport.created_at && 
                               report.invoice_number === nextReport.invoice_number &&
                               ((report.type === 'sales' && nextReport.type === 'receipt') || 
                                (report.type === 'purchase' && nextReport.type === 'payment'));

        const isLinkedToPrev = prevReport && 
                               report.created_at === prevReport.created_at && 
                               report.invoice_number === prevReport.invoice_number &&
                               ((prevReport.type === 'sales' && report.type === 'receipt') || 
                                (prevReport.type === 'purchase' && report.type === 'payment'));

        const row = document.createElement('tr');
        const typeMeta = getTypeMeta(report.type);
        const safeDate = formatDateForUi(report.invoice_date);
        let timeHtml = '';
        if (report.created_at) {
            // Append 'Z' to treat SQLite's CURRENT_TIMESTAMP as UTC
            const d = new Date(report.created_at.replace(' ', 'T') + 'Z');
            if (!Number.isNaN(d.getTime())) {
                const timeStr = d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                timeHtml = `<div style="font-size: 0.8em; color: var(--text-muted, #888); margin-top: 4px; direction: ltr; display: inline-block;">${timeStr}</div>`;
            }
        }
        
        let linkIcon = '';
        let extraStyle = '';
        
        if (isLinkedToNext) {
            extraStyle = 'border-bottom: 1px dashed rgba(0,0,0,0.25) !important; background-color: rgba(13, 110, 253, 0.04) !important; box-shadow: inset -4px 0 0 var(--primary-color, #0d6efd);';
        } else if (isLinkedToPrev) {
            extraStyle = 'border-bottom: 1px solid rgba(150,150,150,0.2) !important; background-color: rgba(13, 110, 253, 0.04) !important; box-shadow: inset -4px 0 0 var(--primary-color, #0d6efd);';
            linkIcon = '<i class="fas fa-level-up-alt fa-rotate-90" style="color: #888; margin-left: 10px;"></i>';
        } else {
            extraStyle = 'border-bottom: 1px solid rgba(150,150,150,0.2);';
        }

        const invoiceNumberValue = (report.type === 'receipt' || report.type === 'payment')
            ? (report.invoice_number || '-')
            : (report.invoice_number || report.id || '-');
        const invoiceCellHtml = window.renderDocNumberCell
            ? window.renderDocNumberCell(invoiceNumberValue, { numberTag: 'strong' })
            : `<strong>${escapeHtml(invoiceNumberValue || '-')}</strong>`;
            
        const finalInvoiceCell = isLinkedToPrev ? `<div style="display:flex; align-items:center;">${linkIcon}${invoiceCellHtml}</div>` : invoiceCellHtml;
        const finalTypeBadge = isLinkedToPrev ? `<div style="padding-right: 15px; opacity: 0.85;">${typeMeta.badge}</div>` : typeMeta.badge;

        const safeCustomer = escapeHtml(report.customer_name || '-');
        row.className = typeMeta.rowClass;
        row.style.cssText = extraStyle;
        row.innerHTML = `
            <td class="index-col">${absoluteIdx + 1}</td>
            <td class="date-col" style="text-align: center;">
                <div>${safeDate}</div>
                ${timeHtml}
            </td>
            <td>${finalInvoiceCell}</td>
            <td>${finalTypeBadge}</td>
            <td class="name-col">${safeCustomer}</td>
            <td class="amount ${typeMeta.amountClass}">${formatCurrency(report.total_amount)}</td>
            <td>
                <div class="row-actions">
                    ${report.type === 'receipt' || report.type === 'payment' ? `
                    <button type="button" class="btn-sm btn-edit" data-action="view" data-id="${report.id}" data-type="${report.type}">
                        <i class="fas fa-eye"></i> ${t('reports.viewBtn', 'عرض')}
                    </button>
                    ` : ''}
                    <button type="button" class="btn-sm btn-edit" data-action="edit" data-id="${report.id}" data-type="${report.type}">
                        <i class="fas fa-edit"></i> ${t('reports.editBtn', 'تعديل')}
                    </button>
                    <button type="button" class="btn-sm btn-delete" data-action="delete" data-id="${report.id}" data-type="${report.type}">
                        <i class="fas fa-trash"></i> ${t('reports.deleteBtn', 'حذف')}
                    </button>
                </div>
            </td>
        `;

        if (isLinkedToNext && idx > 0) {
            const spacerTop = document.createElement('tr');
            spacerTop.innerHTML = `<td colspan="7" style="height: 4px; background-color: #cbd5e1; border: none !important; padding: 0;"></td>`;
            reportsTableBody.appendChild(spacerTop);
        }

        reportsTableBody.appendChild(row);

        if (isLinkedToPrev) {
            const spacerBottom = document.createElement('tr');
            spacerBottom.innerHTML = `<td colspan="7" style="height: 4px; background-color: #cbd5e1; border: none !important; padding: 0;"></td>`;
            reportsTableBody.appendChild(spacerBottom);
        }
    });

    renderPagination(reports.length, totalPages);
}

function renderPagination(total, totalPages) {
    const paginationBar = document.getElementById('paginationBar');
    const paginationInfo = document.getElementById('paginationInfo');

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

    let btnsHTML = `<button type="button" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;

    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    for (let i = startPage; i <= endPage; i += 1) {
        btnsHTML += `<button type="button" class="${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }

    btnsHTML += `<button type="button" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;
    paginationBtnsEl.innerHTML = btnsHTML;
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
        else if (type === 'receipt') page = '../payments/receipt.html';
        else if (type === 'payment') page = '../payments/payment.html';

        if (page) {
            const target = `${page}?editId=${id}`;
            if (!window.__navigateWithinShell || !window.__navigateWithinShell(target)) {
                window.location.href = target;
            }
        }
        return;
    }

    if (action === 'delete') {
        deleteInvoice(id, type);
    }
}

async function deleteInvoice(id, type) {
    const isTreasury = type === 'receipt' || type === 'payment';
    const msg = isTreasury 
        ? t('reports.deleteTreasuryConfirm', 'هل أنت متأكد من حذف هذا السند؟ سيتم عكس جميع التأثيرات المالية.')
        : t('reports.deleteConfirm', 'هل أنت متأكد من حذف هذه الفاتورة؟ سيتم عكس جميع التأثيرات المالية والمخزنية.');
    
    const confirmed = typeof window.showConfirmDialog === 'function'
        ? await window.showConfirmDialog(msg)
        : false;
    if (!confirmed) return;

    let result;
    if (isTreasury) {
        result = await window.electronAPI.deleteTreasuryTransaction(Number(id));
    } else if (type === 'sales_return') {
        result = await window.electronAPI.deleteSalesReturn(Number(id));
    } else if (type === 'purchase_return') {
        result = await window.electronAPI.deletePurchaseReturn(Number(id));
    } else {
        result = await window.electronAPI.deleteInvoice(Number(id), type);
    }
    
    if (result && result.success) {
        if (window.showToast) {
            window.showToast(isTreasury ? t('reports.deleteTreasurySuccess', 'تم حذف السند بنجاح') : t('reports.deleteSuccess', 'تم حذف الفاتورة بنجاح'), 'success');
        }
        currentPage = 1;
        loadReports();
    } else {
        const errorMessage = fmt(t('reports.deleteError', 'حدث خطأ أثناء الحذف: {error}'), { error: (result && result.error) || 'Unknown error' });
        if (window.showToast) {
            window.showToast(errorMessage, 'error');
        }
        setStatus(errorMessage, 'error');
    }
}

function setDefaultProfitDateRange() {
    if (!profitStartDateInput || !profitEndDateInput) return;
    const now = new Date();
    // تعيين التاريخ ليكون بداية الشهر الحالي (يوم 1)
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    profitStartDateInput.value = startDate.toISOString().split('T')[0];
    profitEndDateInput.value = tomorrow.toISOString().split('T')[0];
}

async function loadProfitReports() {
    const filters = {
        startDate: profitStartDateInput.value,
        endDate: profitEndDateInput.value,
        customerName: profitCustomerNameInput.value
    };

    try {
        const response = await window.electronAPI.getInvoiceProfitReport(filters);
        if (response && response.success) {
            renderProfitReports(response.data || []);
        } else {
            console.error(response?.error);
            if (window.showToast) window.showToast('حدث خطأ أثناء تحميل أرباح الفواتير', 'error');
        }
    } catch (error) {
        console.error(error);
        if (window.showToast) window.showToast('حدث خطأ أثناء تحميل أرباح الفواتير', 'error');
    }
}

function renderProfitReports(reports) {
    profitTableBody.innerHTML = '';
    let totalProfit = 0;

    if (!reports || reports.length === 0) {
        profitTableBody.innerHTML = `<tr><td colspan="8"><div class="empty-state">لا توجد فواتير مطابقة</div></td></tr>`;
        if (profitTotalProfitEl) profitTotalProfitEl.textContent = formatCurrency(0);
        return;
    }

    reports.forEach((report) => {
        totalProfit += Number(report.profit_amount || 0);
        const row = document.createElement('tr');
        const profitMargin = report.total_amount > 0 ? ((report.profit_amount / report.total_amount) * 100).toFixed(2) + '%' : '0%';
        const profitColor = report.profit_amount >= 0 ? '#2e7d32' : '#d32f2f';
        
        row.innerHTML = `
            <td><strong>${escapeHtml(report.invoice_number || report.id)}</strong></td>
            <td>${formatDateForUi(report.invoice_date)}</td>
            <td>${escapeHtml(report.customer_name || '-')}</td>
            <td>${formatCurrency(report.total_amount)}</td>
            <td>${formatCurrency(report.total_cost)}</td>
            <td style="color: ${profitColor}; font-weight: bold;">${formatCurrency(report.profit_amount)}</td>
            <td><span class="badge" style="background-color: ${profitColor}; color: white; padding: 4px 8px; border-radius: 4px;">${profitMargin}</span></td>
            <td>
                <button type="button" class="btn-sm btn-edit btn-view-profit" data-id="${report.id}" data-invoice-number="${escapeHtml(report.invoice_number || report.id)}" style="background: var(--bg-color); border: 1px solid var(--border-color); border-radius: 4px; padding: 5px 10px; cursor: pointer;">
                    <i class="fas fa-eye"></i> التفاصيل
                </button>
            </td>
        `;
        profitTableBody.appendChild(row);
    });

    if (profitTotalProfitEl) profitTotalProfitEl.textContent = formatCurrency(totalProfit);
}

async function openProfitDetailsModal(invoiceId, invoiceNumber) {
    profitModalSubtitleEl.textContent = `رقم الفاتورة: ${invoiceNumber}`;
    profitDetailsTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px;">جارٍ التحميل...</td></tr>`;
    profitDetailsModalEl.style.display = 'flex';
    profitDetailsModalEl.classList.add('is-open');

    try {
        const response = await window.electronAPI.getInvoiceProfitDetails(Number(invoiceId));
        if (response && response.success) {
            renderProfitDetails(response.data || []);
        } else {
            profitDetailsTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red;">خطأ في تحميل التفاصيل</td></tr>`;
        }
    } catch (error) {
        profitDetailsTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red;">خطأ في تحميل التفاصيل</td></tr>`;
    }
}

function renderProfitDetails(details) {
    profitDetailsTableBody.innerHTML = '';
    if (!details || details.length === 0) {
        profitDetailsTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center;">لا توجد أصناف مرتبطة بهذه الفاتورة</td></tr>`;
        return;
    }

    details.forEach(item => {
        const row = document.createElement('tr');
        const profitColor = item.total_profit >= 0 ? '#2e7d32' : '#d32f2f';
        row.innerHTML = `
            <td>${escapeHtml(item.item_name || '-')}</td>
            <td>${item.quantity}</td>
            <td>${formatCurrency(item.cost_price)}</td>
            <td>${formatCurrency(item.sale_price)}</td>
            <td>${formatCurrency(item.unit_profit)}</td>
            <td style="color: ${profitColor}; font-weight: bold;">${formatCurrency(item.total_profit)}</td>
        `;
        profitDetailsTableBody.appendChild(row);
    });
}

function closeProfitDetailsModal() {
    profitDetailsModalEl.style.display = 'none';
    profitDetailsModalEl.classList.remove('is-open');
}

