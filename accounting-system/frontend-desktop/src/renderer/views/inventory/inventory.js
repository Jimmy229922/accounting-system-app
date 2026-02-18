let inventoryTableBody, searchInput, itemCardModal, itemCardBody, modalItemName;
let allItems = [];
let showShortagesOnly = false;
let ar = {};

function t(key, fallback = '') {
    if (window.i18n && typeof window.i18n.getText === 'function') {
        return window.i18n.getText(ar, key, fallback);
    }
    return fallback;
}

function fmt(template, values = {}) {
    if (!template) return '';
    return Object.entries(values).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), template);
}

function getNavHTML() {
    return `
    <nav class="top-nav">
        <div class="nav-brand">${t('common.nav.brand', 'نظام المحاسبة')}</div>
        <ul class="nav-links">
            <li><a href="../dashboard/index.html">${t('common.nav.dashboard', 'لوحة التحكم')}</a></li>
            <li class="dropdown">
                <a href="#">${t('common.nav.masterData', 'البيانات الأساسية')}</a>
                <div class="dropdown-content">
                    <a href="../items/units.html">${t('common.nav.units', 'الوحدات')}</a>
                    <a href="../items/items.html">${t('common.nav.items', 'الأصناف')}</a>
                    <a href="../customers/index.html">${t('common.nav.customersSuppliers', 'العملاء والموردين')}</a>
                    <a href="../opening-balance/index.html">${t('common.nav.openingBalance', 'بيانات أول المدة')}</a>
                    <a href="../auth-users/index.html">${t('common.nav.userManagement', 'إدارة المستخدمين')}</a>
                </div>
            </li>
            <li class="dropdown">
                <a href="#">${t('common.nav.sales', 'المبيعات')}</a>
                <div class="dropdown-content">
                    <a href="../sales/index.html">${t('common.nav.salesInvoice', 'فاتورة المبيعات')}</a>
                    <a href="../sales-returns/index.html">${t('common.nav.salesReturns', 'مردودات المبيعات')}</a>
                </div>
            </li>
            <li class="dropdown">
                <a href="#">${t('common.nav.purchases', 'المشتريات')}</a>
                <div class="dropdown-content">
                    <a href="../purchases/index.html">${t('common.nav.purchaseInvoice', 'فاتورة المشتريات')}</a>
                    <a href="../purchase-returns/index.html">${t('common.nav.purchaseReturns', 'مردودات المشتريات')}</a>
                </div>
            </li>
            <li><a href="#" class="active">${t('common.nav.inventory', 'المخزن')}</a></li>
            <li><a href="../finance/index.html">${t('common.nav.finance', 'المالية')}</a></li>
            <li><a href="../payments/receipt.html">${t('common.nav.receipt', 'تحصيل من عميل')}</a></li>
            <li><a href="../payments/payment.html">${t('common.nav.payment', 'سداد لمورد')}</a></li>
            <li class="dropdown">
                <a href="#">${t('common.nav.reports', 'التقارير')}</a>
                <div class="dropdown-content">
                    <a href="../reports/index.html">${t('common.nav.generalReports', 'التقارير العامة')}</a>
                    <a href="../customer-reports/index.html">${t('common.nav.customerReports', 'تقارير العملاء')}</a>
                    <a href="../reports/debtor-creditor/index.html">${t('common.nav.debtorCreditor', 'كشف المدين والدائن')}</a>
                </div>
            </li>
            <li><a href="../settings/index.html">${t('common.nav.settings', 'الإعدادات')}</a></li>
        </ul>
    </nav>`;
}

document.addEventListener('DOMContentLoaded', async () => {
    if (window.i18n && typeof window.i18n.loadArabicDictionary === 'function') {
        ar = await window.i18n.loadArabicDictionary();
    }
    renderPage();
    initializeElements();
    loadInventory();
});

function renderPage() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${getNavHTML()}
        <div class="content">
            <div class="inv-hero">
                <div class="hero-shapes">
                    <div class="hero-shape shape-1"></div>
                    <div class="hero-shape shape-2"></div>
                    <div class="hero-shape shape-3"></div>
                </div>
                <div class="hero-content">
                    <h1>${t('inventory.reportTitle', 'تقرير المخزن')}</h1>
                    <p>${t('inventory.heroSubtitle', 'متابعة شاملة لجميع الأصناف والكميات والقيم المخزنية')}</p>
                </div>
            </div>

            <div class="inv-stats">
                <div class="inv-stat-card stat-items">
                    <div class="inv-stat-icon"><i class="fas fa-boxes-stacked"></i></div>
                    <div class="inv-stat-info">
                        <div class="inv-stat-label">${t('inventory.totalItemsCount', 'إجمالي عدد الأصناف')}</div>
                        <div class="inv-stat-value" id="totalItems">0</div>
                    </div>
                </div>
                <div class="inv-stat-card stat-qty">
                    <div class="inv-stat-icon"><i class="fas fa-cubes"></i></div>
                    <div class="inv-stat-info">
                        <div class="inv-stat-label">${t('inventory.totalQuantity', 'إجمالي الكمية')}</div>
                        <div class="inv-stat-value" id="totalQuantity">0</div>
                    </div>
                </div>
                <div class="inv-stat-card stat-cost">
                    <div class="inv-stat-icon"><i class="fas fa-coins"></i></div>
                    <div class="inv-stat-info">
                        <div class="inv-stat-label">${t('inventory.totalValuePurchase', 'إجمالي قيمة المخزن (شراء)')}</div>
                        <div class="inv-stat-value" id="totalValue">0.00</div>
                    </div>
                </div>
                <div class="inv-stat-card stat-sale">
                    <div class="inv-stat-icon"><i class="fas fa-tag"></i></div>
                    <div class="inv-stat-info">
                        <div class="inv-stat-label">${t('inventory.totalValueSale', 'إجمالي قيمة المخزن (بيع)')}</div>
                        <div class="inv-stat-value" id="totalSaleValue">0.00</div>
                    </div>
                </div>
                <div class="inv-stat-card stat-profit">
                    <div class="inv-stat-icon"><i class="fas fa-chart-line"></i></div>
                    <div class="inv-stat-info">
                        <div class="inv-stat-label">${t('inventory.profitMargin', 'هامش الربح المتوقع')}</div>
                        <div class="inv-stat-value" id="profitMargin">0.00</div>
                    </div>
                </div>
                <div class="inv-stat-card stat-low">
                    <div class="inv-stat-icon"><i class="fas fa-exclamation-triangle"></i></div>
                    <div class="inv-stat-info">
                        <div class="inv-stat-label">${t('inventory.lowStockCount', 'أصناف تحت الحد')}</div>
                        <div class="inv-stat-value" id="lowStockCount">0</div>
                    </div>
                </div>
            </div>

            <div class="inv-controls">
                <div class="inv-search">
                    <i class="fas fa-search"></i>
                    <input type="text" id="searchInput" placeholder="${t('inventory.searchPlaceholder', 'بحث عن صنف (الاسم أو الباركود)...')}" onkeyup="filterItems()">
                </div>
                <button id="shortageBtn" class="inv-filter-btn" onclick="toggleShortages()">
                    <i class="fas fa-exclamation-triangle"></i>
                    ${t('inventory.showShortagesOnly', 'عرض النواقص فقط')}
                </button>
            </div>

            <div class="inv-table-card">
                <div class="inv-table-header">
                    <h3><i class="fas fa-clipboard-list"></i> ${t('inventory.reportTitle', 'تقرير المخزن')} <span class="inv-count-badge" id="itemCountBadge">0</span></h3>
                </div>
                <table class="inv-table">
                    <thead>
                        <tr>
                            <th>${t('inventory.tableHeaders.barcode', 'الباركود')}</th>
                            <th>${t('inventory.tableHeaders.itemName', 'الصنف')}</th>
                            <th>${t('inventory.tableHeaders.unit', 'الوحدة')}</th>
                            <th>${t('inventory.tableHeaders.currentQty', 'الكمية الحالية')}</th>
                            <th>${t('inventory.tableHeaders.costPrice', 'سعر التكلفة')}</th>
                            <th>${t('inventory.tableHeaders.salePrice', 'سعر البيع')}</th>
                            <th>${t('inventory.tableHeaders.totalValue', 'إجمالي القيمة')}</th>
                            <th>${t('inventory.tableHeaders.status', 'الحالة')}</th>
                            <th>${t('inventory.tableHeaders.actions', 'إجراءات')}</th>
                        </tr>
                    </thead>
                    <tbody id="inventoryTableBody"></tbody>
                </table>
            </div>

            <div id="itemCardModal" class="inv-modal">
                <div class="inv-modal-content">
                    <div class="inv-modal-header">
                        <h2 id="modalItemName">${t('inventory.itemCard', 'كارت الصنف')}</h2>
                        <button class="inv-modal-close" onclick="closeItemCard()"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="inv-modal-stats" id="modalStats"></div>
                    <table class="inv-table">
                        <thead>
                            <tr>
                                <th>${t('inventory.modalHeaders.date', 'التاريخ')}</th>
                                <th>${t('inventory.modalHeaders.movementType', 'نوع الحركة')}</th>
                                <th>${t('inventory.modalHeaders.docNumber', 'رقم المستند')}</th>
                                <th>${t('inventory.modalHeaders.party', 'الطرف (عميل/مورد)')}</th>
                                <th>${t('inventory.modalHeaders.incoming', 'وارد')}</th>
                                <th>${t('inventory.modalHeaders.outgoing', 'صادر')}</th>
                                <th>${t('inventory.modalHeaders.price', 'السعر')}</th>
                            </tr>
                        </thead>
                        <tbody id="itemCardBody"></tbody>
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
    const countBadge = document.getElementById('itemCountBadge');
    if (countBadge) countBadge.textContent = items.length;
    
    if (items.length === 0) {
        inventoryTableBody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 30px;">' + t('inventory.noItems', 'لا توجد أصناف') + '</td></tr>';
        return;
    }

    items.forEach(item => {
        const totalValue = item.stock_quantity * item.cost_price;
        const row = document.createElement('tr');
        const reorderLevel = item.reorder_level || 0;
        
        let statusBadge = '';
        if (item.stock_quantity <= 0) {
            statusBadge = '<span class="inv-status-badge status-out"><i class="fas fa-times-circle"></i> ' + t('inventory.statusOut', 'نافد') + '</span>';
        } else if (item.stock_quantity <= reorderLevel) {
            statusBadge = '<span class="inv-status-badge status-low"><i class="fas fa-exclamation-circle"></i> ' + t('inventory.statusLow', 'منخفض') + '</span>';
        } else {
            statusBadge = '<span class="inv-status-badge status-ok"><i class="fas fa-check-circle"></i> ' + t('inventory.statusOk', 'متوفر') + '</span>';
        }
        const quantityClass = item.stock_quantity <= reorderLevel ? 'qty-low' : '';
        const escapedName = item.name.replace(/'/g, "\\'");

        row.innerHTML = `
            <td>${item.barcode || '-'}</td>
            <td>${item.name}</td>
            <td>${item.unit_name || '-'}</td>
            <td class="${quantityClass}">${item.stock_quantity}</td>
            <td class="amount-cell">${item.cost_price.toFixed(2)}</td>
            <td class="amount-cell">${item.sale_price.toFixed(2)}</td>
            <td class="amount-cell">${totalValue.toFixed(2)}</td>
            <td>${statusBadge}</td>
            <td>
                <button class="inv-btn-card" onclick="showItemCard(${item.id}, '${escapedName}')"><i class="fas fa-file-alt"></i> ${t('inventory.itemCard', 'كارت الصنف')}</button>
            </td>
        `;
        inventoryTableBody.appendChild(row);
    });
}

function updateStats(items) {
    const totalItems = items.length;
    const totalQuantity = items.reduce((sum, item) => sum + item.stock_quantity, 0);
    const totalCostValue = items.reduce((sum, item) => sum + (item.stock_quantity * item.cost_price), 0);
    const totalSaleValue = items.reduce((sum, item) => sum + (item.stock_quantity * item.sale_price), 0);
    const profitMargin = totalSaleValue - totalCostValue;
    const lowStockCount = items.filter(item => item.stock_quantity <= (item.reorder_level || 0)).length;

    document.getElementById('totalItems').textContent = totalItems;
    document.getElementById('totalQuantity').textContent = totalQuantity;
    document.getElementById('totalValue').textContent = totalCostValue.toFixed(2);
    document.getElementById('totalSaleValue').textContent = totalSaleValue.toFixed(2);
    document.getElementById('profitMargin').textContent = profitMargin.toFixed(2);
    document.getElementById('lowStockCount').textContent = lowStockCount;
}

function toggleShortages() {
    showShortagesOnly = !showShortagesOnly;
    const btn = document.getElementById('shortageBtn');
    
    if (showShortagesOnly) {
        btn.classList.add('active');
        btn.innerHTML = `
            <i class="fas fa-check"></i>
            ${t('inventory.showAll', 'عرض الكل')}
        `;
    } else {
        btn.classList.remove('active');
        btn.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            ${t('inventory.showShortagesOnly', 'عرض النواقص فقط')}
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
    modalItemName.textContent = fmt(t('inventory.itemCardTitle', 'كارت الصنف: {name}'), { name: itemName });
    itemCardModal.style.display = 'block';
    
    try {
        const result = await window.electronAPI.getItemMovements(itemId);
        const movements = result.movements || [];
        const stats = result.stats || {};
        
        const modalStats = document.getElementById('modalStats');
        modalStats.innerHTML = `
            <div class="modal-stat"><i class="fas fa-arrow-down" style="color:#10b981"></i> ${t('inventory.totalPurchased', 'إجمالي المشتريات')}: ${stats.totalPurchased || 0}</div>
            <div class="modal-stat"><i class="fas fa-arrow-up" style="color:#ef4444"></i> ${t('inventory.totalSold', 'إجمالي المبيعات')}: ${stats.totalSold || 0}</div>
            <div class="modal-stat"><i class="fas fa-box" style="color:#6366f1"></i> ${t('inventory.currentStock', 'المخزون الحالي')}: ${stats.currentStock || 0}</div>
        `;
        
        itemCardBody.innerHTML = '';

        if (movements.length === 0) {
            itemCardBody.innerHTML = '<tr><td colspan="7" style="text-align:center">' + t('inventory.noMovements', 'لا توجد حركات لهذا الصنف') + '</td></tr>';
            return;
        }

        movements.forEach(mv => {
            const row = document.createElement('tr');
            const isIn = mv.type === 'purchase' || mv.type === 'sale_return' || mv.type === 'opening';
            const typeClass = isIn ? 'transaction-in' : 'transaction-out';
            
            let dateDisplay = mv.date || '';
            if (dateDisplay.includes('T')) dateDisplay = dateDisplay.split('T')[0];
            else if (dateDisplay.includes(' ')) dateDisplay = dateDisplay.split(' ')[0];

            row.innerHTML = `
                <td>${dateDisplay}</td>
                <td><span class="inv-mv-badge ${isIn ? 'mv-in' : 'mv-out'}">${mv.type_label || mv.type}</span></td>
                <td>${mv.invoice_number || '-'}</td>
                <td>${mv.party_name || '-'}</td>
                <td class="transaction-in">${isIn ? mv.quantity : '-'}</td>
                <td class="transaction-out">${!isIn ? mv.quantity : '-'}</td>
                <td>${(mv.price || 0).toFixed(2)}</td>
            `;
            itemCardBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading item movements:', error);
        itemCardBody.innerHTML = '<tr><td colspan="7" style="text-align:center">' + t('inventory.loadError', 'حدث خطأ أثناء تحميل البيانات') + '</td></tr>';
    }
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
