const purchasesState = window.purchasesPageState.createInitialState();
const purchasesApi = window.purchasesPageApi;
const purchasesRender = window.purchasesPageRender;
const purchasesEvents = window.purchasesPageEvents;
const pageI18n = window.i18n?.createPageHelpers ? window.i18n.createPageHelpers(() => purchasesState.ar) : null;

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
        purchasesState.ar = await window.i18n.loadArabicDictionary();
    }

    purchasesRender.renderPage({ t, getNavHTML });
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
}

function handleSupplierChange() {
    if (!purchasesState.dom.supplierSelect || !purchasesState.dom.invoiceItemsBody) return;

    if (purchasesState.dom.supplierSelect.value && purchasesState.dom.invoiceItemsBody.children.length === 0) {
        addInvoiceRow();
    }
}

async function initializeNewInvoice() {
    const nextId = await purchasesApi.getNextInvoiceNumber();
    const invoiceNumberInput = document.getElementById('invoiceNumber');
    if (invoiceNumberInput) {
        invoiceNumberInput.value = nextId;
    }
}

async function loadInvoiceForEdit(id) {
    try {
        const invoice = await purchasesApi.getInvoiceWithDetails(id);
        if (!invoice) {
            alert(t('purchases.invoiceNotFound', 'الفاتورة غير موجودة'));
            return;
        }

        purchasesState.editingInvoiceId = id;

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

        purchasesState.dom.invoiceItemsBody.innerHTML = '';
        invoice.items.forEach((item) => {
            addInvoiceRow(item);
        });
        calculateInvoiceTotal();

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
    const autocomplete = new Autocomplete(selectElement);

    const autoAddHandler = () => {
        maybeAutoAddRow(row);
    };

    const nameInput = autocomplete.input;
    const qtyInput = row.querySelector('.quantity-input');

    if (nameInput) {
        nameInput.addEventListener('input', autoAddHandler);
    }
    if (qtyInput) {
        qtyInput.addEventListener('input', autoAddHandler);
    }
    if (selectElement) {
        selectElement.addEventListener('change', autoAddHandler);
    }
}

function removeRow(removeBtnEl) {
    const row = removeBtnEl.closest('tr');
    if (!row) return;
    row.remove();
    calculateInvoiceTotal();
}

function maybeAutoAddRow(row) {
    if (!row || !purchasesState.dom.invoiceItemsBody) return;
    if (row === purchasesState.dom.invoiceItemsBody.lastElementChild) {
        addInvoiceRow();
    }
}

function onItemSelect(select) {
    const row = select.closest('tr');
    const selectedOption = select.options[select.selectedIndex];
    const price = selectedOption?.dataset?.price || 0;

    const priceInput = row.querySelector('.price-input');
    if (priceInput) {
        priceInput.value = price;
    }

    calculateRowTotal(row.querySelector('.quantity-input'));
    maybeAutoAddRow(row);
}

function onRowInput(input) {
    calculateRowTotal(input);
}

function calculateRowTotal(input) {
    if (!input) return;

    const row = input.closest('tr');
    const quantity = parseFloat(row.querySelector('.quantity-input').value) || 0;
    const price = parseFloat(row.querySelector('.price-input').value) || 0;
    const total = quantity * price;

    row.querySelector('.row-total').textContent = total.toFixed(2);
    calculateInvoiceTotal();
}

function calculateInvoiceTotal() {
    let total = 0;
    purchasesState.dom.invoiceItemsBody.querySelectorAll('.row-total').forEach((span) => {
        total += parseFloat(span.textContent) || 0;
    });

    purchasesState.dom.invoiceTotalSpan.textContent = total.toFixed(2);

    const finalTotal = document.getElementById('finalTotal');
    if (finalTotal) {
        finalTotal.textContent = total.toFixed(2);
    }
}

function collectInvoiceItemsFromForm() {
    const items = [];
    let isValid = true;

    purchasesState.dom.invoiceItemsBody.querySelectorAll('tr').forEach((row) => {
        const itemId = row.querySelector('.item-select').value;
        const quantity = parseFloat(row.querySelector('.quantity-input').value);
        const price = parseFloat(row.querySelector('.price-input').value);

        const isItemEmpty = !itemId;
        const isQuantityEmpty = Number.isNaN(quantity) || quantity === 0;
        const isPriceEmpty = Number.isNaN(price) || price === 0;

        if (isItemEmpty && isQuantityEmpty && isPriceEmpty) {
            return;
        }

        if (!itemId || !quantity || Number.isNaN(price)) {
            isValid = false;
            return;
        }

        items.push({
            item_id: itemId,
            quantity,
            cost_price: price,
            total_price: quantity * price
        });
    });

    return { items, isValid: isValid && items.length > 0 };
}

function buildInvoicePayload() {
    return {
        supplier_id: purchasesState.dom.supplierSelect.value,
        invoice_number: document.getElementById('invoiceNumber').value,
        invoice_date: purchasesState.dom.invoiceDateInput.value,
        payment_type: document.getElementById('paymentType').value,
        notes: document.getElementById('invoiceNotes').value,
        total_amount: parseFloat(purchasesState.dom.invoiceTotalSpan.textContent)
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

    const invoiceData = {
        ...buildInvoicePayload(),
        items
    };

    try {
        const result = await purchasesApi.savePurchaseInvoice(invoiceData);
        if (result.success) {
            alert(t('purchases.toast.saveSuccess', 'تم حفظ الفاتورة بنجاح'));
            window.location.reload();
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

    const invoiceData = {
        ...buildInvoicePayload(),
        id: purchasesState.editingInvoiceId,
        items
    };

    try {
        const result = await purchasesApi.updatePurchaseInvoice(invoiceData);
        if (result.success) {
            alert(t('purchases.toast.updateSuccess', 'تم تحديث الفاتورة بنجاح'));
            window.location.href = 'index.html';
        } else {
            alert(t('purchases.toast.updateError', 'حدث خطأ أثناء التحديث: ') + result.error);
        }
    } catch (error) {
        alert(t('purchases.toast.unexpectedError', 'حدث خطأ غير متوقع: ') + error.message);
    }
}
