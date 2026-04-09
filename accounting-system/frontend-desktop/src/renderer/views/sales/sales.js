let customerSelect, invoiceDateInput, invoiceItemsBody, invoiceTotalSpan, invoiceForm;
let allItems = [];
let editingInvoiceId = null;
let customerAutocomplete = null;
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
        loadCustomers(),
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

        <div class="content sales-content">
            <div class="sales-page-header">
                <div class="sales-title-wrap">
                    <h1 class="page-title">${t('sales.pageTitle', 'فواتير المبيعات')}</h1>
                    <p class="sales-subtitle">${t('sales.subtitle', 'ترتيب واضح وسريع لتسجيل الفاتورة ومراجعة الإجمالي قبل الحفظ.')}</p>
                </div>
            </div>

            <div id="invoiceForm" class="invoice-form-container">
                <div class="invoice-shell">
                    <div class="form-title-row">
                        <h2 class="form-title">${t('sales.formTitle', 'تسجيل فاتورة بيع جديدة')}</h2>
                        <span class="form-status-chip">${t('sales.formStatusChip', 'فاتورة مبيعات')}</span>
                    </div>

                    <div class="invoice-top-grid">
                        <div class="form-group">
                            <label>${t('sales.customer', 'العميل')}</label>
                            <select id="customerSelect" class="form-control">
                                <option value="">${t('sales.selectCustomer', 'اختر العميل')}</option>
                            </select>
                            <div id="customerBalance" class="customer-balance" style="display: none;"></div>
                        </div>

                        <div class="form-group">
                            <label>${t('sales.invoiceNumber', 'رقم الفاتورة')}</label>
                            <input type="text" id="invoiceNumber" class="form-control" list="invoiceSuggestions" placeholder="${t('sales.autoNumber', 'تلقائي')}" autocomplete="off">
                            <datalist id="invoiceSuggestions"></datalist>
                        </div>

                        <div class="form-group">
                            <label>${t('sales.invoiceDate', 'تاريخ الفاتورة')}</label>
                            <input type="date" id="invoiceDate" class="form-control">
                        </div>

                        <div class="form-group">
                            <label>${t('sales.paymentType', 'طريقة الدفع')}</label>
                            <select id="paymentType" class="form-control">
                                <option value="cash">${t('sales.paymentCash', 'كاش (نقدي)')}</option>
                                <option value="credit" selected>${t('sales.paymentCredit', 'آجل (ذمم)')}</option>
                            </select>
                        </div>
                    </div>

                    <div class="items-section">
                        <div class="items-section-head">
                            <h3 class="items-section-title">${t('sales.invoiceItems', 'أصناف الفاتورة')}</h3>
                            <button class="btn btn-outline" onclick="addInvoiceRow()">${t('sales.addItemBtn', '+ إضافة صنف')}</button>
                        </div>

                        <div class="items-table-wrap">
                            <table class="items-table">
                                <thead>
                                    <tr>
                                        <th style="width: 35%;">${t('sales.tableHeaders.item', 'الصنف')}</th>
                                        <th style="width: 10%;">${t('sales.tableHeaders.unit', 'الوحدة')}</th>
                                        <th style="width: 15%;">${t('sales.tableHeaders.qty', 'الكمية')}</th>
                                        <th style="width: 17.5%;">${t('sales.tableHeaders.price', 'سعر البيع')}</th>
                                        <th style="width: 17.5%;">${t('sales.tableHeaders.total', 'الإجمالي')}</th>
                                        <th style="width: 5%;"></th>
                                    </tr>
                                </thead>
                                <tbody id="invoiceItemsBody"></tbody>
                            </table>
                        </div>
                    </div>

                    <div class="invoice-footer-grid">
                        <div class="notes-section">
                            <div class="form-group">
                                <label>${t('sales.notesLabel', 'ملاحظات / شروط الدفع')}</label>
                                <textarea id="invoiceNotes" class="form-control" rows="4" placeholder="${t('sales.notesPlaceholder2', 'اكتب أي ملاحظات إضافية على الفاتورة...')}"></textarea>
                            </div>
                        </div>

                        <div class="totals-panel">
                            <div class="total-row grand-total">
                                <span>${t('sales.grandTotal', 'الإجمالي النهائي:')}</span>
                                <span id="invoiceTotal">0.00</span>
                            </div>
                            <button class="btn btn-success" onclick="submitInvoice()">
                                ${t('sales.saveAndPost', 'حفظ وترحيل الفاتورة')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}
function initializeElements() {
    customerSelect = document.getElementById('customerSelect');
    invoiceDateInput = document.getElementById('invoiceDate');
    invoiceItemsBody = document.getElementById('invoiceItemsBody');
    invoiceTotalSpan = document.getElementById('invoiceTotal');
    invoiceForm = document.getElementById('invoiceForm');

    customerSelect.addEventListener('change', async () => {
        if (customerSelect.value) {
            // عرض رصيد العميل
            await displayCustomerBalance();
            
            if (invoiceItemsBody.children.length === 0) {
                addInvoiceRow();
            }
        } else {
            // إخفاء رصيد العميل
            const balanceDiv = document.getElementById('customerBalance');
            if (balanceDiv) balanceDiv.style.display = 'none';
        }
    });
}

async function initializeNewInvoice() {
    // Auto-generate invoice number
    const nextId = await window.electronAPI.getNextInvoiceNumber('sales');
    document.getElementById('invoiceNumber').value = nextId;
}

async function loadInvoiceForEdit(id) {
    console.log('[loadInvoiceForEdit] START - id:', id);
    
    // Removed isInvoiceLoading check to allow unrestricted editing
    
    try {
        const invoice = await window.electronAPI.getInvoiceWithDetails(id, 'sales');
        if (!invoice) {
            alert(t('sales.invoiceNotFound', 'الفاتورة غير موجودة'));
            return;
        }

        editingInvoiceId = id;
        
        // Populate Form
        customerSelect.value = invoice.customer_id;
        if (customerAutocomplete) customerAutocomplete.refresh();
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
        document.querySelector('#invoiceForm h2').textContent = t('sales.editFormTitle', 'تعديل فاتورة بيع');
        const saveBtn = document.querySelector('#invoiceForm .btn-success');
        saveBtn.textContent = t('sales.updateAndSave', 'تحديث وحفظ الفاتورة');
        saveBtn.disabled = false;
        saveBtn.removeAttribute('disabled');

    } catch (error) {
        console.error('[loadInvoiceForEdit] Error:', error);
        alert(t('sales.toast.unexpectedError', 'حدث خطأ غير متوقع') + ': ' + error.message);
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

async function loadCustomers() {
    const customers = await window.electronAPI.getCustomers();
    // Filter for customers (assuming type 'customer' or 'both')
    const filteredCustomers = customers.filter(c => c.type === 'customer' || c.type === 'both');
    
    customerSelect.innerHTML = '<option value="">' + t('sales.selectCustomer', 'اختر العميل') + '</option>';
    filteredCustomers.forEach(customer => {
        const option = document.createElement('option');
        option.value = customer.id;
        option.textContent = customer.name;
        option.dataset.balance = customer.balance || 0;
        customerSelect.appendChild(option);
    });

    // Initialize/refresh Autocomplete once (NOT inside the loop)
    if (customerAutocomplete) {
        customerAutocomplete.refresh();
    } else {
        customerAutocomplete = new Autocomplete(customerSelect);
    }
}

async function loadInvoiceNumberSuggestions() {
    try {
        const invoices = await window.electronAPI.getSalesInvoices();
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

async function displayCustomerBalance() {
    const customerId = customerSelect.value;
    if (!customerId) return;
    
    const selectedOption = customerSelect.options[customerSelect.selectedIndex];
    const balance = parseFloat(selectedOption.dataset.balance || 0);
    
    const balanceDiv = document.getElementById('customerBalance');
    if (balanceDiv) {
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
}

async function loadItems() {
    allItems = await window.electronAPI.getItems();
}

function addInvoiceRow(existingItem = null) {
    if (!existingItem && !customerSelect.value) {
        alert(t('sales.selectCustomerFirst', 'الرجاء اختيار العميل أولا'));
        return;
    }

    const rowId = Date.now();
    const row = document.createElement('tr');
    row.dataset.id = rowId;
    
    let itemsOptions = '<option value="">' + t('sales.selectItem', 'اختر الصنف') + '</option>';
    allItems.forEach(item => {
        // Use sale_price here
        const isSelected = existingItem && existingItem.item_id === item.id ? 'selected' : '';
        itemsOptions += `<option value="${item.id}" data-price="${item.sale_price}" data-cost="${item.cost_price || 0}" ${isSelected}>${item.name} (${fmt(t('sales.available', 'متاح: {qty}'), { qty: item.stock_quantity })})</option>`;
    });

    const quantity = existingItem ? existingItem.quantity : '';
    const price = existingItem ? existingItem.sale_price : 0;
    const total = existingItem ? existingItem.total_price : 0;

    let unitName = '';
    if (existingItem) {
        const existingItemId = parseInt(existingItem.item_id);
        const match = Number.isFinite(existingItemId) ? allItems.find(i => i.id === existingItemId) : null;
        unitName = match && match.unit_name ? match.unit_name : '';
    }

    row.innerHTML = `
        <td>
            <select class="form-control item-select" onchange="onItemSelect(this)">
                ${itemsOptions}
            </select>
        </td>
        <td>
            <span class="unit-label">${unitName}</span>
        </td>
        <td>
            <input type="text" autocomplete="off" class="form-control quantity-input" value="${quantity}" placeholder="0" oninput="calculateRowTotal(this)">
        </td>
        <td>
            <input type="text" autocomplete="off" class="form-control price-input" value="${price}" oninput="calculateRowTotal(this)">
            <div class="profit-indicator"></div>
        </td>
        <td>
            <span class="row-total">${total.toFixed(2)}</span>
        </td>
        <td>
            <span class="remove-row" onclick="removeRow(this)">×</span>
        </td>
    `;
    
    invoiceItemsBody.appendChild(row);

    // Initialize Autocomplete
    const selectElement = row.querySelector('.item-select');
    const autocomplete = new Autocomplete(selectElement);

    // Update profit indicator for existing items
    if (existingItem) {
        updateProfitIndicator(row);
    }

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

    const itemId = parseInt(select.value);
    const match = Number.isFinite(itemId) ? allItems.find(i => i.id === itemId) : null;
    const unitName = match && match.unit_name ? match.unit_name : '';
    const unitEl = row.querySelector('.unit-label');
    if (unitEl) unitEl.textContent = unitName;
    
    row.querySelector('.price-input').value = price;
    calculateRowTotal(select);
    updateProfitIndicator(row);

    // Auto-focus quantity field after item selection
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

    // Arabic decimal/group separators
    s = s.replace(/[٬،]/g, '.');

    // Remove spaces
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
    document.querySelectorAll('#invoiceItemsBody tr').forEach(row => {
        const rowTotal = parseFloat(row.querySelector('.row-total').textContent) || 0;
        total += rowTotal;
    });
    invoiceTotalSpan.textContent = total.toFixed(2);
}

function collectInvoiceItemsFromForm() {
    const items = [];
    let isValid = true;

    document.querySelectorAll('#invoiceItemsBody tr').forEach(row => {
        const item_id = parseInt(row.querySelector('.item-select').value);
        const quantityRaw = row.querySelector('.quantity-input').value;
        const priceRaw = row.querySelector('.price-input').value;

        const quantity = parseLocaleFloat(quantityRaw);
        const sale_price = parseLocaleFloat(priceRaw);

        const quantityOk = Number.isFinite(quantity) && quantity > 0;
        const priceOk = Number.isFinite(sale_price) && sale_price >= 0;
        const itemOk = Number.isFinite(item_id) && item_id > 0;

        // If row is completely empty, skip it
        if (!itemOk && !quantityOk && (!priceOk || sale_price === 0)) {
            return;
        }

        // If row has partial data, mark as invalid
        if (!itemOk || !quantityOk || !priceOk) {
            isValid = false;
            return;
        }

        items.push({
            item_id: itemOk ? item_id : null,
            quantity: quantityOk ? quantity : 0,
            sale_price: priceOk ? sale_price : 0,
            total_price: (quantityOk ? quantity : 0) * (priceOk ? sale_price : 0)
        });
    });

    return { items, isValid: isValid && items.length > 0 };
}

async function updateInvoice() {
    if (!editingInvoiceId) {
        alert(t('sales.updateNoId', 'لا يمكن تحديث الفاتورة: رقم تعريف الفاتورة غير موجود'));
        return;
    }

    const customer_id = customerSelect.value;
    const invoice_date = invoiceDateInput.value || new Date().toISOString().slice(0, 10);
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
        id: editingInvoiceId,
        customer_id,
        invoice_number,
        invoice_date,
        payment_type,
        notes,
        items,
        total_amount: parseFloat(invoiceTotalSpan.textContent)
    };

    try {
        const result = await window.electronAPI.updateSalesInvoice(invoiceData);
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
    const customer_id = customerSelect.value;
    const invoice_date = invoiceDateInput.value || new Date().toISOString().slice(0, 10);
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

    const result = await window.electronAPI.saveSalesInvoice(invoiceData);
    
    if (result.success) {
        showToast(t('sales.toast.saveSuccess', 'تم حفظ الفاتورة بنجاح'), 'success');
        resetForm();
    } else {
        showToast(t('sales.toast.saveError', 'حدث خطأ') + ': ' + result.error, 'error');
    }
}

async function resetForm() {
    customerSelect.value = '';
    if (customerAutocomplete) customerAutocomplete.refresh();
    
    // إخفاء رصيد العميل
    const balanceDiv = document.getElementById('customerBalance');
    if (balanceDiv) balanceDiv.style.display = 'none';
    
    document.getElementById('invoiceNumber').value = '';
    document.getElementById('invoiceNotes').value = '';
    document.getElementById('paymentType').value = 'credit'; // Reset to default
    invoiceItemsBody.innerHTML = '';
    invoiceTotalSpan.textContent = '0.00';
    
    // Reset Edit Mode
    editingInvoiceId = null;
    document.querySelector('#invoiceForm h2').textContent = t('sales.formTitle', 'تسجيل فاتورة بيع جديدة');
    const saveBtn = document.querySelector('#invoiceForm .btn-success');
    saveBtn.textContent = t('sales.saveAndPost', 'حفظ وترحيل الفاتورة');
    
    // Clear URL params
    window.history.replaceState({}, document.title, window.location.pathname);

    // Initialize for new invoice
    await initializeNewInvoice();
}




