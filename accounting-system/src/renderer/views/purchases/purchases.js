let supplierSelect, invoiceDateInput, invoiceItemsBody, invoiceTotalSpan, invoiceForm;
let allItems = [];
let editingInvoiceId = null;
let supplierAutocomplete = null;
let isSubmitting = false;

document.addEventListener('DOMContentLoaded', () => {
    renderPage();
    initializeElements();
    
    // Set default date to today
    invoiceDateInput.valueAsDate = new Date();
    
    // Load data in parallel for better performance
    Promise.all([
        loadSuppliers(),
        loadItems()
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
        <nav class="top-nav">
            <div class="nav-brand">نظام المحاسبة</div>
            <ul class="nav-links">
                <li><a href="../dashboard/index.html">لوحة التحكم</a></li>
                <li class="dropdown">
                    <a href="#">البيانات الأساسية</a>
                    <div class="dropdown-content">
                        <a href="../items/units.html">الوحدات</a>
                        <a href="../items/items.html">الأصناف</a>
                        <a href="../customers/index.html">العملاء والموردين</a>
                        <a href="../opening-balance/index.html">بيانات أول المدة</a>
                    </div>
                </li>
                <li><a href="../sales/index.html">المبيعات</a></li>
                <li><a href="#" class="active">المشتريات</a></li>
                <li><a href="../inventory/index.html">المخزن</a></li>
                <li><a href="../finance/index.html">المالية</a></li>
                <li><a href="../payments/receipt.html">تحصيل من عميل</a></li>
                <li><a href="../payments/payment.html">سداد لمورد</a></li>
                <li class="dropdown">
                    <a href="#">التقارير</a>
                    <div class="dropdown-content">
                        <a href="../reports/index.html">التقارير العامة</a>
                        <a href="../customer-reports/index.html">تقارير العملاء</a>
                        <a href="../reports/debtor-creditor/index.html">كشف المدين والدائن</a>
                    </div>
                </li>
                <li><a href="../settings/index.html">الإعدادات</a></li>
            </ul>
        </nav>

        <div class="page-header">
            <h1 class="page-title">فواتير المشتريات</h1>
        </div>

        <!-- Invoice Form -->
        <div id="invoiceForm" class="invoice-form-container">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0; color: var(--primary-color);">تسجيل فاتورة شراء جديدة</h2>
            </div>

            <div class="invoice-top-grid">
                <div class="form-group">
                    <label>المورد</label>
                    <select id="supplierSelect" class="form-control">
                        <option value="">اختر المورد</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>رقم الفاتورة</label>
                    <input type="text" id="invoiceNumber" class="form-control" placeholder="تلقائي ويمكن تعديله يدويًا">
                </div>
                <div class="form-group">
                    <label>تاريخ الفاتورة</label>
                    <input type="date" id="invoiceDate" class="form-control">
                </div>
                <div class="form-group">
                    <label>طريقة الدفع</label>
                    <select id="paymentType" class="form-control">
                        <option value="cash">كاش (نقدي)</option>
                        <option value="credit">آجل (ذمم)</option>
                    </select>
                </div>
            </div>

            <table class="items-table">
                <thead>
                    <tr>
                        <th style="width: 40%">الصنف</th>
                        <th style="width: 15%">الكمية</th>
                        <th style="width: 20%">السعر</th>
                        <th style="width: 20%">الإجمالي</th>
                        <th style="width: 5%"></th>
                    </tr>
                </thead>
                <tbody id="invoiceItemsBody">
                    <!-- Items will be added here -->
                </tbody>
            </table>

            <button class="btn btn-primary" onclick="addInvoiceRow()">
                <span>+</span> إضافة صنف
            </button>

            <div class="invoice-footer-grid">
                <div class="form-group">
                    <label>ملاحظات</label>
                    <textarea id="invoiceNotes" class="form-control" rows="4"></textarea>
                </div>
                <div class="totals-panel">
                    <div class="total-row">
                        <span>الإجمالي:</span>
                        <span id="invoiceTotal">0.00</span>
                    </div>
                    <div class="grand-total">
                        <span>الصافي:</span>
                        <span id="finalTotal">0.00</span>
                    </div>
                    <button class="btn btn-success" style="width: 100%; margin-top: 20px;" onclick="submitInvoice()">
                        حفظ الفاتورة
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
            alert('الفاتورة غير موجودة');
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
        document.querySelector('#invoiceForm h2') ? document.querySelector('#invoiceForm h2').textContent = 'تعديل فاتورة شراء' : null;
        const saveBtn = document.querySelector('#invoiceForm .btn-success');
        saveBtn.textContent = 'تحديث وحفظ الفاتورة';
        saveBtn.disabled = false;
        saveBtn.removeAttribute('disabled');

    } catch (error) {
        console.error('[loadInvoiceForEdit] Error:', error);
        alert('حدث خطأ أثناء تحميل الفاتورة: ' + error.message);
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
    
    supplierSelect.innerHTML = '<option value="">اختر المورد</option>';
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

async function loadItems() {
    allItems = await window.electronAPI.getItems();
}

function addInvoiceRow(existingItem = null) {
    // Prevent adding rows if no supplier is selected (unless we are loading an existing invoice)
    if (!existingItem && !supplierSelect.value) {
        alert('الرجاء اختيار المورد أولاً');
        return;
    }

    const rowId = Date.now();
    const row = document.createElement('tr');
    row.dataset.id = rowId;
    
    let itemsOptions = '<option value="">اختر الصنف</option>';
    allItems.forEach(item => {
        // Use cost_price here for purchases
        const isSelected = existingItem && existingItem.item_id === item.id ? 'selected' : '';
        itemsOptions += `<option value="${item.id}" data-price="${item.cost_price}" ${isSelected}>${item.name} (متاح: ${item.stock_quantity})</option>`;
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
        alert('الرجاء اختيار المورد');
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
        alert('الرجاء إدخال جميع بيانات الأصناف بشكل صحيح (يجب إضافة صنف واحد على الأقل)');
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
            alert('تم حفظ الفاتورة بنجاح');
            window.location.reload();
        } else {
            alert('حدث خطأ أثناء الحفظ: ' + result.error);
        }
    } catch (error) {
        alert('حدث خطأ غير متوقع: ' + error.message);
    }
}

async function updateInvoice() {
    const supplierId = supplierSelect.value;
    if (!supplierId) {
        alert('الرجاء اختيار المورد');
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
        alert('الرجاء إدخال جميع بيانات الأصناف بشكل صحيح (يجب إضافة صنف واحد على الأقل)');
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
            alert('تم تحديث الفاتورة بنجاح');
            window.location.href = 'index.html'; // Reload to clear edit mode
        } else {
            alert('حدث خطأ أثناء التحديث: ' + result.error);
        }
    } catch (error) {
        alert('حدث خطأ غير متوقع: ' + error.message);
    }
}
