let inventoryTableBody, searchInput, itemCardModal, itemCardBody, modalItemName;
let allItems = [];
let showShortagesOnly = false;

document.addEventListener('DOMContentLoaded', () => {
    renderPage();
    initializeElements();
    loadInventory();
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
                <li><a href="../purchases/index.html">المشتريات</a></li>
                <li><a href="#" class="active">المخزن</a></li>
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

        <div class="page-header">
            <h1 class="page-title">تقرير المخزن</h1>
            <div class="header-controls">
                <button id="shortageBtn" class="btn-filter" onclick="toggleShortages()">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    عرض النواقص فقط
                </button>
                <div class="search-box">
                    <input type="text" id="searchInput" placeholder="بحث عن صنف (الاسم أو الباركود)..." onkeyup="filterItems()">
                </div>
            </div>
        </div>

        <div class="inventory-stats">
            <div class="stat-card">
                <h3>إجمالي عدد الأصناف</h3>
                <div class="stat-value" id="totalItems">0</div>
            </div>
            <div class="stat-card">
                <h3>إجمالي الكمية</h3>
                <div class="stat-value" id="totalQuantity">0</div>
            </div>
            <div class="stat-card">
                <h3>إجمالي قيمة المخزن (شراء)</h3>
                <div class="stat-value" id="totalValue">0.00</div>
            </div>
        </div>

        <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>الباركود</th>
                        <th>الصنف</th>
                        <th>الوحدة</th>
                        <th>الكمية الحالية</th>
                        <th>سعر التكلفة</th>
                        <th>سعر البيع</th>
                        <th>إجمالي القيمة</th>
                        <th>إجراءات</th>
                    </tr>
                </thead>
                <tbody id="inventoryTableBody">
                    <!-- Items will be loaded here -->
                </tbody>
            </table>
        </div>

        <!-- Item Card Modal -->
        <div id="itemCardModal" class="modal">
            <div class="modal-content">
                <span class="close" onclick="closeItemCard()">&times;</span>
                <h2 id="modalItemName">كارت الصنف</h2>
                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>التاريخ</th>
                                <th>نوع الحركة</th>
                                <th>رقم المستند</th>
                                <th>الطرف (عميل/مورد)</th>
                                <th>وارد</th>
                                <th>صادر</th>
                                <th>السعر</th>
                            </tr>
                        </thead>
                        <tbody id="itemCardBody">
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function initializeElements() {
    inventoryTableBody = document.getElementById('inventoryTableBody');
    searchInput = document.getElementById('searchInput');
    itemCardModal = document.getElementById('itemCardModal');
    itemCardBody = document.getElementById('itemCardBody');
    modalItemName = document.getElementById('modalItemName');
}

async function loadInventory() {
    allItems = await window.electronAPI.getItems();
    renderTable(allItems);
    updateStats(allItems);
}

function renderTable(items) {
    inventoryTableBody.innerHTML = '';
    
    if (items.length === 0) {
        inventoryTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 30px;">لا توجد أصناف</td></tr>';
        return;
    }

    items.forEach(item => {
        const totalValue = item.stock_quantity * item.cost_price;
        const row = document.createElement('tr');
        
        // Highlight low stock based on reorder_level
        const reorderLevel = item.reorder_level || 0;
        const quantityClass = item.stock_quantity <= reorderLevel ? 'low-stock' : '';

        row.innerHTML = `
            <td>${item.barcode || '-'}</td>
            <td>${item.name}</td>
            <td>${item.unit_name || '-'}</td>
            <td class="${quantityClass}">${item.stock_quantity}</td>
            <td>${item.cost_price.toFixed(2)}</td>
            <td>${item.sale_price.toFixed(2)}</td>
            <td>${totalValue.toFixed(2)}</td>
            <td>
                <button class="btn-view" onclick="showItemCard(${item.id}, '${item.name}')">كارت الصنف</button>
            </td>
        `;
        inventoryTableBody.appendChild(row);
    });
}

function updateStats(items) {
    const totalItems = items.length;
    const totalQuantity = items.reduce((sum, item) => sum + item.stock_quantity, 0);
    const totalValue = items.reduce((sum, item) => sum + (item.stock_quantity * item.cost_price), 0);

    document.getElementById('totalItems').textContent = totalItems;
    document.getElementById('totalQuantity').textContent = totalQuantity;
    document.getElementById('totalValue').textContent = totalValue.toFixed(2);
}

function toggleShortages() {
    showShortagesOnly = !showShortagesOnly;
    const btn = document.getElementById('shortageBtn');
    
    if (showShortagesOnly) {
        btn.classList.add('active');
        btn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            عرض الكل
        `;
    } else {
        btn.classList.remove('active');
        btn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            عرض النواقص فقط
        `;
    }
    
    filterItems();
}

function filterItems() {
    const term = searchInput.value.toLowerCase();
    
    let filtered = allItems.filter(item => 
        item.name.toLowerCase().includes(term) || 
        (item.barcode && item.barcode.toLowerCase().includes(term))
    );

    if (showShortagesOnly) {
        filtered = filtered.filter(item => {
            const reorderLevel = item.reorder_level || 0;
            return item.stock_quantity <= reorderLevel;
        });
    }

    renderTable(filtered);
}

async function showItemCard(itemId, itemName) {
    modalItemName.textContent = `كارت الصنف: ${itemName}`;
    itemCardModal.style.display = 'block';
    
    const transactions = await window.electronAPI.getItemTransactions(itemId);
    itemCardBody.innerHTML = '';

    if (transactions.length === 0) {
        itemCardBody.innerHTML = '<tr><td colspan="7" style="text-align:center">لا توجد حركات لهذا الصنف</td></tr>';
        return;
    }

    transactions.forEach(t => {
        const row = document.createElement('tr');
        const typeText = t.type === 'purchase' ? 'شراء' : 'بيع';
        const typeClass = t.type === 'purchase' ? 'transaction-in' : 'transaction-out';
        
        row.innerHTML = `
            <td>${t.date}</td>
            <td class="${typeClass}">${typeText}</td>
            <td>${t.ref_number || '-'}</td>
            <td>${t.party_name || '-'}</td>
            <td class="transaction-in">${t.quantity_in > 0 ? t.quantity_in : '-'}</td>
            <td class="transaction-out">${t.quantity_out > 0 ? t.quantity_out : '-'}</td>
            <td>${t.price.toFixed(2)}</td>
        `;
        itemCardBody.appendChild(row);
    });
}

function closeItemCard() {
    itemCardModal.style.display = 'none';
}

// Close modal when clicking outside
window.onclick = function(event) {
    if (event.target == itemCardModal) {
        closeItemCard();
    }
}