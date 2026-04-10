const salesReturnsState = window.salesReturnsPageState.createInitialState();
const salesReturnsApi = window.salesReturnsPageApi;
const salesReturnsRender = window.salesReturnsPageRender;
const salesReturnsEvents = window.salesReturnsPageEvents;
const { t, fmt } = window.i18n?.createPageHelpers?.(() => salesReturnsState.ar) || { t: (k, f = '') => f, fmt: (t, v = {}) => String(t || '') };

function toArray(value) {
    return Array.isArray(value) ? value : [];
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
        salesReturnsState.ar = await window.i18n.loadArabicDictionary();
    }

    salesReturnsRender.renderPage({ t, getNavHTML: buildTopNavHTML });
    initializeElements();

    await Promise.all([loadCustomers(), loadReturnsHistory()]);

    const editId = getEditIdFromUrl();
    if (editId) {
        await loadReturnForEdit(editId);
    }
    } catch (error) {
        console.error('Initialization Error:', error);
        if (window.toast && typeof window.toast.error === 'function') {
            window.toast.error(t('alerts.initError', 'حدث خطأ أثناء تهيئة الصفحة، يرجى إعادة التحميل'));
        }
    }
});

function getEditIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('editId');
}

function clearEditQueryFromUrl() {
    window.history.replaceState({}, document.title, window.location.pathname);
}

function initializeElements() {
    window.salesReturnsPageState.initializeDomRefs(salesReturnsState);

    if (salesReturnsState.dom.returnDateInput) {
        salesReturnsState.dom.returnDateInput.valueAsDate = new Date();
    }
    loadNextReturnNumber();

    salesReturnsEvents.bindEvents({
        root: salesReturnsState.dom.app,
        dom: salesReturnsState.dom,
        handlers: {
            onCustomerChange: handleCustomerChange,
            onInvoiceChange: handleInvoiceChange,
            onCheckboxChange,
            onQtyInput,
            onPriceInput: calculateTotal,
            onResetForm: resetForm,
            onSaveReturn: saveReturn,
            onHistoryPrev: () => changeSalesReturnsPage(salesReturnsState.salesReturnsPage - 1),
            onHistoryNext: () => changeSalesReturnsPage(salesReturnsState.salesReturnsPage + 1),
            onDeleteReturn: deleteReturn
        }
    });
}

async function loadNextReturnNumber() {
    const next = await salesReturnsApi.getNextReturnNumber();
    if (salesReturnsState.dom.returnNumberInput) {
        salesReturnsState.dom.returnNumberInput.value = `MR-${String(next).padStart(4, '0')}`;
    }
}

async function loadCustomers() {
    const customers = toArray(await salesReturnsApi.getCustomers());

    salesReturnsState.dom.customerSelect.innerHTML = `<option value="">${t('common.actions.selectCustomer', 'Select Customer')}</option>`;
    customers.forEach((customer) => {
        const option = document.createElement('option');
        option.value = customer.id;
        option.textContent = customer.name;
        salesReturnsState.dom.customerSelect.appendChild(option);
    });

    if (salesReturnsState.customerAutocomplete) {
        salesReturnsState.customerAutocomplete.refresh();
    } else {
        salesReturnsState.customerAutocomplete = new Autocomplete(salesReturnsState.dom.customerSelect);
    }
}

async function handleCustomerChange() {
    const customerId = salesReturnsState.dom.customerSelect.value;
    if (customerId) {
        if (salesReturnsState.editingReturnId) {
            salesReturnsState.editingOriginalInvoiceId = null;
            salesReturnsState.editingReturnItemsMap = new Map();
        }

        salesReturnsState.dom.invoiceSelect.disabled = false;
        await loadCustomerInvoices(customerId);
        return;
    }

    salesReturnsState.dom.invoiceSelect.disabled = true;
    salesReturnsState.dom.invoiceSelect.innerHTML = `<option value="">${t('common.actions.selectInvoice', 'Select Invoice')}</option>`;
    if (salesReturnsState.invoiceAutocomplete) salesReturnsState.invoiceAutocomplete.refresh();
    hideItemsSection();
}

async function loadCustomerInvoices(customerId) {
    const invoices = toArray(await salesReturnsApi.getCustomerInvoices(customerId));

    salesReturnsState.dom.invoiceSelect.innerHTML = `<option value="">${t('common.actions.selectInvoice', 'Select Invoice')}</option>`;
    invoices.forEach((invoice) => {
        const option = document.createElement('option');
        option.value = invoice.id;
        option.textContent = fmt(t('salesReturns.invoiceOption', 'Invoice #{number} - {date} - {total}'), {
            number: invoice.invoice_number ?? '-',
            date: invoice.invoice_date ?? '-',
            total: `${(Number(invoice.total_amount) || 0).toFixed(2)} ${t('common.currency.egp', 'EGP')}`
        });
        salesReturnsState.dom.invoiceSelect.appendChild(option);
    });

    if (salesReturnsState.invoiceAutocomplete) {
        salesReturnsState.invoiceAutocomplete.refresh();
    } else {
        salesReturnsState.invoiceAutocomplete = new Autocomplete(salesReturnsState.dom.invoiceSelect);
    }
}

async function handleInvoiceChange() {
    const invoiceId = salesReturnsState.dom.invoiceSelect.value;
    if (invoiceId) {
        if (salesReturnsState.editingReturnId && Number(invoiceId) !== Number(salesReturnsState.editingOriginalInvoiceId)) {
            salesReturnsState.editingReturnItemsMap = new Map();
        }
        await loadInvoiceItems(invoiceId);
    } else {
        hideItemsSection();
    }
}

async function loadInvoiceItems(invoiceId) {
    const result = await salesReturnsApi.getInvoiceItems(invoiceId);
    if (!result || !result.success) {
        Toast.show((result && result.error) || t('salesReturns.toast.loadItemsError', 'Failed to load invoice items'), 'error');
        return;
    }

    salesReturnsState.currentInvoiceItems = toArray(result.items);
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
    if (!salesReturnsState.editingReturnId || Number(invoiceId) !== Number(salesReturnsState.editingOriginalInvoiceId) || salesReturnsState.editingReturnItemsMap.size === 0) {
        return;
    }

    salesReturnsState.currentInvoiceItems = salesReturnsState.currentInvoiceItems.map((item) => {
        const editItem = salesReturnsState.editingReturnItemsMap.get(Number(item.item_id));
        if (!editItem) return item;

        return {
            ...item,
            returned_quantity: Math.max(0, toSafeNumber(item.returned_quantity) - toSafeNumber(editItem.quantity))
        };
    });
}

function renderInvoiceItems() {
    salesReturnsState.dom.itemsBody.innerHTML = '';

    if (salesReturnsState.currentInvoiceItems.length === 0) {
        hideItemsSection();
        return;
    }

    salesReturnsState.dom.itemsSection.style.display = 'block';

    salesReturnsState.currentInvoiceItems.forEach((item, index) => {
        const row = salesReturnsRender.createInvoiceItemRow({
            item,
            index,
            t,
            toSafeNumber,
            getAvailableToReturn
        });
        salesReturnsState.dom.itemsBody.appendChild(row);
    });

    calculateTotal();
}

function applyEditSelections(invoiceId) {
    if (!salesReturnsState.editingReturnId || Number(invoiceId) !== Number(salesReturnsState.editingOriginalInvoiceId) || salesReturnsState.editingReturnItemsMap.size === 0) {
        return;
    }

    salesReturnsState.currentInvoiceItems.forEach((item, index) => {
        const editItem = salesReturnsState.editingReturnItemsMap.get(Number(item.item_id));
        if (!editItem) return;

        const checkbox = salesReturnsState.dom.itemsBody.querySelector(`.return-checkbox[data-index="${index}"]`);
        const qtyInput = salesReturnsState.dom.itemsBody.querySelector(`.return-qty-input[data-index="${index}"]`);
        const priceInput = salesReturnsState.dom.itemsBody.querySelector(`.return-price-input[data-index="${index}"]`);
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

function onCheckboxChange(checkbox) {
    const index = checkbox.dataset.index;
    const qtyInput = salesReturnsState.dom.itemsBody.querySelector(`.return-qty-input[data-index="${index}"]`);
    const priceInput = salesReturnsState.dom.itemsBody.querySelector(`.return-price-input[data-index="${index}"]`);

    if (!qtyInput || !priceInput) return;

    if (checkbox.checked) {
        qtyInput.disabled = false;
        priceInput.disabled = false;

        const item = salesReturnsState.currentInvoiceItems[index];
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

function onQtyInput(input) {
    const index = input.dataset.index;
    const item = salesReturnsState.currentInvoiceItems[index];
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

    salesReturnsState.dom.itemsBody.querySelectorAll('.return-checkbox').forEach((checkbox) => {
        const index = checkbox.dataset.index;
        const rowTotalEl = salesReturnsState.dom.itemsBody.querySelector(`.row-total[data-index="${index}"]`);

        if (!rowTotalEl) return;

        if (!checkbox.checked) {
            rowTotalEl.textContent = '0.00';
            return;
        }

        const qty = Number.parseFloat(salesReturnsState.dom.itemsBody.querySelector(`.return-qty-input[data-index="${index}"]`)?.value || '0') || 0;
        const price = Number.parseFloat(salesReturnsState.dom.itemsBody.querySelector(`.return-price-input[data-index="${index}"]`)?.value || '0') || 0;
        const rowTotal = qty * price;

        rowTotalEl.textContent = rowTotal.toFixed(2);
        total += rowTotal;
        if (qty > 0) hasItems = true;
    });

    salesReturnsState.dom.returnTotal.textContent = total.toFixed(2);
    salesReturnsState.dom.saveBtn.disabled = !hasItems;
}

function hideItemsSection() {
    salesReturnsState.dom.itemsSection.style.display = 'none';
    salesReturnsState.dom.itemsBody.innerHTML = '';
    salesReturnsState.dom.returnTotal.textContent = '0.00';
    salesReturnsState.dom.saveBtn.disabled = true;
    salesReturnsState.currentInvoiceItems = [];
}

function collectSelectedItems() {
    const items = [];

    salesReturnsState.dom.itemsBody.querySelectorAll('.return-checkbox').forEach((checkbox) => {
        if (!checkbox.checked) return;

        const index = checkbox.dataset.index;
        const qty = Number.parseFloat(salesReturnsState.dom.itemsBody.querySelector(`.return-qty-input[data-index="${index}"]`)?.value || '0') || 0;
        const price = Number.parseFloat(salesReturnsState.dom.itemsBody.querySelector(`.return-price-input[data-index="${index}"]`)?.value || '0') || 0;

        if (qty <= 0) return;

        items.push({
            item_id: salesReturnsState.currentInvoiceItems[index].item_id,
            quantity: qty,
            price,
            total_price: qty * price
        });
    });

    return items;
}

async function saveReturn() {
    if (salesReturnsState.isSubmitting) return;

    salesReturnsState.isSubmitting = true;
    salesReturnsState.dom.saveBtn.disabled = true;

    try {
        const customerId = salesReturnsState.dom.customerSelect.value;
        const invoiceId = salesReturnsState.dom.invoiceSelect.value;
        const returnNumber = salesReturnsState.dom.returnNumberInput.value;
        const returnDate = salesReturnsState.dom.returnDateInput.value;
        const notes = document.getElementById('returnNotes').value;

        if (!customerId || !invoiceId) {
            Toast.show(t('salesReturns.toast.selectCustomerInvoice', 'Please select customer and invoice'), 'warning');
            return;
        }

        const items = collectSelectedItems();
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
        if (salesReturnsState.editingReturnId) {
            result = await salesReturnsApi.updateReturn({
                id: salesReturnsState.editingReturnId,
                ...payload
            });
        } else {
            result = await salesReturnsApi.saveReturn(payload);
        }

        if (result && result.success) {
            Toast.show(
                salesReturnsState.editingReturnId
                    ? t('salesReturns.toast.updateSuccess', 'Return updated successfully')
                    : t('salesReturns.toast.saveSuccess', 'Return saved successfully'),
                'success'
            );
            await resetForm();
            await loadReturnsHistory();
        } else {
            const errorText = salesReturnsState.editingReturnId
                ? t('salesReturns.toast.updateError', 'Failed to update return')
                : t('salesReturns.toast.saveError', 'Failed to save return');
            Toast.show((result && result.error) || errorText, 'error');
        }
    } catch (error) {
        if (salesReturnsState.editingReturnId && String(error?.message || '').includes("No handler registered for 'update-sales-return'")) {
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
        salesReturnsState.isSubmitting = false;
        calculateTotal();
    }
}

async function resetForm() {
    salesReturnsState.editingReturnId = null;
    salesReturnsState.editingOriginalInvoiceId = null;
    salesReturnsState.editingReturnItemsMap = new Map();
    clearEditQueryFromUrl();
    salesReturnsRender.setFormMode(false, t);

    salesReturnsState.dom.customerSelect.value = '';
    if (salesReturnsState.customerAutocomplete) salesReturnsState.customerAutocomplete.refresh();

    salesReturnsState.dom.invoiceSelect.innerHTML = `<option value="">${t('common.actions.selectInvoice', 'Select Invoice')}</option>`;
    salesReturnsState.dom.invoiceSelect.disabled = true;
    if (salesReturnsState.invoiceAutocomplete) salesReturnsState.invoiceAutocomplete.refresh();

    document.getElementById('returnNotes').value = '';
    hideItemsSection();
    await loadNextReturnNumber();
    salesReturnsState.dom.returnDateInput.valueAsDate = new Date();
}

async function loadReturnForEdit(id) {
    const returnId = Number.parseInt(id, 10);
    if (!Number.isFinite(returnId) || returnId <= 0) {
        Toast.show(t('salesReturns.toast.invalidReturnId', 'Invalid return ID'), 'warning');
        clearEditQueryFromUrl();
        return;
    }

    try {
        const returns = toArray(await salesReturnsApi.getReturns());
        const selectedReturn = returns.find((row) => Number(row.id) === returnId);
        if (!selectedReturn) {
            Toast.show(t('salesReturns.toast.returnNotFound', 'Return not found'), 'warning');
            clearEditQueryFromUrl();
            return;
        }

        const details = toArray(await salesReturnsApi.getReturnDetails(returnId));
        salesReturnsState.editingReturnId = returnId;
        salesReturnsState.editingOriginalInvoiceId = Number(selectedReturn.original_invoice_id);
        salesReturnsState.editingReturnItemsMap = new Map();

        details.forEach((detail) => {
            const itemId = Number(detail.item_id);
            if (!Number.isFinite(itemId)) return;
            const prev = salesReturnsState.editingReturnItemsMap.get(itemId);
            salesReturnsState.editingReturnItemsMap.set(itemId, {
                quantity: (prev ? toSafeNumber(prev.quantity) : 0) + toSafeNumber(detail.quantity),
                price: toSafeNumber(detail.price)
            });
        });

        salesReturnsRender.setFormMode(true, t);

        salesReturnsState.dom.customerSelect.value = String(selectedReturn.customer_id ?? '');
        if (salesReturnsState.customerAutocomplete) salesReturnsState.customerAutocomplete.refresh();

        salesReturnsState.dom.invoiceSelect.disabled = false;
        await loadCustomerInvoices(selectedReturn.customer_id);

        const invoiceValue = String(selectedReturn.original_invoice_id ?? '');
        const hasInvoiceOption = Array.from(salesReturnsState.dom.invoiceSelect.options).some((option) => option.value === invoiceValue);
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
            salesReturnsState.dom.invoiceSelect.appendChild(fallbackOption);
        }

        salesReturnsState.dom.invoiceSelect.value = invoiceValue;
        if (salesReturnsState.invoiceAutocomplete) salesReturnsState.invoiceAutocomplete.refresh();

        salesReturnsState.dom.returnNumberInput.value = selectedReturn.return_number || '';
        salesReturnsState.dom.returnDateInput.value = selectedReturn.return_date
            ? String(selectedReturn.return_date).split('T')[0]
            : new Date().toISOString().slice(0, 10);

        document.getElementById('returnNotes').value = selectedReturn.notes || '';

        await loadInvoiceItems(selectedReturn.original_invoice_id);
    } catch (_) {
        Toast.show(t('salesReturns.toast.loadReturnError', 'Failed to load return data for editing'), 'error');
    }
}

async function loadReturnsHistory() {
    salesReturnsState.allSalesReturns = toArray(await salesReturnsApi.getReturns());
    salesReturnsState.salesReturnsPage = 1;
    renderReturnsHistory();
}

function renderReturnsHistory() {
    if (!salesReturnsState.allSalesReturns.length) {
        salesReturnsRender.renderEmptyHistory(salesReturnsState.dom.historyContent, t);
        return;
    }

    const totalPages = Math.ceil(salesReturnsState.allSalesReturns.length / salesReturnsState.salesReturnsPerPage);
    if (salesReturnsState.salesReturnsPage > totalPages) salesReturnsState.salesReturnsPage = totalPages;
    if (salesReturnsState.salesReturnsPage < 1) salesReturnsState.salesReturnsPage = 1;

    const startIdx = (salesReturnsState.salesReturnsPage - 1) * salesReturnsState.salesReturnsPerPage;
    const pageReturns = salesReturnsState.allSalesReturns.slice(startIdx, startIdx + salesReturnsState.salesReturnsPerPage);

    salesReturnsRender.renderHistoryTable({
        container: salesReturnsState.dom.historyContent,
        rows: pageReturns,
        page: salesReturnsState.salesReturnsPage,
        totalPages,
        t,
        fmt
    });
}

function changeSalesReturnsPage(newPage) {
    const totalPages = Math.ceil(salesReturnsState.allSalesReturns.length / salesReturnsState.salesReturnsPerPage);
    if (newPage < 1 || newPage > totalPages) return;

    salesReturnsState.salesReturnsPage = newPage;
    renderReturnsHistory();
}

async function deleteReturn(id) {
    if (!Number.isFinite(id)) return;

    if (!confirm(t('salesReturns.confirmDelete', 'Are you sure you want to delete this return?'))) {
        return;
    }

    try {
        const result = await salesReturnsApi.deleteReturn(id);

        if (result && result.success) {
            Toast.show(t('salesReturns.toast.deleteSuccess', 'Return deleted successfully'), 'success');
            await loadReturnsHistory();

            if (salesReturnsState.dom.invoiceSelect.value) {
                await loadInvoiceItems(salesReturnsState.dom.invoiceSelect.value);
            }
            return;
        }

        Toast.show((result && result.error) || t('salesReturns.toast.deleteError', 'Failed to delete return'), 'error');
    } catch (_) {
        Toast.show(t('salesReturns.toast.unexpectedError', 'Unexpected error'), 'error');
    }
}
