let supplierSelect;
let invoiceSelect;
let returnDateInput;
let returnNumberInput;
let supplierAutocomplete = null;
let invoiceAutocomplete = null;
let currentInvoiceItems = [];
let isSubmitting = false;
let editingReturnId = null;
let editingOriginalInvoiceId = null;
let editingReturnItemsMap = new Map();
let originalInvoicePreviewEl;
let originalInvoicePreviewTextEl;
let allPurchaseReturns = [];
let purchaseReturnsPage = 1;
const purchaseReturnsPerPage = 50;
let ar = {};

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

function toArray(value) {
    return Array.isArray(value) ? value : [];
}

function formatAmount(value) {
    const parsed = Number(value) || 0;
    return parsed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatInvoiceOptionText(invoiceNumber, invoiceDate, totalAmount) {
    const numberText = `\u200E${invoiceNumber || '-'}\u200E`;
    const dateText = `\u200E${invoiceDate || '-'}\u200E`;
    const totalText = `\u200E${formatAmount(totalAmount)}\u200E ${t('common.currency.egp', 'ج.م')}`;

    return fmt(t('purchaseReturns.invoiceOption', 'فاتورة {number} - {date} - {total}'), {
        number: numberText,
        date: dateText,
        total: totalText
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    if (window.i18n && typeof window.i18n.loadArabicDictionary === 'function') {
        ar = await window.i18n.loadArabicDictionary();
    }

    renderPage();
    initializeElements();
    await Promise.all([loadSuppliers(), loadReturnsHistory()]);

    const editId = getEditIdFromUrl();
    if (editId) {
        await loadReturnForEdit(editId);
    }
});

function getNavHTML() {
    return `
        <nav class="top-nav">
            <div class="nav-brand">${t('common.nav.brand', 'Accounting System')}</div>
            <ul class="nav-links">
                <li><a href="../dashboard/index.html">${t('common.nav.dashboard', 'Dashboard')}</a></li>
                <li class="dropdown">
                    <a href="#">${t('common.nav.masterData', 'Master Data')}</a>
                    <div class="dropdown-content">
                        <a href="../items/units.html">${t('common.nav.units', 'Units')}</a>
                        <a href="../items/items.html">${t('common.nav.items', 'Items')}</a>
                        <a href="../customers/index.html">${t('common.nav.customersSuppliers', 'Customers & Suppliers')}</a>
                        <a href="../opening-balance/index.html">${t('common.nav.openingBalance', 'Opening Balance')}</a>
                        <a href="../auth-users/index.html">${t('common.nav.userManagement', 'إدارة المستخدمين')}</a>
                    </div>
                </li>
                <li class="dropdown">
                    <a href="#">${t('common.nav.sales', 'Sales')}</a>
                    <div class="dropdown-content">
                        <a href="../sales/index.html">${t('common.nav.salesInvoice', 'Sales Invoice')}</a>
                        <a href="../sales-returns/index.html">${t('common.nav.salesReturns', 'Sales Returns')}</a>
                    </div>
                </li>
                <li class="dropdown">
                    <a href="#" class="active">${t('common.nav.purchases', 'Purchases')}</a>
                    <div class="dropdown-content">
                        <a href="../purchases/index.html">${t('common.nav.purchaseInvoice', 'Purchase Invoice')}</a>
                        <a href="../purchase-returns/index.html" class="active">${t('common.nav.purchaseReturns', 'Purchase Returns')}</a>
                    </div>
                </li>
                <li><a href="../inventory/index.html">${t('common.nav.inventory', 'Inventory')}</a></li>
                <li><a href="../finance/index.html">${t('common.nav.finance', 'Finance')}</a></li>
                <li><a href="../payments/receipt.html">${t('common.nav.receipt', 'Customer Receipt')}</a></li>
                <li><a href="../payments/payment.html">${t('common.nav.payment', 'Supplier Payment')}</a></li>
                <li class="dropdown">
                    <a href="#">${t('common.nav.reports', 'Reports')}</a>
                    <div class="dropdown-content">
                        <a href="../reports/index.html">${t('common.nav.generalReports', 'General Reports')}</a>
                        <a href="../customer-reports/index.html">${t('common.nav.customerReports', 'تقارير العملاء')}</a>
                        <a href="../reports/debtor-creditor/index.html">${t('common.nav.debtorCreditor', 'Debtor / Creditor')}</a>
                    </div>
                </li>
                <li><a href="../settings/index.html">${t('common.nav.settings', 'Settings')}</a></li>
            </ul>
        </nav>
    `;
}

function renderPage() {
    document.title = t('purchaseReturns.title', 'مردودات المشتريات');

    const app = document.getElementById('app');
    app.innerHTML = `
        ${getNavHTML()}

        <div class="content">
            <div class="page-header">
                <div class="page-title">
                    <i class="fas fa-undo-alt"></i>
                    ${t('purchaseReturns.title', 'مردودات المشتريات')}
                </div>
            </div>

            <div class="return-form-container">
                <h2 class="form-title">
                    <i class="fas fa-file-invoice"></i>
                    ${t('purchaseReturns.newReturnTitle', 'تسجيل مرتجع مشتريات جديد')}
                </h2>

                <div class="form-grid">
                    <div class="form-group">
                        <label>${t('purchaseReturns.supplier', 'المورد')}</label>
                        <select id="supplierSelect" class="form-control">
                            <option value="">${t('common.actions.selectSupplier', 'اختر المورد')}</option>
                        </select>
                    </div>
                    <div class="form-group form-group-original-invoice">
                        <label>${t('purchaseReturns.originalInvoice', 'فاتورة الشراء الأصلية')}</label>
                        <select id="invoiceSelect" class="form-control" disabled>
                            <option value="">${t('common.actions.selectInvoice', 'اختر الفاتورة')}</option>
                        </select>
                        <div id="originalInvoicePreview" class="original-invoice-preview is-empty">
                            <span>${t('purchaseReturns.originalInvoicePreview', 'تفاصيل الفاتورة المختارة')}</span>
                            <strong id="originalInvoicePreviewText">${t('purchaseReturns.noInvoiceSelected', 'لم يتم اختيار فاتورة شراء أصلية بعد')}</strong>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>${t('purchaseReturns.returnNumber', 'رقم المرتجع')}</label>
                        <input type="text" id="returnNumber" class="form-control" placeholder="${t('common.actions.auto', 'Auto')}" readonly style="background: var(--bg-color); cursor: not-allowed;">
                    </div>
                    <div class="form-group">
                        <label>${t('purchaseReturns.returnDate', 'تاريخ المرتجع')}</label>
                        <input type="date" id="returnDate" class="form-control">
                    </div>
                </div>

                <div id="itemsSection" class="items-section" style="display: none;">
                    <table class="items-table">
                        <thead>
                            <tr>
                                <th style="width: 5%;">${t('purchaseReturns.returnItem', 'إرجاع')}</th>
                                <th style="width: 30%;">${t('purchaseReturns.item', 'الصنف')}</th>
                                <th style="width: 10%;">${t('purchaseReturns.unit', 'الوحدة')}</th>
                                <th style="width: 12%;">${t('purchaseReturns.boughtQty', 'الكمية المشتراة')}</th>
                                <th style="width: 12%;">${t('purchaseReturns.returnedQty', 'تم إرجاعها')}</th>
                                <th style="width: 12%;">${t('purchaseReturns.returnQty', 'كمية الإرجاع')}</th>
                                <th style="width: 12%;">${t('purchaseReturns.price', 'السعر')}</th>
                                <th style="width: 12%;">${t('purchaseReturns.total', 'الإجمالي')}</th>
                            </tr>
                        </thead>
                        <tbody id="itemsBody"></tbody>
                    </table>
                </div>

                <div class="notes-section" style="margin-bottom: 15px;">
                    <div class="form-group">
                        <label>${t('purchaseReturns.notes', 'ملاحظات')}</label>
                        <textarea id="returnNotes" rows="2" placeholder="${t('purchaseReturns.notesPlaceholder', 'ملاحظات اختيارية...')}"></textarea>
                    </div>
                </div>

                <div class="form-footer">
                    <div class="total-section">
                        <span>${t('purchaseReturns.returnTotal', 'إجمالي المرتجع:')}</span>
                        <span class="total-value" id="returnTotal">0.00</span>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button class="btn btn-secondary" onclick="resetForm()">
                            <i class="fas fa-eraser"></i> ${t('common.actions.clear', 'مسح')}
                        </button>
                        <button class="btn btn-warning" id="saveBtn" onclick="saveReturn()" disabled>
                            <i class="fas fa-save"></i> ${t('purchaseReturns.saveReturn', 'حفظ المرتجع')}
                        </button>
                    </div>
                </div>
            </div>

            <div class="history-card">
                <div class="history-header">
                    <h3><i class="fas fa-history"></i> ${t('purchaseReturns.historyTitle', 'سجل المرتجعات')}</h3>
                </div>
                <div id="historyContent">
                    <div class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <p>${t('common.state.noReturns', 'لا توجد مرتجعات مسجلة')}</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function getEditIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('editId');
}

function clearEditQueryFromUrl() {
    window.history.replaceState({}, document.title, window.location.pathname);
}

function setFormMode(isEditing) {
    const formTitle = document.querySelector('.form-title');
    const saveBtn = document.getElementById('saveBtn');

    const titleText = isEditing
        ? t('purchaseReturns.editReturnTitle', 'تعديل مرتجع مشتريات')
        : t('purchaseReturns.newReturnTitle', 'تسجيل مرتجع مشتريات جديد');
    const saveText = isEditing
        ? t('purchaseReturns.updateReturn', 'تحديث المرتجع')
        : t('purchaseReturns.saveReturn', 'حفظ المرتجع');

    if (formTitle) {
        formTitle.innerHTML = `<i class="fas fa-file-invoice"></i> ${titleText}`;
    }

    if (saveBtn) {
        saveBtn.innerHTML = `<i class="fas fa-save"></i> ${saveText}`;
    }
}

function initializeElements() {
    supplierSelect = document.getElementById('supplierSelect');
    invoiceSelect = document.getElementById('invoiceSelect');
    returnDateInput = document.getElementById('returnDate');
    returnNumberInput = document.getElementById('returnNumber');
    originalInvoicePreviewEl = document.getElementById('originalInvoicePreview');
    originalInvoicePreviewTextEl = document.getElementById('originalInvoicePreviewText');

    returnDateInput.valueAsDate = new Date();
    loadNextReturnNumber();
    updateOriginalInvoicePreview();

    supplierSelect.addEventListener('change', async () => {
        const supplierId = supplierSelect.value;
        if (supplierId) {
            if (editingReturnId) {
                editingOriginalInvoiceId = null;
                editingReturnItemsMap = new Map();
            }

            invoiceSelect.disabled = false;
            await loadSupplierInvoices(supplierId);
            return;
        }

        invoiceSelect.disabled = true;
        invoiceSelect.innerHTML = `<option value="">${t('common.actions.selectInvoice', 'اختر الفاتورة')}</option>`;
        if (invoiceAutocomplete) invoiceAutocomplete.refresh();
        hideItemsSection();
        updateOriginalInvoicePreview();
    });

    invoiceSelect.addEventListener('change', async () => {
        const invoiceId = invoiceSelect.value;
        updateOriginalInvoicePreview();
        if (invoiceId) {
            if (editingReturnId && Number(invoiceId) !== Number(editingOriginalInvoiceId)) {
                editingReturnItemsMap = new Map();
            }
            await loadInvoiceItems(invoiceId);
        } else {
            hideItemsSection();
        }
    });
}

async function loadNextReturnNumber() {
    const next = await window.electronAPI.getNextInvoiceNumber('purchase_return');
    returnNumberInput.value = `PR-${String(next).padStart(4, '0')}`;
}

async function loadSuppliers() {
    const customers = toArray(await window.electronAPI.getCustomers());
    const filtered = customers.filter((c) => c.type === 'supplier' || c.type === 'both');

    supplierSelect.innerHTML = `<option value="">${t('common.actions.selectSupplier', 'اختر المورد')}</option>`;
    filtered.forEach((supplier) => {
        const option = document.createElement('option');
        option.value = supplier.id;
        option.textContent = supplier.name;
        supplierSelect.appendChild(option);
    });

    if (supplierAutocomplete) {
        supplierAutocomplete.refresh();
    } else {
        supplierAutocomplete = new Autocomplete(supplierSelect);
    }
}

async function loadSupplierInvoices(supplierId) {
    const invoices = toArray(await window.electronAPI.getSupplierPurchaseInvoices(supplierId));

    invoiceSelect.innerHTML = `<option value="">${t('common.actions.selectInvoice', 'اختر الفاتورة')}</option>`;
    invoices.forEach((invoice) => {
        const option = document.createElement('option');
        option.value = invoice.id;
        option.textContent = formatInvoiceOptionText(invoice.invoice_number, invoice.invoice_date, invoice.total_amount);
        invoiceSelect.appendChild(option);
    });

    if (invoiceAutocomplete) {
        invoiceAutocomplete.refresh();
    } else {
        invoiceAutocomplete = new Autocomplete(invoiceSelect);
    }

    updateOriginalInvoicePreview();
}

async function loadInvoiceItems(invoiceId) {
    const result = await window.electronAPI.getInvoiceItemsForReturn(invoiceId, 'purchase');
    if (!result || !result.success) {
        Toast.show((result && result.error) || t('purchaseReturns.toast.loadItemsError', 'Failed to load invoice items'), 'error');
        return;
    }

    currentInvoiceItems = toArray(result.items);
    normalizeInvoiceItemsForEdit(invoiceId);
    renderInvoiceItems();
    applyEditSelections(invoiceId);
}

function toSafeNumber(value) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function getAvailableToReturn(item) {
    return Math.max(0, toSafeNumber(item.quantity) - toSafeNumber(item.returned_quantity));
}

function normalizeInvoiceItemsForEdit(invoiceId) {
    if (!editingReturnId || Number(invoiceId) !== Number(editingOriginalInvoiceId) || editingReturnItemsMap.size === 0) {
        return;
    }

    currentInvoiceItems = currentInvoiceItems.map((item) => {
        const editItem = editingReturnItemsMap.get(Number(item.item_id));
        if (!editItem) return item;

        return {
            ...item,
            returned_quantity: Math.max(0, toSafeNumber(item.returned_quantity) - toSafeNumber(editItem.quantity))
        };
    });
}

function applyEditSelections(invoiceId) {
    if (!editingReturnId || Number(invoiceId) !== Number(editingOriginalInvoiceId) || editingReturnItemsMap.size === 0) {
        return;
    }

    currentInvoiceItems.forEach((item, index) => {
        const editItem = editingReturnItemsMap.get(Number(item.item_id));
        if (!editItem) return;

        const checkbox = document.querySelector(`.return-checkbox[data-index="${index}"]`);
        const qtyInput = document.querySelector(`.return-qty-input[data-index="${index}"]`);
        const priceInput = document.querySelector(`.return-price-input[data-index="${index}"]`);
        if (!checkbox || !qtyInput || !priceInput || checkbox.disabled) return;

        checkbox.checked = true;
        qtyInput.disabled = false;
        priceInput.disabled = false;

        const maxQty = getAvailableToReturn(item);
        const qty = Math.min(maxQty, Math.max(0, toSafeNumber(editItem.quantity)));
        qtyInput.value = String(qty);
        priceInput.value = String(toSafeNumber(editItem.price));
    });

    calculateTotal();
}

function renderInvoiceItems() {
    const itemsBody = document.getElementById('itemsBody');
    const itemsSection = document.getElementById('itemsSection');
    itemsBody.innerHTML = '';

    if (currentInvoiceItems.length === 0) {
        hideItemsSection();
        return;
    }

    itemsSection.style.display = 'block';

    currentInvoiceItems.forEach((item, index) => {
        const quantity = toSafeNumber(item.quantity);
        const returnedQty = toSafeNumber(item.returned_quantity);
        const availableToReturn = getAvailableToReturn(item);

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><input type="checkbox" class="return-checkbox" data-index="${index}" onchange="onCheckboxChange(this)" ${availableToReturn <= 0 ? 'disabled' : ''}></td>
            <td class="item-name">${item.item_name || t('common.state.deletedItem', 'Deleted Item')}</td>
            <td>${item.unit_name || '-'}</td>
            <td>${quantity}</td>
            <td class="returned-qty">${returnedQty > 0 ? returnedQty : '-'}</td>
            <td>
                <input type="number" class="return-qty-input" data-index="${index}"
                    min="0" max="${availableToReturn}" step="any"
                    value="0" disabled onchange="onQtyChange(this)" oninput="onQtyChange(this)"
                    style="max-width: 120px; margin: 0 auto;">
            </td>
            <td>
                <input type="number" class="return-price-input" data-index="${index}"
                    value="${toSafeNumber(item.cost_price)}" step="any" disabled onchange="calculateTotal()" oninput="calculateTotal()"
                    style="max-width: 120px; margin: 0 auto;">
            </td>
            <td class="row-total" data-index="${index}">0.00</td>
        `;

        if (availableToReturn <= 0) {
            row.style.opacity = '0.5';
        }

        itemsBody.appendChild(row);
    });

    calculateTotal();
}

function onCheckboxChange(checkbox) {
    const index = checkbox.dataset.index;
    const qtyInput = document.querySelector(`.return-qty-input[data-index="${index}"]`);
    const priceInput = document.querySelector(`.return-price-input[data-index="${index}"]`);

    if (!qtyInput || !priceInput) return;

    if (checkbox.checked) {
        qtyInput.disabled = false;
        priceInput.disabled = false;

        const item = currentInvoiceItems[index];
        const available = getAvailableToReturn(item);
        qtyInput.value = String(available);
        qtyInput.focus();
    } else {
        qtyInput.disabled = true;
        priceInput.disabled = true;
        qtyInput.value = '0';
    }

    calculateTotal();
}

function onQtyChange(input) {
    const index = input.dataset.index;
    const item = currentInvoiceItems[index];
    const maxQty = getAvailableToReturn(item);

    let val = Number.parseFloat(input.value);
    if (!Number.isFinite(val)) val = 0;
    if (val > maxQty) val = maxQty;
    if (val < 0) val = 0;

    input.value = String(val);
    calculateTotal();
}

function calculateTotal() {
    let total = 0;
    let hasItems = false;

    document.querySelectorAll('.return-checkbox').forEach((checkbox) => {
        const index = checkbox.dataset.index;
        const rowTotalEl = document.querySelector(`.row-total[data-index="${index}"]`);

        if (!rowTotalEl) return;

        if (!checkbox.checked) {
            rowTotalEl.textContent = '0.00';
            return;
        }

        const qty = Number.parseFloat(document.querySelector(`.return-qty-input[data-index="${index}"]`)?.value || '0') || 0;
        const price = Number.parseFloat(document.querySelector(`.return-price-input[data-index="${index}"]`)?.value || '0') || 0;
        const rowTotal = qty * price;

        rowTotalEl.textContent = rowTotal.toFixed(2);
        total += rowTotal;
        if (qty > 0) hasItems = true;
    });

    document.getElementById('returnTotal').textContent = total.toFixed(2);
    document.getElementById('saveBtn').disabled = !hasItems;
}

function hideItemsSection() {
    document.getElementById('itemsSection').style.display = 'none';
    document.getElementById('itemsBody').innerHTML = '';
    document.getElementById('returnTotal').textContent = '0.00';
    document.getElementById('saveBtn').disabled = true;
    currentInvoiceItems = [];
}

async function saveReturn() {
    if (isSubmitting) return;

    isSubmitting = true;
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.disabled = true;

    try {
        const supplierId = supplierSelect.value;
        const invoiceId = invoiceSelect.value;
        const returnNumber = returnNumberInput.value;
        const returnDate = returnDateInput.value;
        const notes = document.getElementById('returnNotes').value;

        if (!supplierId || !invoiceId) {
            Toast.show(t('purchaseReturns.toast.selectSupplierInvoice', 'الرجاء اختيار المورد والفاتورة'), 'warning');
            return;
        }

        const items = [];
        document.querySelectorAll('.return-checkbox').forEach((checkbox) => {
            if (!checkbox.checked) return;

            const index = checkbox.dataset.index;
            const qty = Number.parseFloat(document.querySelector(`.return-qty-input[data-index="${index}"]`)?.value || '0') || 0;
            const price = Number.parseFloat(document.querySelector(`.return-price-input[data-index="${index}"]`)?.value || '0') || 0;

            if (qty <= 0) return;

            items.push({
                item_id: currentInvoiceItems[index].item_id,
                quantity: qty,
                price,
                total_price: qty * price
            });
        });

        if (items.length === 0) {
            Toast.show(t('purchaseReturns.toast.selectAtLeastOneItem', 'الرجاء تحديد صنف واحد على الأقل للإرجاع'), 'warning');
            return;
        }

        const payload = {
            original_invoice_id: Number.parseInt(invoiceId, 10),
            supplier_id: Number.parseInt(supplierId, 10),
            return_number: returnNumber,
            return_date: returnDate,
            notes,
            items
        };

        let result;
        if (editingReturnId) {
            result = await window.electronAPI.updatePurchaseReturn({
                id: editingReturnId,
                ...payload
            });
        } else {
            result = await window.electronAPI.savePurchaseReturn(payload);
        }

        if (result && result.success) {
            Toast.show(
                editingReturnId
                    ? t('purchaseReturns.toast.updateSuccess', 'تم تحديث المرتجع بنجاح')
                    : t('purchaseReturns.toast.saveSuccess', 'تم حفظ المرتجع بنجاح'),
                'success'
            );
            await resetForm();
            await loadReturnsHistory();
        } else {
            const errorText = editingReturnId
                ? t('purchaseReturns.toast.updateError', 'حدث خطأ أثناء تحديث المرتجع')
                : t('purchaseReturns.toast.saveError', 'حدث خطأ أثناء حفظ المرتجع');
            Toast.show((result && result.error) || errorText, 'error');
        }
    } catch (error) {
        console.error('Save purchase return error:', error);
        if (editingReturnId && String(error?.message || '').includes("No handler registered for 'update-purchase-return'")) {
            Toast.show(
                t(
                    'purchaseReturns.toast.restartRequired',
                    'تم تحديث جزء من التطبيق أثناء التشغيل. أغلق البرنامج وافتحه مرة أخرى ثم أعد المحاولة.'
                ),
                'warning'
            );
            return;
        }
        Toast.show(t('purchaseReturns.toast.unexpectedError', 'حدث خطأ غير متوقع'), 'error');
    } finally {
        isSubmitting = false;
        calculateTotal();
    }
}

async function resetForm() {
    editingReturnId = null;
    editingOriginalInvoiceId = null;
    editingReturnItemsMap = new Map();
    clearEditQueryFromUrl();
    setFormMode(false);

    supplierSelect.value = '';
    if (supplierAutocomplete) supplierAutocomplete.refresh();

    invoiceSelect.innerHTML = `<option value="">${t('common.actions.selectInvoice', 'اختر الفاتورة')}</option>`;
    invoiceSelect.disabled = true;
    if (invoiceAutocomplete) invoiceAutocomplete.refresh();
    updateOriginalInvoicePreview();

    document.getElementById('returnNotes').value = '';
    hideItemsSection();
    await loadNextReturnNumber();
    returnDateInput.valueAsDate = new Date();
}

async function loadReturnForEdit(id) {
    const returnId = Number.parseInt(id, 10);
    if (!Number.isFinite(returnId) || returnId <= 0) {
        Toast.show(t('purchaseReturns.toast.invalidReturnId', 'معرف المرتجع غير صالح'), 'warning');
        clearEditQueryFromUrl();
        return;
    }

    try {
        const returns = toArray(await window.electronAPI.getPurchaseReturns());
        const selectedReturn = returns.find((row) => Number(row.id) === returnId);
        if (!selectedReturn) {
            Toast.show(t('purchaseReturns.toast.returnNotFound', 'المرتجع غير موجود'), 'warning');
            clearEditQueryFromUrl();
            return;
        }

        const details = toArray(await window.electronAPI.getPurchaseReturnDetails(returnId));
        editingReturnId = returnId;
        editingOriginalInvoiceId = Number(selectedReturn.original_invoice_id);
        editingReturnItemsMap = new Map();
        details.forEach((detail) => {
            const itemId = Number(detail.item_id);
            if (!Number.isFinite(itemId)) return;
            const prev = editingReturnItemsMap.get(itemId);
            editingReturnItemsMap.set(itemId, {
                quantity: (prev ? toSafeNumber(prev.quantity) : 0) + toSafeNumber(detail.quantity),
                price: toSafeNumber(detail.price)
            });
        });

        setFormMode(true);

        supplierSelect.value = String(selectedReturn.supplier_id ?? '');
        if (supplierAutocomplete) supplierAutocomplete.refresh();

        invoiceSelect.disabled = false;
        await loadSupplierInvoices(selectedReturn.supplier_id);

        const invoiceValue = String(selectedReturn.original_invoice_id ?? '');
        const hasInvoiceOption = Array.from(invoiceSelect.options).some((option) => option.value === invoiceValue);
        if (!hasInvoiceOption && invoiceValue) {
            const fallbackOption = document.createElement('option');
            fallbackOption.value = invoiceValue;
            fallbackOption.textContent = formatInvoiceOptionText(
                selectedReturn.original_invoice_number || invoiceValue,
                '-',
                selectedReturn.total_amount
            );
            invoiceSelect.appendChild(fallbackOption);
        }
        invoiceSelect.value = invoiceValue;
        if (invoiceAutocomplete) invoiceAutocomplete.refresh();
        updateOriginalInvoicePreview();

        returnNumberInput.value = selectedReturn.return_number || '';
        returnDateInput.value = selectedReturn.return_date
            ? String(selectedReturn.return_date).split('T')[0]
            : new Date().toISOString().slice(0, 10);
        document.getElementById('returnNotes').value = selectedReturn.notes || '';

        await loadInvoiceItems(selectedReturn.original_invoice_id);
    } catch (error) {
        console.error('Load purchase return for edit error:', error);
        Toast.show(t('purchaseReturns.toast.loadReturnError', 'تعذر تحميل بيانات المرتجع للتعديل'), 'error');
    }
}

async function loadReturnsHistory() {
    allPurchaseReturns = toArray(await window.electronAPI.getPurchaseReturns());
    purchaseReturnsPage = 1;
    renderReturnsHistory();
}

function renderReturnsHistory() {
    const container = document.getElementById('historyContent');

    if (!allPurchaseReturns.length) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>${t('common.state.noReturns', 'لا توجد مرتجعات مسجلة')}</p>
            </div>
        `;
        return;
    }

    const totalPages = Math.ceil(allPurchaseReturns.length / purchaseReturnsPerPage);
    if (purchaseReturnsPage > totalPages) purchaseReturnsPage = totalPages;
    if (purchaseReturnsPage < 1) purchaseReturnsPage = 1;
    const startIdx = (purchaseReturnsPage - 1) * purchaseReturnsPerPage;
    const pageReturns = allPurchaseReturns.slice(startIdx, startIdx + purchaseReturnsPerPage);

    let paginationHtml = '';
    if (totalPages > 1) {
        paginationHtml = `
            <div style="display:flex;align-items:center;justify-content:center;gap:12px;padding:12px 0;">
                <button class="btn btn-sm" onclick="changePurchaseReturnsPage(${purchaseReturnsPage - 1})" ${purchaseReturnsPage === 1 ? 'disabled' : ''}>السابق</button>
                <span style="font-weight:600;">صفحة ${purchaseReturnsPage} من ${totalPages}</span>
                <button class="btn btn-sm" onclick="changePurchaseReturnsPage(${purchaseReturnsPage + 1})" ${purchaseReturnsPage === totalPages ? 'disabled' : ''}>التالي</button>
            </div>
        `;
    }

    container.innerHTML = `
        <table class="history-table">
            <thead>
                <tr>
                    <th>${t('purchaseReturns.returnNumber', 'رقم المرتجع')}</th>
                    <th>${t('purchaseReturns.originalInvoice', 'فاتورة الشراء الأصلية')}</th>
                    <th>${t('purchaseReturns.supplier', 'المورد')}</th>
                    <th>${t('purchaseReturns.returnDate', 'التاريخ')}</th>
                    <th>${t('purchaseReturns.total', 'الإجمالي')}</th>
                    <th>${t('common.labels.actions', 'إجراءات')}</th>
                </tr>
            </thead>
            <tbody>
                ${pageReturns.map((row) => `
                    <tr>
                        <td><span class="badge badge-return"><i class="fas fa-undo-alt"></i> ${row.return_number || '-'}</span></td>
                        <td>${fmt(t('purchaseReturns.invoiceLabel', 'Invoice #{number}'), { number: row.original_invoice_number || '-' })}</td>
                        <td>${row.supplier_name || '-'}</td>
                        <td>${row.return_date || '-'}</td>
                        <td style="font-weight: 700; color: #f59e0b;">${(Number(row.total_amount) || 0).toFixed(2)}</td>
                        <td>
                            <button class="btn btn-sm btn-delete" onclick="deleteReturn(${row.id})">
                                <i class="fas fa-trash"></i> ${t('common.actions.delete', 'حذف')}
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        ${paginationHtml}
    `;
}

function changePurchaseReturnsPage(newPage) {
    const totalPages = Math.ceil(allPurchaseReturns.length / purchaseReturnsPerPage);
    if (newPage < 1 || newPage > totalPages) return;
    purchaseReturnsPage = newPage;
    renderReturnsHistory();
}

async function deleteReturn(id) {
    if (!confirm(t('purchaseReturns.confirmDelete', 'هل أنت متأكد من حذف هذا المرتجع؟'))) {
        return;
    }

    try {
        const result = await window.electronAPI.deletePurchaseReturn(id);

        if (result && result.success) {
            Toast.show(t('purchaseReturns.toast.deleteSuccess', 'تم حذف المرتجع بنجاح'), 'success');
            await loadReturnsHistory();

            if (invoiceSelect.value) {
                await loadInvoiceItems(invoiceSelect.value);
            }
            return;
        }

        Toast.show((result && result.error) || t('purchaseReturns.toast.deleteError', 'حدث خطأ أثناء حذف المرتجع'), 'error');
    } catch (error) {
        console.error('Delete purchase return error:', error);
        Toast.show(t('purchaseReturns.toast.unexpectedError', 'حدث خطأ غير متوقع'), 'error');
    }
}

function updateOriginalInvoicePreview() {
    if (!originalInvoicePreviewEl || !originalInvoicePreviewTextEl || !invoiceSelect) return;

    const selectedOption = invoiceSelect.options[invoiceSelect.selectedIndex];
    const hasSelectedInvoice = Boolean(invoiceSelect.value && selectedOption);

    if (hasSelectedInvoice) {
        originalInvoicePreviewEl.classList.remove('is-empty');
        originalInvoicePreviewTextEl.textContent = (selectedOption.textContent || '').trim();
        return;
    }

    originalInvoicePreviewEl.classList.add('is-empty');
    originalInvoicePreviewTextEl.textContent = t('purchaseReturns.noInvoiceSelected', 'لم يتم اختيار فاتورة شراء أصلية بعد');
}

window.onCheckboxChange = onCheckboxChange;
window.onQtyChange = onQtyChange;
window.calculateTotal = calculateTotal;
window.saveReturn = saveReturn;
window.resetForm = resetForm;
window.deleteReturn = deleteReturn;
