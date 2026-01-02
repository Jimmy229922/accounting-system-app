// ============================================
// ITEMS MANAGEMENT - MAIN SCRIPT
// ============================================

// DOM Elements
let itemBarcodeInput, itemNameInput, itemUnitSelect, costPriceInput, salePriceInput, reorderLevelInput, initialQuantityInput;
let editModal, editItemIdInput, editItemBarcodeInput, editItemNameInput, editItemUnitSelect, editCostPriceInput, editSalePriceInput, editReorderLevelInput, editStockQuantityInput;
let itemsTableBody, deleteModal, searchInput, totalItemsElement, paginationContainer;

// State
let allItems = [];
let allUnits = [];
let currentPage = 1;
let itemsPerPage = 50;
let currentFilteredItems = [];
let itemToDeleteId = null;

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initializeElements();
    loadUnits();
    loadItems();
    
    if (itemBarcodeInput) itemBarcodeInput.focus();
});

function initializeElements() {
    // Add Form Inputs
    itemBarcodeInput = document.getElementById('itemBarcode');
    itemNameInput = document.getElementById('itemName');
    itemUnitSelect = document.getElementById('itemUnit');
    costPriceInput = document.getElementById('costPrice');
    salePriceInput = document.getElementById('salePrice');
    reorderLevelInput = document.getElementById('reorderLevel');
    initialQuantityInput = document.getElementById('initialQuantity');

    // Edit Modal Inputs
    editModal = document.getElementById('editModal');
    editItemIdInput = document.getElementById('editItemId');
    editItemBarcodeInput = document.getElementById('editItemBarcode');
    editItemNameInput = document.getElementById('editItemName');
    editItemUnitSelect = document.getElementById('editItemUnit');
    editCostPriceInput = document.getElementById('editCostPrice');
    editSalePriceInput = document.getElementById('editSalePrice');
    editReorderLevelInput = document.getElementById('editReorderLevel');
    editStockQuantityInput = document.getElementById('editStockQuantity');

    // Other UI Elements
    itemsTableBody = document.getElementById('itemsTableBody');
    deleteModal = document.getElementById('deleteModal');
    searchInput = document.getElementById('searchInput');
    totalItemsElement = document.getElementById('totalItems');
    paginationContainer = document.getElementById('pagination');

    // Items Per Page Select
    const itemsPerPageSelect = document.getElementById('itemsPerPageSelect');
    if (itemsPerPageSelect) {
        itemsPerPageSelect.addEventListener('change', (e) => {
            itemsPerPage = parseInt(e.target.value);
            currentPage = 1;
            renderTable();
        });
    }

    // Search Event
    if (searchInput) {
        searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
    }

    // Close modals on outside click
    window.addEventListener('click', (e) => {
        if (e.target === deleteModal) hideDeleteModal();
        if (e.target === editModal) closeEditModal();
    });

    // Enter key navigation in form
    setupEnterNavigation();

    // Profit Margin Listeners (Add Form)
    if (costPriceInput && salePriceInput) {
        const updateAddMargin = () => calculateProfitMargin(costPriceInput, salePriceInput, 'addProfitMargin');
        costPriceInput.addEventListener('input', updateAddMargin);
        salePriceInput.addEventListener('input', updateAddMargin);
    }

    // Profit Margin Listeners (Edit Form)
    if (editCostPriceInput && editSalePriceInput) {
        const updateEditMargin = () => calculateProfitMargin(editCostPriceInput, editSalePriceInput, 'editProfitMargin');
        editCostPriceInput.addEventListener('input', updateEditMargin);
        editSalePriceInput.addEventListener('input', updateEditMargin);
    }
}

function calculateProfitMargin(costInput, saleInput, displayId) {
    const displayEl = document.getElementById(displayId);
    if (!displayEl) return;

    const cost = parseFloat(costInput.value) || 0;
    const sale = parseFloat(saleInput.value) || 0;

    if (cost <= 0 || sale <= 0) {
        displayEl.textContent = '';
        displayEl.className = 'profit-margin-display';
        return;
    }

    const profit = sale - cost;
    const marginPercent = ((profit / cost) * 100).toFixed(1);
    
    let className = 'profit-neutral';
    let icon = '';

    if (profit > 0) {
        className = 'profit-positive';
        icon = '📈';
    } else if (profit < 0) {
        className = 'profit-negative';
        icon = '📉';
    }

    displayEl.className = `profit-margin-display ${className}`;
    displayEl.innerHTML = `${icon} ربح: ${formatCurrency(profit)} (${marginPercent}%)`;
}

function setupEnterNavigation() {
    const inputs = [itemBarcodeInput, itemNameInput, itemUnitSelect, costPriceInput, salePriceInput, reorderLevelInput, initialQuantityInput];
    
    inputs.forEach((input, index) => {
        if (!input) return;
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (index < inputs.length - 1) {
                    inputs[index + 1].focus();
                } else {
                    saveNewItem();
                }
            }
        });
    });
}

// ============================================
// DATA LOADING
// ============================================
async function loadUnits() {
    try {
        allUnits = await window.electronAPI.getUnits();
        const options = allUnits.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
        
        if (itemUnitSelect) itemUnitSelect.innerHTML = '<option value="">اختر الوحدة...</option>' + options;
        if (editItemUnitSelect) editItemUnitSelect.innerHTML = '<option value="">اختر الوحدة...</option>' + options;
    } catch (error) {
        console.error('Error loading units:', error);
        Toast.show('فشل تحميل الوحدات', 'error');
    }
}

async function loadItems() {
    try {
        allItems = await window.electronAPI.getItems();
        currentFilteredItems = [...allItems];
        renderTable();
        updateStats();
    } catch (error) {
        console.error('Error loading items:', error);
        Toast.show('فشل تحميل الأصناف', 'error');
    }
}

// ============================================
// SEARCH
// ============================================
function handleSearch(term) {
    term = term.toLowerCase().trim();
    
    if (term) {
        currentFilteredItems = allItems.filter(item => 
            item.name.toLowerCase().includes(term) || 
            (item.barcode && item.barcode.toLowerCase().includes(term))
        );
    } else {
        currentFilteredItems = [...allItems];
    }
    
    currentPage = 1;
    renderTable();
}

// ============================================
// TABLE RENDERING
// ============================================
function renderTable() {
    if (!itemsTableBody) return;
    
    itemsTableBody.innerHTML = '';
    
    if (currentFilteredItems.length === 0) {
        itemsTableBody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty-state">
                        <div class="empty-icon">📦</div>
                        <p>لا توجد أصناف مسجلة</p>
                    </div>
                </td>
            </tr>
        `;
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    // Pagination
    const totalPages = Math.ceil(currentFilteredItems.length / itemsPerPage);
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, currentFilteredItems.length);
    const pageItems = currentFilteredItems.slice(startIndex, endIndex);

    const searchTerm = searchInput ? searchInput.value.trim() : '';
    const regex = searchTerm ? new RegExp(`(${searchTerm})`, 'gi') : null;

    pageItems.forEach((item, index) => {
        const unitName = allUnits.find(u => u.id == item.unit_id)?.name || '-';
        
        let displayName = item.name;
        let displayBarcode = item.barcode || '-';
        
        if (regex) {
            displayName = displayName.replace(regex, '<span class="highlight">$1</span>');
            if (item.barcode) {
                displayBarcode = displayBarcode.replace(regex, '<span class="highlight">$1</span>');
            }
        }

        // Low Stock Logic
        const stockQty = item.stock_quantity || 0;
        const reorderLvl = item.reorder_level || 0;
        const isLowStock = stockQty <= reorderLvl;
        const quantityDisplay = isLowStock 
            ? `<span class="low-stock-badge" title="الكمية أقل من حد الطلب">${stockQty} <span class="warning-icon">⚠️</span></span>` 
            : stockQty;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${startIndex + index + 1}</td>
            <td>${displayBarcode}</td>
            <td>${displayName}</td>
            <td>${unitName}</td>
            <td>${quantityDisplay}</td>
            <td>${formatCurrency(item.cost_price)}</td>
            <td>${formatCurrency(item.sale_price)}</td>
            <td>${reorderLvl}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-icon btn-edit" onclick="openEditModal(${item.id})" title="تعديل">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button class="btn-icon btn-delete" onclick="showDeleteModal(${item.id})" title="حذف">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                </div>
            </td>
        `;
        itemsTableBody.appendChild(row);
    });

    renderPagination(totalPages);
}

function renderPagination(totalPages) {
    if (!paginationContainer) return;
    
    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    paginationContainer.innerHTML = `
        <button class="pagination-btn" onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
        <span style="color: var(--text-secondary); font-weight: 600;">صفحة ${currentPage} من ${totalPages}</span>
        <button class="pagination-btn" onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
    `;
}

function changePage(newPage) {
    const totalPages = Math.ceil(currentFilteredItems.length / itemsPerPage);
    if (newPage < 1 || newPage > totalPages) return;
    currentPage = newPage;
    renderTable();
}

function updateStats() {
    if (totalItemsElement) {
        totalItemsElement.textContent = allItems.length;
    }

    const totalInventoryValueElement = document.getElementById('totalInventoryValue');
    if (totalInventoryValueElement) {
        const totalValue = allItems.reduce((sum, item) => {
            const qty = parseFloat(item.stock_quantity) || 0;
            const cost = parseFloat(item.cost_price) || 0;
            return sum + (qty * cost);
        }, 0);
        totalInventoryValueElement.textContent = formatCurrency(totalValue);
    }

    const totalInventorySalesValueElement = document.getElementById('totalInventorySalesValue');
    if (totalInventorySalesValueElement) {
        const totalSalesValue = allItems.reduce((sum, item) => {
            const qty = parseFloat(item.stock_quantity) || 0;
            const sale = parseFloat(item.sale_price) || 0;
            return sum + (qty * sale);
        }, 0);
        totalInventorySalesValueElement.textContent = formatCurrency(totalSalesValue);
    }
}

function formatCurrency(value) {
    return parseFloat(value || 0).toFixed(2) + ' ج.م';
}

// ============================================
// ADD NEW ITEM (Top Form)
// ============================================
function resetAddForm() {
    if (itemBarcodeInput) itemBarcodeInput.value = '';
    if (itemNameInput) itemNameInput.value = '';
    if (itemUnitSelect) itemUnitSelect.value = '';
    if (costPriceInput) costPriceInput.value = '';
    if (salePriceInput) salePriceInput.value = '';
    if (reorderLevelInput) reorderLevelInput.value = '';
    if (initialQuantityInput) initialQuantityInput.value = '';
    if (itemBarcodeInput) itemBarcodeInput.focus();
}

async function saveNewItem() {
    console.log('saveNewItem() called');
    
    const barcode = itemBarcodeInput ? itemBarcodeInput.value.trim() : '';
    const name = itemNameInput ? itemNameInput.value.trim() : '';
    const unitId = itemUnitSelect ? itemUnitSelect.value : '';
    const costPrice = costPriceInput ? parseFloat(costPriceInput.value) || 0 : 0;
    const salePrice = salePriceInput ? parseFloat(salePriceInput.value) || 0 : 0;
    const reorderLevel = reorderLevelInput ? parseInt(reorderLevelInput.value) || 0 : 0;
    const initialQuantity = initialQuantityInput ? parseFloat(initialQuantityInput.value) || 0 : 0;

    console.log('Form Data:', { barcode, name, unitId, costPrice, salePrice, reorderLevel, initialQuantity });

    // Validation
    if (!name) {
        Toast.show('الرجاء إدخال اسم الصنف', 'error');
        if (itemNameInput) itemNameInput.focus();
        return;
    }
    if (!unitId) {
        Toast.show('الرجاء اختيار الوحدة', 'error');
        if (itemUnitSelect) itemUnitSelect.focus();
        return;
    }

    // Duplicate Check
    const isNameDuplicate = allItems.some(i => i.name.toLowerCase() === name.toLowerCase());
    if (isNameDuplicate) {
        Toast.show('اسم الصنف موجود بالفعل', 'error');
        if (itemNameInput) itemNameInput.select();
        return;
    }

    if (barcode) {
        const isBarcodeDuplicate = allItems.some(i => i.barcode === barcode);
        if (isBarcodeDuplicate) {
            Toast.show('الباركود مستخدم لصنف آخر', 'error');
            if (itemBarcodeInput) itemBarcodeInput.select();
            return;
        }
    }

    const itemData = {
        name,
        barcode: barcode || null,
        unit_id: unitId,
        cost_price: costPrice,
        sale_price: salePrice,
        reorder_level: reorderLevel,
        stock_quantity: initialQuantity // Pass initial quantity
    };

    console.log('Sending to API:', itemData);

    try {
        const result = await window.electronAPI.addItem(itemData);
        console.log('API Result:', result);

        if (result.success) {
            resetAddForm();
            loadItems();
            Toast.show('تم إضافة الصنف بنجاح', 'success');
        } else {
            console.error('Save failed:', result.error);
            Toast.show('حدث خطأ: ' + (result.error || 'غير معروف'), 'error');
        }
    } catch (error) {
        console.error('Exception:', error);
        Toast.show('حدث خطأ أثناء الحفظ', 'error');
    }
}

// ============================================
// EDIT ITEM (Modal)
// ============================================
function openEditModal(id) {
    const item = allItems.find(i => i.id === id);
    if (!item) return;

    if (editItemIdInput) editItemIdInput.value = item.id;
    if (editItemBarcodeInput) editItemBarcodeInput.value = item.barcode || '';
    if (editItemNameInput) editItemNameInput.value = item.name;
    if (editItemUnitSelect) editItemUnitSelect.value = item.unit_id;
    if (editCostPriceInput) editCostPriceInput.value = item.cost_price || 0;
    if (editSalePriceInput) editSalePriceInput.value = item.sale_price;
    if (editReorderLevelInput) editReorderLevelInput.value = item.reorder_level || '';
    if (editStockQuantityInput) editStockQuantityInput.value = item.stock_quantity || 0;

    // Calculate initial margin
    if (editCostPriceInput && editSalePriceInput) {
        calculateProfitMargin(editCostPriceInput, editSalePriceInput, 'editProfitMargin');
    }

    if (editModal) editModal.classList.add('show');
}

function closeEditModal() {
    if (editModal) editModal.classList.remove('show');
}

async function saveEditedItem() {
    const id = editItemIdInput ? editItemIdInput.value : null;
    const barcode = editItemBarcodeInput ? editItemBarcodeInput.value.trim() : '';
    const name = editItemNameInput ? editItemNameInput.value.trim() : '';
    const unitId = editItemUnitSelect ? editItemUnitSelect.value : '';
    const costPrice = editCostPriceInput ? parseFloat(editCostPriceInput.value) || 0 : 0;
    const salePrice = editSalePriceInput ? parseFloat(editSalePriceInput.value) || 0 : 0;
    const reorderLevel = editReorderLevelInput ? parseInt(editReorderLevelInput.value) || 0 : 0;
    const stockQuantity = editStockQuantityInput ? parseFloat(editStockQuantityInput.value) || 0 : 0;

    if (!name || !unitId) {
        Toast.show('الرجاء إكمال البيانات المطلوبة', 'error');
        return;
    }

    // Duplicate Check
    const isNameDuplicate = allItems.some(i => i.name.toLowerCase() === name.toLowerCase() && i.id != id);
    if (isNameDuplicate) {
        Toast.show('اسم الصنف موجود بالفعل', 'error');
        return;
    }

    if (barcode) {
        const isBarcodeDuplicate = allItems.some(i => i.barcode === barcode && i.id != id);
        if (isBarcodeDuplicate) {
            Toast.show('الباركود مستخدم لصنف آخر', 'error');
            return;
        }
    }

    const itemData = {
        id,
        name,
        barcode: barcode || null,
        unit_id: unitId,
        cost_price: costPrice,
        sale_price: salePrice,
        reorder_level: reorderLevel,
        stock_quantity: stockQuantity
    };

    try {
        const result = await window.electronAPI.updateItem(itemData);

        if (result.success) {
            closeEditModal();
            loadItems();
            Toast.show('تم تعديل الصنف بنجاح', 'success');
        } else {
            Toast.show('حدث خطأ: ' + (result.error || 'غير معروف'), 'error');
        }
    } catch (error) {
        console.error('Exception:', error);
        Toast.show('حدث خطأ أثناء التعديل', 'error');
    }
}

// ============================================
// DELETE ITEM
// ============================================
function showDeleteModal(id) {
    itemToDeleteId = id;
    if (deleteModal) deleteModal.classList.add('show');
}

function hideDeleteModal() {
    itemToDeleteId = null;
    if (deleteModal) deleteModal.classList.remove('show');
}

async function confirmDelete() {
    if (!itemToDeleteId) return;
    
    try {
        const result = await window.electronAPI.deleteItem(itemToDeleteId);
        if (result.success) {
            loadItems();
            Toast.show('تم حذف الصنف بنجاح', 'success');
        } else {
            Toast.show('حدث خطأ أثناء الحذف', 'error');
        }
    } catch (error) {
        console.error('Exception:', error);
        Toast.show('حدث خطأ أثناء الحذف', 'error');
    }
    
    hideDeleteModal();
}
