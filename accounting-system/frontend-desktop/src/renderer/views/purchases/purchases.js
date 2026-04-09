let supplierSelect, invoiceDateInput, invoiceItemsBody, invoiceTotalSpan, invoiceForm;
let allItems = [];
let editingInvoiceId = null;
let supplierAutocomplete = null;
let isSubmitting = false;
let ar = {};
const pageI18n = window.i18n?.createPageHelpers ? window.i18n.createPageHelpers(() => ar) : null;

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
        ar = await window.i18n.loadArabicDictionary();
    }

    renderPage();
    initializeElements();
    
    // Set default date to today
    invoiceDateInput.valueAsDate = new Date();
    
    // Load data in parallel for better performance
    Promise.all([
        loadSuppliers(),
        loadItems(),
        loadInvoiceNumberSuggestions()
    ]).then(() => {
        // Check for edit mode
        const urlParams = new URLSearchParams(window.location.search);
        const editId = urlParams.get('editId');
        if (editId) {
            loadInvoiceForEdit(editId);
        } else {
            // Initialize Form directly
            initializeNewInvoice();
        }
    });
});

function renderPage() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${getNavHTML()}

        <div class="page-header">
            <h1 class="page-title">${t('purchases.pageTitle', 'فواتير المشتريات')}</h1>
        </div>

        <!-- Invoice Form -->
        <div id="invoiceForm" class="invoice-form-container">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0; color: var(--primary-color);">${t('purchases.formTitle', 'تسجيل فاتورة شراء جديدة')}</h2>
            </div>

            <div class="invoice-top-grid">
                <div class="form-group">
                    <label>${t('purchases.supplier', 'المورد')}</label>
                    <select id="supplierSelect" class="form-control">
                        <option value="">${t('purchases.selectSupplier', 'اختر المورد')}</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>${t('purchases.invoiceNumber', 'رقم الفاتورة')}</label>
                    <input type="text" id="invoiceNumber" class="form-control" list="invoiceSuggestions" placeholder="${t('purchases.invoiceNumberPlaceholder', 'تلقائي ويمكن تعديله يدويًا')}" autocomplete="off">
                    <datalist id="invoiceSuggestions"></datalist>
                </div>
                <div class="form-group">
                    <label>${t('purchases.invoiceDate', 'تاريخ الفاتورة')}</label>
                    <input type="date" id="invoiceDate" class="form-control">
                </div>
                <div class="form-group">
                    <label>${t('purchases.paymentType', 'طريقة الدفع')}</label>
                    <select id="paymentType" class="form-control">
                        <option value="cash">${t('purchases.paymentCash', 'كاش (نقدي)')}</option>
                        <option value="credit">${t('purchases.paymentCredit', 'آجل (ذمم)')}</option>
                    </select>
                </div>
            </div>

            <table class="items-table">
                <thead>
                    <tr>
                        <th style="width: 40%">${t('purchases.tableHeaders.item', 'الصنف')}</th>
                        <th style="width: 15%">${t('purchases.tableHeaders.qty', 'الكمية')}</th>
                        <th style="width: 20%">${t('purchases.tableHeaders.price', 'السعر')}</th>
                        <th style="width: 20%">${t('purchases.tableHeaders.total', 'الإجمالي')}</th>
                        <th style="width: 5%"></th>
                    </tr>
                </thead>
                <tbody id="invoiceItemsBody">
                    <!-- Items will be added here -->
                </tbody>
            </table>

            <button class="btn btn-primary" onclick="addInvoiceRow()">
                <span>+</span> ${t('purchases.addItemBtn', 'إضافة صنف')}
            </button>

            <div class="invoice-footer-grid">
                <div class="form-group">
                    <label>${t('purchases.notes', 'ملاحظات')}</label>
                    <textarea id="invoiceNotes" class="form-control" rows="4"></textarea>
                </div>
                <div class="totals-panel">
                    <div class="total-row">
                        <span>${t('purchases.totalLabel', 'الإجمالي:')}</span>
                        <span id="invoiceTotal">0.00</span>
                    </div>
                    <div class="grand-total">
                        <span>${t('purchases.netLabel', 'الصافي:')}</span>
                        <span id="finalTotal">0.00</span>
                    </div>
                    <button class="btn btn-success" style="width: 100%; margin-top: 20px;" onclick="submitInvoice()">
                        ${t('purchases.saveInvoice', 'حفظ الفاتورة')}
                    </button>
                </div>
            </div>
        </div>
    `;
}

function initializeElements() {
    supplierSelect = document.getElementById('supplierSelect');
    invoiceDateInput = document.getElementById('invoiceDate');
    invoiceItemsBody = document.getElementById('invoiceItemsBody');
    invoiceTotalSpan = document.getElementById('invoiceTotal');
    invoiceForm = document.getElementById('invoiceForm');

    // Add event listener to add first row when supplier is selected
    if (supplierSelect) {
        supplierSelect.addEventListener('change', () => {
            if (supplierSelect.value && invoiceItemsBody.children.length === 0) {
                addInvoiceRow();
            }
        });
    }
}

async function initializeNewInvoice() {
    // Auto-generate invoice number
    const nextId = await window.electronAPI.getNextInvoiceNumber('purchase');
    document.getElementById('invoiceNumber').value = nextId;

    // Note: We do NOT add a default row here anymore.
    // The user must select a supplier first.
}

async function loadInvoiceForEdit(id) {
    console.log('[loadInvoiceForEdit] START - id:', id);
    
    try {
        const invoice = await window.electronAPI.getInvoiceWithDetails(id, 'purchase');
        if (!invoice) {
            alert(t('purchases.invoiceNotFound', 'الفاتورة غير موجودة'));
            return;
        }

        editingInvoiceId = id;
        
        // Populate Form
        supplierSelect.value = invoice.supplier_id;
        if (supplierAutocomplete) supplierAutocomplete.refresh();
        document.getElementById('invoiceNumber').value = invoice.invoice_number;
        
        // Fix date format (take only YYYY-MM-DD part)
        if (invoice.invoice_date) {
            invoiceDateInput.value = invoice.invoice_date.split('T')[0];
        }
        
        document.getElementById('invoiceNotes').value = invoice.notes || '';
        document.getElementById('paymentType').value = invoice.payment_type || 'cash';

        // Populate Items
        invoiceItemsBody.innerHTML = '';
        invoice.items.forEach(item => {
            addInvoiceRow(item);
        });
        calculateInvoiceTotal();

        // Update UI
        document.querySelector('#invoiceForm h2') ? document.querySelector('#invoiceForm h2').textContent = t('purchases.editFormTitle', 'تعديل فاتورة شراء') : null;
        const saveBtn = document.querySelector('#invoiceForm .btn-success');
        saveBtn.textContent = t('purchases.updateAndSave', 'تحديث وحفظ الفاتورة');
        saveBtn.disabled = false;
        saveBtn.removeAttribute('disabled');

    } catch (error) {
        console.error('[loadInvoiceForEdit] Error:', error);
        alert(t('purchases.toast.loadError', 'حدث خطأ أثناء تحميل الفاتورة: ') + error.message);
    }
}

async function submitInvoice() {
    if (isSubmitting) return;
    isSubmitting = true;

    const saveBtn = document.querySelector('#invoiceForm .btn-success');
    if (saveBtn) {
        saveBtn.blur(); // Remove focus to prevent "Focus Trap"
        saveBtn.disabled = true;
        saveBtn.setAttribute('disabled', 'true');
    }

    // Single entry point for the submit button.
    // Prevents accidental "save new" while in edit mode.
    try {
        if (editingInvoiceId) {
            await updateInvoice();
        } else {
            await saveInvoice();
        }
    } finally {
        isSubmitting = false;
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.removeAttribute('disabled');
        }
    }
}

async function loadSuppliers() {
    const customers = await window.electronAPI.getCustomers();
    // Filter for suppliers (assuming type 'supplier' or 'both')
    const suppliers = customers.filter(c => c.type === 'supplier' || c.type === 'both');
    
    supplierSelect.innerHTML = `<option value="">${t('purchases.selectSupplier', 'اختر المورد')}</option>`;
    suppliers.forEach(supplier => {
        const option = document.createElement('option');
        option.value = supplier.id;
        option.textContent = supplier.name;
        supplierSelect.appendChild(option);
    });

    // Initialize/refresh Autocomplete once (NOT inside the loop)
    if (supplierAutocomplete) {
        supplierAutocomplete.refresh();
    } else {
        supplierAutocomplete = new Autocomplete(supplierSelect);
    }
}
async function loadInvoiceNumberSuggestions() {
    try {
        const invoices = await window.electronAPI.getPurchaseInvoices();
        const datalist = document.getElementById('invoiceSuggestions');
        if (datalist) {
            datalist.innerHTML = '';
            invoices.slice(0, 30).forEach(inv => {
                if (inv.invoice_number) {
                    const option = document.createElement('option');
                    option.value = inv.invoice_number;
                    datalist.appendChild(option);
                }
            });
        }
    } catch (error) {
        console.error('Error loading invoice suggestions:', error);
    }
}
async function loadItems() {
    allItems = await window.electronAPI.getItems();
}

function addInvoiceRow(existingItem = null) {
    // Prevent adding rows if no supplier is selected (unless we are loading an existing invoice)
    if (!existingItem && !supplierSelect.value) {
        alert(t('purchases.selectSupplierFirst', 'الرجاء اختيار المورد أولاً'));
        return;
    }

    const rowId = Date.now();
    const row = document.createElement('tr');
    row.dataset.id = rowId;
    
    let itemsOptions = `<option value="">${t('purchases.selectItem', 'اختر الصنف')}</option>`;
    allItems.forEach(item => {
        // Use cost_price here for purchases
        const isSelected = existingItem && existingItem.item_id === item.id ? 'selected' : '';
        itemsOptions += `<option value="${item.id}" data-price="${item.cost_price}" ${isSelected}>${item.name} (${fmt(t('purchases.available', 'متاح: {qty}'), { qty: item.stock_quantity })})</option>`;
    });

    const quantity = existingItem ? existingItem.quantity : '';
    const price = existingItem ? existingItem.cost_price : 0;
    const total = existingItem ? existingItem.total_price : 0;

    row.innerHTML = `
        <td>
            <select class="form-control item-select" onchange="onItemSelect(this)">
                ${itemsOptions}
            </select>
        </td>
        <td>
            <input type="text" autocomplete="off" class="form-control quantity-input" value="${quantity}" placeholder="0" oninput="calculateRowTotal(this)">
        </td>
        <td>
            <input type="text" autocomplete="off" class="form-control price-input" value="${price}" oninput="calculateRowTotal(this)">
        </td>
        <td>
            <span class="row-total">${total.toFixed(2)}</span>
        </td>
        <td>
            <span class="remove-row" onclick="removeRow(this)">❌</span>
        </td>
    `;
    
    invoiceItemsBody.appendChild(row);

    // Initialize Autocomplete
    const selectElement = row.querySelector('.item-select');
    const autocomplete = new Autocomplete(selectElement);

    // Auto-add row logic
    const nameInput = autocomplete.input;
    const qtyInput = row.querySelector('.quantity-input');

    const autoAddHandler = () => {
        if (row === invoiceItemsBody.lastElementChild) {
            addInvoiceRow();
        }
    };

    nameInput.addEventListener('input', autoAddHandler);
    qtyInput.addEventListener('input', autoAddHandler);
    selectElement.addEventListener('change', autoAddHandler);
}

function removeRow(btn) {
    btn.closest('tr').remove();
    calculateInvoiceTotal();
}

function onItemSelect(select) {
    const row = select.closest('tr');
    const selectedOption = select.options[select.selectedIndex];
    const price = selectedOption.dataset.price || 0;
    
    row.querySelector('.price-input').value = price;
    calculateRowTotal(row.querySelector('.quantity-input'));
}

function calculateRowTotal(input) {
    const row = input.closest('tr');
    const quantity = parseFloat(row.querySelector('.quantity-input').value) || 0;
    const price = parseFloat(row.querySelector('.price-input').value) || 0;
    const total = quantity * price;
    
    row.querySelector('.row-total').textContent = total.toFixed(2);
    calculateInvoiceTotal();
}

function calculateInvoiceTotal() {
    let total = 0;
    document.querySelectorAll('.row-total').forEach(span => {
        total += parseFloat(span.textContent) || 0;
    });
    
    invoiceTotalSpan.textContent = total.toFixed(2);
    document.getElementById('finalTotal').textContent = total.toFixed(2);
}

async function saveInvoice() {
    const supplierId = supplierSelect.value;
    if (!supplierId) {
        alert(t('purchases.toast.selectSupplier', 'الرجاء اختيار المورد'));
        return;
    }

    const items = [];
    let isValid = true;

    document.querySelectorAll('#invoiceItemsBody tr').forEach(row => {
        const itemId = row.querySelector('.item-select').value;
        const quantity = parseFloat(row.querySelector('.quantity-input').value);
        const price = parseFloat(row.querySelector('.price-input').value);

        // Check if row is completely empty (no item, no quantity, no price or price is 0)
        const isItemEmpty = !itemId;
        const isQuantityEmpty = isNaN(quantity) || quantity === 0;
        const isPriceEmpty = isNaN(price) || price === 0;

        if (isItemEmpty && isQuantityEmpty && isPriceEmpty) {
            return; // Skip empty row
        }

        // If row has partial data, mark as invalid
        if (!itemId || !quantity || isNaN(price)) {
            isValid = false;
            return;
        }

        items.push({
            item_id: itemId,
            quantity: quantity,
            cost_price: price,
            total_price: quantity * price
        });
    });

    if (!isValid || items.length === 0) {
        alert(t('purchases.noItemsData', 'الرجاء إدخال جميع بيانات الأصناف بشكل صحيح (يجب إضافة صنف واحد على الأقل)'));
        return;
    }

    const invoiceData = {
        supplier_id: supplierId,
        invoice_number: document.getElementById('invoiceNumber').value,
        invoice_date: invoiceDateInput.value,
        payment_type: document.getElementById('paymentType').value,
        notes: document.getElementById('invoiceNotes').value,
        items: items,
        total_amount: parseFloat(invoiceTotalSpan.textContent)
    };

    try {
        const result = await window.electronAPI.savePurchaseInvoice(invoiceData);
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
    const supplierId = supplierSelect.value;
    if (!supplierId) {
        alert(t('purchases.toast.selectSupplier', 'الرجاء اختيار المورد'));
        return;
    }

    const items = [];
    let isValid = true;

    document.querySelectorAll('#invoiceItemsBody tr').forEach(row => {
        const itemId = row.querySelector('.item-select').value;
        const quantity = parseFloat(row.querySelector('.quantity-input').value);
        const price = parseFloat(row.querySelector('.price-input').value);

        // Check if row is completely empty (no item, no quantity, no price or price is 0)
        const isItemEmpty = !itemId;
        const isQuantityEmpty = isNaN(quantity) || quantity === 0;
        const isPriceEmpty = isNaN(price) || price === 0;

        if (isItemEmpty && isQuantityEmpty && isPriceEmpty) {
            return; // Skip empty row
        }

        // If row has partial data, mark as invalid
        if (!itemId || !quantity || isNaN(price)) {
            isValid = false;
            return;
        }

        items.push({
            item_id: itemId,
            quantity: quantity,
            cost_price: price,
            total_price: quantity * price
        });
    });

    if (!isValid || items.length === 0) {
        alert(t('purchases.noItemsData', 'الرجاء إدخال جميع بيانات الأصناف بشكل صحيح (يجب إضافة صنف واحد على الأقل)'));
        return;
    }

    const invoiceData = {
        id: editingInvoiceId,
        supplier_id: supplierId,
        invoice_number: document.getElementById('invoiceNumber').value,
        invoice_date: invoiceDateInput.value,
        payment_type: document.getElementById('paymentType').value,
        notes: document.getElementById('invoiceNotes').value,
        items: items,
        total_amount: parseFloat(invoiceTotalSpan.textContent)
    };

    try {
        const result = await window.electronAPI.updatePurchaseInvoice(invoiceData);
        if (result.success) {
            alert(t('purchases.toast.updateSuccess', 'تم تحديث الفاتورة بنجاح'));
            window.location.href = 'index.html'; // Reload to clear edit mode
        } else {
            alert(t('purchases.toast.updateError', 'حدث خطأ أثناء التحديث: ') + result.error);
        }
    } catch (error) {
        alert(t('purchases.toast.unexpectedError', 'حدث خطأ غير متوقع: ') + error.message);
    }
}
