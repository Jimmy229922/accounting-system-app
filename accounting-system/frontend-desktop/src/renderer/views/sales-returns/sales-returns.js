let customerSelect;
let invoiceSelect;
let returnDateInput;
let returnNumberInput;
let customerAutocomplete = null;
let invoiceAutocomplete = null;
let currentInvoiceItems = [];
let isSubmitting = false;
let editingReturnId = null;
let editingOriginalInvoiceId = null;
let editingReturnItemsMap = new Map();
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

document.addEventListener('DOMContentLoaded', async () => {
    if (window.i18n && typeof window.i18n.loadArabicDictionary === 'function') {
        ar = await window.i18n.loadArabicDictionary();
    }

    renderPage();
    initializeElements();
    await Promise.all([loadCustomers(), loadReturnsHistory()]);

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
                    <a href="#" class="active">${t('common.nav.sales', 'Sales')}</a>
                    <div class="dropdown-content">
                        <a href="../sales/index.html">${t('common.nav.salesInvoice', 'Sales Invoice')}</a>
                        <a href="../sales-returns/index.html" class="active">${t('common.nav.salesReturns', 'Sales Returns')}</a>
                    </div>
                </li>
                <li class="dropdown">
                    <a href="#">${t('common.nav.purchases', 'Purchases')}</a>
                    <div class="dropdown-content">
                        <a href="../purchases/index.html">${t('common.nav.purchaseInvoice', 'Purchase Invoice')}</a>
                        <a href="../purchase-returns/index.html">${t('common.nav.purchaseReturns', 'Purchase Returns')}</a>
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
    document.title = t('salesReturns.title', 'Sales Returns');

    const app = document.getElementById('app');
    app.innerHTML = `
        ${getNavHTML()}

        <div class="content">
            <div class="page-header">
                <div class="page-title">
                    <i class="fas fa-undo-alt"></i>
                    ${t('salesReturns.title', 'Sales Returns')}
                </div>
            </div>

            <div class="return-form-container">
                <h2 class="form-title">
                    <i class="fas fa-file-invoice"></i>
                    ${t('salesReturns.newReturnTitle', 'New Sales Return')}
                </h2>

                <div class="form-grid">
                    <div class="form-group">
                        <label>${t('salesReturns.customer', 'Customer')}</label>
                        <select id="customerSelect" class="form-control">
                            <option value="">${t('common.actions.selectCustomer', 'Select Customer')}</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>${t('salesReturns.originalInvoice', 'Original Invoice')}</label>
                        <select id="invoiceSelect" class="form-control" disabled>
                            <option value="">${t('common.actions.selectInvoice', 'Select Invoice')}</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>${t('salesReturns.returnNumber', 'Return Number')}</label>
                        <input type="text" id="returnNumber" class="form-control" placeholder="${t('common.actions.auto', 'Auto')}" readonly style="background: var(--bg-color); cursor: not-allowed;">
                    </div>
                    <div class="form-group">
                        <label>${t('salesReturns.returnDate', 'Return Date')}</label>
                        <input type="date" id="returnDate" class="form-control">
                    </div>
                </div>

                <div id="itemsSection" class="items-section" style="display: none;">
                    <table class="items-table">
                        <thead>
                            <tr>
                                <th style="width: 5%;">${t('salesReturns.returnItem', 'Return')}</th>
                                <th style="width: 30%;">${t('salesReturns.item', 'Item')}</th>
                                <th style="width: 10%;">${t('salesReturns.unit', 'Unit')}</th>
                                <th style="width: 12%;">${t('salesReturns.soldQty', 'Sold Qty')}</th>
                                <th style="width: 12%;">${t('salesReturns.returnedQty', 'Already Returned')}</th>
                                <th style="width: 12%;">${t('salesReturns.returnQty', 'Return Qty')}</th>
                                <th style="width: 12%;">${t('salesReturns.price', 'Price')}</th>
                                <th style="width: 12%;">${t('salesReturns.total', 'Total')}</th>
                            </tr>
                        </thead>
                        <tbody id="itemsBody"></tbody>
                    </table>
                </div>

                <div class="notes-section" style="margin-bottom: 15px;">
                    <div class="form-group">
                        <label>${t('salesReturns.notes', 'Notes')}</label>
                        <textarea id="returnNotes" rows="2" placeholder="${t('salesReturns.notesPlaceholder', 'Optional notes...')}"></textarea>
                    </div>
                </div>

                <div class="form-footer">
                    <div class="total-section">
                        <span>${t('salesReturns.returnTotal', 'Return Total:')}</span>
                        <span class="total-value" id="returnTotal">0.00</span>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button class="btn btn-secondary" onclick="resetForm()">
                            <i class="fas fa-eraser"></i> ${t('common.actions.clear', 'Clear')}
                        </button>
                        <button class="btn btn-danger" id="saveBtn" onclick="saveReturn()" disabled>
                            <i class="fas fa-save"></i> ${t('salesReturns.saveReturn', 'Save Return')}
                        </button>
                    </div>
                </div>
            </div>

            <div class="history-card">
                <div class="history-header">
                    <h3><i class="fas fa-history"></i> ${t('salesReturns.historyTitle', 'Returns History')}</h3>
                </div>
                <div id="historyContent">
                    <div class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <p>${t('common.state.noReturns', 'No returns recorded')}</p>
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
        ? t('salesReturns.editReturnTitle', 'Edit Sales Return')
        : t('salesReturns.newReturnTitle', 'New Sales Return');
    const saveText = isEditing
        ? t('salesReturns.updateReturn', 'Update Return')
        : t('salesReturns.saveReturn', 'Save Return');

    if (formTitle) {
        formTitle.innerHTML = `<i class="fas fa-file-invoice"></i> ${titleText}`;
    }

    if (saveBtn) {
        saveBtn.innerHTML = `<i class="fas fa-save"></i> ${saveText}`;
    }
}

function initializeElements() {
    customerSelect = document.getElementById('customerSelect');
    invoiceSelect = document.getElementById('invoiceSelect');
    returnDateInput = document.getElementById('returnDate');
    returnNumberInput = document.getElementById('returnNumber');

    returnDateInput.valueAsDate = new Date();
    loadNextReturnNumber();

    customerSelect.addEventListener('change', async () => {
        const customerId = customerSelect.value;
        if (customerId) {
            if (editingReturnId) {
                editingOriginalInvoiceId = null;
                editingReturnItemsMap = new Map();
            }

            invoiceSelect.disabled = false;
            await loadCustomerInvoices(customerId);
            return;
        }

        invoiceSelect.disabled = true;
        invoiceSelect.innerHTML = `<option value="">${t('common.actions.selectInvoice', 'Select Invoice')}</option>`;
        if (invoiceAutocomplete) invoiceAutocomplete.refresh();
        hideItemsSection();
    });

    invoiceSelect.addEventListener('change', async () => {
        const invoiceId = invoiceSelect.value;
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
    const next = await window.electronAPI.getNextInvoiceNumber('sales_return');
    returnNumberInput.value = `MR-${String(next).padStart(4, '0')}`;
}

async function loadCustomers() {
    const customers = toArray(await window.electronAPI.getCustomers());
    const filtered = customers.filter((c) => c.type === 'customer' || c.type === 'both');

    customerSelect.innerHTML = `<option value="">${t('common.actions.selectCustomer', 'Select Customer')}</option>`;
    filtered.forEach((customer) => {
        const option = document.createElement('option');
        option.value = customer.id;
        option.textContent = customer.name;
        customerSelect.appendChild(option);
    });

    if (customerAutocomplete) {
        customerAutocomplete.refresh();
    } else {
        customerAutocomplete = new Autocomplete(customerSelect);
    }
}

async function loadCustomerInvoices(customerId) {
    const invoices = toArray(await window.electronAPI.getCustomerSalesInvoices(customerId));

    invoiceSelect.innerHTML = `<option value="">${t('common.actions.selectInvoice', 'Select Invoice')}</option>`;
    invoices.forEach((invoice) => {
        const option = document.createElement('option');
        option.value = invoice.id;
        option.textContent = fmt(t('salesReturns.invoiceOption', 'Invoice #{number} - {date} - {total}'), {
            number: invoice.invoice_number ?? '-',
            date: invoice.invoice_date ?? '-',
            total: `${(Number(invoice.total_amount) || 0).toFixed(2)} ${t('common.currency.egp', 'EGP')}`
        });
        invoiceSelect.appendChild(option);
    });

    if (invoiceAutocomplete) {
        invoiceAutocomplete.refresh();
    } else {
        invoiceAutocomplete = new Autocomplete(invoiceSelect);
    }
}

async function loadInvoiceItems(invoiceId) {
    const result = await window.electronAPI.getInvoiceItemsForReturn(invoiceId, 'sales');
    if (!result || !result.success) {
        Toast.show((result && result.error) || t('salesReturns.toast.loadItemsError', 'Failed to load invoice items'), 'error');
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
                    value="${toSafeNumber(item.sale_price)}" step="any" disabled onchange="calculateTotal()" oninput="calculateTotal()"
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
        const customerId = customerSelect.value;
        const invoiceId = invoiceSelect.value;
        const returnNumber = returnNumberInput.value;
        const returnDate = returnDateInput.value;
        const notes = document.getElementById('returnNotes').value;

        if (!customerId || !invoiceId) {
            Toast.show(t('salesReturns.toast.selectCustomerInvoice', 'Please select customer and invoice'), 'warning');
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
            Toast.show(t('salesReturns.toast.selectAtLeastOneItem', 'Select at least one item for return'), 'warning');
            return;
        }

        const payload = {
            original_invoice_id: Number.parseInt(invoiceId, 10),
            customer_id: Number.parseInt(customerId, 10),
            return_number: returnNumber,
            return_date: returnDate,
            notes,
            items
        };

        let result;
        if (editingReturnId) {
            result = await window.electronAPI.updateSalesReturn({
                id: editingReturnId,
                ...payload
            });
        } else {
            result = await window.electronAPI.saveSalesReturn(payload);
        }

        if (result && result.success) {
            Toast.show(
                editingReturnId
                    ? t('salesReturns.toast.updateSuccess', 'Return updated successfully')
                    : t('salesReturns.toast.saveSuccess', 'Return saved successfully'),
                'success'
            );
            await resetForm();
            await loadReturnsHistory();
        } else {
            const errorText = editingReturnId
                ? t('salesReturns.toast.updateError', 'Failed to update return')
                : t('salesReturns.toast.saveError', 'Failed to save return');
            Toast.show((result && result.error) || errorText, 'error');
        }
    } catch (error) {
        console.error('Save sales return error:', error);
        if (editingReturnId && String(error?.message || '').includes("No handler registered for 'update-sales-return'")) {
            Toast.show(
                t(
                    'salesReturns.toast.restartRequired',
                    'تم تحديث جزء من التطبيق أثناء التشغيل. أغلق البرنامج وافتحه مرة أخرى ثم أعد المحاولة.'
                ),
                'warning'
            );
            return;
        }
        Toast.show(t('salesReturns.toast.unexpectedError', 'Unexpected error'), 'error');
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

    customerSelect.value = '';
    if (customerAutocomplete) customerAutocomplete.refresh();

    invoiceSelect.innerHTML = `<option value="">${t('common.actions.selectInvoice', 'Select Invoice')}</option>`;
    invoiceSelect.disabled = true;
    if (invoiceAutocomplete) invoiceAutocomplete.refresh();

    document.getElementById('returnNotes').value = '';
    hideItemsSection();
    await loadNextReturnNumber();
    returnDateInput.valueAsDate = new Date();
}

async function loadReturnForEdit(id) {
    const returnId = Number.parseInt(id, 10);
    if (!Number.isFinite(returnId) || returnId <= 0) {
        Toast.show(t('salesReturns.toast.invalidReturnId', 'Invalid return ID'), 'warning');
        clearEditQueryFromUrl();
        return;
    }

    try {
        const returns = toArray(await window.electronAPI.getSalesReturns());
        const selectedReturn = returns.find((row) => Number(row.id) === returnId);
        if (!selectedReturn) {
            Toast.show(t('salesReturns.toast.returnNotFound', 'Return not found'), 'warning');
            clearEditQueryFromUrl();
            return;
        }

        const details = toArray(await window.electronAPI.getSalesReturnDetails(returnId));
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

        customerSelect.value = String(selectedReturn.customer_id ?? '');
        if (customerAutocomplete) customerAutocomplete.refresh();

        invoiceSelect.disabled = false;
        await loadCustomerInvoices(selectedReturn.customer_id);

        const invoiceValue = String(selectedReturn.original_invoice_id ?? '');
        const hasInvoiceOption = Array.from(invoiceSelect.options).some((option) => option.value === invoiceValue);
        if (!hasInvoiceOption && invoiceValue) {
            const fallbackOption = document.createElement('option');
            fallbackOption.value = invoiceValue;
            fallbackOption.textContent = fmt(
                t('salesReturns.invoiceOption', 'Invoice #{number} - {date} - {total}'),
                {
                    number: selectedReturn.original_invoice_number || invoiceValue,
                    date: '-',
                    total: `${(Number(selectedReturn.total_amount) || 0).toFixed(2)} ${t('common.currency.egp', 'EGP')}`
                }
            );
            invoiceSelect.appendChild(fallbackOption);
        }
        invoiceSelect.value = invoiceValue;
        if (invoiceAutocomplete) invoiceAutocomplete.refresh();

        returnNumberInput.value = selectedReturn.return_number || '';
        returnDateInput.value = selectedReturn.return_date
            ? String(selectedReturn.return_date).split('T')[0]
            : new Date().toISOString().slice(0, 10);
        document.getElementById('returnNotes').value = selectedReturn.notes || '';

        await loadInvoiceItems(selectedReturn.original_invoice_id);
    } catch (error) {
        console.error('Load sales return for edit error:', error);
        Toast.show(t('salesReturns.toast.loadReturnError', 'Failed to load return data for editing'), 'error');
    }
}

async function loadReturnsHistory() {
    const returns = toArray(await window.electronAPI.getSalesReturns());
    const container = document.getElementById('historyContent');

    if (!returns.length) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>${t('common.state.noReturns', 'No returns recorded')}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <table class="history-table">
            <thead>
                <tr>
                    <th>${t('salesReturns.returnNumber', 'Return Number')}</th>
                    <th>${t('salesReturns.originalInvoice', 'Original Invoice')}</th>
                    <th>${t('salesReturns.customer', 'Customer')}</th>
                    <th>${t('salesReturns.returnDate', 'Date')}</th>
                    <th>${t('salesReturns.total', 'Total')}</th>
                    <th>${t('common.labels.actions', 'Actions')}</th>
                </tr>
            </thead>
            <tbody>
                ${returns.map((row) => `
                    <tr>
                        <td><span class="badge badge-return"><i class="fas fa-undo-alt"></i> ${row.return_number || '-'}</span></td>
                        <td>${fmt(t('salesReturns.invoiceLabel', 'Invoice #{number}'), { number: row.original_invoice_number || '-' })}</td>
                        <td>${row.customer_name || '-'}</td>
                        <td>${row.return_date || '-'}</td>
                        <td style="font-weight: 700; color: #ef4444;">${(Number(row.total_amount) || 0).toFixed(2)}</td>
                        <td>
                            <button class="btn btn-sm btn-delete" onclick="deleteReturn(${row.id})">
                                <i class="fas fa-trash"></i> ${t('common.actions.delete', 'Delete')}
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function deleteReturn(id) {
    if (!confirm(t('salesReturns.confirmDelete', 'Are you sure you want to delete this return?'))) {
        return;
    }

    try {
        const result = await window.electronAPI.deleteSalesReturn(id);

        if (result && result.success) {
            Toast.show(t('salesReturns.toast.deleteSuccess', 'Return deleted successfully'), 'success');
            await loadReturnsHistory();

            if (invoiceSelect.value) {
                await loadInvoiceItems(invoiceSelect.value);
            }
            return;
        }

        Toast.show((result && result.error) || t('salesReturns.toast.deleteError', 'Failed to delete return'), 'error');
    } catch (error) {
        console.error('Delete sales return error:', error);
        Toast.show(t('salesReturns.toast.unexpectedError', 'Unexpected error'), 'error');
    }
}

window.onCheckboxChange = onCheckboxChange;
window.onQtyChange = onQtyChange;
window.calculateTotal = calculateTotal;
window.saveReturn = saveReturn;
window.resetForm = resetForm;
window.deleteReturn = deleteReturn;
