const salesState = window.salesPageState.createInitialState();
const salesApi = window.salesPageApi;
const salesRender = window.salesPageRender;
const salesEvents = window.salesPageEvents;
const pageI18n = window.i18n?.createPageHelpers ? window.i18n.createPageHelpers(() => salesState.ar) : null;

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
    try {
    if (window.i18n && typeof window.i18n.loadArabicDictionary === 'function') {
        salesState.ar = await window.i18n.loadArabicDictionary();
    }

    salesRender.renderPage({ t, getNavHTML });
    initializeElements();

    if (salesState.dom.invoiceDateInput) {
        salesState.dom.invoiceDateInput.valueAsDate = new Date();
    }

    Promise.all([loadCustomers(), loadItems(), loadInvoiceNumberSuggestions()]).then(() => {
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
    window.salesPageState.initializeDomRefs(salesState);

    salesEvents.bindStaticEvents({
        root: salesState.dom.app,
        dom: salesState.dom,
        handlers: {
            onCustomerChange: handleCustomerChange,
            onAddRow: () => addInvoiceRow(),
            onSubmitInvoice: submitInvoice,
            onRemoveRow: removeRow
        }
    });

    salesEvents.bindRowsEvents({
        dom: salesState.dom,
        handlers: {
            onItemSelect,
            onRowInput
        }
    });
}

async function handleCustomerChange() {
    if (!salesState.dom.customerSelect) return;

    if (salesState.dom.customerSelect.value) {
        await displayCustomerBalance();
        if (salesState.dom.invoiceItemsBody.children.length === 0) {
            addInvoiceRow();
        }
    } else {
        const balanceDiv = document.getElementById('customerBalance');
        if (balanceDiv) balanceDiv.style.display = 'none';
    }
}

async function initializeNewInvoice() {
    const nextId = await salesApi.getNextInvoiceNumber();
    const invoiceNumberInput = document.getElementById('invoiceNumber');
    if (invoiceNumberInput) {
        invoiceNumberInput.value = nextId;
    }
}

async function loadInvoiceForEdit(id) {
    try {
        const invoice = await salesApi.getInvoiceWithDetails(id);
        if (!invoice) {
            alert(t('sales.invoiceNotFound', 'الفاتورة غير موجودة'));
            return;
        }

        salesState.editingInvoiceId = id;

        salesState.dom.customerSelect.value = invoice.customer_id;
        if (salesState.customerAutocomplete) salesState.customerAutocomplete.refresh();

        const invoiceNumberInput = document.getElementById('invoiceNumber');
        if (invoiceNumberInput) {
            invoiceNumberInput.value = invoice.invoice_number;
        }

        if (invoice.invoice_date) {
            salesState.dom.invoiceDateInput.value = invoice.invoice_date.split('T')[0];
        }

        const notesInput = document.getElementById('invoiceNotes');
        if (notesInput) notesInput.value = invoice.notes || '';

        const paymentTypeInput = document.getElementById('paymentType');
        if (paymentTypeInput) paymentTypeInput.value = invoice.payment_type || 'cash';

        salesState.dom.invoiceItemsBody.innerHTML = '';
        invoice.items.forEach((item) => addInvoiceRow(item));
        calculateInvoiceTotal();

        salesRender.setEditModeUI(t);
    } catch (error) {
        alert(t('sales.toast.unexpectedError', 'حدث خطأ غير متوقع') + ': ' + error.message);
    }
}

async function submitInvoice() {
    if (salesState.isSubmitting) return;
    salesState.isSubmitting = true;

    const saveBtn = document.querySelector('#invoiceForm .btn-success');
    if (saveBtn) {
        saveBtn.blur();
        saveBtn.disabled = true;
        saveBtn.setAttribute('disabled', 'true');
    }

    try {
        if (salesState.editingInvoiceId) {
            await updateInvoice();
        } else {
            await saveInvoice();
        }
    } finally {
        salesState.isSubmitting = false;
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.removeAttribute('disabled');
        }
    }
}

async function loadCustomers() {
    const customers = await salesApi.getCustomers();
    if (!salesState.dom.customerSelect) return;

    salesState.dom.customerSelect.innerHTML = `<option value="">${t('sales.selectCustomer', 'اختر العميل')}</option>`;

    customers.forEach((customer) => {
        const option = document.createElement('option');
        option.value = customer.id;
        option.textContent = customer.name;
        option.dataset.balance = customer.balance || 0;
        salesState.dom.customerSelect.appendChild(option);
    });

    if (salesState.customerAutocomplete) {
        salesState.customerAutocomplete.refresh();
    } else {
        salesState.customerAutocomplete = new Autocomplete(salesState.dom.customerSelect);
    }
}

async function loadInvoiceNumberSuggestions() {
    try {
        const invoices = await salesApi.getSalesInvoices();
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

async function displayCustomerBalance() {
    const customerId = salesState.dom.customerSelect?.value;
    if (!customerId) return;

    const selectedOption = salesState.dom.customerSelect.options[salesState.dom.customerSelect.selectedIndex];
    const balance = parseFloat(selectedOption.dataset.balance || 0);

    const balanceDiv = document.getElementById('customerBalance');
    if (!balanceDiv) return;

    balanceDiv.className = 'customer-balance';
    if (balance > 0) {
        balanceDiv.classList.add('balance-positive');
        balanceDiv.textContent = fmt(t('sales.balanceCurrentOwes', 'الرصيد الحالي: عليه {amount} جنيه'), { amount: balance.toLocaleString() });
    } else if (balance < 0) {
        balanceDiv.classList.add('balance-negative');
        balanceDiv.textContent = fmt(t('sales.balanceCurrentOwed', 'الرصيد الحالي: له {amount} جنيه'), { amount: Math.abs(balance).toLocaleString() });
    } else {
        balanceDiv.classList.add('balance-zero');
        balanceDiv.textContent = t('sales.balanceCurrentSettled', 'الرصيد الحالي: متزن');
    }
    balanceDiv.style.display = 'block';
}

async function loadItems() {
    salesState.allItems = await salesApi.getItems();
}

function addInvoiceRow(existingItem = null) {
    if (!existingItem && !salesState.dom.customerSelect?.value) {
        alert(t('sales.selectCustomerFirst', 'الرجاء اختيار العميل أولا'));
        return;
    }

    const row = salesRender.createInvoiceRow({
        allItems: salesState.allItems,
        existingItem,
        t,
        fmt
    });

    salesState.dom.invoiceItemsBody.appendChild(row);

    const selectElement = row.querySelector('.item-select');
    new Autocomplete(selectElement);

    if (existingItem) {
        updateProfitIndicator(row);
    }
}

function removeRow(removeBtnEl) {
    const row = removeBtnEl.closest('tr');
    if (!row) return;
    row.remove();
    calculateInvoiceTotal();
}

function onRowInput(input) {
    calculateRowTotal(input);
    if (input.classList.contains('quantity-input')) {
        maybeAutoAddRow(input.closest('tr'));
    }
}

function maybeAutoAddRow(row) {
    if (!row || !salesState.dom.invoiceItemsBody) return;
    if (row === salesState.dom.invoiceItemsBody.lastElementChild) {
        addInvoiceRow();
    }
}

function updateProfitIndicator(row) {
    const indicator = row.querySelector('.profit-indicator');
    if (!indicator) return;

    const select = row.querySelector('.item-select');
    const selectedOption = select.options[select.selectedIndex];
    const costPrice = parseFloat(selectedOption?.dataset?.cost) || 0;
    const salePrice = parseLocaleFloat(row.querySelector('.price-input').value) || 0;

    if (!costPrice || !salePrice) {
        indicator.innerHTML = '';
        indicator.className = 'profit-indicator';
        return;
    }

    const diff = salePrice - costPrice;
    const percent = ((diff / costPrice) * 100).toFixed(1);
    const costLabel = t('sales.costPriceLabel', 'سعر الشراء') + ': ' + costPrice.toFixed(2);

    if (diff > 0) {
        indicator.className = 'profit-indicator profit-positive';
        indicator.innerHTML = '<i class="fas fa-arrow-up"></i> ' + costLabel + ' · ' + t('sales.profitLabel', 'ربح') + ': ' + diff.toFixed(2) + ' (' + percent + '%)';
    } else if (diff < 0) {
        indicator.className = 'profit-indicator profit-negative';
        indicator.innerHTML = '<i class="fas fa-arrow-down"></i> ' + costLabel + ' · ' + t('sales.lossLabel', 'خسارة') + ': ' + Math.abs(diff).toFixed(2) + ' (' + Math.abs(percent) + '%)';
    } else {
        indicator.className = 'profit-indicator profit-neutral';
        indicator.innerHTML = costLabel + ' · ' + t('sales.profitLabel', 'ربح') + ': 0.00 (0.0%)';
    }
}

function onItemSelect(select) {
    const row = select.closest('tr');
    const selectedOption = select.options[select.selectedIndex];
    const price = selectedOption.dataset.price || 0;

    const itemId = parseInt(select.value, 10);
    const match = Number.isFinite(itemId) ? salesState.allItems.find((i) => i.id === itemId) : null;
    const unitName = match && match.unit_name ? match.unit_name : '';

    const unitEl = row.querySelector('.unit-label');
    if (unitEl) unitEl.textContent = unitName;

    row.querySelector('.price-input').value = price;
    calculateRowTotal(select);
    updateProfitIndicator(row);
    maybeAutoAddRow(row);

    const qtyInput = row.querySelector('.quantity-input');
    if (qtyInput) qtyInput.focus();
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

function calculateRowTotal(element) {
    const row = element.closest('tr');
    const quantity = parseLocaleFloat(row.querySelector('.quantity-input').value);
    const price = parseLocaleFloat(row.querySelector('.price-input').value);
    const total = (Number.isFinite(quantity) ? quantity : 0) * (Number.isFinite(price) ? price : 0);

    row.querySelector('.row-total').textContent = total.toFixed(2);
    calculateInvoiceTotal();
    updateProfitIndicator(row);
}

function calculateInvoiceTotal() {
    let total = 0;
    salesState.dom.invoiceItemsBody.querySelectorAll('tr').forEach((row) => {
        const rowTotal = parseFloat(row.querySelector('.row-total').textContent) || 0;
        total += rowTotal;
    });
    salesState.dom.invoiceTotalSpan.textContent = total.toFixed(2);
}

function collectInvoiceItemsFromForm() {
    const items = [];
    let isValid = true;

    salesState.dom.invoiceItemsBody.querySelectorAll('tr').forEach((row) => {
        const item_id = parseInt(row.querySelector('.item-select').value, 10);
        const quantity = parseLocaleFloat(row.querySelector('.quantity-input').value);
        const sale_price = parseLocaleFloat(row.querySelector('.price-input').value);

        const quantityOk = Number.isFinite(quantity) && quantity > 0;
        const priceOk = Number.isFinite(sale_price) && sale_price >= 0;
        const itemOk = Number.isFinite(item_id) && item_id > 0;

        if (!itemOk && !quantityOk && (!priceOk || sale_price === 0)) {
            return;
        }

        if (!itemOk || !quantityOk || !priceOk) {
            isValid = false;
            return;
        }

        items.push({
            item_id,
            quantity,
            sale_price,
            total_price: quantity * sale_price
        });
    });

    return { items, isValid: isValid && items.length > 0 };
}

async function updateInvoice() {
    if (!salesState.editingInvoiceId) {
        alert(t('sales.updateNoId', 'لا يمكن تحديث الفاتورة: رقم تعريف الفاتورة غير موجود'));
        return;
    }

    const customer_id = salesState.dom.customerSelect.value;
    const invoice_date = salesState.dom.invoiceDateInput.value || new Date().toISOString().slice(0, 10);
    const invoice_number = document.getElementById('invoiceNumber').value;
    const notes = document.getElementById('invoiceNotes').value;
    const payment_type = document.getElementById('paymentType').value;

    if (!customer_id) {
        alert(t('sales.toast.selectCustomer', 'الرجاء اختيار العميل'));
        return;
    }

    const { items, isValid } = collectInvoiceItemsFromForm();
    if (!isValid || items.length === 0) {
        alert(t('sales.itemsDataInvalid', 'الرجاء إدخال جميع بيانات الأصناف بشكل صحيح'));
        return;
    }

    const invoiceData = {
        id: salesState.editingInvoiceId,
        customer_id,
        invoice_number,
        invoice_date,
        payment_type,
        notes,
        items,
        total_amount: parseFloat(salesState.dom.invoiceTotalSpan.textContent)
    };

    try {
        const result = await salesApi.updateInvoice(invoiceData);
        if (result.success) {
            showToast(t('sales.toast.updateSuccess', 'تم تحديث الفاتورة بنجاح'), 'success');
            await resetForm();
        } else {
            alert(t('sales.toast.updateError', 'حدث خطأ أثناء التحديث') + ': ' + result.error);
        }
    } catch (error) {
        alert(t('sales.toast.unexpectedError', 'حدث خطأ غير متوقع') + ': ' + error.message);
    }
}

async function saveInvoice() {
    const customer_id = salesState.dom.customerSelect.value;
    const invoice_date = salesState.dom.invoiceDateInput.value || new Date().toISOString().slice(0, 10);
    const invoice_number = document.getElementById('invoiceNumber').value;
    const notes = document.getElementById('invoiceNotes').value;
    const payment_type = document.getElementById('paymentType').value;

    if (!customer_id) {
        alert(t('sales.toast.selectCustomer', 'الرجاء اختيار العميل'));
        return;
    }

    const { items, isValid } = collectInvoiceItemsFromForm();
    if (!isValid) {
        alert(t('sales.itemsInvalid', 'الرجاء التأكد من إدخال الأصناف والكميات بشكل صحيح'));
        return;
    }

    const invoiceData = {
        customer_id,
        invoice_number,
        invoice_date,
        notes,
        items,
        payment_type
    };

    const result = await salesApi.saveInvoice(invoiceData);
    if (result.success) {
        showToast(t('sales.toast.saveSuccess', 'تم حفظ الفاتورة بنجاح'), 'success');
        await resetForm();
    } else {
        showToast(t('sales.toast.saveError', 'حدث خطأ') + ': ' + result.error, 'error');
    }
}

async function resetForm() {
    salesState.dom.customerSelect.value = '';
    if (salesState.customerAutocomplete) salesState.customerAutocomplete.refresh();

    const balanceDiv = document.getElementById('customerBalance');
    if (balanceDiv) balanceDiv.style.display = 'none';

    const invoiceNumberInput = document.getElementById('invoiceNumber');
    const notesInput = document.getElementById('invoiceNotes');
    const paymentTypeInput = document.getElementById('paymentType');

    if (invoiceNumberInput) invoiceNumberInput.value = '';
    if (notesInput) notesInput.value = '';
    if (paymentTypeInput) paymentTypeInput.value = 'credit';

    salesState.dom.invoiceItemsBody.innerHTML = '';
    salesState.dom.invoiceTotalSpan.textContent = '0.00';

    salesState.editingInvoiceId = null;
    salesRender.setCreateModeUI(t);

    window.history.replaceState({}, document.title, window.location.pathname);
    await initializeNewInvoice();
}
