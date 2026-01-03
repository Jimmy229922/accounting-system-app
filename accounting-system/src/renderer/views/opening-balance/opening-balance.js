
document.addEventListener('DOMContentLoaded', async () => {
    // State
    let warehouses = [];
    let items = [];
    let history = []; // History of items
    let selectedWarehouseId = '';
    
    // Initialize
    setupInteractions();
    await loadData();

    // Listen for focus event to reload data when returning to this tab/window
    window.addEventListener('focus', async () => {
        await loadData();
    });

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

            updateUI();
        } catch (error) {
            console.error('Error loading data:', error);
            Toast.show('فشل تحميل البيانات', 'error');
        }
    }

    function updateUI() {
        updateStats();
        populateWarehouseSelect();
        populateItemSelect();
        renderWarehousesTable();
        renderHistory();
    }

    function updateStats() {
        document.getElementById('stats-total-items').textContent = history.length;
        const totalValue = history.reduce((sum, item) => sum + (item.quantity * item.cost_price), 0);
        document.getElementById('stats-total-value').textContent = formatCurrency(totalValue);
    }

    function populateWarehouseSelect() {
        const select = document.getElementById('global-warehouse-select');
        const currentVal = select.value || selectedWarehouseId;
        
        select.innerHTML = '<option value="">اختر المخزن...</option>' + 
            warehouses.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
        
        if (currentVal) {
            select.value = currentVal;
            selectedWarehouseId = currentVal;
        } else {
            const mainWarehouse = warehouses.find(w => w.name === 'المخزن الرئيسي');
            if (mainWarehouse) {
                select.value = mainWarehouse.id;
                selectedWarehouseId = mainWarehouse.id;
            }
        }
    }

    function populateItemSelect() {
        const select = document.getElementById('item-select');
        
        // Check if wrapped and reset
        const wrapper = select.closest('.autocomplete-wrapper');
        if (wrapper) {
            wrapper.parentNode.insertBefore(select, wrapper);
            wrapper.remove();
            select.style.display = 'block';
        }
        
        select.innerHTML = '<option value="">اختر الصنف...</option>' + 
            items.map(item => `<option value="${item.id}" data-cost="${item.cost_price || 0}" data-unit="${item.unit_name || ''}" data-qty="${item.stock_quantity || 0}">${item.name} - ${item.barcode || ''} (الكمية الحالية: ${item.stock_quantity || 0})</option>`).join('');
            
        new Autocomplete(select);
    }

    function renderWarehousesTable() {
        const tbody = document.getElementById('warehouses-tbody');
        if (warehouses.length > 0) {
            tbody.innerHTML = warehouses.map(w => `
                <tr>
                    <td>${w.name}</td>
                    <td>
                        <button class="btn-edit-warehouse btn btn-outline" data-id="${w.id}" data-name="${w.name}" title="تعديل" style="padding: 6px 12px; font-size: 0.85rem;">
                            <i class="fas fa-edit"></i> تعديل
                        </button>
                        <button class="btn-delete-warehouse btn btn-danger" data-id="${w.id}" title="حذف" style="padding: 6px 12px; font-size: 0.85rem;">
                            <i class="fas fa-trash"></i> حذف
                        </button>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = `<tr><td colspan="2" class="empty-state">لا توجد مخازن مضافة</td></tr>`;
        }
        
        attachWarehouseTableListeners();
    }

    function attachWarehouseTableListeners() {
        document.querySelectorAll('.btn-edit-warehouse').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const name = btn.dataset.name;
                document.getElementById('manage-warehouses-modal').style.display = 'none';
                
                const modal = document.getElementById('warehouse-modal');
                modal.style.display = 'flex';
                document.getElementById('modal-title').textContent = 'تعديل بيانات المخزن';
                document.getElementById('warehouse-id').value = id;
                document.getElementById('new-warehouse-name').value = name;
                document.getElementById('new-warehouse-name').focus();
            });
        });

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
                            
                            populateWarehouseSelect();
                            renderWarehousesTable();
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
    }

    function setupInteractions() {
        const warehouseSelect = document.getElementById('global-warehouse-select');
        warehouseSelect.addEventListener('change', (e) => {
            selectedWarehouseId = e.target.value;
        });

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
                        
                        populateWarehouseSelect();
                        renderWarehousesTable();
                        
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

        const itemSelect = document.getElementById('item-select');

        itemSelect.addEventListener('change', () => {
            const selectedOption = itemSelect.options[itemSelect.selectedIndex];
            if (!selectedOption) return;
            
            const cost = selectedOption.dataset.cost;
            const unit = selectedOption.dataset.unit;
            
            if (cost) {
                document.getElementById('cost-input').value = cost;
            }
            document.getElementById('unit-input').value = unit || '';
            document.getElementById('quantity-input').focus();
            calculateTotal();
        });

        document.getElementById('add-item-btn').addEventListener('click', handleAddItem);

        document.getElementById('quantity-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') document.getElementById('cost-input').focus();
        });
        document.getElementById('cost-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleAddItem();
        });

        document.getElementById('quantity-input').addEventListener('input', calculateTotal);
        document.getElementById('cost-input').addEventListener('input', calculateTotal);

        // Edit Entry Modal Listeners
        document.getElementById('save-edit-entry-btn').addEventListener('click', saveEditEntry);
        document.getElementById('cancel-edit-entry-btn').addEventListener('click', () => {
            document.getElementById('edit-entry-modal').style.display = 'none';
        });

        document.getElementById('apply-filter-btn').addEventListener('click', filterHistory);
    }

    function calculateTotal() {
        const qty = parseFloat(document.getElementById('quantity-input').value) || 0;
        const cost = parseFloat(document.getElementById('cost-input').value) || 0;
        const total = qty * cost;
        document.getElementById('total-input').value = total.toFixed(2);
    }

    async function handleAddItem() {
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

        try {
            const result = await window.electronAPI.addOpeningBalance(item);
            if (result.success) {
                Toast.show('تم حفظ الرصيد بنجاح', 'success');
                
                // Clear inputs
                document.getElementById('quantity-input').value = '';
                document.getElementById('cost-input').value = '';
                document.getElementById('total-input').value = '';
                document.getElementById('unit-input').value = '';
                
                const itemSelect = document.getElementById('item-select');
                itemSelect.value = "";
                const input = itemSelect.parentElement.querySelector('.autocomplete-input');
                if (input) {
                    input.value = '';
                    input.focus(); 
                }

                // Reload data
                await loadData();
            } else {
                Toast.show('فشل الحفظ: ' + result.error, 'error');
            }
        } catch (error) {
            console.error(error);
            Toast.show('حدث خطأ أثناء الحفظ', 'error');
        }
    }

    function formatCurrency(amount) {
        return new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' }).format(amount);
    }

    function renderHistory(filteredHistory = null) {
        const data = filteredHistory || history;
        const tbody = document.getElementById('history-tbody');
        
        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="empty-state">لا توجد بيانات</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map(row => `
            <tr>
                <td>${row.item_name || '-'}</td>
                <td><span class="warehouse-badge">${row.warehouse_name || '-'}</span></td>
                <td>${row.quantity}</td>
                <td>${formatCurrency(row.cost_price)}</td>
                <td>${formatCurrency(row.quantity * row.cost_price)}</td>
                <td class="muted">${row.created_at ? new Date(row.created_at).toLocaleDateString('ar-EG') : '-'}</td>
                <td>
                    <button class="btn-edit-entry btn btn-sm btn-outline btn-icon-text" data-id="${row.id}" title="تعديل">
                        <i class="fas fa-edit"></i> تعديل
                    </button>
                    <button class="btn-delete-entry btn btn-sm btn-danger btn-icon-text" data-id="${row.id}" title="حذف">
                        <i class="fas fa-trash"></i> حذف
                    </button>
                </td>
            </tr>
        `).join('');

        // Add Event Listeners
        document.querySelectorAll('.btn-edit-entry').forEach(btn => {
            btn.addEventListener('click', () => openEditEntryModal(btn.dataset.id));
        });

        document.querySelectorAll('.btn-delete-entry').forEach(btn => {
            btn.addEventListener('click', () => deleteEntry(btn.dataset.id));
        });
    }

    function filterHistory() {
        const search = document.getElementById('history-search').value.toLowerCase();
        const dateFrom = document.getElementById('history-date-from').value;
        const dateTo = document.getElementById('history-date-to').value;

        const filtered = history.filter(row => {
            const matchesSearch = (row.item_name && row.item_name.toLowerCase().includes(search)) ||
                                  (row.warehouse_name && row.warehouse_name.toLowerCase().includes(search));
            
            let matchesDate = true;
            if (dateFrom || dateTo) {
                const rowDate = new Date(row.created_at).toISOString().split('T')[0];
                if (dateFrom && rowDate < dateFrom) matchesDate = false;
                if (dateTo && rowDate > dateTo) matchesDate = false;
            }

            return matchesSearch && matchesDate;
        });

        renderHistory(filtered);
    }

    // ============================================
    // SINGLE ENTRY EDIT/DELETE
    // ============================================
    function openEditEntryModal(id) {
        const entry = history.find(h => h.id == id);
        if (!entry) return;

        document.getElementById('edit-entry-id').value = entry.id;
        document.getElementById('edit-entry-item').value = entry.item_name;
        document.getElementById('edit-entry-quantity').value = entry.quantity;
        document.getElementById('edit-entry-cost').value = entry.cost_price;

        // Populate warehouse select
        const whSelect = document.getElementById('edit-entry-warehouse');
        whSelect.innerHTML = warehouses.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
        whSelect.value = entry.warehouse_id;

        document.getElementById('edit-entry-modal').style.display = 'block';
    }

    async function saveEditEntry() {
        const id = document.getElementById('edit-entry-id').value;
        const warehouseId = document.getElementById('edit-entry-warehouse').value;
        const quantity = parseFloat(document.getElementById('edit-entry-quantity').value);
        const costPrice = parseFloat(document.getElementById('edit-entry-cost').value);

        if (!quantity || quantity <= 0) {
            Toast.show('الكمية غير صحيحة', 'error');
            return;
        }

        try {
            const result = await window.electronAPI.updateOpeningBalance({
                id,
                warehouse_id: warehouseId,
                quantity,
                cost_price: costPrice
            });

            if (result.success) {
                Toast.show('تم التعديل بنجاح', 'success');
                document.getElementById('edit-entry-modal').style.display = 'none';
                await loadData();
            } else {
                Toast.show('خطأ: ' + result.error, 'error');
            }
        } catch (error) {
            console.error(error);
            Toast.show('حدث خطأ أثناء التعديل', 'error');
        }
    }

    async function deleteEntry(id) {
        document.getElementById('delete-entry-id').value = id;
        document.getElementById('delete-entry-modal').style.display = 'block';
    }

    // Delete Modal Listeners
    document.getElementById('cancel-delete-entry-btn').addEventListener('click', () => {
        document.getElementById('delete-entry-modal').style.display = 'none';
    });

    document.getElementById('confirm-delete-entry-btn').addEventListener('click', async () => {
        const id = document.getElementById('delete-entry-id').value;
        try {
            const result = await window.electronAPI.deleteOpeningBalance(id);
            if (result.success) {
                Toast.show('تم الحذف بنجاح', 'success');
                document.getElementById('delete-entry-modal').style.display = 'none';
                await loadData();
            } else {
                Toast.show('خطأ: ' + result.error, 'error');
            }
        } catch (error) {
            console.error(error);
            Toast.show('حدث خطأ أثناء الحذف', 'error');
        }
    });
});
