
document.addEventListener('DOMContentLoaded', async () => {
    const app = document.getElementById('app');
    
    // State
    let warehouses = [];
    let items = [];
    let history = []; // History of items
    let currentGroupItems = []; // Items in the current form
    let selectedWarehouseId = '';
    let isEditingGroup = false;
    let editingGroupId = null;
    
    // Initialize
    await loadData();
    render();

    async function loadData() {
        try {
            const [whData, itemsData, historyData] = await Promise.all([
                window.electronAPI.getWarehouses(),
                window.electronAPI.getItems(),
                window.electronAPI.getOpeningBalances()
            ]);
            warehouses = whData || [];
            items = itemsData || [];
            history = historyData || [];
        } catch (error) {
            console.error('Error loading data:', error);
            Toast.show('فشل تحميل البيانات', 'error');
        }
    }

    function render() {
        app.innerHTML = `
            <style>
                /* Table Alignment Fixes */
                .entry-table th, .entry-table td {
                    text-align: center !important;
                    vertical-align: middle !important;
                }
                /* Align the first column (Item Name) to the right for better readability in Arabic */
                .entry-table th:first-child, .entry-table td:first-child {
                    text-align: right !important;
                    padding-right: 15px;
                }
                /* Button Styling */
                .btn-icon-text {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    justify-content: center;
                }
            </style>
            <nav class="top-nav">
                <div class="nav-brand">نظام المحاسبة</div>
                <ul class="nav-links">
                    <li><a href="../dashboard/index.html">لوحة التحكم</a></li>
                    <li class="dropdown">
                        <a href="#" class="active">البيانات الأساسية</a>
                        <div class="dropdown-content">
                            <a href="../items/units.html">الوحدات</a>
                            <a href="../items/items.html">الأصناف</a>
                            <a href="../customers/index.html">العملاء والموردين</a>
                            <a href="../opening-balance/index.html">بيانات أول المدة</a>
                        </div>
                    </li>
                    <li><a href="../sales/index.html">المبيعات</a></li>
                    <li><a href="../purchases/index.html">المشتريات</a></li>
                    <li><a href="../inventory/index.html">المخزن</a></li>
                    <li><a href="../finance/index.html">المالية</a></li>
                    <li class="dropdown">
                        <a href="#">التقارير</a>
                        <div class="dropdown-content">
                            <a href="../reports/index.html">التقارير العامة</a>
                            <a href="../customer-reports/index.html">تقارير العملاء</a>
                        </div>
                    </li>
                    <li><a href="../settings/index.html">الإعدادات</a></li>
                </ul>
            </nav>

            <div class="content">
                <div class="page-header">
                    <h1 class="page-title">بيانات أول المدة</h1>
                    <div class="stats-grid" style="margin-bottom: 0; flex: 1; justify-content: flex-end; display: flex; gap: 20px;">
                        <div class="stat-card" style="min-width: 200px;">
                            <div class="stat-icon" style="background: rgba(37,99,235,0.1); color: var(--accent-color);">
                                <i class="fas fa-box"></i>
                            </div>
                            <div class="stat-info">
                                <h4>إجمالي الأصناف</h4>
                                <p class="value">${history.length}</p>
                            </div>
                        </div>
                        <div class="stat-card" style="min-width: 200px;">
                            <div class="stat-icon" style="background: rgba(16,185,129,0.1); color: var(--success-color);">
                                <i class="fas fa-coins"></i>
                            </div>
                            <div class="stat-info">
                                <h4>إجمالي القيمة</h4>
                                <p class="value">${formatCurrency(history.reduce((sum, item) => sum + (item.quantity * item.cost_price), 0))}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Global Warehouse Selection -->
                <div class="card" style="margin-bottom: 20px; background: var(--bg-color); border: none; box-shadow: none;">
                    <div style="display: flex; align-items: center; gap: 15px; background: var(--card-bg); padding: 15px; border-radius: 12px; border: 1px solid var(--table-border);">
                        <div style="flex: 1;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-color);">المخزن الافتراضي للإضافة</label>
                            <div style="display: flex; gap: 10px;">
                                <select id="global-warehouse-select" class="form-control" style="font-size: 1.1rem; padding: 10px;">
                                    <option value="">اختر المخزن...</option>
                                    ${warehouses.map(w => `<option value="${w.id}" ${w.id == selectedWarehouseId ? 'selected' : ''}>${w.name}</option>`).join('')}
                                </select>
                                <button id="add-warehouse-btn" class="btn btn-primary" title="إضافة مخزن جديد" style="padding: 0 20px; display: flex; align-items: center; gap: 8px; white-space: nowrap;">
                                    <i class="fas fa-plus"></i>
                                    <span>إضافة مخزن</span>
                                </button>
                                <button id="manage-warehouses-btn" class="btn btn-outline" title="إدارة المخازن" style="padding: 0 20px; display: flex; align-items: center; gap: 8px; white-space: nowrap;">
                                    <i class="fas fa-cog"></i>
                                    <span>إدارة المخازن</span>
                                </button>
                            </div>
                        </div>
                        <div style="flex: 2; color: var(--muted-text); font-size: 0.9rem; padding-right: 20px; border-right: 1px solid var(--table-border);">
                            <i class="fas fa-info-circle"></i>
                            يمكنك تغيير المخزن لكل صنف على حدة، ولكن سيتم استخدام هذا المخزن بشكل افتراضي.
                        </div>
                    </div>
                </div>

                <!-- Manage Warehouses Modal -->
                <div id="manage-warehouses-modal" class="modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 2000; align-items: center; justify-content: center;">
                    <div class="modal-content" style="background: var(--card-bg); padding: 0; border-radius: 12px; width: 600px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); overflow: hidden; display: flex; flex-direction: column; max-height: 80vh;">
                        <div class="modal-header" style="padding: 20px; border-bottom: 1px solid var(--table-border); display: flex; justify-content: space-between; align-items: center; background: var(--table-header-bg);">
                            <h3 style="margin: 0;">إدارة المخازن</h3>
                            <button id="close-manage-modal" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-color);"><i class="fas fa-times"></i></button>
                        </div>
                        <div class="modal-body" style="padding: 20px; overflow-y: auto;">
                            <div class="table-container">
                                <table class="entry-table">
                                    <thead>
                                        <tr>
                                            <th>اسم المخزن</th>
                                            <th style="width: 200px;">إجراءات</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${warehouses.length > 0 ? warehouses.map(w => `
                                            <tr>
                                                <td>${w.name}</td>
                                                <td>
                                                    <button class="btn-edit-warehouse btn btn-sm btn-outline btn-icon-text" data-id="${w.id}" data-name="${w.name}" title="تعديل">
                                                        <i class="fas fa-edit"></i> تعديل
                                                    </button>
                                                    <button class="btn-delete-warehouse btn btn-sm btn-danger btn-icon-text" data-id="${w.id}" title="حذف">
                                                        <i class="fas fa-trash"></i> حذف
                                                    </button>
                                                </td>
                                            </tr>
                                        `).join('') : `
                                            <tr>
                                                <td colspan="2" class="empty-state">لا توجد مخازن مضافة</td>
                                            </tr>
                                        `}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Add/Edit Warehouse Modal -->
                <div id="warehouse-modal" class="modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 2100; align-items: center; justify-content: center;">
                    <div class="modal-content" style="background: var(--card-bg); padding: 25px; border-radius: 12px; width: 400px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
                        <h3 id="modal-title" style="margin-top: 0;">إضافة مخزن جديد</h3>
                        <input type="hidden" id="warehouse-id">
                        <div class="form-group" style="margin: 20px 0;">
                            <label style="display: block; margin-bottom: 8px;">اسم المخزن</label>
                            <input type="text" id="new-warehouse-name" class="form-control" placeholder="أدخل اسم المخزن...">
                        </div>
                        <div style="display: flex; gap: 10px; justify-content: flex-end;">
                            <button id="cancel-warehouse-btn" class="btn btn-outline">إلغاء</button>
                            <button id="save-warehouse-btn" class="btn btn-primary">حفظ</button>
                        </div>
                    </div>
                </div>

                <div class="main-grid" style="grid-template-columns: 1fr; gap: 30px;">
                    <!-- New Group Card -->
                    <div class="card">
                        <div class="card-header">
                            <h3 id="form-title"><i class="fas fa-plus-circle"></i> تسجيل رصيد أول المدة (مجموعة)</h3>
                            <div style="display: flex; gap: 10px;">
                                <button id="cancel-group-edit-btn" class="btn btn-outline" style="display: none;">
                                    <i class="fas fa-times"></i> إلغاء التعديل
                                </button>
                            </div>
                        </div>
                        <div class="card-body">
                            <!-- Add Item Form -->
                            <div class="entry-form" style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr auto; gap: 20px; align-items: end; padding: 20px; background: var(--bg-color); border-radius: 8px; border: 1px solid var(--table-border);">
                                <div class="form-group" style="min-width: 250px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">الصنف</label>
                                    <select id="item-select" class="form-control">
                                        <option value="">اختر الصنف...</option>
                                        ${items.map(item => `<option value="${item.id}" data-cost="${item.cost_price || 0}" data-unit="${item.unit_name || ''}">${item.name} - ${item.barcode || ''}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">الوحدة</label>
                                    <input type="text" id="unit-input" class="form-control" readonly placeholder="-" style="background: var(--card-bg);">
                                </div>
                                <div class="form-group">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">الكمية</label>
                                    <input type="number" id="quantity-input" class="form-control" min="1" placeholder="0">
                                </div>
                                <div class="form-group">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">سعر الشراء</label>
                                    <input type="number" id="cost-input" class="form-control" min="0" step="0.01" placeholder="0.00">
                                </div>
                                <div class="form-group">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">الإجمالي</label>
                                    <input type="text" id="total-input" class="form-control" readonly placeholder="0.00" style="background: var(--card-bg); cursor: not-allowed;">
                                </div>
                                <div class="form-group">
                                    <button id="add-to-list-btn" class="btn btn-primary" style="height: 42px;">
                                        <i class="fas fa-plus"></i> إضافة للقائمة
                                    </button>
                                </div>
                            </div>

                            <!-- Items List -->
                            <div style="margin-top: 20px;">
                                <h4 style="margin-bottom: 10px;">الأصناف المضافة</h4>
                                <div class="table-container" style="max-height: 300px; overflow-y: auto; border: 1px solid var(--table-border); border-radius: 8px;">
                                    <table class="entry-table" id="current-items-table">
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>الصنف</th>
                                                <th>المخزن</th>
                                                <th>الكمية</th>
                                                <th>سعر الشراء</th>
                                                <th>الإجمالي</th>
                                                <th>إجراءات</th>
                                            </tr>
                                        </thead>
                                        <tbody id="current-items-tbody">
                                            <!-- Items will be rendered here -->
                                        </tbody>
                                    </table>
                                </div>

                                <!-- Group Details (Notes) - Moved Here -->
                                <div class="form-group" style="margin-top: 20px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">ملاحظات / بيان</label>
                                    <input type="text" id="group-notes" class="form-control" placeholder="مثال: رصيد افتتاحي للمخزن الرئيسي...">
                                </div>

                                <div style="margin-top: 20px; display: flex; justify-content: flex-end; gap: 15px; align-items: center;">
                                    <div style="font-size: 1.2rem; font-weight: 700;">
                                        الإجمالي الكلي: <span id="grand-total">0.00 ج.م</span>
                                    </div>
                                    <button id="save-group-btn" class="btn btn-success" style="padding: 10px 30px; font-size: 1.1rem;">
                                        <i class="fas fa-save"></i> حفظ المجموعة
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- History Card -->
                    <div class="card">
                        <div class="card-header">
                            <h3><i class="fas fa-history"></i> سجل الأرصدة المضافة</h3>
                        </div>
                        <div class="card-body" style="padding: 0;">
                            <div class="table-container" style="max-height: 500px; overflow-y: auto;">
                                <table class="entry-table history-table">
                                    <thead>
                                        <tr>
                                            <th>الصنف</th>
                                            <th>المخزن</th>
                                            <th>الكمية</th>
                                            <th>سعر الشراء</th>
                                            <th>الإجمالي</th>
                                            <th>تاريخ الإضافة</th>
                                            <th>إجراءات</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${history.length > 0 ? history.map(row => `
                                            <tr>
                                                <td>${row.item_name || '-'}</td>
                                                <td>${row.warehouse_name || '-'}</td>
                                                <td>${row.quantity}</td>
                                                <td>${formatCurrency(row.cost_price)}</td>
                                                <td>${formatCurrency(row.quantity * row.cost_price)}</td>
                                                <td class="muted">${row.created_at ? new Date(row.created_at).toLocaleDateString('ar-EG') : '-'}</td>
                                                <td>
                                                    <button class="btn-edit-entry btn btn-sm btn-outline btn-icon-text" data-id="${row.id}" data-group="${row.group_id || ''}" title="تعديل">
                                                        <i class="fas fa-edit"></i> تعديل
                                                    </button>
                                                    <button class="btn-delete-entry btn btn-sm btn-danger btn-icon-text" data-id="${row.id}" title="حذف">
                                                        <i class="fas fa-trash"></i> حذف
                                                    </button>
                                                </td>
                                            </tr>
                                        `).join('') : `
                                            <tr>
                                                <td colspan="7" class="empty-state">لا توجد بيانات مضافة بعد</td>
                                            </tr>
                                        `}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        setupInteractions();
        renderCurrentItems();
    }

    function renderCurrentItems() {
        const tbody = document.getElementById('current-items-tbody');
        const grandTotalEl = document.getElementById('grand-total');
        
        if (currentGroupItems.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="empty-state">لم يتم إضافة أصناف للقائمة بعد</td></tr>`;
            grandTotalEl.textContent = formatCurrency(0);
            return;
        }

        let total = 0;
        tbody.innerHTML = currentGroupItems.map((item, index) => {
            const itemTotal = item.quantity * item.cost_price;
            total += itemTotal;
            const itemData = items.find(i => i.id == item.item_id);
            const whData = warehouses.find(w => w.id == item.warehouse_id);
            
            return `
                <tr>
                    <td>${index + 1}</td>
                    <td>${itemData ? itemData.name : 'غير معروف'}</td>
                    <td>${whData ? whData.name : 'غير معروف'}</td>
                    <td>${item.quantity}</td>
                    <td>${formatCurrency(item.cost_price)}</td>
                    <td>${formatCurrency(itemTotal)}</td>
                    <td>
                        <button class="btn-edit-item-list btn btn-sm btn-outline btn-icon-text" data-index="${index}" title="تعديل">
                            <i class="fas fa-edit"></i> تعديل
                        </button>
                        <button class="btn-remove-item btn btn-sm btn-danger btn-icon-text" data-index="${index}" title="حذف من القائمة">
                            <i class="fas fa-trash"></i> حذف
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        grandTotalEl.textContent = formatCurrency(total);

        // Add listeners for remove buttons
        document.querySelectorAll('.btn-remove-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                currentGroupItems.splice(index, 1);
                renderCurrentItems();
            });
        });

        // Add listeners for edit buttons
        document.querySelectorAll('.btn-edit-item-list').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                const item = currentGroupItems[index];
                
                // Populate form
                document.getElementById('item-select').value = item.item_id;
                document.getElementById('quantity-input').value = item.quantity;
                document.getElementById('cost-input').value = item.cost_price;
                
                // Trigger change for unit/cost
                const itemSelect = document.getElementById('item-select');
                const selectedOption = itemSelect.querySelector(`option[value="${item.item_id}"]`);
                if (selectedOption) {
                    const input = itemSelect.parentElement.querySelector('.autocomplete-input');
                    if (input) input.value = selectedOption.text;
                    document.getElementById('unit-input').value = selectedOption.dataset.unit || '';
                }
                
                calculateTotal();
                
                // Remove from list
                currentGroupItems.splice(index, 1);
                renderCurrentItems();
                
                // Focus quantity
                document.getElementById('quantity-input').focus();
            });
        });
    }

    function setupInteractions() {
        // Global Warehouse Select
        const warehouseSelect = document.getElementById('global-warehouse-select');
        warehouseSelect.addEventListener('change', (e) => {
            selectedWarehouseId = e.target.value;
        });

        // Manage Warehouses Modal Logic
        const manageModal = document.getElementById('manage-warehouses-modal');
        const manageBtn = document.getElementById('manage-warehouses-btn');
        const closeManageBtn = document.getElementById('close-manage-modal');

        manageBtn.addEventListener('click', () => {
            manageModal.style.display = 'flex';
        });

        closeManageBtn.addEventListener('click', () => {
            manageModal.style.display = 'none';
        });

        manageModal.addEventListener('click', (e) => {
            if (e.target === manageModal) manageModal.style.display = 'none';
        });

        // Add Warehouse Modal Logic
        const modal = document.getElementById('warehouse-modal');
        const addWhBtn = document.getElementById('add-warehouse-btn');
        const cancelWhBtn = document.getElementById('cancel-warehouse-btn');
        const saveWhBtn = document.getElementById('save-warehouse-btn');
        const whNameInput = document.getElementById('new-warehouse-name');
        const whIdInput = document.getElementById('warehouse-id');
        const modalTitle = document.getElementById('modal-title');

        addWhBtn.addEventListener('click', () => {
            modal.style.display = 'flex';
            modalTitle.textContent = 'إضافة مخزن جديد';
            whIdInput.value = '';
            whNameInput.value = '';
            whNameInput.focus();
        });

        // Edit Warehouse Buttons
        document.querySelectorAll('.btn-edit-warehouse').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const name = btn.dataset.name;
                manageModal.style.display = 'none';
                modal.style.display = 'flex';
                modalTitle.textContent = 'تعديل بيانات المخزن';
                whIdInput.value = id;
                whNameInput.value = name;
                whNameInput.focus();
            });
        });

        // Delete Warehouse Buttons
        document.querySelectorAll('.btn-delete-warehouse').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                if (confirm('هل أنت متأكد من حذف هذا المخزن؟')) {
                    try {
                        const result = await window.electronAPI.deleteWarehouse(id);
                        if (result.success) {
                            Toast.show('تم حذف المخزن بنجاح', 'success');
                            const whData = await window.electronAPI.getWarehouses();
                            warehouses = whData || [];
                            if (selectedWarehouseId == id) selectedWarehouseId = '';
                            render();
                            document.getElementById('manage-warehouses-btn').click();
                        } else {
                            Toast.show('خطأ: ' + result.error, 'error');
                        }
                    } catch (error) {
                        console.error(error);
                        Toast.show('حدث خطأ أثناء حذف المخزن', 'error');
                    }
                }
            });
        });

        cancelWhBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            if (whIdInput.value) {
                manageModal.style.display = 'flex';
            }
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                if (whIdInput.value) {
                    manageModal.style.display = 'flex';
                }
            }
        });

        saveWhBtn.addEventListener('click', async () => {
            const name = whNameInput.value.trim();
            const id = whIdInput.value;
            
            if (name) {
                try {
                    let result;
                    if (id) {
                        result = await window.electronAPI.updateWarehouse({ id, name });
                    } else {
                        result = await window.electronAPI.addWarehouse(name);
                    }

                    if (result.success) {
                        Toast.show(id ? 'تم تحديث المخزن بنجاح' : 'تم إضافة المخزن بنجاح', 'success');
                        const whData = await window.electronAPI.getWarehouses();
                        warehouses = whData || [];
                        if (!id) selectedWarehouseId = result.id;
                        modal.style.display = 'none';
                        render();
                        if (id) {
                            document.getElementById('manage-warehouses-btn').click();
                        }
                    } else {
                        Toast.show('خطأ: ' + result.error, 'error');
                    }
                } catch (error) {
                    console.error(error);
                    Toast.show('حدث خطأ أثناء حفظ المخزن', 'error');
                }
            } else {
                Toast.show('الرجاء إدخال اسم المخزن', 'error');
            }
        });

        // Autocomplete
        const itemSelect = document.getElementById('item-select');
        new Autocomplete(itemSelect);

        itemSelect.addEventListener('change', () => {
            const selectedOption = itemSelect.options[itemSelect.selectedIndex];
            const cost = selectedOption.dataset.cost;
            const unit = selectedOption.dataset.unit;
            
            if (cost) {
                document.getElementById('cost-input').value = cost;
            }
            document.getElementById('unit-input').value = unit || '';
            document.getElementById('quantity-input').focus();
            calculateTotal();
        });

        // Add To List Button
        document.getElementById('add-to-list-btn').addEventListener('click', handleAddToList);

        // Enter key navigation
        document.getElementById('quantity-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') document.getElementById('cost-input').focus();
        });
        document.getElementById('cost-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleAddToList();
        });

        // Calculate Total
        document.getElementById('quantity-input').addEventListener('input', calculateTotal);
        document.getElementById('cost-input').addEventListener('input', calculateTotal);

        // Save Group Button
        document.getElementById('save-group-btn').addEventListener('click', handleSaveGroup);

        // Edit Group Buttons
        document.querySelectorAll('.btn-edit-group').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                await loadGroupForEdit(id);
            });
        });

        // Delete Group Buttons
        document.querySelectorAll('.btn-delete-group').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                if (confirm('هل أنت متأكد من حذف هذه المجموعة بالكامل؟ سيتم خصم الكميات من المخزون.')) {
                    try {
                        const result = await window.electronAPI.deleteOpeningBalanceGroup(id);
                        if (result.success) {
                            Toast.show('تم الحذف بنجاح', 'success');
                            const groupsData = await window.electronAPI.getOpeningBalanceGroups();
                            groups = groupsData || [];
                            render();
                        } else {
                            Toast.show('خطأ: ' + result.error, 'error');
                        }
                    } catch (error) {
                        console.error(error);
                        Toast.show('حدث خطأ أثناء الحذف', 'error');
                    }
                }
            });
        });

        // Cancel Group Edit
        document.getElementById('cancel-group-edit-btn').addEventListener('click', () => {
            resetGroupForm();
        });
    }

    function calculateTotal() {
        const qty = parseFloat(document.getElementById('quantity-input').value) || 0;
        const cost = parseFloat(document.getElementById('cost-input').value) || 0;
        const total = qty * cost;
        document.getElementById('total-input').value = total.toFixed(2);
    }

    function handleAddToList() {
        const warehouseId = selectedWarehouseId;
        const itemId = document.getElementById('item-select').value;
        const quantity = document.getElementById('quantity-input').value;
        const costPrice = document.getElementById('cost-input').value;

        if (!warehouseId) return Toast.show('الرجاء اختيار المخزن من أعلى الصفحة', 'error');
        if (!itemId) return Toast.show('الرجاء اختيار الصنف', 'error');
        if (!quantity || quantity <= 0) return Toast.show('الرجاء إدخال كمية صحيحة', 'error');

        const item = {
            item_id: Number(itemId),
            warehouse_id: Number(warehouseId),
            quantity: Number(quantity),
            cost_price: Number(costPrice) || 0
        };

        currentGroupItems.push(item);
        renderCurrentItems();
        
        // Reset inputs for next item
        document.getElementById('quantity-input').value = '';
        document.getElementById('cost-input').value = '';
        document.getElementById('total-input').value = '';
        document.getElementById('unit-input').value = '';
        
        const itemSelect = document.getElementById('item-select');
        itemSelect.value = "";
        const input = itemSelect.parentElement.querySelector('.autocomplete-input');
        if (input) {
            input.value = '';
            input.focus(); // Focus back for rapid entry
        }
    }

    async function handleSaveGroup() {
        if (currentGroupItems.length === 0) {
            return Toast.show('الرجاء إضافة أصناف للقائمة أولاً', 'error');
        }

        const notes = document.getElementById('group-notes').value;
        const payload = {
            id: isEditingGroup ? editingGroupId : null,
            notes: notes,
            items: currentGroupItems
        };

        try {
            let result;
            if (isEditingGroup) {
                result = await window.electronAPI.updateOpeningBalanceGroup(payload);
            } else {
                result = await window.electronAPI.addOpeningBalanceGroup(payload);
            }

            if (result.success) {
                Toast.show(isEditingGroup ? 'تم تعديل المجموعة بنجاح' : 'تم حفظ المجموعة بنجاح', 'success');
                resetGroupForm();
                
                // Reload history
                await loadData();
                render();
            } else {
                Toast.show('فشل الحفظ: ' + result.error, 'error');
            }
        } catch (error) {
            console.error(error);
            Toast.show('حدث خطأ أثناء الحفظ', 'error');
        }
    }

    async function loadGroupForEdit(id) {
        try {
            const [details, group] = await Promise.all([
                window.electronAPI.getGroupDetails(id),
                window.electronAPI.getOpeningBalanceGroup(id)
            ]);
            
            if (details && details.length > 0) {
                isEditingGroup = true;
                editingGroupId = id;
                currentGroupItems = details.map(d => ({
                    item_id: d.item_id,
                    warehouse_id: d.warehouse_id,
                    quantity: d.quantity,
                    cost_price: d.cost_price
                }));
                
                document.getElementById('group-notes').value = group ? (group.notes || '') : '';
                document.getElementById('form-title').innerHTML = `<i class="fas fa-edit"></i> تعديل المجموعة #${id}`;
                document.getElementById('save-group-btn').innerHTML = '<i class="fas fa-save"></i> حفظ التعديلات';
                document.getElementById('cancel-group-edit-btn').style.display = 'inline-flex';
                
                renderCurrentItems();
                document.querySelector('.card').scrollIntoView({ behavior: 'smooth' });
            } else {
                Toast.show('لم يتم العثور على تفاصيل المجموعة', 'error');
            }
        } catch (error) {
            console.error(error);
            Toast.show('فشل تحميل تفاصيل المجموعة', 'error');
        }
    }

    function resetGroupForm() {
        isEditingGroup = false;
        editingGroupId = null;
        currentGroupItems = [];
        document.getElementById('group-notes').value = '';
        document.getElementById('form-title').innerHTML = '<i class="fas fa-plus-circle"></i> تسجيل رصيد أول المدة (مجموعة)';
        document.getElementById('save-group-btn').innerHTML = '<i class="fas fa-save"></i> حفظ المجموعة';
        document.getElementById('cancel-group-edit-btn').style.display = 'none';
        renderCurrentItems();
    }

    function formatCurrency(amount) {
        return new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' }).format(amount);
    }
});
