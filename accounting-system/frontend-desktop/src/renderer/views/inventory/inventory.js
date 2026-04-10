let inventoryTableBody, searchInput, itemCardModal, itemCardBody, modalItemName;
let allItems = [];
let showShortagesOnly = false;
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
                    <h1>${t('inventory.reportTitle', '????? ??????')}</h1>
                    <p>${t('inventory.heroSubtitle', '?????? ????? ????? ??????? ???????? ?????? ????????')}</p>
                </div>
            </div>
            <div class="inv-stats">
                <div class="inv-stat-card stat-items">
                    <div class="inv-stat-icon"><i class="fas fa-boxes-stacked"></i></div>
                    <div class="inv-stat-info">
                        <div class="inv-stat-label">${t('inventory.totalItemsCount', '?????? ??? ???????')}</div>
                        <div class="inv-stat-value" id="totalItems">0</div>
                    </div>
                </div>
                <div class="inv-stat-card stat-qty">
                    <div class="inv-stat-icon"><i class="fas fa-cubes"></i></div>
                    <div class="inv-stat-info">
                        <div class="inv-stat-label">${t('inventory.totalQuantity', '?????? ??????')}</div>
                        <div class="inv-stat-value" id="totalQuantity">0</div>
                    </div>
                </div>
                <div class="inv-stat-card stat-cost">
                    <div class="inv-stat-icon"><i class="fas fa-coins"></i></div>
                    <div class="inv-stat-info">
                        <div class="inv-stat-label">${t('inventory.totalValuePurchase', '?????? ???? ?????? (????)')}</div>
                        <div class="inv-stat-value" id="totalValue">0.00</div>
                    </div>
                </div>
                <div class="inv-stat-card stat-sale">
                    <div class="inv-stat-icon"><i class="fas fa-tag"></i></div>
                    <div class="inv-stat-info">
                        <div class="inv-stat-label">${t('inventory.totalValueSale', '?????? ???? ?????? (???)')}</div>
                        <div class="inv-stat-value" id="totalSaleValue">0.00</div>
                    </div>
                </div>
                <div class="inv-stat-card stat-profit">
                    <div class="inv-stat-icon"><i class="fas fa-chart-line"></i></div>
                    <div class="inv-stat-info">
                        <div class="inv-stat-label">${t('inventory.profitMargin', '???? ????? ???????')}</div>
                        <div class="inv-stat-value" id="profitMargin">0.00</div>
                    </div>
                </div>
                <div class="inv-stat-card stat-low">
                    <div class="inv-stat-icon"><i class="fas fa-exclamation-triangle"></i></div>
                    <div class="inv-stat-info">
                        <div class="inv-stat-label">${t('inventory.lowStockCount', '????? ??? ????')}</div>
                        <div class="inv-stat-value" id="lowStockCount">0</div>
                    </div>
                </div>
            </div>
            <div class="inv-controls">
                <div class="inv-search">
                    <i class="fas fa-search"></i>
                    <input type="text" id="searchInput" placeholder="${t('inventory.searchPlaceholder', '??? ?? ??? (????? ?? ????????)...')}">
                </div>
                <button id="shortageBtn" class="inv-filter-btn" data-action="toggle-shortages">
                    <i class="fas fa-exclamation-triangle"></i>
                    ${t('inventory.showShortagesOnly', '??? ??????? ???')}
                </button>
            </div>
            <div class="inv-table-card">
                <div class="inv-table-header">
                    <h3><i class="fas fa-clipboard-list"></i> ${t('inventory.reportTitle', '????? ??????')} <span class="inv-count-badge" id="itemCountBadge">0</span></h3>
                </div>
                <table class="inv-table">
                    <thead>
                        <tr>
                            <th>${t('inventory.tableHeaders.barcode', '????????')}</th>
                            <th>${t('inventory.tableHeaders.itemName', '?????')}</th>
                            <th>${t('inventory.tableHeaders.unit', '??????')}</th>
                            <th>${t('inventory.tableHeaders.currentQty', '?????? ???????')}</th>
                            <th>${t('inventory.tableHeaders.costPrice', '??? ???????')}</th>
                            <th>${t('inventory.tableHeaders.salePrice', '??? ?????')}</th>
                            <th>${t('inventory.tableHeaders.totalValue', '?????? ??????')}</th>
                            <th>${t('inventory.tableHeaders.status', '??????')}</th>
                            <th>${t('inventory.tableHeaders.actions', '???????')}</th>
                        </tr>
                    </thead>
                    <tbody id="inventoryTableBody"></tbody>
                </table>
            </div>
            <div id="itemCardModal" class="inv-modal">
                <div class="inv-modal-content">
                    <div class="inv-modal-header">
                        <h2 id="modalItemName">${t('inventory.itemCard', '???? ?????')}</h2>
                        <button class="inv-modal-close" data-action="close-item-card"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="inv-modal-stats" id="modalStats"></div>
                    <table class="inv-table">
                        <thead>
                            <tr>
                                <th>${t('inventory.modalHeaders.date', '???????')}</th>
                                <th>${t('inventory.modalHeaders.movementType', '??? ??????')}</th>
                                <th>${t('inventory.modalHeaders.docNumber', '??? ???????')}</th>
                                <th>${t('inventory.modalHeaders.party', '????? (????/????)')}</th>
                                <th>${t('inventory.modalHeaders.incoming', '????')}</th>
                                <th>${t('inventory.modalHeaders.outgoing', '????')}</th>
                                <th>${t('inventory.modalHeaders.price', '?????')}</th>
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
    if (searchInput) searchInput.addEventListener('input', filterItems);
    document.getElementById('app').addEventListener('click', handleAppClick);
    document.addEventListener('click', handleModalOutsideClick);
}
function handleAppClick(event) {
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;
    switch (actionEl.dataset.action) {
        case 'toggle-shortages':
            toggleShortages();
            return;
        case 'close-item-card':
            closeItemCard();
            return;
        case 'show-item-card': {
            const itemId = Number.parseInt(actionEl.dataset.itemId || '', 10);
            if (Number.isFinite(itemId)) showItemCard(itemId, decodeURIComponent(actionEl.dataset.itemName || ''));
            return;
        }
    }
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
        inventoryTableBody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 30px;">' + t('inventory.noItems', '?? ???? ?????') + '</td></tr>';
        return;
    }
    items.forEach(item => {
        const totalValue = item.stock_quantity * item.cost_price;
        const row = document.createElement('tr');
        const reorderLevel = item.reorder_level || 0;
        let statusBadge = '';
        if (item.stock_quantity <= 0) {
            statusBadge = '<span class="inv-status-badge status-out"><i class="fas fa-times-circle"></i> ' + t('inventory.statusOut', '????') + '</span>';
        } else if (item.stock_quantity <= reorderLevel) {
            statusBadge = '<span class="inv-status-badge status-low"><i class="fas fa-exclamation-circle"></i> ' + t('inventory.statusLow', '?????') + '</span>';
        } else {
            statusBadge = '<span class="inv-status-badge status-ok"><i class="fas fa-check-circle"></i> ' + t('inventory.statusOk', '?????') + '</span>';
        }
        const quantityClass = item.stock_quantity <= reorderLevel ? 'qty-low' : '';
        const encodedName = encodeURIComponent(item.name);
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
                <button class="inv-btn-card" data-action="show-item-card" data-item-id="${item.id}" data-item-name="${encodedName}"><i class="fas fa-file-alt"></i> ${t('inventory.itemCard', '???? ?????')}</button>
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
        btn.innerHTML = `<i class="fas fa-check"></i> ${t('inventory.showAll', '??? ????')}`;
    } else {
        btn.classList.remove('active');
        btn.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${t('inventory.showShortagesOnly', '??? ??????? ???')}`;
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
    modalItemName.textContent = fmt(t('inventory.itemCardTitle', '???? ?????: {name}'), { name: itemName });
    itemCardModal.style.display = 'block';
    try {
        const result = await window.electronAPI.getItemMovements(itemId);
        const movements = result.movements || [];
        const stats = result.stats || {};
        const modalStats = document.getElementById('modalStats');
        modalStats.innerHTML = `
            <div class="modal-stat"><i class="fas fa-arrow-down" style="color:#10b981"></i> ${t('inventory.totalPurchased', '?????? ?????????')}: ${stats.totalPurchased || 0}</div>
            <div class="modal-stat"><i class="fas fa-arrow-up" style="color:#ef4444"></i> ${t('inventory.totalSold', '?????? ????????')}: ${stats.totalSold || 0}</div>
            <div class="modal-stat"><i class="fas fa-box" style="color:#6366f1"></i> ${t('inventory.currentStock', '??????? ??????')}: ${stats.currentStock || 0}</div>
        `;
        itemCardBody.innerHTML = '';
        if (movements.length === 0) {
            itemCardBody.innerHTML = '<tr><td colspan="7" style="text-align:center">' + t('inventory.noMovements', '?? ???? ????? ???? ?????') + '</td></tr>';
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
        itemCardBody.innerHTML = '<tr><td colspan="7" style="text-align:center">' + t('inventory.loadError', '??? ??? ????? ????? ????????') + '</td></tr>';
    }
}
function closeItemCard() {
    itemCardModal.style.display = 'none';
}
function handleModalOutsideClick(event) { if (event.target == itemCardModal) closeItemCard(); }


