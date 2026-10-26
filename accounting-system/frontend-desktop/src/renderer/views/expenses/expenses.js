let transactionsTableBody;
let transDateInput;
let newExpenseBtn;
let expensesById = new Map();
let allExpenses = [];
let ar = {};
const { t, fmt } = window.i18n?.createPageHelpers?.(() => ar) || { t: (k, f = '') => f, fmt: (t, v = {}) => String(t || '') };

function formatLocalDate(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function buildTopNavHTML() {
    if (window.navManager && typeof window.navManager.getTopNavHTML === 'function') {
        return window.navManager.getTopNavHTML(t);
    }
    return '';
}

function showExpenseToast(message, type = 'info') {
    if (!message) return;

    if (window.toast && typeof window.toast[type] === 'function') {
        window.toast[type](message);
        return;
    }

    if (typeof Toast !== 'undefined' && typeof Toast.show === 'function') {
        Toast.show(message, type);
        return;
    }

    if (type === 'error') {
        console.error('[expenses]', message);
        return;
    }

    console.log('[expenses]', message);
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        if (window.i18n && typeof window.i18n.loadArabicDictionary === 'function') {
            ar = await window.i18n.loadArabicDictionary();
        }
        renderPage();
        initializeElements();
        if (transDateInput) transDateInput.valueAsDate = new Date();
        loadExpensesData();
    } catch (error) {
        console.error('Initialization Error:', error);
        if (window.toast && typeof window.toast.error === 'function') {
            window.toast.error(t('alerts.initError', 'حدث خطأ أثناء تهيئة الصفحة، يرجى إعادة التحميل'));
        }
    }
});

function renderPage() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${buildTopNavHTML()}

        <div class="content">
            <div class="expenses-hero">
                <div class="hero-shapes">
                    <span class="hero-shape shape-1"></span>
                    <span class="hero-shape shape-2"></span>
                    <span class="hero-shape shape-3"></span>
                </div>
                <div class="hero-content">
                    <h1>${t('expenses.pageTitle', 'الخوارج')}</h1>
                    <p>${t('expenses.heroSubtitle', 'إدارة وتسجيل حركات الخوارج والمصروفات المالية')}</p>
                </div>
                <div class="hero-bottom">
                    <button class="btn btn-primary" id="newExpenseBtn" data-action="show-form">
                        <i class="fas fa-plus-circle"></i> ${t('expenses.newExpenseBtn', 'تسجيل خارج جديد')}
                    </button>
                </div>
            </div>

            <div class="stats-container">
                <div class="stat-card stat-net-profit">
                    <div class="stat-icon"><i class="fas fa-coins"></i></div>
                    <div class="stat-info">
                        <div class="stat-title">${t('expenses.netProfitMonth', 'صافي الربح التقديري (بعد الخوارج)')}</div>
                        <div class="stat-value positive" id="estimatedNetProfit">0.00</div>
                    </div>
                </div>
                <div class="stat-card stat-share-god">
                    <div class="stat-icon"><i class="fas fa-hand-holding-heart"></i></div>
                    <div class="stat-info">
                        <div class="stat-title">${t('expenses.shareForGod', 'مستقطع لوجه الله (10%)')}</div>
                        <div class="stat-value positive" id="estimatedShareForGod">0.00</div>
                    </div>
                </div>
                <div class="stat-card stat-final-profit">
                    <div class="stat-icon"><i class="fas fa-award"></i></div>
                    <div class="stat-info">
                        <div class="stat-title">${t('expenses.finalNetProfit', 'صافي الربح النهائي (بعد الـ 10%)')}</div>
                        <div class="stat-value positive" id="estimatedFinalNetProfit">0.00</div>
                    </div>
                </div>
                <div class="stat-card stat-month-expense">
                    <div class="stat-icon"><i class="fas fa-calendar-alt"></i></div>
                    <div class="stat-info">
                        <div class="stat-title">${t('expenses.monthExpenses', 'خوارج الشهر الحالي')}</div>
                        <div class="stat-value negative" id="monthExpense">0.00</div>
                    </div>
                </div>
                <div class="stat-card stat-today-expense">
                    <div class="stat-icon"><i class="fas fa-calendar-minus"></i></div>
                    <div class="stat-info">
                        <div class="stat-title">${t('expenses.todayExpenses', 'خوارج اليوم')}</div>
                        <div class="stat-value negative" id="todayExpense">0.00</div>
                    </div>
                </div>
                <div class="stat-card stat-total-expense">
                    <div class="stat-icon"><i class="fas fa-receipt"></i></div>
                    <div class="stat-info">
                        <div class="stat-title">${t('expenses.totalExpenses', 'إجمالي الخوارج (الكل)')}</div>
                        <div class="stat-value negative" id="totalExpense">0.00</div>
                    </div>
                </div>
            </div>

            <div id="newExpenseModal" class="doc-modal">
                <div class="doc-modal-card">
                    <div class="doc-modal-header">
                        <button type="button" class="doc-modal-close" data-action="hide-form">&times;</button>
                        <h3 class="doc-modal-title">
                            <i class="fas fa-file-invoice-dollar"></i>
                            ${t('expenses.newExpenseTitle', 'إضافة مستند خارج')}
                        </h3>
                    </div>
                    <div class="doc-modal-body">
                        <div class="doc-modal-row">
                            <div class="doc-modal-group">
                                <label class="doc-modal-label"># ${t('finance.tableHeaders.voucherNumber', 'رقم المستند')}</label>
                                <input type="text" id="expenseVoucherNumber" class="doc-modal-input doc-modal-input-readonly" readonly placeholder="NTH-0001">
                            </div>
                            <div class="doc-modal-group">
                                <label class="doc-modal-label"><i class="far fa-calendar-alt"></i> ${t('expenses.date', 'التاريخ')}</label>
                                <input type="date" id="transDate" class="doc-modal-input">
                            </div>
                        </div>

                        <div class="doc-modal-row">
                            <div class="doc-modal-group">
                                <label class="doc-modal-label"><span class="req-star">*</span> <i class="fas fa-money-bill-wave"></i> ${t('expenses.amount', 'المبلغ')}</label>
                                <div class="currency-input-wrapper">
                                    <span class="currency-badge">ج.م</span>
                                    <input type="number" id="transAmount" class="doc-modal-input" placeholder="0.00" step="0.01">
                                </div>
                            </div>
                            <div class="doc-modal-group">
                                <label class="doc-modal-label"><span class="req-star">*</span> <i class="fas fa-pen"></i> ${t('expenses.descriptionLabel', 'البيان')}</label>
                                <input type="text" id="transDesc" class="doc-modal-input" placeholder="${t('expenses.descriptionPlaceholder', 'اكتب هنا وصفاً موجزاً للمصروف...')}">
                            </div>
                        </div>

                        <div class="doc-modal-group full-width">
                            <label class="doc-modal-label"><i class="far fa-comment-dots"></i> ملاحظات إضافية</label>
                            <textarea id="transNotes" class="doc-modal-textarea" rows="3" placeholder="أية تفاصيل أخرى متعلقة بالمصروف..."></textarea>
                        </div>
                    </div>
                    <div class="doc-modal-footer">
                        <button type="button" class="btn-doc-submit" data-action="save-transaction">
                            <i class="fas fa-check-circle"></i> ${t('finance.saveAndApprove', 'حفظ واعتماد')}
                        </button>
                        <button type="button" class="btn-doc-cancel" data-action="hide-form">${t('expenses.cancel', 'إلغاء')}</button>
                    </div>
                </div>
            </div>

            <div id="editModal" class="doc-modal">
                <div class="doc-modal-card">
                    <div class="doc-modal-header">
                        <button type="button" class="doc-modal-close" data-action="close-edit-modal">&times;</button>
                        <h3 class="doc-modal-title">
                            <i class="fas fa-edit"></i>
                            ${t('finance.editTransactionTitle', 'تعديل مستند خارج')}
                        </h3>
                    </div>
                    <input type="hidden" id="editTransId">
                    <div class="doc-modal-body">
                        <div class="doc-modal-row">
                            <div class="doc-modal-group">
                                <label class="doc-modal-label"># ${t('finance.tableHeaders.voucherNumber', 'رقم المستند')}</label>
                                <input type="text" id="editTransVoucher" class="doc-modal-input doc-modal-input-readonly" readonly>
                            </div>
                            <div class="doc-modal-group">
                                <label class="doc-modal-label"><i class="far fa-calendar-alt"></i> ${t('expenses.date', 'التاريخ')}</label>
                                <input type="date" id="editTransDate" class="doc-modal-input">
                            </div>
                        </div>

                        <div class="doc-modal-row">
                            <div class="doc-modal-group">
                                <label class="doc-modal-label"><span class="req-star">*</span> <i class="fas fa-money-bill-wave"></i> ${t('expenses.amount', 'المبلغ')}</label>
                                <div class="currency-input-wrapper">
                                    <span class="currency-badge">ج.م</span>
                                    <input type="number" id="editTransAmount" class="doc-modal-input" placeholder="0.00" step="0.01">
                                </div>
                            </div>
                            <div class="doc-modal-group">
                                <label class="doc-modal-label"><span class="req-star">*</span> <i class="fas fa-pen"></i> ${t('expenses.descriptionLabel', 'البيان')}</label>
                                <input type="text" id="editTransDesc" class="doc-modal-input">
                            </div>
                        </div>

                        <div class="doc-modal-group full-width">
                            <label class="doc-modal-label"><i class="far fa-comment-dots"></i> ملاحظات إضافية</label>
                            <textarea id="editTransNotes" class="doc-modal-textarea" rows="3"></textarea>
                        </div>
                    </div>
                    <div class="doc-modal-footer">
                        <button type="button" class="btn-doc-submit" data-action="update-transaction">
                            <i class="fas fa-check-circle"></i> ${t('finance.saveChanges', 'حفظ التعديلات')}
                        </button>
                        <button type="button" class="btn-doc-cancel" data-action="close-edit-modal">${t('expenses.cancel', 'إلغاء')}</button>
                    </div>
                </div>
            </div>

            <div class="table-card">
                <div class="expenses-table-header">
                    <div class="table-header-title">
                        <h3 style="margin: 0; color: var(--text-color);"><i class="fas fa-receipt" style="color: #e11d48; margin-inline-end: 8px;"></i>${t('expenses.recentExpenses', 'سجل حركات الخوارج')}</h3>
                        <span id="expensesCountBadge" class="expenses-count-pill">0 حركة</span>
                    </div>

                    <div class="expenses-filter-bar">
                        <div class="search-box">
                            <i class="fas fa-search search-icon"></i>
                            <input type="text" id="expenseSearchInput" class="filter-input search-input" placeholder="بحث بالبيان، المبلغ، أو رقم السند...">
                        </div>
                        <div class="date-filter-box">
                            <span class="filter-label"><i class="fas fa-calendar-alt"></i> من:</span>
                            <input type="date" id="expenseFromDate" class="filter-input date-input">
                        </div>
                        <div class="date-filter-box">
                            <span class="filter-label"><i class="fas fa-calendar-alt"></i> إلى:</span>
                            <input type="date" id="expenseToDate" class="filter-input date-input">
                        </div>
                        <button type="button" id="expenseClearFilterBtn" class="filter-reset-btn" title="مسح التصفية">
                            <i class="fas fa-eraser"></i> مسح
                        </button>
                    </div>
                </div>

                <div id="expensesFilteredSummary" class="expenses-filtered-summary" style="display: none;">
                    <span><i class="fas fa-filter" style="color: #e11d48;"></i> نتائج التصفية: <strong id="summaryFilteredCount">0</strong> حركة بإجمالي <strong id="summaryFilteredTotal" style="color: #e11d48;">0.00</strong> ج.م</span>
                </div>
                <table class="table">
                    <thead>
                        <tr>
                            <th>${t('finance.tableHeaders.voucherNumber', 'رقم المستند')}</th>
                            <th>${t('finance.tableHeaders.date', 'التاريخ')}</th>
                            <th>${t('finance.tableHeaders.amount', 'المبلغ')}</th>
                            <th>${t('finance.tableHeaders.description', 'البيان')}</th>
                            <th>ملاحظات إضافية</th>
                            <th>${t('finance.tableHeaders.actions', 'إجراءات')}</th>
                        </tr>
                    </thead>
                    <tbody id="transactionsTableBody">
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function initializeElements() {
    transactionsTableBody = document.getElementById('transactionsTableBody');
    transDateInput = document.getElementById('transDate');
    newExpenseBtn = document.getElementById('newExpenseBtn');
    document.getElementById('app').addEventListener('click', handleAppClick);
    document.addEventListener('click', handleOutsideModalClick);

    const searchInput = document.getElementById('expenseSearchInput');
    const fromDateInput = document.getElementById('expenseFromDate');
    const toDateInput = document.getElementById('expenseToDate');
    const clearFilterBtn = document.getElementById('expenseClearFilterBtn');

    if (searchInput) {
        searchInput.addEventListener('input', () => applyExpensesFilters());
    }
    if (fromDateInput) {
        fromDateInput.addEventListener('change', () => {
            applyExpensesFilters();
            handleDateFilterChange();
        });
    }
    if (toDateInput) {
        toDateInput.addEventListener('change', () => {
            applyExpensesFilters();
            handleDateFilterChange();
        });
    }
    if (clearFilterBtn) {
        clearFilterBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (fromDateInput) fromDateInput.value = '';
            if (toDateInput) toDateInput.value = '';
            applyExpensesFilters();
            handleDateFilterChange();
        });
    }
}

async function loadExpensesData() {
    if (!window.electronAPI || typeof window.electronAPI.getExpenses !== 'function') {
        return;
    }

    const expensesList = await window.electronAPI.getExpenses();
    allExpenses = Array.isArray(expensesList) ? expensesList : [];
    const items = allExpenses;

    const now = new Date();
    const today = formatLocalDate(now);
    const firstDayOfMonth = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
    const lastDayOfMonth = formatLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));

    let totalExpense = 0;
    let monthExpense = 0;
    let todayExpense = 0;

    items.forEach((item) => {
        const amt = Number(item.amount) || 0;
        totalExpense += amt;
        const itemDate = String(item.transaction_date || '');
        if (itemDate >= firstDayOfMonth && itemDate <= lastDayOfMonth) {
            monthExpense += amt;
        }
        if (itemDate === today) {
            todayExpense += amt;
        }
    });

    let netProfit = 0;
    let shareForGod = 0;
    let finalNetProfit = 0;
    if (typeof window.electronAPI.getDashboardStats === 'function') {
        try {
            const dashboardStats = await window.electronAPI.getDashboardStats({
                startDate: firstDayOfMonth,
                endDate: today
            });
            netProfit = Number(dashboardStats?.netProfit) || 0;
            shareForGod = Number(dashboardStats?.shareForGod) || (netProfit > 0 ? Number((netProfit * 0.10).toFixed(2)) : 0);
            finalNetProfit = Number(dashboardStats?.finalNetProfit) || (netProfit > 0 ? Number((netProfit - shareForGod).toFixed(2)) : netProfit);
        } catch (err) {
            console.error('[expenses] Error fetching dashboard stats:', err);
        }
    }

    const netProfitEl = document.getElementById('estimatedNetProfit');
    const shareForGodEl = document.getElementById('estimatedShareForGod');
    const finalProfitEl = document.getElementById('estimatedFinalNetProfit');
    const monthExpenseEl = document.getElementById('monthExpense');
    const todayExpenseEl = document.getElementById('todayExpense');
    const totalExpenseEl = document.getElementById('totalExpense');

    if (netProfitEl) {
        netProfitEl.textContent = netProfit.toFixed(2);
        netProfitEl.className = netProfit >= 0 ? 'stat-value positive' : 'stat-value negative';
    }
    if (shareForGodEl) {
        shareForGodEl.textContent = shareForGod.toFixed(2);
    }
    if (finalProfitEl) {
        finalProfitEl.textContent = finalNetProfit.toFixed(2);
        finalProfitEl.className = finalNetProfit >= 0 ? 'stat-value positive' : 'stat-value negative';
    }
    if (monthExpenseEl) monthExpenseEl.textContent = monthExpense.toFixed(2);
    if (todayExpenseEl) todayExpenseEl.textContent = todayExpense.toFixed(2);
    if (totalExpenseEl) totalExpenseEl.textContent = totalExpense.toFixed(2);

    applyExpensesFilters();
}

function isFilterActive() {
    const searchVal = (document.getElementById('expenseSearchInput')?.value || '').trim();
    const fromDate = document.getElementById('expenseFromDate')?.value || '';
    const toDate = document.getElementById('expenseToDate')?.value || '';
    return Boolean(searchVal || fromDate || toDate);
}

function applyExpensesFilters() {
    const searchVal = (document.getElementById('expenseSearchInput')?.value || '').trim().toLowerCase();
    const fromDate = document.getElementById('expenseFromDate')?.value || '';
    const toDate = document.getElementById('expenseToDate')?.value || '';

    const filtered = allExpenses.filter((item) => {
        const itemDate = String(item.transaction_date || '');
        if (fromDate && itemDate < fromDate) return false;
        if (toDate && itemDate > toDate) return false;

        if (searchVal) {
            const desc = String(item.description || '').toLowerCase();
            const voucher = String(item.voucher_number || '').toLowerCase();
            const notes = String(item.notes || '').toLowerCase();
            const amount = String(item.amount || '');

            const matchDesc = desc.includes(searchVal);
            const matchVoucher = voucher.includes(searchVal);
            const matchNotes = notes.includes(searchVal);
            const matchAmount = amount.includes(searchVal);

            if (!matchDesc && !matchVoucher && !matchNotes && !matchAmount) {
                return false;
            }
        }
        return true;
    });

    renderTransactions(filtered);
    updateFilteredSummary(filtered);
}

function updateFilteredSummary(filtered) {
    const countBadge = document.getElementById('expensesCountBadge');
    const summaryBox = document.getElementById('expensesFilteredSummary');
    const summaryCount = document.getElementById('summaryFilteredCount');
    const summaryTotal = document.getElementById('summaryFilteredTotal');

    const totalCount = allExpenses.length;
    const filterActive = isFilterActive();

    if (countBadge) {
        countBadge.textContent = filterActive 
            ? `${filtered.length} من ${totalCount} حركة` 
            : `${totalCount} حركة`;
    }

    if (summaryBox) {
        if (filterActive) {
            const sum = filtered.reduce((acc, it) => acc + (Number(it.amount) || 0), 0);
            if (summaryCount) summaryCount.textContent = filtered.length;
            if (summaryTotal) summaryTotal.textContent = sum.toFixed(2);
            summaryBox.style.display = 'flex';
        } else {
            summaryBox.style.display = 'none';
        }
    }
}

async function handleDateFilterChange() {
    const fromDate = document.getElementById('expenseFromDate')?.value || '';
    const toDate = document.getElementById('expenseToDate')?.value || '';
    await updatePeriodNetProfit(fromDate, toDate);
}

async function updatePeriodNetProfit(fromDate, toDate) {
    const now = new Date();
    const effectiveStart = fromDate || formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
    const effectiveEnd = toDate || formatLocalDate(now);

    if (typeof window.electronAPI.getDashboardStats === 'function') {
        try {
            const dashboardStats = await window.electronAPI.getDashboardStats({
                startDate: effectiveStart,
                endDate: effectiveEnd
            });
            const netProfit = Number(dashboardStats?.netProfit) || 0;
            const shareForGod = Number(dashboardStats?.shareForGod) || (netProfit > 0 ? Number((netProfit * 0.10).toFixed(2)) : 0);
            const finalNetProfit = Number(dashboardStats?.finalNetProfit) || (netProfit > 0 ? Number((netProfit - shareForGod).toFixed(2)) : netProfit);

            const netProfitEl = document.getElementById('estimatedNetProfit');
            const shareForGodEl = document.getElementById('estimatedShareForGod');
            const finalProfitEl = document.getElementById('estimatedFinalNetProfit');

            if (netProfitEl) {
                netProfitEl.textContent = netProfit.toFixed(2);
                netProfitEl.className = netProfit >= 0 ? 'stat-value positive' : 'stat-value negative';
            }
            if (shareForGodEl) shareForGodEl.textContent = shareForGod.toFixed(2);
            if (finalProfitEl) {
                finalProfitEl.textContent = finalNetProfit.toFixed(2);
                finalProfitEl.className = finalNetProfit >= 0 ? 'stat-value positive' : 'stat-value negative';
            }
        } catch (err) {
            console.error('[expenses] Error updating period stats:', err);
        }
    }
}

function renderTransactions(expenses) {
    if (!transactionsTableBody) return;
    transactionsTableBody.innerHTML = '';
    expensesById = new Map();

    if (expenses.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `
            <td colspan="6" style="text-align: center; padding: 30px; color: var(--text-muted);">
                ${isFilterActive() ? 'لا توجد حركات مطابقة لشروط البحث أو الفترة المحددة' : t('expenses.noExpenses', 'لا توجد حركات خوارج مسجلة')}
            </td>
        `;
        transactionsTableBody.appendChild(emptyRow);
        return;
    }

    expenses.forEach((item) => {
        expensesById.set(String(item.id), item);
        const row = document.createElement('tr');

        const voucherCell = window.renderDocNumberCell
            ? window.renderDocNumberCell(item.voucher_number, { numberTag: 'span', numberClassName: 'finance-voucher-number' })
            : (item.voucher_number
                ? `<span style="font-weight: 700; color: var(--accent-color);">${item.voucher_number}</span>`
                : `<span style="color: var(--text-muted); font-size: 0.85rem;">-</span>`);

        const actions = `
            <button class="btn btn-warning btn-sm" data-action="edit-transaction" data-id="${item.id}">${t('finance.editBtn', 'تعديل')}</button>
            <button class="btn btn-danger btn-sm" data-action="delete-transaction" data-id="${item.id}">${t('finance.deleteBtn', 'حذف')}</button>
        `;

        row.innerHTML = `
            <td>${voucherCell}</td>
            <td>${item.transaction_date || '-'}</td>
            <td style="font-weight: bold; direction: ltr; color: #ef4444;">${(Number(item.amount) || 0).toFixed(2)}</td>
            <td>${item.description || '-'}</td>
            <td style="color: var(--text-muted);">${item.notes || '-'}</td>
            <td>${actions}</td>
        `;
        transactionsTableBody.appendChild(row);
    });
}

function handleAppClick(event) {
    const target = event.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    if (action === 'show-form') {
        showForm();
        return;
    }

    if (action === 'hide-form') {
        hideForm();
        return;
    }

    if (action === 'save-transaction') {
        saveTransaction();
        return;
    }

    if (action === 'close-edit-modal') {
        closeEditModal();
        return;
    }

    if (action === 'update-transaction') {
        updateTransaction();
        return;
    }

    if (action === 'edit-transaction') {
        const item = expensesById.get(String(target.dataset.id || ''));
        if (item) {
            openEditModal(item);
        }
        return;
    }

    if (action === 'delete-transaction') {
        const id = Number.parseInt(target.dataset.id || '', 10);
        if (Number.isFinite(id)) {
            deleteTransaction(id);
        }
    }
}

async function showForm() {
    const modal = document.getElementById('newExpenseModal');
    if (!modal) return;
    modal.classList.add('is-open');
    if (transDateInput) transDateInput.valueAsDate = new Date();
    await updateNextVoucherPreview();
}

function hideForm() {
    const modal = document.getElementById('newExpenseModal');
    if (!modal) return;
    modal.classList.remove('is-open');
    document.getElementById('transAmount').value = '';
    document.getElementById('transDesc').value = '';
    document.getElementById('transNotes').value = '';
    if (transDateInput) transDateInput.valueAsDate = new Date();
}

async function updateNextVoucherPreview() {
    const voucherInput = document.getElementById('expenseVoucherNumber');
    if (voucherInput && window.electronAPI && typeof window.electronAPI.getNextExpenseVoucherNumber === 'function') {
        const res = await window.electronAPI.getNextExpenseVoucherNumber();
        if (res && res.success) {
            voucherInput.value = res.voucher_number;
        }
    }
}

async function saveTransaction() {
    const amount = parseFloat(document.getElementById('transAmount').value);
    const date = document.getElementById('transDate').value;
    const description = document.getElementById('transDesc').value;
    const notes = document.getElementById('transNotes').value;
    const voucher_number = document.getElementById('expenseVoucherNumber').value;

    if (!amount || amount <= 0) {
        showExpenseToast(t('finance.toast.invalidAmount', 'الرجاء إدخال مبلغ صحيح'), 'error');
        return;
    }
    if (!description) {
        showExpenseToast(t('finance.toast.descriptionRequired', 'الرجاء إدخال وصف للحركة'), 'error');
        return;
    }

    const result = await window.electronAPI.addExpense({
        voucher_number,
        amount,
        date,
        description,
        notes
    });

    if (result.success) {
        showExpenseToast(t('finance.toast.saveSuccess', 'تم حفظ الحركة بنجاح'), 'success');
        hideForm();
        loadExpensesData();
    } else {
        showExpenseToast(fmt(t('finance.toast.saveError', 'حدث خطأ: {error}'), { error: result.error }), 'error');
    }
}

async function deleteTransaction(id) {
    const confirmed = typeof window.showConfirmDialog === 'function'
        ? await window.showConfirmDialog(t('finance.toast.deleteConfirm', 'هل أنت متأكد من حذف هذه الحركة؟ لا يمكن التراجع عن هذا الإجراء.'))
        : false;
    if (!confirmed) return;

    const result = await window.electronAPI.deleteExpense(id);
    if (result.success) {
        showExpenseToast(t('finance.toast.deleteSuccess', 'تم الحذف بنجاح'), 'success');
        loadExpensesData();
    } else {
        showExpenseToast(fmt(t('finance.toast.deleteError', 'حدث خطأ أثناء الحذف: {error}'), { error: result.error }), 'error');
    }
}

function openEditModal(item) {
    document.getElementById('editTransId').value = item.id;
    document.getElementById('editTransVoucher').value = item.voucher_number || '-';
    document.getElementById('editTransAmount').value = item.amount;
    document.getElementById('editTransDate').value = item.transaction_date;
    document.getElementById('editTransDesc').value = item.description || '';
    document.getElementById('editTransNotes').value = item.notes || '';
    const modal = document.getElementById('editModal');
    if (modal) modal.classList.add('is-open');
}

function closeEditModal() {
    const modal = document.getElementById('editModal');
    if (modal) modal.classList.remove('is-open');
}

async function updateTransaction() {
    const id = document.getElementById('editTransId').value;
    const amount = parseFloat(document.getElementById('editTransAmount').value);
    const date = document.getElementById('editTransDate').value;
    const description = document.getElementById('editTransDesc').value;
    const notes = document.getElementById('editTransNotes').value;

    if (!amount || amount <= 0) {
        showExpenseToast(t('finance.toast.invalidAmount', 'الرجاء إدخال مبلغ صحيح'), 'error');
        return;
    }

    const result = await window.electronAPI.updateExpense({
        id,
        amount,
        date,
        description,
        notes
    });

    if (result.success) {
        showExpenseToast(t('finance.toast.updateSuccess', 'تم تحديث الحركة بنجاح'), 'success');
        closeEditModal();
        loadExpensesData();
    } else {
        showExpenseToast(fmt(t('finance.toast.updateError', 'حدث خطأ: {error}'), { error: result.error }), 'error');
    }
}

function handleOutsideModalClick(event) {
    const newModal = document.getElementById('newExpenseModal');
    if (event.target === newModal) {
        hideForm();
    }
    const editModal = document.getElementById('editModal');
    if (event.target === editModal) {
        closeEditModal();
    }
}
