const purchasesState = window.purchasesPageState.createInitialState();
const purchasesApi = window.purchasesPageApi;
const purchasesRender = window.purchasesPageRender;
const purchasesEvents = window.purchasesPageEvents;
const { t, fmt } = window.i18n?.createPageHelpers?.(() => purchasesState.ar) || { t: (k, f = '') => f, fmt: (t, v = {}) => String(t || '') };

function buildTopNavHTML() {
    if (window.navManager && typeof window.navManager.getTopNavHTML === 'function') {
        return window.navManager.getTopNavHTML(t);
    }
    return '';
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
    if (window.i18n && typeof window.i18n.loadArabicDictionary === 'function') {
        purchasesState.ar = await window.i18n.loadArabicDictionary();
    }

    purchasesRender.renderPage({ t, getNavHTML: buildTopNavHTML });
    initializeElements();

    if (purchasesState.dom.invoiceDateInput) {
        purchasesState.dom.invoiceDateInput.valueAsDate = new Date();
    }

    Promise.all([
        loadSuppliers(),
        loadItems(),
        loadInvoiceNumberSuggestions()
    ]).then(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const editId = urlParams.get('editId');
        if (editId) {
            loadInvoiceForEdit(editId);
        } else {
            initializeNewInvoice();
        }
    });
    } catch (error) {
        console.error('Initialization Error:', error);
        if (window.toast && typeof window.toast.error === 'function') {
            window.toast.error(t('alerts.initError', 'حدث خطأ أثناء تهيئة الصفحة، يرجى إعادة التحميل'));
        }
    }
});

function initializeElements() {
    window.purchasesPageState.initializeDomRefs(purchasesState);

    purchasesEvents.bindStaticEvents({
        root: purchasesState.dom.app,
        dom: purchasesState.dom,
        handlers: {
            onSupplierChange: handleSupplierChange,
            onAddRow: () => addInvoiceRow(),
            onSubmitInvoice: submitInvoice,
            onRemoveRow: removeRow
        }
    });

    purchasesEvents.bindRowsEvents({
        dom: purchasesState.dom,
        handlers: {
            onItemSelect,
            onRowInput
        }
    });

    if (purchasesState.dom.discountTypeSelect) {
        purchasesState.dom.discountTypeSelect.addEventListener('change', () => calculateInvoiceTotal());
    }

    if (purchasesState.dom.discountValueInput) {
        purchasesState.dom.discountValueInput.addEventListener('input', () => calculateInvoiceTotal());
    }

    if (purchasesState.dom.paidAmountInput) {
        purchasesState.dom.paidAmountInput.addEventListener('input', () => calculateInvoiceTotal());
    }
}

async function handleSupplierChange() {
    if (!purchasesState.dom.supplierSelect || !purchasesState.dom.invoiceItemsBody) return;

    if (purchasesState.dom.supplierSelect.value) {
        await displaySupplierBalance();
        if (purchasesState.dom.invoiceItemsBody.children.length === 0) {
            addInvoiceRow();
        }
    } else {
        const balanceDiv = document.getElementById('supplierBalance');
        if (balanceDiv) balanceDiv.style.display = 'none';
        clearSelectedItemAvailability();
    }
}

async function initializeNewInvoice() {
    purchasesState.originalInvoiceItemTotalsByItemId = {};
    const nextId = await purchasesApi.getNextInvoiceNumber();
    const invoiceNumberInput = document.getElementById('invoiceNumber');
    if (invoiceNumberInput) {
        invoiceNumberInput.value = nextId;
    }
    calculateInvoiceTotal();
}

async function loadInvoiceForEdit(id) {
    try {
        const invoice = await purchasesApi.getInvoiceWithDetails(id);
        if (!invoice) {
            alert(t('purchases.invoiceNotFound', 'الفاتورة غير موجودة'));
            return;
        }

        purchasesState.editingInvoiceId = id;
        purchasesState.originalInvoiceItemTotalsByItemId = {};
        (invoice.items || []).forEach((item) => {
            const itemId = parseInt(item.item_id, 10);
            const qty = Number(item.quantity) || 0;
            if (!Number.isFinite(itemId) || qty <= 0) return;
            purchasesState.originalInvoiceItemTotalsByItemId[itemId] = (purchasesState.originalInvoiceItemTotalsByItemId[itemId] || 0) + qty;
        });

        purchasesState.dom.supplierSelect.value = invoice.supplier_id;
        if (purchasesState.supplierAutocomplete) purchasesState.supplierAutocomplete.refresh();

        const invoiceNumberInput = document.getElementById('invoiceNumber');
        if (invoiceNumberInput) {
            invoiceNumberInput.value = invoice.invoice_number;
        }

        if (invoice.invoice_date && purchasesState.dom.invoiceDateInput) {
            purchasesState.dom.invoiceDateInput.value = invoice.invoice_date.split('T')[0];
        }

        const notesInput = document.getElementById('invoiceNotes');
        if (notesInput) notesInput.value = invoice.notes || '';

        const paymentTypeInput = document.getElementById('paymentType');
        if (paymentTypeInput) paymentTypeInput.value = invoice.payment_type || 'cash';

        const subtotalFromDetails = (invoice.items || []).reduce((sum, item) => sum + (Number(item.total_price) || 0), 0);
        const storedTotal = Number(invoice.total_amount) || 0;
        const fallbackDiscountAmount = Math.max(subtotalFromDetails - storedTotal, 0);
        const discountTypeInput = purchasesState.dom.discountTypeSelect;
        const discountValueInput = purchasesState.dom.discountValueInput;
        const paidAmountInput = purchasesState.dom.paidAmountInput;

        if (discountTypeInput) {
            discountTypeInput.value = invoice.discount_type === 'percent' ? 'percent' : 'amount';
        }

        if (discountValueInput) {
            const sourceDiscountValue = Number(invoice.discount_value);
            const valueToUse = Number.isFinite(sourceDiscountValue) ? sourceDiscountValue : fallbackDiscountAmount;
            discountValueInput.value = valueToUse.toFixed(2);
        }

        if (paidAmountInput) {
            const paid = Number(invoice.paid_amount) || 0;
            paidAmountInput.value = paid.toFixed(2);
        }

        purchasesState.dom.invoiceItemsBody.innerHTML = '';
        invoice.items.forEach((item) => addInvoiceRow(item));
        calculateInvoiceTotal();
        updateSelectedItemAvailability(purchasesState.dom.invoiceItemsBody.querySelector('tr'));

        purchasesRender.setEditModeUI(t);
    } catch (error) {
        alert(t('purchases.toast.loadError', 'حدث خطأ أثناء تحميل الفاتورة: ') + error.message);
    }
}

async function submitInvoice() {
    if (purchasesState.isSubmitting) return;
    purchasesState.isSubmitting = true;

    const saveBtn = document.querySelector('#invoiceForm .btn-success');
    if (saveBtn) {
        saveBtn.blur();
        saveBtn.disabled = true;
        saveBtn.setAttribute('disabled', 'true');
    }

    try {
        if (purchasesState.editingInvoiceId) {
            await updateInvoice();
        } else {
            await saveInvoice();
        }
    } finally {
        purchasesState.isSubmitting = false;
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.removeAttribute('disabled');
        }
    }
}

async function loadSuppliers() {
    const suppliers = await purchasesApi.getSuppliers();
    if (!purchasesState.dom.supplierSelect) return;

    purchasesState.dom.supplierSelect.innerHTML = `<option value="">${t('purchases.selectSupplier', 'اختر المورد')}</option>`;

    suppliers.forEach((supplier) => {
        const option = document.createElement('option');
        option.value = supplier.id;
        option.textContent = supplier.name;
        option.dataset.balance = supplier.balance || 0;
        purchasesState.dom.supplierSelect.appendChild(option);
    });

    if (purchasesState.supplierAutocomplete) {
        purchasesState.supplierAutocomplete.refresh();
    } else {
        purchasesState.supplierAutocomplete = new Autocomplete(purchasesState.dom.supplierSelect);
    }
}

async function loadInvoiceNumberSuggestions() {
    try {
        const invoices = await purchasesApi.getPurchaseInvoices();
        const datalist = document.getElementById('invoiceSuggestions');
        if (!datalist) return;

        datalist.innerHTML = '';
        invoices.slice(0, 30).forEach((inv) => {
            if (!inv.invoice_number) return;
            const option = document.createElement('option');
            option.value = inv.invoice_number;
            datalist.appendChild(option);
        });
    } catch (_) {
    }
}

async function loadItems() {
    purchasesState.allItems = await purchasesApi.getItems();
}

async function displaySupplierBalance() {
    const supplierId = purchasesState.dom.supplierSelect?.value;
    if (!supplierId) return;

    const selectedOption = purchasesState.dom.supplierSelect.options[purchasesState.dom.supplierSelect.selectedIndex];
    const balance = parseFloat(selectedOption?.dataset?.balance || 0);

    const balanceDiv = document.getElementById('supplierBalance');
    if (!balanceDiv) return;

    balanceDiv.className = 'customer-balance';
    if (balance > 0) {
        balanceDiv.classList.add('balance-positive');
        balanceDiv.textContent = fmt(t('purchases.balanceCurrentOwedToSupplier', 'الرصيد الحالي: له {amount} جنيه'), { amount: balance.toLocaleString() });
    } else if (balance < 0) {
        balanceDiv.classList.add('balance-negative');
        balanceDiv.textContent = fmt(t('purchases.balanceCurrentDueFromSupplier', 'الرصيد الحالي: عليه {amount} جنيه'), { amount: Math.abs(balance).toLocaleString() });
    } else {
        balanceDiv.classList.add('balance-zero');
        balanceDiv.textContent = t('purchases.balanceCurrentSettled', 'الرصيد الحالي: متزن');
    }

    balanceDiv.style.display = 'block';
}

function clearSelectedItemAvailability() {
    if (!purchasesState.dom.selectedItemAvailability) return;
    purchasesState.dom.selectedItemAvailability.classList.remove('has-overage');
    purchasesState.dom.selectedItemAvailability.textContent = '';
}

function formatQty(value) {
    const qty = Number(value);
    if (!Number.isFinite(qty)) return '0';
    if (Number.isInteger(qty)) return String(qty);
    return qty.toFixed(3).replace(/\.?0+$/, '');
}

function getAddedQuantityInDraft(itemId, excludedRow = null) {
    if (!Number.isFinite(itemId) || !purchasesState.dom.invoiceItemsBody) return 0;

    let added = 0;
    purchasesState.dom.invoiceItemsBody.querySelectorAll('tr').forEach((candidateRow) => {
        if (excludedRow && candidateRow === excludedRow) return;

        const itemSelect = candidateRow.querySelector('.item-select');
        const candidateItemId = parseInt(itemSelect?.value, 10);
        if (!Number.isFinite(candidateItemId) || candidateItemId !== itemId) return;

        const quantityInput = candidateRow.querySelector('.quantity-input');
        const qty = parseLocaleFloat(quantityInput?.value);
        if (Number.isFinite(qty) && qty > 0) {
            added += qty;
        }
    });

    return added;
}

function getEffectiveBaseAvailable(itemId) {
    const match = Number.isFinite(itemId) ? purchasesState.allItems.find((i) => i.id === itemId) : null;
    const currentStock = Number(match?.stock_quantity) || 0;
    const originalInEditedInvoice = Number(purchasesState.originalInvoiceItemTotalsByItemId?.[itemId]) || 0;
    return Math.max(currentStock - originalInEditedInvoice, 0);
}

function updateSelectedItemAvailability(row) {
    if (!purchasesState.dom.selectedItemAvailability) return;
    if (!row) {
        clearSelectedItemAvailability();
        return;
    }

    const itemSelect = row.querySelector('.item-select');
    if (!itemSelect || !itemSelect.value) {
        clearSelectedItemAvailability();
        return;
    }

    const itemId = parseInt(itemSelect.value, 10);
    const match = Number.isFinite(itemId) ? purchasesState.allItems.find((i) => i.id === itemId) : null;
    if (!match) {
        clearSelectedItemAvailability();
        return;
    }

    const baseAvailableQty = getEffectiveBaseAvailable(itemId);
    const addedByOtherRows = getAddedQuantityInDraft(itemId, row);
    const availableQty = Math.max(baseAvailableQty + addedByOtherRows, 0);

    const qtyInput = row.querySelector('.quantity-input');
    const enteredQtyRaw = qtyInput ? parseLocaleFloat(qtyInput.value) : 0;
    const enteredQty = Number.isFinite(enteredQtyRaw) && enteredQtyRaw > 0 ? enteredQtyRaw : 0;

    if (enteredQty > 0) {
        const expectedQty = availableQty + enteredQty;
        purchasesState.dom.selectedItemAvailability.textContent = `المتاح الحالي: ${formatQty(availableQty)} | المتوقع بعد الإدخال: ${formatQty(expectedQty)}`;
        return;
    }

    purchasesState.dom.selectedItemAvailability.textContent = `المتاح الحالي: ${formatQty(availableQty)}`;
}

function addInvoiceRow(existingItem = null) {
    if (!existingItem && !purchasesState.dom.supplierSelect?.value) {
        alert(t('purchases.selectSupplierFirst', 'الرجاء اختيار المورد أولاً'));
        return;
    }

    const row = purchasesRender.createInvoiceRow({
        allItems: purchasesState.allItems,
        existingItem,
        t,
        fmt
    });

    purchasesState.dom.invoiceItemsBody.appendChild(row);

    const selectElement = row.querySelector('.item-select');
    new Autocomplete(selectElement);
    if (selectElement) {
        selectElement.addEventListener('change', () => onItemSelect(selectElement));
    }
}

function removeRow(removeBtnEl) {
    const row = removeBtnEl.closest('tr');
    if (!row) return;
    row.remove();
    calculateInvoiceTotal();

    const fallbackRow = purchasesState.dom.invoiceItemsBody.querySelector('tr:last-child');
    if (fallbackRow) {
        updateSelectedItemAvailability(fallbackRow);
    } else {
        clearSelectedItemAvailability();
    }
}

function maybeAutoAddRow(row) {
    if (!row || !purchasesState.dom.invoiceItemsBody) return;
    if (row === purchasesState.dom.invoiceItemsBody.lastElementChild) {
        addInvoiceRow();
    }
}

function onItemSelect(select) {
    const row = select.closest('tr');
    const itemId = parseInt(select.value, 10);
    const match = Number.isFinite(itemId) ? purchasesState.allItems.find((i) => i.id === itemId) : null;
    const unitName = match && match.unit_name ? match.unit_name : '';
    const costPrice = match ? Number(match.cost_price || 0) : 0;

    const unitEl = row.querySelector('.unit-label');
    if (unitEl) unitEl.textContent = unitName;

    const priceInput = row.querySelector('.price-input');
    if (priceInput) {
        priceInput.value = Number.isFinite(costPrice) ? costPrice : 0;
    }

    updateSelectedItemAvailability(row);
    calculateRowTotal(select);
    maybeAutoAddRow(row);

    const qtyInput = row.querySelector('.quantity-input');
    if (qtyInput) qtyInput.focus();
}

function onRowInput(input) {
    calculateRowTotal(input);
    if (input.classList.contains('quantity-input')) {
        const row = input.closest('tr');
        maybeAutoAddRow(row);
        updateSelectedItemAvailability(row);
    }
}

function calculateRowTotal(input) {
    if (!input) return;

    const row = input.closest('tr');
    const quantity = parseLocaleFloat(row.querySelector('.quantity-input').value);
    const price = parseLocaleFloat(row.querySelector('.price-input').value);
    const total = (Number.isFinite(quantity) ? quantity : 0) * (Number.isFinite(price) ? price : 0);

    row.querySelector('.row-total').textContent = total.toFixed(2);
    calculateInvoiceTotal();
}

function normalizeNumberString(value) {
    if (value === null || value === undefined) return '';
    let s = String(value).trim();
    if (s === '') return '';

    const arabicIndic = '٠١٢٣٤٥٦٧٨٩';
    const easternArabicIndic = '۰۱۲۳۴۵۶۷۸۹';

    s = s.replace(/[٠-٩]/g, (d) => String(arabicIndic.indexOf(d)));
    s = s.replace(/[۰-۹]/g, (d) => String(easternArabicIndic.indexOf(d)));
    s = s.replace(/[٬،]/g, '.');
    s = s.replace(/\s+/g, '');
    return s;
}

function parseLocaleFloat(value) {
    const normalized = normalizeNumberString(value);
    const num = parseFloat(normalized);
    return Number.isFinite(num) ? num : NaN;
}

function roundMoney(value) {
    const n = Number(value) || 0;
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

function getInvoiceFinancials(subtotal) {
    const safeSubtotal = Number.isFinite(subtotal) ? Math.max(subtotal, 0) : 0;
    const discountType = purchasesState.dom.discountTypeSelect?.value === 'percent' ? 'percent' : 'amount';

    const discountValueRaw = parseLocaleFloat(purchasesState.dom.discountValueInput?.value || '0');
    const discountValue = Number.isFinite(discountValueRaw) && discountValueRaw > 0 ? discountValueRaw : 0;

    let discountAmount = discountType === 'percent'
        ? safeSubtotal * (discountValue / 100)
        : discountValue;

    if (!Number.isFinite(discountAmount) || discountAmount < 0) discountAmount = 0;
    discountAmount = Math.min(discountAmount, safeSubtotal);

    const netTotal = Math.max(safeSubtotal - discountAmount, 0);

    const paidAmountRaw = parseLocaleFloat(purchasesState.dom.paidAmountInput?.value || '0');
    const paidAmount = Number.isFinite(paidAmountRaw) && paidAmountRaw > 0 ? paidAmountRaw : 0;
    const supplierRemaining = netTotal - paidAmount;

    return {
        discountType,
        discountValue: roundMoney(discountValue),
        discountAmount: roundMoney(discountAmount),
        netTotal: roundMoney(netTotal),
        paidAmount: roundMoney(paidAmount),
        supplierRemaining: roundMoney(supplierRemaining)
    };
}

function calculateInvoiceTotal() {
    let subtotal = 0;
    purchasesState.dom.invoiceItemsBody.querySelectorAll('tr').forEach((row) => {
        const rowTotal = parseFloat(row.querySelector('.row-total').textContent) || 0;
        subtotal += rowTotal;
    });

    const financials = getInvoiceFinancials(subtotal);

    if (purchasesState.dom.invoiceSubtotalSpan) {
        purchasesState.dom.invoiceSubtotalSpan.textContent = subtotal.toFixed(2);
    }

    if (purchasesState.dom.invoiceDiscountAmountSpan) {
        purchasesState.dom.invoiceDiscountAmountSpan.textContent = financials.discountAmount.toFixed(2);
    }

    purchasesState.dom.invoiceTotalSpan.textContent = financials.netTotal.toFixed(2);

    if (purchasesState.dom.invoicePaidDisplaySpan) {
        purchasesState.dom.invoicePaidDisplaySpan.textContent = financials.paidAmount.toFixed(2);
    }

    if (purchasesState.dom.invoiceRemainingSpan) {
        if (financials.supplierRemaining > 0) {
            purchasesState.dom.invoiceRemainingSpan.textContent = fmt(t('purchases.supplierDuePositive', 'له {amount}'), { amount: financials.supplierRemaining.toFixed(2) });
            purchasesState.dom.invoiceRemainingSpan.className = 'customer-due-value due-positive';
        } else if (financials.supplierRemaining < 0) {
            purchasesState.dom.invoiceRemainingSpan.textContent = fmt(t('purchases.supplierDueNegative', 'عليه {amount}'), { amount: Math.abs(financials.supplierRemaining).toFixed(2) });
            purchasesState.dom.invoiceRemainingSpan.className = 'customer-due-value due-negative';
        } else {
            purchasesState.dom.invoiceRemainingSpan.textContent = '0.00';
            purchasesState.dom.invoiceRemainingSpan.className = 'customer-due-value';
        }
    }
}

function collectInvoiceItemsFromForm() {
    const items = [];
    let isValid = true;

    purchasesState.dom.invoiceItemsBody.querySelectorAll('tr').forEach((row) => {
        const item_id = parseInt(row.querySelector('.item-select').value, 10);
        const quantity = parseLocaleFloat(row.querySelector('.quantity-input').value);
        const cost_price = parseLocaleFloat(row.querySelector('.price-input').value);

        const quantityOk = Number.isFinite(quantity) && quantity > 0;
        const priceOk = Number.isFinite(cost_price) && cost_price >= 0;
        const itemOk = Number.isFinite(item_id) && item_id > 0;

        if (!itemOk && !quantityOk && (!priceOk || cost_price === 0)) {
            return;
        }

        if (!itemOk || !quantityOk || !priceOk) {
            isValid = false;
            return;
        }

        items.push({
            item_id,
            quantity,
            cost_price,
            total_price: quantity * cost_price
        });
    });

    return { items, isValid: isValid && items.length > 0 };
}

function buildInvoicePayload(financials) {
    return {
        supplier_id: purchasesState.dom.supplierSelect.value,
        invoice_number: document.getElementById('invoiceNumber').value,
        invoice_date: purchasesState.dom.invoiceDateInput.value || new Date().toISOString().slice(0, 10),
        payment_type: document.getElementById('paymentType').value,
        notes: document.getElementById('invoiceNotes').value,
        discount_type: financials.discountType,
        discount_value: financials.discountValue,
        paid_amount: financials.paidAmount,
        total_amount: financials.netTotal
    };
}

async function saveInvoice() {
    if (!purchasesState.dom.supplierSelect.value) {
        alert(t('purchases.toast.selectSupplier', 'الرجاء اختيار المورد'));
        return;
    }

    const { items, isValid } = collectInvoiceItemsFromForm();
    if (!isValid) {
        alert(t('purchases.noItemsData', 'الرجاء إدخال جميع بيانات الأصناف بشكل صحيح (يجب إضافة صنف واحد على الأقل)'));
        return;
    }

    const financials = getInvoiceFinancials(parseFloat(purchasesState.dom.invoiceSubtotalSpan?.textContent || '0') || 0);

    const invoiceData = {
        ...buildInvoicePayload(financials),
        items
    };

    try {
        const result = await purchasesApi.savePurchaseInvoice(invoiceData);
        if (result.success) {
            alert(t('purchases.toast.saveSuccess', 'تم حفظ الفاتورة بنجاح'));
            await resetForm();
        } else {
            alert(t('purchases.toast.saveError', 'حدث خطأ أثناء الحفظ: ') + result.error);
        }
    } catch (error) {
        alert(t('purchases.toast.unexpectedError', 'حدث خطأ غير متوقع: ') + error.message);
    }
}

async function updateInvoice() {
    if (!purchasesState.dom.supplierSelect.value) {
        alert(t('purchases.toast.selectSupplier', 'الرجاء اختيار المورد'));
        return;
    }

    const { items, isValid } = collectInvoiceItemsFromForm();
    if (!isValid) {
        alert(t('purchases.noItemsData', 'الرجاء إدخال جميع بيانات الأصناف بشكل صحيح (يجب إضافة صنف واحد على الأقل)'));
        return;
    }

    const financials = getInvoiceFinancials(parseFloat(purchasesState.dom.invoiceSubtotalSpan?.textContent || '0') || 0);

    const invoiceData = {
        ...buildInvoicePayload(financials),
        id: purchasesState.editingInvoiceId,
        items
    };

    try {
        const result = await purchasesApi.updatePurchaseInvoice(invoiceData);
        if (result.success) {
            alert(t('purchases.toast.updateSuccess', 'تم تحديث الفاتورة بنجاح'));
            await resetForm();
        } else {
            alert(t('purchases.toast.updateError', 'حدث خطأ أثناء التحديث: ') + result.error);
        }
    } catch (error) {
        alert(t('purchases.toast.unexpectedError', 'حدث خطأ غير متوقع: ') + error.message);
    }
}

async function resetForm() {
    purchasesState.dom.supplierSelect.value = '';
    if (purchasesState.supplierAutocomplete) purchasesState.supplierAutocomplete.refresh();

    const balanceDiv = document.getElementById('supplierBalance');
    if (balanceDiv) balanceDiv.style.display = 'none';

    const invoiceNumberInput = document.getElementById('invoiceNumber');
    const notesInput = document.getElementById('invoiceNotes');
    const paymentTypeInput = document.getElementById('paymentType');

    if (invoiceNumberInput) invoiceNumberInput.value = '';
    if (notesInput) notesInput.value = '';
    if (paymentTypeInput) paymentTypeInput.value = 'credit';
    if (purchasesState.dom.discountTypeSelect) purchasesState.dom.discountTypeSelect.value = 'amount';
    if (purchasesState.dom.discountValueInput) purchasesState.dom.discountValueInput.value = '0';
    if (purchasesState.dom.paidAmountInput) purchasesState.dom.paidAmountInput.value = '0';

    purchasesState.dom.invoiceItemsBody.innerHTML = '';
    if (purchasesState.dom.invoiceSubtotalSpan) purchasesState.dom.invoiceSubtotalSpan.textContent = '0.00';
    if (purchasesState.dom.invoiceDiscountAmountSpan) purchasesState.dom.invoiceDiscountAmountSpan.textContent = '0.00';
    purchasesState.dom.invoiceTotalSpan.textContent = '0.00';
    if (purchasesState.dom.invoicePaidDisplaySpan) purchasesState.dom.invoicePaidDisplaySpan.textContent = '0.00';
    if (purchasesState.dom.invoiceRemainingSpan) {
        purchasesState.dom.invoiceRemainingSpan.textContent = '0.00';
        purchasesState.dom.invoiceRemainingSpan.className = 'customer-due-value';
    }
    clearSelectedItemAvailability();

    purchasesState.editingInvoiceId = null;
    purchasesState.originalInvoiceItemTotalsByItemId = {};
    purchasesRender.setCreateModeUI(t);

    window.history.replaceState({}, document.title, window.location.pathname);
    await loadItems();
    await initializeNewInvoice();
}
