const purchaseReturnsState = window.purchaseReturnsPageState.createInitialState();
const purchaseReturnsApi = window.purchaseReturnsPageApi;
const purchaseReturnsRender = window.purchaseReturnsPageRender;
const purchaseReturnsEvents = window.purchaseReturnsPageEvents;
const pageI18n = window.i18n?.createPageHelpers ? window.i18n.createPageHelpers(() => purchaseReturnsState.ar) : null;

function t(key, fallback = '') {
    return pageI18n ? pageI18n.t(key, fallback) : fallback;
}

function fmt(template, values = {}) {
    return pageI18n ? pageI18n.fmt(template, values) : String(template || '');
}

function toArray(value) {
    return Array.isArray(value) ? value : [];
}

function getNavHTML() {
    if (window.navManager && typeof window.navManager.getTopNavHTML === 'function') {
        return window.navManager.getTopNavHTML(t);
    }
    return '';
}

document.addEventListener('DOMContentLoaded', async () => {
    if (window.i18n && typeof window.i18n.loadArabicDictionary === 'function') {
        purchaseReturnsState.ar = await window.i18n.loadArabicDictionary();
    }

    purchaseReturnsRender.renderPage({ t, getNavHTML });
    initializeElements();

    await Promise.all([loadSuppliers(), loadReturnsHistory()]);

    const editId = getEditIdFromUrl();
    if (editId) {
        await loadReturnForEdit(editId);
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
    window.purchaseReturnsPageState.initializeDomRefs(purchaseReturnsState);

    if (purchaseReturnsState.dom.returnDateInput) {
        purchaseReturnsState.dom.returnDateInput.valueAsDate = new Date();
    }
    loadNextReturnNumber();
    updateOriginalInvoicePreview();

    purchaseReturnsEvents.bindEvents({
        root: purchaseReturnsState.dom.app,
        dom: purchaseReturnsState.dom,
        handlers: {
            onSupplierChange: handleSupplierChange,
            onInvoiceChange: handleInvoiceChange,
            onCheckboxChange,
            onQtyInput,
            onPriceInput: calculateTotal,
            onResetForm: resetForm,
            onSaveReturn: saveReturn,
            onHistoryPrev: () => changePurchaseReturnsPage(purchaseReturnsState.purchaseReturnsPage - 1),
            onHistoryNext: () => changePurchaseReturnsPage(purchaseReturnsState.purchaseReturnsPage + 1),
            onDeleteReturn: deleteReturn
        }
    });
}

async function loadNextReturnNumber() {
    const next = await purchaseReturnsApi.getNextReturnNumber();
    if (purchaseReturnsState.dom.returnNumberInput) {
        purchaseReturnsState.dom.returnNumberInput.value = `PR-${String(next).padStart(4, '0')}`;
    }
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

async function loadSuppliers() {
    const suppliers = toArray(await purchaseReturnsApi.getSuppliers());

    purchaseReturnsState.dom.supplierSelect.innerHTML = `<option value="">${t('common.actions.selectSupplier', 'اختر المورد')}</option>`;
    suppliers.forEach((supplier) => {
        const option = document.createElement('option');
        option.value = supplier.id;
        option.textContent = supplier.name;
        purchaseReturnsState.dom.supplierSelect.appendChild(option);
    });

    if (purchaseReturnsState.supplierAutocomplete) {
        purchaseReturnsState.supplierAutocomplete.refresh();
    } else {
        purchaseReturnsState.supplierAutocomplete = new Autocomplete(purchaseReturnsState.dom.supplierSelect);
    }
}

async function handleSupplierChange() {
    const supplierId = purchaseReturnsState.dom.supplierSelect.value;
    if (supplierId) {
        if (purchaseReturnsState.editingReturnId) {
            purchaseReturnsState.editingOriginalInvoiceId = null;
            purchaseReturnsState.editingReturnItemsMap = new Map();
        }

        purchaseReturnsState.dom.invoiceSelect.disabled = false;
        await loadSupplierInvoices(supplierId);
        return;
    }

    purchaseReturnsState.dom.invoiceSelect.disabled = true;
    purchaseReturnsState.dom.invoiceSelect.innerHTML = `<option value="">${t('common.actions.selectInvoice', 'اختر الفاتورة')}</option>`;
    if (purchaseReturnsState.invoiceAutocomplete) purchaseReturnsState.invoiceAutocomplete.refresh();

    hideItemsSection();
    updateOriginalInvoicePreview();
}

async function loadSupplierInvoices(supplierId) {
    const invoices = toArray(await purchaseReturnsApi.getSupplierInvoices(supplierId));

    purchaseReturnsState.dom.invoiceSelect.innerHTML = `<option value="">${t('common.actions.selectInvoice', 'اختر الفاتورة')}</option>`;
    invoices.forEach((invoice) => {
        const option = document.createElement('option');
        option.value = invoice.id;
        option.textContent = formatInvoiceOptionText(invoice.invoice_number, invoice.invoice_date, invoice.total_amount);
        purchaseReturnsState.dom.invoiceSelect.appendChild(option);
    });

    if (purchaseReturnsState.invoiceAutocomplete) {
        purchaseReturnsState.invoiceAutocomplete.refresh();
    } else {
        purchaseReturnsState.invoiceAutocomplete = new Autocomplete(purchaseReturnsState.dom.invoiceSelect);
    }

    updateOriginalInvoicePreview();
}

async function handleInvoiceChange() {
    const invoiceId = purchaseReturnsState.dom.invoiceSelect.value;
    updateOriginalInvoicePreview();

    if (invoiceId) {
        if (purchaseReturnsState.editingReturnId && Number(invoiceId) !== Number(purchaseReturnsState.editingOriginalInvoiceId)) {
            purchaseReturnsState.editingReturnItemsMap = new Map();
        }
        await loadInvoiceItems(invoiceId);
    } else {
        hideItemsSection();
    }
}

async function loadInvoiceItems(invoiceId) {
    const result = await purchaseReturnsApi.getInvoiceItems(invoiceId);
    if (!result || !result.success) {
        Toast.show((result && result.error) || t('purchaseReturns.toast.loadItemsError', 'Failed to load invoice items'), 'error');
        return;
    }

    purchaseReturnsState.currentInvoiceItems = toArray(result.items);
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
    if (!purchaseReturnsState.editingReturnId || Number(invoiceId) !== Number(purchaseReturnsState.editingOriginalInvoiceId) || purchaseReturnsState.editingReturnItemsMap.size === 0) {
        return;
    }

    purchaseReturnsState.currentInvoiceItems = purchaseReturnsState.currentInvoiceItems.map((item) => {
        const editItem = purchaseReturnsState.editingReturnItemsMap.get(Number(item.item_id));
        if (!editItem) return item;

        return {
            ...item,
            returned_quantity: Math.max(0, toSafeNumber(item.returned_quantity) - toSafeNumber(editItem.quantity))
        };
    });
}

function renderInvoiceItems() {
    purchaseReturnsState.dom.itemsBody.innerHTML = '';

    if (purchaseReturnsState.currentInvoiceItems.length === 0) {
        hideItemsSection();
        return;
    }

    purchaseReturnsState.dom.itemsSection.style.display = 'block';

    purchaseReturnsState.currentInvoiceItems.forEach((item, index) => {
        const row = purchaseReturnsRender.createInvoiceItemRow({
            item,
            index,
            t,
            toSafeNumber,
            getAvailableToReturn
        });
        purchaseReturnsState.dom.itemsBody.appendChild(row);
    });

    calculateTotal();
}

function applyEditSelections(invoiceId) {
    if (!purchaseReturnsState.editingReturnId || Number(invoiceId) !== Number(purchaseReturnsState.editingOriginalInvoiceId) || purchaseReturnsState.editingReturnItemsMap.size === 0) {
        return;
    }

    purchaseReturnsState.currentInvoiceItems.forEach((item, index) => {
        const editItem = purchaseReturnsState.editingReturnItemsMap.get(Number(item.item_id));
        if (!editItem) return;

        const checkbox = purchaseReturnsState.dom.itemsBody.querySelector(`.return-checkbox[data-index="${index}"]`);
        const qtyInput = purchaseReturnsState.dom.itemsBody.querySelector(`.return-qty-input[data-index="${index}"]`);
        const priceInput = purchaseReturnsState.dom.itemsBody.querySelector(`.return-price-input[data-index="${index}"]`);
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
    const qtyInput = purchaseReturnsState.dom.itemsBody.querySelector(`.return-qty-input[data-index="${index}"]`);
    const priceInput = purchaseReturnsState.dom.itemsBody.querySelector(`.return-price-input[data-index="${index}"]`);

    if (!qtyInput || !priceInput) return;

    if (checkbox.checked) {
        qtyInput.disabled = false;
        priceInput.disabled = false;

        const item = purchaseReturnsState.currentInvoiceItems[index];
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
    const item = purchaseReturnsState.currentInvoiceItems[index];
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

    purchaseReturnsState.dom.itemsBody.querySelectorAll('.return-checkbox').forEach((checkbox) => {
        const index = checkbox.dataset.index;
        const rowTotalEl = purchaseReturnsState.dom.itemsBody.querySelector(`.row-total[data-index="${index}"]`);

        if (!rowTotalEl) return;

        if (!checkbox.checked) {
            rowTotalEl.textContent = '0.00';
            return;
        }

        const qty = Number.parseFloat(purchaseReturnsState.dom.itemsBody.querySelector(`.return-qty-input[data-index="${index}"]`)?.value || '0') || 0;
        const price = Number.parseFloat(purchaseReturnsState.dom.itemsBody.querySelector(`.return-price-input[data-index="${index}"]`)?.value || '0') || 0;
        const rowTotal = qty * price;

        rowTotalEl.textContent = rowTotal.toFixed(2);
        total += rowTotal;
        if (qty > 0) hasItems = true;
    });

    purchaseReturnsState.dom.returnTotal.textContent = total.toFixed(2);
    purchaseReturnsState.dom.saveBtn.disabled = !hasItems;
}

function hideItemsSection() {
    purchaseReturnsState.dom.itemsSection.style.display = 'none';
    purchaseReturnsState.dom.itemsBody.innerHTML = '';
    purchaseReturnsState.dom.returnTotal.textContent = '0.00';
    purchaseReturnsState.dom.saveBtn.disabled = true;
    purchaseReturnsState.currentInvoiceItems = [];
}

function collectSelectedItems() {
    const items = [];

    purchaseReturnsState.dom.itemsBody.querySelectorAll('.return-checkbox').forEach((checkbox) => {
        if (!checkbox.checked) return;

        const index = checkbox.dataset.index;
        const qty = Number.parseFloat(purchaseReturnsState.dom.itemsBody.querySelector(`.return-qty-input[data-index="${index}"]`)?.value || '0') || 0;
        const price = Number.parseFloat(purchaseReturnsState.dom.itemsBody.querySelector(`.return-price-input[data-index="${index}"]`)?.value || '0') || 0;

        if (qty <= 0) return;

        items.push({
            item_id: purchaseReturnsState.currentInvoiceItems[index].item_id,
            quantity: qty,
            price,
            total_price: qty * price
        });
    });

    return items;
}

async function saveReturn() {
    if (purchaseReturnsState.isSubmitting) return;

    purchaseReturnsState.isSubmitting = true;
    purchaseReturnsState.dom.saveBtn.disabled = true;

    try {
        const supplierId = purchaseReturnsState.dom.supplierSelect.value;
        const invoiceId = purchaseReturnsState.dom.invoiceSelect.value;
        const returnNumber = purchaseReturnsState.dom.returnNumberInput.value;
        const returnDate = purchaseReturnsState.dom.returnDateInput.value;
        const notes = document.getElementById('returnNotes').value;

        if (!supplierId || !invoiceId) {
            Toast.show(t('purchaseReturns.toast.selectSupplierInvoice', 'الرجاء اختيار المورد والفاتورة'), 'warning');
            return;
        }

        const items = collectSelectedItems();
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
        if (purchaseReturnsState.editingReturnId) {
            result = await purchaseReturnsApi.updateReturn({
                id: purchaseReturnsState.editingReturnId,
                ...payload
            });
        } else {
            result = await purchaseReturnsApi.saveReturn(payload);
        }

        if (result && result.success) {
            Toast.show(
                purchaseReturnsState.editingReturnId
                    ? t('purchaseReturns.toast.updateSuccess', 'تم تحديث المرتجع بنجاح')
                    : t('purchaseReturns.toast.saveSuccess', 'تم حفظ المرتجع بنجاح'),
                'success'
            );
            await resetForm();
            await loadReturnsHistory();
        } else {
            const errorText = purchaseReturnsState.editingReturnId
                ? t('purchaseReturns.toast.updateError', 'حدث خطأ أثناء تحديث المرتجع')
                : t('purchaseReturns.toast.saveError', 'حدث خطأ أثناء حفظ المرتجع');
            Toast.show((result && result.error) || errorText, 'error');
        }
    } catch (error) {
        if (purchaseReturnsState.editingReturnId && String(error?.message || '').includes("No handler registered for 'update-purchase-return'")) {
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
        purchaseReturnsState.isSubmitting = false;
        calculateTotal();
    }
}

async function resetForm() {
    purchaseReturnsState.editingReturnId = null;
    purchaseReturnsState.editingOriginalInvoiceId = null;
    purchaseReturnsState.editingReturnItemsMap = new Map();
    clearEditQueryFromUrl();
    purchaseReturnsRender.setFormMode(false, t);

    purchaseReturnsState.dom.supplierSelect.value = '';
    if (purchaseReturnsState.supplierAutocomplete) purchaseReturnsState.supplierAutocomplete.refresh();

    purchaseReturnsState.dom.invoiceSelect.innerHTML = `<option value="">${t('common.actions.selectInvoice', 'اختر الفاتورة')}</option>`;
    purchaseReturnsState.dom.invoiceSelect.disabled = true;
    if (purchaseReturnsState.invoiceAutocomplete) purchaseReturnsState.invoiceAutocomplete.refresh();

    updateOriginalInvoicePreview();

    document.getElementById('returnNotes').value = '';
    hideItemsSection();
    await loadNextReturnNumber();
    purchaseReturnsState.dom.returnDateInput.valueAsDate = new Date();
}

async function loadReturnForEdit(id) {
    const returnId = Number.parseInt(id, 10);
    if (!Number.isFinite(returnId) || returnId <= 0) {
        Toast.show(t('purchaseReturns.toast.invalidReturnId', 'معرف المرتجع غير صالح'), 'warning');
        clearEditQueryFromUrl();
        return;
    }

    try {
        const returns = toArray(await purchaseReturnsApi.getReturns());
        const selectedReturn = returns.find((row) => Number(row.id) === returnId);
        if (!selectedReturn) {
            Toast.show(t('purchaseReturns.toast.returnNotFound', 'المرتجع غير موجود'), 'warning');
            clearEditQueryFromUrl();
            return;
        }

        const details = toArray(await purchaseReturnsApi.getReturnDetails(returnId));
        purchaseReturnsState.editingReturnId = returnId;
        purchaseReturnsState.editingOriginalInvoiceId = Number(selectedReturn.original_invoice_id);
        purchaseReturnsState.editingReturnItemsMap = new Map();

        details.forEach((detail) => {
            const itemId = Number(detail.item_id);
            if (!Number.isFinite(itemId)) return;
            const prev = purchaseReturnsState.editingReturnItemsMap.get(itemId);
            purchaseReturnsState.editingReturnItemsMap.set(itemId, {
                quantity: (prev ? toSafeNumber(prev.quantity) : 0) + toSafeNumber(detail.quantity),
                price: toSafeNumber(detail.price)
            });
        });

        purchaseReturnsRender.setFormMode(true, t);

        purchaseReturnsState.dom.supplierSelect.value = String(selectedReturn.supplier_id ?? '');
        if (purchaseReturnsState.supplierAutocomplete) purchaseReturnsState.supplierAutocomplete.refresh();

        purchaseReturnsState.dom.invoiceSelect.disabled = false;
        await loadSupplierInvoices(selectedReturn.supplier_id);

        const invoiceValue = String(selectedReturn.original_invoice_id ?? '');
        const hasInvoiceOption = Array.from(purchaseReturnsState.dom.invoiceSelect.options).some((option) => option.value === invoiceValue);
        if (!hasInvoiceOption && invoiceValue) {
            const fallbackOption = document.createElement('option');
            fallbackOption.value = invoiceValue;
            fallbackOption.textContent = formatInvoiceOptionText(
                selectedReturn.original_invoice_number || invoiceValue,
                '-',
                selectedReturn.total_amount
            );
            purchaseReturnsState.dom.invoiceSelect.appendChild(fallbackOption);
        }

        purchaseReturnsState.dom.invoiceSelect.value = invoiceValue;
        if (purchaseReturnsState.invoiceAutocomplete) purchaseReturnsState.invoiceAutocomplete.refresh();

        updateOriginalInvoicePreview();

        purchaseReturnsState.dom.returnNumberInput.value = selectedReturn.return_number || '';
        purchaseReturnsState.dom.returnDateInput.value = selectedReturn.return_date
            ? String(selectedReturn.return_date).split('T')[0]
            : new Date().toISOString().slice(0, 10);

        document.getElementById('returnNotes').value = selectedReturn.notes || '';

        await loadInvoiceItems(selectedReturn.original_invoice_id);
    } catch (_) {
        Toast.show(t('purchaseReturns.toast.loadReturnError', 'تعذر تحميل بيانات المرتجع للتعديل'), 'error');
    }
}

async function loadReturnsHistory() {
    purchaseReturnsState.allPurchaseReturns = toArray(await purchaseReturnsApi.getReturns());
    purchaseReturnsState.purchaseReturnsPage = 1;
    renderReturnsHistory();
}

function renderReturnsHistory() {
    if (!purchaseReturnsState.allPurchaseReturns.length) {
        purchaseReturnsRender.renderEmptyHistory(purchaseReturnsState.dom.historyContent, t);
        return;
    }

    const totalPages = Math.ceil(purchaseReturnsState.allPurchaseReturns.length / purchaseReturnsState.purchaseReturnsPerPage);
    if (purchaseReturnsState.purchaseReturnsPage > totalPages) purchaseReturnsState.purchaseReturnsPage = totalPages;
    if (purchaseReturnsState.purchaseReturnsPage < 1) purchaseReturnsState.purchaseReturnsPage = 1;

    const startIdx = (purchaseReturnsState.purchaseReturnsPage - 1) * purchaseReturnsState.purchaseReturnsPerPage;
    const pageReturns = purchaseReturnsState.allPurchaseReturns.slice(startIdx, startIdx + purchaseReturnsState.purchaseReturnsPerPage);

    purchaseReturnsRender.renderHistoryTable({
        container: purchaseReturnsState.dom.historyContent,
        rows: pageReturns,
        page: purchaseReturnsState.purchaseReturnsPage,
        totalPages,
        t,
        fmt
    });
}

function changePurchaseReturnsPage(newPage) {
    const totalPages = Math.ceil(purchaseReturnsState.allPurchaseReturns.length / purchaseReturnsState.purchaseReturnsPerPage);
    if (newPage < 1 || newPage > totalPages) return;

    purchaseReturnsState.purchaseReturnsPage = newPage;
    renderReturnsHistory();
}

async function deleteReturn(id) {
    if (!Number.isFinite(id)) return;

    if (!confirm(t('purchaseReturns.confirmDelete', 'هل أنت متأكد من حذف هذا المرتجع؟'))) {
        return;
    }

    try {
        const result = await purchaseReturnsApi.deleteReturn(id);

        if (result && result.success) {
            Toast.show(t('purchaseReturns.toast.deleteSuccess', 'تم حذف المرتجع بنجاح'), 'success');
            await loadReturnsHistory();

            if (purchaseReturnsState.dom.invoiceSelect.value) {
                await loadInvoiceItems(purchaseReturnsState.dom.invoiceSelect.value);
            }
            return;
        }

        Toast.show((result && result.error) || t('purchaseReturns.toast.deleteError', 'حدث خطأ أثناء حذف المرتجع'), 'error');
    } catch (_) {
        Toast.show(t('purchaseReturns.toast.unexpectedError', 'حدث خطأ غير متوقع'), 'error');
    }
}

function updateOriginalInvoicePreview() {
    if (!purchaseReturnsState.dom.originalInvoicePreview || !purchaseReturnsState.dom.originalInvoicePreviewText || !purchaseReturnsState.dom.invoiceSelect) {
        return;
    }

    const selectedOption = purchaseReturnsState.dom.invoiceSelect.options[purchaseReturnsState.dom.invoiceSelect.selectedIndex];
    const hasSelectedInvoice = Boolean(purchaseReturnsState.dom.invoiceSelect.value && selectedOption);

    if (hasSelectedInvoice) {
        purchaseReturnsState.dom.originalInvoicePreview.classList.remove('is-empty');
        purchaseReturnsState.dom.originalInvoicePreviewText.textContent = (selectedOption.textContent || '').trim();
        return;
    }

    purchaseReturnsState.dom.originalInvoicePreview.classList.add('is-empty');
    purchaseReturnsState.dom.originalInvoicePreviewText.textContent = t('purchaseReturns.noInvoiceSelected', 'لم يتم اختيار فاتورة شراء أصلية بعد');
}
