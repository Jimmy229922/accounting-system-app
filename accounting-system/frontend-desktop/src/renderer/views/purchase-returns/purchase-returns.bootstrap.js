const purchaseReturnsState = window.purchaseReturnsPageState.createInitialState();
const purchaseReturnsApi = window.purchaseReturnsPageApi;
const purchaseReturnsRender = window.purchaseReturnsPageRender;
const purchaseReturnsEvents = window.purchaseReturnsPageEvents;
const { t, fmt } = window.i18n?.createPageHelpers?.(() => purchaseReturnsState.ar) || { t: (k, f = '') => f, fmt: (t, v = {}) => String(t || '') };

function toArray(value) {
    return Array.isArray(value) ? value : [];
}

function buildTopNavHTML() {
    if (window.navManager && typeof window.navManager.getTopNavHTML === 'function') {
        return window.navManager.getTopNavHTML(t);
    }
    return '';
}

document.addEventListener('DOMContentLoaded', async () => {    // Reset submitting state just in case
    purchaseReturnsState.isSubmitting = false;
    purchaseReturnsState.isEditLocked = false;
    try {
    if (window.i18n && typeof window.i18n.loadArabicDictionary === 'function') {
        purchaseReturnsState.ar = await window.i18n.loadArabicDictionary();
    }

    purchaseReturnsRender.renderPage({ t, getNavHTML: buildTopNavHTML });
    initializeElements();

    await Promise.all([loadSuppliers(), loadReturnsHistory()]);

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

function isEditLocked() {
    return Boolean(purchaseReturnsState.editingReturnId && purchaseReturnsState.isEditLocked);
}

function setEditLocked(locked) {
    const form = document.getElementById('invoiceForm');
    if (!form) return;

    purchaseReturnsState.isEditLocked = Boolean(locked);
    const lockActive = Boolean(purchaseReturnsState.editingReturnId && purchaseReturnsState.isEditLocked);
    const saveBtn = form.querySelector('[data-action="save-return"]');
    let lockHint = form.querySelector('[data-edit-lock-hint="true"]');

    if (lockActive && !lockHint) {
        lockHint = document.createElement('div');
        lockHint.dataset.editLockHint = 'true';
        lockHint.textContent = 'الوضع الحالي: عرض فقط. اضغط "تعديل المرتجع" لفتح الحقول.';
        lockHint.style.margin = '10px 0 14px 0';
        lockHint.style.padding = '10px 12px';
        lockHint.style.borderRadius = '10px';
        lockHint.style.background = 'rgba(245, 158, 11, 0.18)';
        lockHint.style.border = '1px solid rgba(245, 158, 11, 0.6)';
        lockHint.style.color = 'var(--text-color)';
        lockHint.style.fontWeight = '700';
        const shell = form.querySelector('.invoice-shell');
        if (shell) {
            shell.insertBefore(lockHint, shell.firstChild);
        }
    }

    if (!lockActive && lockHint) {
        lockHint.remove();
    }

    const controls = form.querySelectorAll('input, select, textarea, button');
    controls.forEach((control) => {
        if (
            control.dataset.action === 'save-return' ||
            control.dataset.action === 'load-prev-return' ||
            control.dataset.action === 'load-next-return'
        ) return;
        control.disabled = lockActive;

        if (lockActive) {
            control.style.cursor = 'not-allowed';
            control.style.backgroundColor = 'rgba(148, 163, 184, 0.2)';
            control.style.borderStyle = 'dashed';
            control.style.opacity = '0.72';
            control.title = 'اضغط "تعديل المرتجع" أولاً';
        } else {
            control.style.cursor = '';
            control.style.backgroundColor = '';
            control.style.borderStyle = '';
            control.style.opacity = '';
            control.title = '';
        }
    });

    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.removeAttribute('data-invalid');

        if (lockActive) {
            saveBtn.innerHTML = `<i class="fas fa-pen"></i> تعديل المرتجع`;
        } else if (purchaseReturnsState.editingReturnId) {
            saveBtn.innerHTML = `<i class="fas fa-save"></i> ${t('purchaseReturns.updateReturn', 'تحديث المرتجع')}`;
        } else {
            saveBtn.innerHTML = `<i class="fas fa-save"></i> ${t('purchaseReturns.saveReturn', 'حفظ المرتجع')}`;
        }
    }
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
            onItemsArrowNavigate: handleItemsArrowNavigation,
            onResetForm: resetForm,
            onSaveReturn: saveReturn,
            onPrintReturn: printReturn,
            onConfirmPrintReturn: confirmPrintReturn,
            onClosePrintPreview: closePrintPreview,
            onChangePrintPrinter: changePrintPrinter,
            onLoadPrevReturn: () => navigateReturn(-1),
            onLoadNextReturn: () => navigateReturn(1),
            onHistoryPrev: () => changePurchaseReturnsPage(purchaseReturnsState.purchaseReturnsPage - 1),
            onHistoryNext: () => changePurchaseReturnsPage(purchaseReturnsState.purchaseReturnsPage + 1),
            onDeleteReturn: deleteReturn
        }
    });

    if (purchaseReturnsState.dom.printPreviewModal) {
        purchaseReturnsState.dom.printPreviewModal.addEventListener('click', (event) => {
            if (event.target === purchaseReturnsState.dom.printPreviewModal) {
                closePrintPreview();
            }
        });
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            if (purchaseReturnsState.dom.printPreviewModal?.classList.contains('is-open')) {
                closePrintPreview();
            }
        }
    });

    updateReturnNavigationButtons();
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

    if (purchaseReturnsState.dom.supplierSelect) {
        purchaseReturnsState.dom.supplierSelect.classList.add('autocomplete-force-down');
    }

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

    applySupplierAutocompleteDropdownStyle();

    bindSupplierAutocompleteClearHandler();
}

function applySupplierAutocompleteDropdownStyle() {
    const supplierAutocomplete = purchaseReturnsState.supplierAutocomplete;
    if (!supplierAutocomplete) return;

    supplierAutocomplete.forceOpenDown = true;

    const supplierList = supplierAutocomplete.list;
    if (!supplierList) return;
    supplierList.style.maxHeight = '350px';
    supplierList.style.overflowY = 'auto';
}

function bindSupplierAutocompleteClearHandler() {
    const supplierInput = purchaseReturnsState.supplierAutocomplete?.input;
    if (!supplierInput || !purchaseReturnsState.dom.supplierSelect) return;
    if (supplierInput.dataset.clearSelectionBound === '1') return;

    supplierInput.dataset.clearSelectionBound = '1';
    supplierInput.addEventListener('input', () => {
        if (supplierInput.value.trim() !== '') return;
        if (!purchaseReturnsState.dom.supplierSelect.value) return;

        purchaseReturnsState.dom.supplierSelect.value = '';
        purchaseReturnsState.dom.supplierSelect.dispatchEvent(new Event('change'));
    });

    const reopenSupplierList = () => {
        if (!purchaseReturnsState.supplierAutocomplete || supplierInput.disabled) return;
        if (!purchaseReturnsState.dom.supplierSelect.value) return;

        // Autocomplete has its own focus/click handlers; defer so full list wins.
        setTimeout(() => {
            if (!purchaseReturnsState.supplierAutocomplete || supplierInput.disabled) return;
            if (!purchaseReturnsState.dom.supplierSelect.value) return;
            purchaseReturnsState.supplierAutocomplete.renderList('');
        }, 70);
    };

    supplierInput.addEventListener('focus', reopenSupplierList);
    supplierInput.addEventListener('click', reopenSupplierList);
}

async function handleSupplierChange() {
    if (isEditLocked()) return;

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
    if (isEditLocked()) return;

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
    if (isEditLocked()) return;

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
        // qtyInput.focus();
    } else {
        qtyInput.disabled = true;
        priceInput.disabled = true;
        qtyInput.value = '0';
    }

    calculateTotal();
}

function onQtyInput(input) {
    if (isEditLocked()) return;

    const index = input.dataset.index;
    const item = purchaseReturnsState.currentInvoiceItems[index];
    const maxQty = getAvailableToReturn(item);

    let val = Number.parseFloat(input.value);
    if (Number.isNaN(val)) {
        calculateTotal();
        return;
    }

    let shouldUpdate = false;
    if (val > maxQty) {
        val = maxQty;
        shouldUpdate = true;
    }
    if (val < 0) {
        val = 0;
        shouldUpdate = true;
    }

    if (shouldUpdate) {
        input.value = String(val);
    }

    calculateTotal();
}

const NAVIGABLE_RETURN_FIELDS = ['toggle', 'quantity', 'price'];

function getItemsRowFieldKey(target) {
    if (!target) return '';
    if (target.classList.contains('return-checkbox')) return 'toggle';
    if (target.classList.contains('return-qty-input')) return 'quantity';
    if (target.classList.contains('return-price-input')) return 'price';
    return '';
}

function getItemsRowFieldElement(row, fieldKey) {
    if (!row) return null;
    if (fieldKey === 'toggle') return row.querySelector('.return-checkbox');
    if (fieldKey === 'quantity') return row.querySelector('.return-qty-input');
    if (fieldKey === 'price') return row.querySelector('.return-price-input');
    return null;
}

function closeVisibleAutocompleteLists() {
    if (typeof Autocomplete !== 'undefined' && typeof Autocomplete.closeAllVisible === 'function') {
        Autocomplete.closeAllVisible();
        return;
    }

    document.querySelectorAll('.autocomplete-list.visible').forEach((listEl) => {
        listEl.classList.remove('visible');
    });
}

function isEnabledElement(field) {
    return Boolean(field && !field.disabled && !field.hasAttribute('disabled'));
}

function focusItemsRowField(row, fieldKey) {
    const field = getItemsRowFieldElement(row, fieldKey);
    if (!isEnabledElement(field)) return;

    closeVisibleAutocompleteLists();
    field.focus();
    if (field.type !== 'checkbox' && typeof field.select === 'function') {
        field.select();
    }
}

function getNextFieldKeyInSameRow(row, currentFieldIndex, step) {
    for (
        let idx = currentFieldIndex + step;
        idx >= 0 && idx < NAVIGABLE_RETURN_FIELDS.length;
        idx += step
    ) {
        const fieldKey = NAVIGABLE_RETURN_FIELDS[idx];
        const field = getItemsRowFieldElement(row, fieldKey);
        if (isEnabledElement(field)) return fieldKey;
    }

    return '';
}

function handleItemsArrowNavigation(event) {
    if (isEditLocked()) return;
    if (!purchaseReturnsState.dom.itemsBody) return;
    if (
        event.key !== 'ArrowDown' &&
        event.key !== 'ArrowUp' &&
        event.key !== 'ArrowRight' &&
        event.key !== 'ArrowLeft'
    ) return;

    const target = event.target;
    const row = target?.closest?.('tr');
    if (!row) return;

    const fieldKey = getItemsRowFieldKey(target);
    if (!fieldKey) return;

    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        const currentFieldIndex = NAVIGABLE_RETURN_FIELDS.indexOf(fieldKey);
        if (currentFieldIndex < 0) return;

        const horizontalStep = event.key === 'ArrowRight' ? -1 : 1;
        const nextFieldKey = getNextFieldKeyInSameRow(row, currentFieldIndex, horizontalStep);
        if (!nextFieldKey) return;

        event.preventDefault();
        focusItemsRowField(row, nextFieldKey);
        return;
    }

    event.preventDefault();

    const rows = Array.from(purchaseReturnsState.dom.itemsBody.querySelectorAll('tr'));
    const currentIndex = rows.indexOf(row);
    if (currentIndex < 0) return;

    const direction = event.key === 'ArrowDown' ? 1 : -1;
    for (let idx = currentIndex + direction; idx >= 0 && idx < rows.length; idx += direction) {
        const field = getItemsRowFieldElement(rows[idx], fieldKey);
        if (!isEnabledElement(field)) continue;
        focusItemsRowField(rows[idx], fieldKey);
        return;
    }
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
    
    if (purchaseReturnsState.dom.saveBtn) {
        if (!hasItems) {
            purchaseReturnsState.dom.saveBtn.disabled = true;
            purchaseReturnsState.dom.saveBtn.dataset.invalid = 'true';
        } else {
            purchaseReturnsState.dom.saveBtn.disabled = false;
            purchaseReturnsState.dom.saveBtn.removeAttribute('data-invalid');
        }
    }
    updatePrintBtnState();
}

function hideItemsSection() {
    purchaseReturnsState.dom.itemsSection.style.display = 'none';
    purchaseReturnsState.dom.itemsBody.innerHTML = '';
    purchaseReturnsState.dom.returnTotal.textContent = '0.00';
    
    if (purchaseReturnsState.dom.saveBtn) {
        purchaseReturnsState.dom.saveBtn.disabled = true;
        purchaseReturnsState.dom.saveBtn.dataset.invalid = 'true';
    }
    purchaseReturnsState.currentInvoiceItems = [];
    updatePrintBtnState();
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
    if (isEditLocked()) {
        setEditLocked(false);
        Toast.show('تم تفعيل وضع التعديل. راجع البيانات ثم اضغط تحديث المرتجع.', 'success');
        return;
    }

    if (purchaseReturnsState.isSubmitting || purchaseReturnsState.dom.saveBtn?.dataset.invalid === 'true') return;

    purchaseReturnsState.isSubmitting = true;
    if (purchaseReturnsState.dom.saveBtn) {
        purchaseReturnsState.dom.saveBtn.disabled = true;
    }

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
    purchaseReturnsState.isEditLocked = false;
    purchaseReturnsState.editingOriginalInvoiceId = null;
    purchaseReturnsState.editingReturnItemsMap = new Map();
    clearEditQueryFromUrl();
    purchaseReturnsRender.setFormMode(false, t);
    setEditLocked(false);

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
    updateReturnNavigationButtons();
}

async function loadReturnForEdit(id) {
    const returnId = Number.parseInt(id, 10);
    if (!Number.isFinite(returnId) || returnId <= 0) {
        Toast.show(t('purchaseReturns.toast.invalidReturnId', 'معرف المرتجع غير صالح'), 'warning');
        clearEditQueryFromUrl();
        updateReturnNavigationButtons();
        return;
    }

    try {
        const returns = toArray(await purchaseReturnsApi.getReturns());
        const selectedReturn = returns.find((row) => Number(row.id) === returnId);
        if (!selectedReturn) {
            Toast.show(t('purchaseReturns.toast.returnNotFound', 'المرتجع غير موجود'), 'warning');
            clearEditQueryFromUrl();
            updateReturnNavigationButtons();
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
        setEditLocked(true);
        updateReturnNavigationButtons();
    } catch (_) {
        Toast.show(t('purchaseReturns.toast.loadReturnError', 'تعذر تحميل بيانات المرتجع للتعديل'), 'error');
        updateReturnNavigationButtons();
    }
}

async function loadReturnsHistory() {
    purchaseReturnsState.allPurchaseReturns = toArray(await purchaseReturnsApi.getReturns());
    purchaseReturnsState.purchaseReturnsPage = 1;
    renderReturnsHistory();
    updateReturnNavigationButtons();
}

function getOrderedReturnsForNavigation() {
    return toArray(purchaseReturnsState.allPurchaseReturns)
        .slice()
        .sort((a, b) => (Number(a?.id) || 0) - (Number(b?.id) || 0));
}

function findCurrentReturnIndexForNavigation(orderedReturns) {
    if (!orderedReturns.length) return -1;

    if (Number.isFinite(Number(purchaseReturnsState.editingReturnId))) {
        const activeId = Number(purchaseReturnsState.editingReturnId);
        const editIdx = orderedReturns.findIndex((entry) => Number(entry?.id) === activeId);
        if (editIdx >= 0) return editIdx;
    }

    const currentReturnNumber = (purchaseReturnsState.dom.returnNumberInput?.value || '').trim();
    if (!currentReturnNumber) return -1;

    return orderedReturns.findIndex((entry) => String(entry?.return_number || '').trim() === currentReturnNumber);
}

function applyReturnNavButtonState(button, disabled, disabledTitle) {
    if (!button) return;

    button.disabled = Boolean(disabled);
    button.style.opacity = disabled ? '0.55' : '1';
    button.style.cursor = disabled ? 'not-allowed' : 'pointer';
    button.title = disabled ? disabledTitle : '';
}

function updateReturnNavigationButtons() {
    const prevBtn = document.querySelector('[data-action="load-prev-return"]');
    const nextBtn = document.querySelector('[data-action="load-next-return"]');
    if (!prevBtn || !nextBtn) return;

    const orderedReturns = getOrderedReturnsForNavigation();
    if (!orderedReturns.length) {
        applyReturnNavButtonState(prevBtn, true, 'لا يوجد مرتجع سابق');
        applyReturnNavButtonState(nextBtn, true, 'لا يوجد مرتجع تالي');
        return;
    }

    const currentIndex = findCurrentReturnIndexForNavigation(orderedReturns);
    if (currentIndex < 0) {
        applyReturnNavButtonState(prevBtn, false, '');
        applyReturnNavButtonState(nextBtn, true, 'لا يوجد مرتجع تالي');
        return;
    }

    const isPrevDisabled = currentIndex <= 0;
    // Keep "next" enabled on the latest saved return to allow returning to a fresh empty form.
    const isNextDisabled = false;

    applyReturnNavButtonState(prevBtn, isPrevDisabled, 'لا يوجد مرتجع سابق');
    applyReturnNavButtonState(nextBtn, isNextDisabled, '');
}

async function navigateReturn(direction) {
    const orderedReturns = getOrderedReturnsForNavigation();
    if (!orderedReturns.length) {
        Toast.show('لا توجد مرتجعات محفوظة للتنقل بينها', 'warning');
        updateReturnNavigationButtons();
        return;
    }

    const currentIndex = findCurrentReturnIndexForNavigation(orderedReturns);
    const targetIndex = currentIndex < 0
        ? (direction < 0 ? orderedReturns.length - 1 : 0)
        : currentIndex + direction;

    if (targetIndex < 0) {
        Toast.show('لا يوجد مرتجع سابق', 'warning');
        updateReturnNavigationButtons();
        return;
    }

    if (targetIndex >= orderedReturns.length) {
        if (direction > 0 && currentIndex === orderedReturns.length - 1) {
            await resetForm();
            updateReturnNavigationButtons();
            return;
        }

        Toast.show('لا يوجد مرتجع تالي', 'warning');
        updateReturnNavigationButtons();
        return;
    }

    const targetReturn = orderedReturns[targetIndex];
    if (!targetReturn?.id) {
        Toast.show('تعذر فتح المرتجع المطلوب', 'error');
        return;
    }

    await loadReturnForEdit(targetReturn.id);
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

    const confirmed = typeof window.showConfirmDialog === 'function'
        ? await window.showConfirmDialog(t('purchaseReturns.confirmDelete', 'هل أنت متأكد من حذف هذا المرتجع؟'))
        : false;
    if (!confirmed) {
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

// ===== Print Returns Functions =====

function updatePrintBtnState() {
    const printBtn = document.getElementById('printReturnBtn');
    if (!printBtn) return;

    const supplierId = purchaseReturnsState.dom.supplierSelect?.value;
    const items = collectSelectedItems();
    const hasItems = items.length > 0;

    if (supplierId && hasItems) {
        printBtn.disabled = false;
        printBtn.style.opacity = '1';
        printBtn.style.cursor = 'pointer';
    } else {
        printBtn.disabled = true;
        printBtn.style.opacity = '0.5';
        printBtn.style.cursor = 'not-allowed';
    }
}

function getSavedPrintPrinterName() {
    return localStorage.getItem('sales_saved_print_printer_name') || '';
}

function savePrintPrinterName(printerName) {
    if (printerName) {
        localStorage.setItem('sales_saved_print_printer_name', printerName);
    }
}

function clearSavedPrintPrinterName() {
    localStorage.removeItem('sales_saved_print_printer_name');
}

async function setPrintPreviewOpen(open) {
    const modal = purchaseReturnsState.dom.printPreviewModal;
    if (!modal) return;
    if (open) {
        modal.style.display = 'flex';
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
    } else {
        modal.style.display = 'none';
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
    }
}

async function openPrintPreview() {
    await setPrintPreviewOpen(true);
    const previewPage = document.getElementById('salesPrintPreviewPage');
    if (previewPage) {
        previewPage.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:300px; color:#666; font-size: 16px; font-weight: bold;">جاري تجهيز معاينة الطباعة الحقيقية...</div>';
    }
    await loadPrintPreviewPrinters({ forceChoose: !getSavedPrintPrinterName() });
    await syncPrintPreviewContent();
}

function closePrintPreview() {
    setPrintPreviewOpen(false);
}

async function changePrintPrinter() {
    clearSavedPrintPrinterName();
    await loadPrintPreviewPrinters({ forceChoose: true });
}

async function loadPrintPreviewPrinters({ forceChoose = false } = {}) {
    const select = document.getElementById('salesPrintPrinterSelect');
    const picker = document.getElementById('salesPrintPrinterPicker');
    const statusText = document.getElementById('salesPrintPrinterStatus');
    const changeBtn = document.getElementById('salesPrintChangePrinterBtn');

    if (!window.electronAPI || typeof window.electronAPI.getPrinters !== 'function') {
        if (statusText) statusText.textContent = 'نظام الطباعة غير مدعوم خارج البيئة التجريبية';
        return;
    }

    try {
        const printers = await window.electronAPI.getPrinters();
        const savedPrinterName = getSavedPrintPrinterName();
        const defaultPrinter = printers.find(p => p.isDefault || p.is_default);

        if (!forceChoose && savedPrinterName) {
            const stillExists = printers.some(p => p.name === savedPrinterName);
            if (stillExists) {
                if (statusText) statusText.textContent = `طابعة المرتجع: ${savedPrinterName}`;
                if (changeBtn) changeBtn.style.display = 'inline-block';
                if (picker) picker.style.display = 'none';
                return;
            }
        }

        if (statusText) statusText.textContent = 'يرجى اختيار الطابعة المفضلة لطباعة المرتجع:';
        if (changeBtn) changeBtn.style.display = 'none';
        if (picker) picker.style.display = 'block';

        if (select) {
            select.innerHTML = '';
            printers.forEach(printer => {
                const opt = document.createElement('option');
                opt.value = printer.name;
                opt.textContent = printer.name + (printer.isDefault || printer.is_default ? ' (الافتراضية)' : '');
                if (printer.isDefault || printer.is_default) {
                    opt.selected = true;
                }
                select.appendChild(opt);
            });

            if (!select.value && printers.length > 0) {
                select.value = printers[0].name;
            }
        }
    } catch (e) {
        console.error("Error loading printers:", e);
        if (statusText) statusText.textContent = 'فشل في استرجاع قائمة الطابعات من النظام';
    }
}

async function syncPrintPreviewContent() {
    const printArea = document.getElementById('printArea');
    const previewPage = document.getElementById('salesPrintPreviewPage');
    if (printArea && previewPage) {
        previewPage.innerHTML = printArea.innerHTML;
    }
}

async function confirmPrintReturn() {
    const printBtn = document.getElementById('salesPrintConfirmBtn');
    const select = document.getElementById('salesPrintPrinterSelect');
    const printArea = document.getElementById('printArea');
    const savedPrinterName = getSavedPrintPrinterName();
    let selectedPrinterName = savedPrinterName || select?.value || '';

    if (!selectedPrinterName && window.electronAPI && typeof window.electronAPI.getPrinters === 'function') {
        try {
            const printers = await window.electronAPI.getPrinters();
            const defaultPrinter = printers.find(p => p.isDefault || p.is_default);
            if (defaultPrinter) {
                selectedPrinterName = defaultPrinter.name;
            } else if (printers.length > 0) {
                selectedPrinterName = printers[0].name;
            }
        } catch (e) {
            console.error("Error fetching default printer:", e);
        }
    }

    if (printBtn) {
        printBtn.disabled = true;
        printBtn.textContent = 'جاري إرسال المرتجع...';
    }

    try {
        if (window.electronAPI && typeof window.electronAPI.printCurrentWindow === 'function' && selectedPrinterName) {
            const printAreaHtml = printArea ? printArea.innerHTML : '';
            const fullHtmlForPrinting = `
                <html>
                    <head>
                        <meta charset="utf-8">
                        <style>
                            body { direction: rtl; font-family: system-ui, sans-serif; padding: 20px; }
                            .print-items-table {
                                width: 100%;
                                border-collapse: separate !important;
                                border-spacing: 0 !important;
                                page-break-inside: auto;
                                border-top: 1px solid #000 !important;
                                border-right: 1px solid #000 !important;
                                border-bottom: none !important;
                                border-left: none !important;
                            }
                            .print-items-table thead { display: table-header-group !important; }
                            .print-items-table tr { page-break-inside: avoid !important; break-inside: avoid !important; }
                            .print-items-table th, .print-items-table td {
                                border-left: 1px solid #000 !important;
                                border-bottom: 1px solid #000 !important;
                                border-right: none !important;
                                border-top: none !important;
                                padding: 8px;
                                text-align: center;
                            }
                            .print-summary, .print-footer { page-break-inside: avoid !important; break-inside: avoid !important; }
                            table:not(.print-items-table) { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                            table:not(.print-items-table) th, table:not(.print-items-table) td { border: 1px solid #ddd; padding: 8px; text-align: right; }
                            th { background-color: #f2f2f2; }
                            .print-header-top { display: flex; justify-content: space-between; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
                            .print-company-name { font-size: 24px; font-weight: bold; }
                            .print-invoice-title { font-size: 20px; font-weight: bold; }
                            .print-header-details { display: flex; justify-content: space-between; margin-bottom: 20px; }
                            .print-footer { margin-top: 30px; text-align: center; border-top: 1px solid #ddd; padding-top: 10px; }
                        </style>
                    </head>
                    <body>
                        ${printAreaHtml}
                    </body>
                </html>
            `;

            const result = await window.electronAPI.printCurrentWindow({
                htmlContent: fullHtmlForPrinting,
                deviceName: selectedPrinterName
            });

            if (result && result.success) {
                savePrintPrinterName(selectedPrinterName);
                closePrintPreview();
                Toast.show('تم إرسال فاتورة المرتجع للطابعة', 'success');
                return;
            }

            Toast.show((result && result.error) || 'تعذر طباعة المرتجع', 'error');
            return;
        }

        Toast.show('تعذر العثور على طابعة متصلة بالنظام، يرجى اختيار طابعة أولاً', 'error');
    } catch (error) {
        console.error("Print error:", error);
    } finally {
        if (printBtn) {
            printBtn.disabled = false;
            printBtn.textContent = 'طباعة';
        }
    }
}

async function printReturn() {
    const supplierSelect = purchaseReturnsState.dom.supplierSelect;
    const supplierName = supplierSelect.options[supplierSelect.selectedIndex]?.text || '';
    const returnNumber = purchaseReturnsState.dom.returnNumberInput.value;
    const returnDate = purchaseReturnsState.dom.returnDateInput.value || new Date().toLocaleDateString('ar-EG');

    const items = collectSelectedItems();
    if (items.length === 0) {
        Toast.show('الرجاء اختيار أصناف صحيحة قبل الطباعة', 'error');
        return;
    }

    // حفظ أسماء الأصناف محلياً قبل التصفير
    const itemNamesMap = {};
    items.forEach(item => {
        const itemObj = purchaseReturnsState.currentInvoiceItems.find(i => i.item_id === item.item_id);
        itemNamesMap[item.item_id] = itemObj ? (itemObj.item_name || itemObj.name || '') : '';
    });

    const totalAmount = parseFloat(purchaseReturnsState.dom.returnTotal?.textContent || '0') || 0;

    // 2. Submit the return if not locked
    const wasEditing = !!purchaseReturnsState.editingReturnId;
    const locked = (typeof isEditLocked === 'function') ? isEditLocked() : false;

    if (!locked) {
        await saveReturn();

        // Check if submit was successful by seeing if form reset
        if (supplierSelect.value !== '') {
            // Form didn't reset, meaning save failed. Stop printing.
            return;
        }
    }

    // 4. Populate Print Area
    document.getElementById('printInvoiceNumber').textContent = returnNumber || (wasEditing ? 'معدلة' : 'جديدة');
    document.getElementById('printInvoiceDate').textContent = returnDate;
    document.getElementById('printCustomerName').textContent = supplierName;

    const printItemsTbody = document.getElementById('printInvoiceItems');
    printItemsTbody.innerHTML = '';
    items.forEach((item, index) => {
        const itemName = itemNamesMap[item.item_id] || '';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${itemName}</td>
            <td>${item.quantity}</td>
            <td>${parseFloat(item.price).toFixed(2)}</td>
            <td>${parseFloat(item.total_price).toFixed(2)}</td>
        `;
        printItemsTbody.appendChild(tr);
    });

    document.getElementById('printInvoiceTotal').textContent = totalAmount.toFixed(2);

    // Get settings for company info
    try {
        const settings = await window.electronAPI.getSettings();
        if (settings) {
            const companyPhone = settings.companyPhone || settings.company_phone || '';
            document.getElementById('printCompanyName').textContent = settings.companyName || settings.company_name || 'اسم الشركة';
            document.getElementById('printCompanyInfo').textContent = companyPhone ? `هاتف: ${companyPhone}` : '';
            document.getElementById('printFooterText').textContent = settings.invoiceFooter || settings.invoice_notes || 'شكراً لتعاملكم معنا';
        }
    } catch (e) {
        console.error('Error fetching settings for print', e);
    }

    await openPrintPreview();
}
