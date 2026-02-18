/**
 * Global Search Component - البحث الشامل
 * يعمل كـ Modal في جميع صفحات النظام
 * الستايلات مُدمجة مباشرة لتجنب مشاكل المسارات
 */

class GlobalSearch {
    constructor() {
        this.modal = null;
        this.overlay = null;
        this.input = null;
        this.resultsContainer = null;
        this.debounceTimer = null;
        this.isOpen = false;
        this.focusedIndex = -1;
        this.results = [];
        this.currentView = 'search'; // 'search' or 'item-details'
        this.navObserver = null;
        this.searchButtonSyncTimer = null;
        this.ar = {};
        
        this.injectStyles();
        this.createSearchModal();
        this.bindKeyboardShortcuts();
        this.bindSearchButton();
    }
    
    injectStyles() {
        // إضافة CSS مباشرة للتأكد من عمل الـ Modal في كل الصفحات
        const style = document.createElement('style');
        style.id = 'gsearch-styles';
        style.textContent = `
            .gsearch-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.6);
                backdrop-filter: blur(4px);
                z-index: 99998;
                opacity: 0;
                visibility: hidden;
                transition: all 0.2s ease;
            }
            
            .gsearch-overlay.active {
                opacity: 1;
                visibility: visible;
            }
            
            .gsearch-modal {
                position: fixed;
                top: 5%;
                left: 50%;
                transform: translateX(-50%) scale(0.95);
                width: 95%;
                max-width: 800px;
                max-height: 90vh;
                background: var(--card-bg, #1e293b);
                border-radius: 16px;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                z-index: 99999;
                opacity: 0;
                visibility: hidden;
                transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                overflow: hidden;
                border: 1px solid var(--table-border, rgba(255,255,255,0.1));
                display: flex;
                flex-direction: column;
            }
            
            .gsearch-modal.active {
                opacity: 1;
                visibility: visible;
                transform: translateX(-50%) scale(1);
            }
            
            .gsearch-header {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 16px 20px;
                border-bottom: 1px solid var(--table-border, rgba(255,255,255,0.1));
                background: var(--table-header-bg, rgba(0,0,0,0.2));
                flex-shrink: 0;
            }
            
            .gsearch-header i.fa-search {
                color: var(--accent-color, #3b82f6);
                font-size: 1.2rem;
            }
            
            .gsearch-input {
                flex: 1;
                background: transparent;
                border: none;
                outline: none;
                font-size: 1.1rem;
                color: var(--text-color, #e2e8f0);
                font-family: inherit;
            }
            
            .gsearch-input::placeholder {
                color: var(--text-muted, #64748b);
            }
            
            .gsearch-close, .gsearch-back {
                background: none;
                border: none;
                color: var(--text-muted, #64748b);
                cursor: pointer;
                padding: 8px;
                border-radius: 8px;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .gsearch-close:hover, .gsearch-back:hover {
                background: rgba(255,255,255,0.1);
                color: var(--text-color, #e2e8f0);
            }
            
            .gsearch-back {
                margin-left: 8px;
            }
            
            .gsearch-body {
                flex: 1;
                overflow-y: auto;
                min-height: 200px;
                max-height: 60vh;
            }
            
            .gsearch-body::-webkit-scrollbar {
                width: 6px;
            }
            
            .gsearch-body::-webkit-scrollbar-track {
                background: transparent;
            }
            
            .gsearch-body::-webkit-scrollbar-thumb {
                background: var(--accent-color, #3b82f6);
                border-radius: 3px;
            }
            
            .gsearch-empty {
                padding: 40px 20px;
                text-align: center;
                color: var(--text-muted, #64748b);
            }
            
            .gsearch-empty i {
                font-size: 2.5rem;
                margin-bottom: 12px;
                opacity: 0.5;
                display: block;
            }
            
            .gsearch-empty p {
                margin: 0;
                font-size: 0.95rem;
            }
            
            .gsearch-section {
                padding: 8px 0;
            }
            
            .gsearch-section-title {
                padding: 8px 20px;
                font-size: 0.75rem;
                font-weight: 600;
                color: var(--text-muted, #64748b);
                text-transform: uppercase;
                letter-spacing: 0.5px;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .gsearch-item {
                display: flex;
                align-items: center;
                gap: 14px;
                padding: 12px 20px;
                cursor: pointer;
                transition: all 0.15s;
                border-right: 3px solid transparent;
            }
            
            .gsearch-item:hover,
            .gsearch-item.focused {
                background: rgba(59, 130, 246, 0.1);
                border-right-color: var(--accent-color, #3b82f6);
            }
            
            .gsearch-item-icon {
                width: 40px;
                height: 40px;
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1rem;
                flex-shrink: 0;
            }
            
            .gsearch-item-icon.item {
                background: linear-gradient(135deg, #3b82f6, #1d4ed8);
                color: white;
            }
            
            .gsearch-item-icon.customer {
                background: linear-gradient(135deg, #10b981, #059669);
                color: white;
            }
            
            .gsearch-item-icon.supplier {
                background: linear-gradient(135deg, #f59e0b, #d97706);
                color: white;
            }
            
            .gsearch-item-icon.sales {
                background: linear-gradient(135deg, #10b981, #059669);
                color: white;
            }
            
            .gsearch-item-icon.purchase {
                background: linear-gradient(135deg, #f59e0b, #d97706);
                color: white;
            }
            
            .gsearch-item-icon.sales-return {
                background: linear-gradient(135deg, #8b5cf6, #7c3aed);
                color: white;
            }
            
            .gsearch-item-icon.purchase-return {
                background: linear-gradient(135deg, #ec4899, #db2777);
                color: white;
            }
            
            .gsearch-item-icon.receipt {
                background: linear-gradient(135deg, #0891b2, #0e7490);
                color: white;
            }
            
            .gsearch-item-icon.payment {
                background: linear-gradient(135deg, #ea580c, #c2410c);
                color: white;
            }
            
            .gsearch-item-info {
                flex: 1;
                min-width: 0;
            }
            
            .gsearch-item-title {
                font-weight: 600;
                color: var(--text-color, #e2e8f0);
                margin-bottom: 2px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .gsearch-item-subtitle {
                font-size: 0.8rem;
                color: var(--text-muted, #64748b);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .gsearch-item-badge {
                padding: 4px 10px;
                border-radius: 20px;
                font-size: 0.7rem;
                font-weight: 600;
                flex-shrink: 0;
            }
            
            .gsearch-item-badge.item {
                background: rgba(59, 130, 246, 0.15);
                color: #60a5fa;
            }
            
            .gsearch-item-badge.customer {
                background: rgba(16, 185, 129, 0.15);
                color: #34d399;
            }
            
            .gsearch-item-badge.supplier {
                background: rgba(245, 158, 11, 0.15);
                color: #fbbf24;
            }
            
            .gsearch-item-badge.sales {
                background: rgba(16, 185, 129, 0.15);
                color: #34d399;
            }
            
            .gsearch-item-badge.purchase {
                background: rgba(245, 158, 11, 0.15);
                color: #fbbf24;
            }
            
            .gsearch-item-badge.sales-return {
                background: rgba(139, 92, 246, 0.15);
                color: #a78bfa;
            }
            
            .gsearch-item-badge.purchase-return {
                background: rgba(236, 72, 153, 0.15);
                color: #f472b6;
            }
            
            .gsearch-item-badge.receipt {
                background: rgba(8, 145, 178, 0.15);
                color: #06b6d4;
            }
            
            .gsearch-item-badge.payment {
                background: rgba(234, 88, 12, 0.15);
                color: #fb923c;
            }
            
            .gsearch-footer {
                display: flex;
                justify-content: center;
                gap: 20px;
                padding: 12px 20px;
                border-top: 1px solid var(--table-border, rgba(255,255,255,0.1));
                background: var(--table-header-bg, rgba(0,0,0,0.2));
                flex-shrink: 0;
            }
            
            .gsearch-shortcut {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 0.75rem;
                color: var(--text-muted, #64748b);
            }
            
            .gsearch-shortcut kbd {
                background: rgba(255,255,255,0.1);
                padding: 3px 8px;
                border-radius: 4px;
                font-size: 0.7rem;
                font-family: inherit;
            }
            
            /* Loading Animation */
            .gsearch-loading {
                display: flex;
                justify-content: center;
                padding: 30px;
            }
            
            .gsearch-spinner {
                width: 30px;
                height: 30px;
                border: 3px solid var(--table-border, rgba(255,255,255,0.1));
                border-top-color: var(--accent-color, #3b82f6);
                border-radius: 50%;
                animation: gsearch-spin 0.8s linear infinite;
            }
            
            @keyframes gsearch-spin {
                to { transform: rotate(360deg); }
            }
            
            /* Item Details View */
            .gsearch-item-details {
                padding: 0;
            }
            
            .gsearch-detail-header {
                background: linear-gradient(135deg, #3b82f6, #1d4ed8);
                color: white;
                padding: 20px;
                text-align: center;
            }
            
            .gsearch-detail-header h2 {
                margin: 0 0 8px 0;
                font-size: 1.4rem;
            }
            
            .gsearch-detail-header p {
                margin: 0;
                opacity: 0.9;
                font-size: 0.9rem;
            }
            
            .gsearch-stats {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 1px;
                background: var(--table-border, rgba(255,255,255,0.1));
                margin: 0;
            }
            
            .gsearch-stat {
                background: var(--card-bg, #1e293b);
                padding: 15px 10px;
                text-align: center;
            }
            
            .gsearch-stat-value {
                font-size: 1.5rem;
                font-weight: 700;
                color: var(--text-color, #e2e8f0);
            }
            
            .gsearch-stat-value.in { color: #10b981; }
            .gsearch-stat-value.out { color: #ef4444; }
            .gsearch-stat-value.stock { color: #3b82f6; }
            
            .gsearch-stat-label {
                font-size: 0.75rem;
                color: var(--text-muted, #64748b);
                margin-top: 4px;
            }
            
            .gsearch-movements-title {
                padding: 15px 20px;
                font-weight: 600;
                color: var(--text-color, #e2e8f0);
                border-bottom: 1px solid var(--table-border, rgba(255,255,255,0.1));
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .gsearch-movements-list {
                max-height: 300px;
                overflow-y: auto;
            }
            
            .gsearch-movement {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 20px;
                border-bottom: 1px solid var(--table-border, rgba(255,255,255,0.05));
                transition: background 0.15s;
            }
            
            .gsearch-movement:hover {
                background: rgba(255,255,255,0.03);
            }
            
            .gsearch-movement-icon {
                width: 36px;
                height: 36px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 0.85rem;
                flex-shrink: 0;
            }
            
            .gsearch-movement-icon.in {
                background: rgba(16, 185, 129, 0.15);
                color: #10b981;
            }
            
            .gsearch-movement-icon.out {
                background: rgba(239, 68, 68, 0.15);
                color: #ef4444;
            }
            
            .gsearch-movement-info {
                flex: 1;
                min-width: 0;
            }
            
            .gsearch-movement-title {
                font-weight: 500;
                color: var(--text-color, #e2e8f0);
                font-size: 0.9rem;
            }
            
            .gsearch-movement-subtitle {
                font-size: 0.75rem;
                color: var(--text-muted, #64748b);
                margin-top: 2px;
            }
            
            .gsearch-movement-qty {
                text-align: left;
                flex-shrink: 0;
            }
            
            .gsearch-movement-qty-value {
                font-weight: 600;
                font-size: 0.95rem;
            }
            
            .gsearch-movement-qty-value.in { color: #10b981; }
            .gsearch-movement-qty-value.out { color: #ef4444; }
            
            .gsearch-movement-qty-label {
                font-size: 0.7rem;
                color: var(--text-muted, #64748b);
            }
            
            .gsearch-no-movements {
                padding: 30px;
                text-align: center;
                color: var(--text-muted, #64748b);
            }
            
            /* Invoice/Return Details Tables */
            .gsearch-item-details table {
                width: 100%;
                border-collapse: collapse;
                font-size: 0.9rem;
            }
            
            .gsearch-item-details table thead {
                background: var(--table-header-bg, rgba(0,0,0,0.2));
            }
            
            .gsearch-item-details table th {
                padding: 12px;
                text-align: center;
                font-weight: 600;
                color: var(--text-color, #e2e8f0);
                border-bottom: 1px solid var(--table-border, rgba(255,255,255,0.1));
            }
            
            .gsearch-item-details table tbody tr {
                border-bottom: 1px solid var(--table-border, rgba(255,255,255,0.05));
                transition: background 0.15s;
            }
            
            .gsearch-item-details table tbody tr:hover {
                background: rgba(255,255,255,0.03);
            }
            
            .gsearch-item-details table td {
                padding: 12px;
                text-align: center;
                color: var(--text-color, #e2e8f0);
            }
            
            .gsearch-item-details table td:first-child,
            .gsearch-item-details table th:first-child {
                text-align: right;
            }
        `;
        document.head.appendChild(style);
    }
    
    t(key, fallback = '') {
        if (window.i18n && typeof window.i18n.getText === 'function') {
            return window.i18n.getText(this.ar, key, fallback);
        }
        return fallback;
    }

    async loadDictionary() {
        if (window.i18n && typeof window.i18n.loadArabicDictionary === 'function') {
            this.ar = await window.i18n.loadArabicDictionary();
        }
    }

    createSearchModal() {
        // إنشاء الـ Overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'gsearch-overlay';
        this.overlay.onclick = () => this.close();
        
        // إنشاء المودال
        this.modal = document.createElement('div');
        this.modal.className = 'gsearch-modal';
        this.modal.innerHTML = `
            <div class="gsearch-header">
                <i class="fas fa-search"></i>
                <input type="text" class="gsearch-input" placeholder="${this.t('globalSearch.placeholder', 'ابحث عن صنف، عميل، أو مورد...')}">
                <button class="gsearch-close" title="${this.t('globalSearch.close', 'إغلاق')} (Esc)">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="gsearch-body">
                <div class="gsearch-empty">
                    <i class="fas fa-search"></i>
                    <p>${this.t('globalSearch.searchPrompt', 'اكتب للبحث في الأصناف والعملاء والموردين')}</p>
                </div>
            </div>
            <div class="gsearch-footer">
                <div class="gsearch-shortcut">
                    <kbd>↑↓</kbd> ${this.t('globalSearch.navigateHint', 'للتنقل')}
                </div>
                <div class="gsearch-shortcut">
                    <kbd>Enter</kbd> ${this.t('globalSearch.selectHint', 'للاختيار')}
                </div>
                <div class="gsearch-shortcut">
                    <kbd>Esc</kbd> ${this.t('globalSearch.closeHint', 'للإغلاق')}
                </div>
            </div>
        `;
        
        document.body.appendChild(this.overlay);
        document.body.appendChild(this.modal);
        
        this.input = this.modal.querySelector('.gsearch-input');
        this.resultsContainer = this.modal.querySelector('.gsearch-body');
        
        this.input.addEventListener('input', () => this.handleInput());
        this.input.addEventListener('keydown', (e) => this.handleKeydown(e));
        this.modal.querySelector('.gsearch-close').onclick = () => this.close();
    }
    
    bindKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+K أو Ctrl+/ للفتح (يعمل مع أي لغة كيبورد)
            // استخدام e.code بدلاً من e.key لأنه لا يتأثر بلغة الكيبورد
            if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyK' || e.key === '/')) {
                e.preventDefault();
                this.open();
            }
            
            // Escape للإغلاق
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    }
    
    bindSearchButton() {
        document.addEventListener('click', (e) => {
            const searchBtn = e.target.closest('.nav-search-btn');
            if (!searchBtn) return;
            e.preventDefault();
            this.open();
        });

        this.observeNavChanges();
        this.scheduleSearchButtonSync();
        setTimeout(() => this.scheduleSearchButtonSync(), 120);
        setTimeout(() => this.scheduleSearchButtonSync(), 350);
    }

    observeNavChanges() {
        if (this.navObserver || !document.body) return;

        this.navObserver = new MutationObserver(() => {
            this.scheduleSearchButtonSync();
        });

        this.navObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    scheduleSearchButtonSync() {
        if (this.searchButtonSyncTimer) {
            cancelAnimationFrame(this.searchButtonSyncTimer);
        }

        this.searchButtonSyncTimer = requestAnimationFrame(() => {
            this.searchButtonSyncTimer = null;
            this.ensureSearchButton();
        });
    }

    ensureSearchButton() {
        const navLinks = document.querySelector('.top-nav .nav-links');
        if (!navLinks) return;

        let searchItem = navLinks.querySelector('.nav-search-item');

        if (!searchItem) {
            searchItem = document.createElement('li');
            searchItem.className = 'nav-search-item';
            searchItem.innerHTML = `
                <button class="nav-search-btn" type="button">
                    <span class="nav-search-icon" aria-hidden="true">🔍</span> ${this.t('globalSearch.searchBtn', 'بحث')}
                </button>
            `;
            navLinks.appendChild(searchItem);
        }

        const hasSearchBtn = searchItem.querySelector('.nav-search-btn');
        if (!hasSearchBtn) {
            searchItem.innerHTML = `
                <button class="nav-search-btn" type="button">
                    <span class="nav-search-icon" aria-hidden="true">🔍</span> ${this.t('globalSearch.searchBtn', 'بحث')}
                </button>
            `;
        }

        const settingsLink = navLinks.querySelector(
            'a[href$="settings/index.html"], a[href*="/settings/index.html"], a[href*="settings/index.html"]'
        );
        const settingsItem = settingsLink ? settingsLink.closest('li') : null;

        if (settingsItem && settingsItem.parentElement === navLinks) {
            if (settingsItem.nextElementSibling !== searchItem) {
                navLinks.insertBefore(searchItem, settingsItem.nextElementSibling);
            }
            return;
        }

        if (navLinks.lastElementChild !== searchItem) {
            navLinks.appendChild(searchItem);
        }
    }
    
    open() {
        this.isOpen = true;
        this.currentView = 'search';
        this.overlay.classList.add('active');
        this.modal.classList.add('active');
        this.input.value = '';
        this.input.focus();
        this.focusedIndex = -1;
        this.results = [];
        this.showDefaultState();
    }
    
    close() {
        this.isOpen = false;
        this.currentView = 'search';
        this.overlay.classList.remove('active');
        this.modal.classList.remove('active');
    }
    
    showDefaultState() {
        this.resultsContainer.innerHTML = `
            <div class="gsearch-empty">
                <i class="fas fa-search"></i>
                <p>${this.t('globalSearch.searchPrompt', 'اكتب للبحث في الأصناف والعملاء والموردين')}</p>
            </div>
        `;
    }
    
    showLoading() {
        this.resultsContainer.innerHTML = `
            <div class="gsearch-loading">
                <div class="gsearch-spinner"></div>
            </div>
        `;
    }
    
    showNoResults() {
        this.resultsContainer.innerHTML = `
            <div class="gsearch-empty">
                <i class="fas fa-inbox"></i>
                <p>${this.t('globalSearch.noResults', 'لا توجد نتائج مطابقة')}</p>
            </div>
        `;
    }
    
    handleInput() {
        const query = this.input.value.trim();
        
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        
        if (!query) {
            this.showDefaultState();
            return;
        }
        
        this.showLoading();
        
        this.debounceTimer = setTimeout(() => {
            this.performSearch(query);
        }, 200);
    }
    
    handleKeydown(e) {
        // دعم Backspace للرجوع من عرض حركة الصنف
        if (e.key === 'Backspace' && this.currentView === 'item-details') {
            e.preventDefault();
            this.backToSearch();
            return;
        }
        
        const items = this.resultsContainer.querySelectorAll('.gsearch-item');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.focusedIndex = Math.min(this.focusedIndex + 1, items.length - 1);
            this.updateFocus(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.focusedIndex = Math.max(this.focusedIndex - 1, 0);
            this.updateFocus(items);
        } else if (e.key === 'Enter' && this.focusedIndex >= 0 && this.results[this.focusedIndex]) {
            e.preventDefault();
            const result = this.results[this.focusedIndex];
            this.handleResultClick(result.type, result.id);
        }
    }
    
    updateFocus(items) {
        items.forEach((item, index) => {
            item.classList.toggle('focused', index === this.focusedIndex);
        });
        
        if (items[this.focusedIndex]) {
            items[this.focusedIndex].scrollIntoView({ block: 'nearest' });
        }
    }
    
    async performSearch(query) {
        try {
            this.results = [];
            
            // البحث في الأصناف
            const items = await window.electronAPI.getItems();
            const filteredItems = items.filter(item => 
                item.name.includes(query) || 
                (item.barcode && item.barcode.includes(query))
            ).slice(0, 5);
            
            filteredItems.forEach(item => {
                this.results.push({
                    type: 'item',
                    id: item.id,
                    title: item.name,
                    subtitle: `${this.t('globalSearch.barcode', 'الباركود')}: ${item.barcode || this.t('globalSearch.noBarcode', 'لا يوجد')} | ${this.t('globalSearch.stock', 'المخزون')}: ${item.stock_quantity || 0}`,
                    data: item
                });
            });
            
            // البحث في فواتير المبيعات
            const salesInvoices = await window.electronAPI.getSalesInvoices();
            const filteredSales = salesInvoices.filter(inv => 
                inv.invoice_number && inv.invoice_number.includes(query)
            ).slice(0, 5);
            
            filteredSales.forEach(invoice => {
                this.results.push({
                    type: 'sales',
                    id: invoice.id,
                    title: invoice.invoice_number,
                    subtitle: `${this.t('globalSearch.customer', 'العميل')}: ${invoice.customer_name || '-'} | ${this.t('globalSearch.amount', 'المبلغ')}: ${(invoice.total_amount || 0).toLocaleString()} | ${invoice.invoice_date}`,
                    data: invoice
                });
            });
            
            // البحث في فواتير المشتريات
            const purchaseInvoices = await window.electronAPI.getPurchaseInvoices();
            const filteredPurchases = purchaseInvoices.filter(inv => 
                inv.invoice_number && inv.invoice_number.includes(query)
            ).slice(0, 5);
            
            filteredPurchases.forEach(invoice => {
                this.results.push({
                    type: 'purchase',
                    id: invoice.id,
                    title: invoice.invoice_number,
                    subtitle: `${this.t('globalSearch.supplier', 'المورد')}: ${invoice.supplier_name || '-'} | ${this.t('globalSearch.amount', 'المبلغ')}: ${(invoice.total_amount || 0).toLocaleString()} | ${invoice.invoice_date}`,
                    data: invoice
                });
            });
            
            // البحث في مرتجعات المبيعات
            const salesReturns = await window.electronAPI.getSalesReturns();
            const filteredSalesReturns = salesReturns.filter(ret => 
                ret.return_number && ret.return_number.includes(query)
            ).slice(0, 5);
            
            filteredSalesReturns.forEach(salesReturn => {
                this.results.push({
                    type: 'sales-return',
                    id: salesReturn.id,
                    title: salesReturn.return_number,
                    subtitle: `${this.t('globalSearch.customer', 'العميل')}: ${salesReturn.customer_name || '-'} | ${this.t('globalSearch.amount', 'المبلغ')}: ${(salesReturn.total_amount || 0).toLocaleString()} | ${salesReturn.return_date}`,
                    data: salesReturn
                });
            });
            
            // البحث في مرتجعات المشتريات
            const purchaseReturns = await window.electronAPI.getPurchaseReturns();
            const filteredPurchaseReturns = purchaseReturns.filter(ret => 
                ret.return_number && ret.return_number.includes(query)
            ).slice(0, 5);
            
            filteredPurchaseReturns.forEach(purchaseReturn => {
                this.results.push({
                    type: 'purchase-return',
                    id: purchaseReturn.id,
                    title: purchaseReturn.return_number,
                    subtitle: `${this.t('globalSearch.supplier', 'المورد')}: ${purchaseReturn.supplier_name || '-'} | ${this.t('globalSearch.amount', 'المبلغ')}: ${(purchaseReturn.total_amount || 0).toLocaleString()} | ${purchaseReturn.return_date}`,
                    data: purchaseReturn
                });
            });
            
            // البحث في سندات التحصيل والسداد
            const transactions = await window.electronAPI.getTreasuryTransactions();
            const filteredTransactions = transactions.filter(tr => 
                tr.voucher_number && tr.voucher_number.includes(query)
            ).slice(0, 5);
            
            filteredTransactions.forEach(transaction => {
                const isReceipt = transaction.type === 'income';
                this.results.push({
                    type: isReceipt ? 'receipt' : 'payment',
                    id: transaction.id,
                    title: transaction.voucher_number,
                    subtitle: `${this.t('globalSearch.amount', 'المبلغ')}: ${(transaction.amount || 0).toLocaleString()} | ${transaction.transaction_date || ''}`,
                    data: transaction
                });
            });
            
            // البحث في العملاء
            const customers = await window.electronAPI.getCustomers();
            const filteredCustomers = customers.filter(c => 
                (c.type === 'customer' || c.type === 'both') && (c.name.includes(query) || (c.code && String(c.code).includes(query)))
            ).slice(0, 5);
            
            filteredCustomers.forEach(customer => {
                const balance = customer.balance || 0;
                const balanceText = balance > 0 ? `${this.t('globalSearch.balanceFor', 'له')}: ${balance.toLocaleString()}` : 
                                   balance < 0 ? `${this.t('globalSearch.balanceAgainst', 'عليه')}: ${Math.abs(balance).toLocaleString()}` : this.t('globalSearch.balanced', 'متزن');
                this.results.push({
                    type: 'customer',
                    id: customer.id,
                    title: customer.name,
                    subtitle: `${customer.phone || this.t('globalSearch.noPhone', 'لا يوجد هاتف')} | ${balanceText}`,
                    data: customer
                });
            });
            
            // البحث في الموردين
            const filteredSuppliers = customers.filter(c => 
                (c.type === 'supplier' || c.type === 'both') && (c.name.includes(query) || (c.code && String(c.code).includes(query)))
            ).slice(0, 5);
            
            filteredSuppliers.forEach(supplier => {
                const balance = supplier.balance || 0;
                const balanceText = balance > 0 ? `${this.t('globalSearch.balanceFor', 'له')}: ${balance.toLocaleString()}` : 
                                   balance < 0 ? `${this.t('globalSearch.balanceAgainst', 'عليه')}: ${Math.abs(balance).toLocaleString()}` : this.t('globalSearch.balanced', 'متزن');
                this.results.push({
                    type: 'supplier',
                    id: supplier.id,
                    title: supplier.name,
                    subtitle: `${supplier.phone || this.t('globalSearch.noPhone', 'لا يوجد هاتف')} | ${balanceText}`,
                    data: supplier
                });
            });
            
            this.displayResults();
            
        } catch (error) {
            console.error('Search error:', error);
            this.showNoResults();
        }
    }
    
    displayResults() {
        if (!this.results.length) {
            this.showNoResults();
            return;
        }
        
        const itemResults = this.results.filter(r => r.type === 'item');
        const salesResults = this.results.filter(r => r.type === 'sales');
        const purchaseResults = this.results.filter(r => r.type === 'purchase');
        const salesReturnResults = this.results.filter(r => r.type === 'sales-return');
        const purchaseReturnResults = this.results.filter(r => r.type === 'purchase-return');
        const receiptResults = this.results.filter(r => r.type === 'receipt');
        const paymentResults = this.results.filter(r => r.type === 'payment');
        const customerResults = this.results.filter(r => r.type === 'customer');
        const supplierResults = this.results.filter(r => r.type === 'supplier');
        
        let html = '';
        
        if (salesResults.length) {
            html += `
                <div class="gsearch-section">
                    <div class="gsearch-section-title">
                        <i class="fas fa-file-invoice"></i> ${this.t('globalSearch.sections.sales', 'فواتير المبيعات')}
                    </div>
                    ${salesResults.map((r, i) => this.renderResultItem(r, this.results.indexOf(r))).join('')}
                </div>
            `;
        }
        
        if (purchaseResults.length) {
            html += `
                <div class="gsearch-section">
                    <div class="gsearch-section-title">
                        <i class="fas fa-file-invoice-dollar"></i> ${this.t('globalSearch.sections.purchases', 'فواتير المشتريات')}
                    </div>
                    ${purchaseResults.map((r, i) => this.renderResultItem(r, this.results.indexOf(r))).join('')}
                </div>
            `;
        }
        
        if (salesReturnResults.length) {
            html += `
                <div class="gsearch-section">
                    <div class="gsearch-section-title">
                        <i class="fas fa-undo-alt"></i> ${this.t('globalSearch.sections.salesReturns', 'مردودات المبيعات')}
                    </div>
                    ${salesReturnResults.map((r, i) => this.renderResultItem(r, this.results.indexOf(r))).join('')}
                </div>
            `;
        }
        
        if (purchaseReturnResults.length) {
            html += `
                <div class="gsearch-section">
                    <div class="gsearch-section-title">
                        <i class="fas fa-undo"></i> ${this.t('globalSearch.sections.purchaseReturns', 'مردودات المشتريات')}
                    </div>
                    ${purchaseReturnResults.map((r, i) => this.renderResultItem(r, this.results.indexOf(r))).join('')}
                </div>
            `;
        }
        
        if (receiptResults.length) {
            html += `
                <div class="gsearch-section">
                    <div class="gsearch-section-title">
                        <i class="fas fa-hand-holding-usd"></i> ${this.t('globalSearch.sections.receipts', 'سندات التحصيل')}
                    </div>
                    ${receiptResults.map((r, i) => this.renderResultItem(r, this.results.indexOf(r))).join('')}
                </div>
            `;
        }
        
        if (paymentResults.length) {
            html += `
                <div class="gsearch-section">
                    <div class="gsearch-section-title">
                        <i class="fas fa-money-bill-wave"></i> ${this.t('globalSearch.sections.payments', 'سندات السداد')}
                    </div>
                    ${paymentResults.map((r, i) => this.renderResultItem(r, this.results.indexOf(r))).join('')}
                </div>
            `;
        }
        
        if (itemResults.length) {
            html += `
                <div class="gsearch-section">
                    <div class="gsearch-section-title">
                        <i class="fas fa-box"></i> ${this.t('globalSearch.sections.items', 'الأصناف')}
                    </div>
                    ${itemResults.map((r, i) => this.renderResultItem(r, this.results.indexOf(r))).join('')}
                </div>
            `;
        }
        
        if (customerResults.length) {
            html += `
                <div class="gsearch-section">
                    <div class="gsearch-section-title">
                        <i class="fas fa-users"></i> ${this.t('globalSearch.sections.customers', 'العملاء')}
                    </div>
                    ${customerResults.map((r, i) => this.renderResultItem(r, this.results.indexOf(r))).join('')}
                </div>
            `;
        }
        
        if (supplierResults.length) {
            html += `
                <div class="gsearch-section">
                    <div class="gsearch-section-title">
                        <i class="fas fa-truck"></i> ${this.t('globalSearch.sections.suppliers', 'الموردين')}
                    </div>
                    ${supplierResults.map((r, i) => this.renderResultItem(r, this.results.indexOf(r))).join('')}
                </div>
            `;
        }
        
        this.resultsContainer.innerHTML = html;
        this.focusedIndex = -1;
    }
    
    renderResultItem(result, index) {
        const typeLabels = {
            item: this.t('globalSearch.badges.item', 'صنف'),
            sales: this.t('globalSearch.badges.sales', 'مبيعات'),
            purchase: this.t('globalSearch.badges.purchase', 'مشتريات'),
            'sales-return': this.t('globalSearch.badges.salesReturn', 'مرتجع بيع'),
            'purchase-return': this.t('globalSearch.badges.purchaseReturn', 'مرتجع شراء'),
            receipt: this.t('globalSearch.badges.receipt', 'تحصيل'),
            payment: this.t('globalSearch.badges.payment', 'سداد'),
            customer: this.t('globalSearch.badges.customer', 'عميل'),
            supplier: this.t('globalSearch.badges.supplier', 'مورد')
        };
        
        const icons = {
            item: 'fa-box',
            sales: 'fa-file-invoice',
            purchase: 'fa-file-invoice-dollar',
            'sales-return': 'fa-undo-alt',
            'purchase-return': 'fa-undo',
            receipt: 'fa-hand-holding-usd',
            payment: 'fa-money-bill-wave',
            customer: 'fa-user',
            supplier: 'fa-truck'
        };
        
        return `
            <div class="gsearch-item" data-index="${index}" onclick="globalSearch.handleResultClick('${result.type}', ${result.id})">
                <div class="gsearch-item-icon ${result.type}">
                    <i class="fas ${icons[result.type]}"></i>
                </div>
                <div class="gsearch-item-info">
                    <div class="gsearch-item-title">${result.title}</div>
                    <div class="gsearch-item-subtitle">${result.subtitle}</div>
                </div>
                <span class="gsearch-item-badge ${result.type}">${typeLabels[result.type]}</span>
            </div>
        `;
    }
    
    async handleResultClick(type, id) {
        if (type === 'item') {
            // عرض حركة الصنف في نفس الـ Modal
            await this.showItemMovements(id);
        } else if (type === 'receipt' || type === 'payment') {
            // عرض تفاصيل السند في نفس الـ Modal
            await this.showVoucherDetails(type, id);
        } else if (type === 'sales') {
            // عرض تفاصيل فاتورة البيع في Modal
            await this.showSalesInvoiceDetails(id);
        } else if (type === 'purchase') {
            // عرض تفاصيل فاتورة الشراء في Modal
            await this.showPurchaseInvoiceDetails(id);
        } else if (type === 'sales-return') {
            // عرض تفاصيل مرتجع بيع في Modal
            await this.showSalesReturnDetails(id);
        } else if (type === 'purchase-return') {
            // عرض تفاصيل مرتجع شراء في Modal
            await this.showPurchaseReturnDetails(id);
        } else {
            // للعملاء والموردين - الانتقال للصفحة المناسبة
            this.close();
            
            const currentPath = window.location.pathname;
            let basePath = '';
            
            const viewsMatch = currentPath.match(/.*[\/\\]views[\/\\]/);
            if (viewsMatch) {
                const afterViews = currentPath.substring(viewsMatch[0].length);
                const depth = (afterViews.match(/[\/\\]/g) || []).length;
                basePath = '../'.repeat(depth) || './';
            } else {
                basePath = './';
            }
            
            basePath = basePath.replace(/\/$/, '');
            
            switch (type) {
                case 'customer':
                    window.location.href = `${basePath}/customer-reports/index.html?customerId=${id}`;
                    break;
                case 'supplier':
                    window.location.href = `${basePath}/reports/debtor-creditor/index.html?supplierId=${id}`;
                    break;
            }
        }
    }
    
    async showItemMovements(itemId) {
        this.currentView = 'item-details';
        this.showLoading();
        
        try {
            const result = await window.electronAPI.getItemMovements(itemId);
            
            if (!result.success) {
                this.resultsContainer.innerHTML = `
                    <div class="gsearch-empty">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>${result.error || this.t('globalSearch.fetchError', 'حدث خطأ في جلب البيانات')}</p>
                    </div>
                `;
                return;
            }
            
            const { item, movements, stats } = result;
            
            // تحديث الـ Header ليظهر زر الرجوع
            const header = this.modal.querySelector('.gsearch-header');
            header.innerHTML = `
                <button class="gsearch-back" onclick="globalSearch.backToSearch()" title="${this.t('globalSearch.backToSearch', 'رجوع للبحث')}">
                    <i class="fas fa-arrow-right"></i>
                </button>
                <span style="flex: 1; font-weight: 600; color: var(--text-color);">
                    <i class="fas fa-box" style="color: var(--accent-color); margin-left: 8px;"></i>
                    ${this.t('globalSearch.itemMovements', 'حركة الصنف: {name}').replace('{name}', item.name)}
                </span>
                <button class="gsearch-close" title="${this.t('globalSearch.close', 'إغلاق')} (Esc)" onclick="globalSearch.close()">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            // بناء محتوى حركة الصنف
            let html = `
                <div class="gsearch-item-details">
                    <div class="gsearch-detail-header">
                        <h2>${item.name}</h2>
                        <p>${this.t('globalSearch.barcodeLabel', 'الباركود')}: ${item.barcode || this.t('globalSearch.noBarcode', 'لا يوجد')} | ${this.t('globalSearch.unitLabel', 'الوحدة')}: ${item.unit_name || '-'}</p>
                    </div>
                    
                    <div class="gsearch-stats">
                        <div class="gsearch-stat">
                            <div class="gsearch-stat-value in">+${stats.totalPurchased + stats.totalOpening}</div>
                            <div class="gsearch-stat-label">${this.t('globalSearch.totalIncoming', 'إجمالي الوارد')}</div>
                        </div>
                        <div class="gsearch-stat">
                            <div class="gsearch-stat-value out">-${stats.totalSold}</div>
                            <div class="gsearch-stat-label">${this.t('globalSearch.totalOutgoing', 'إجمالي الصادر')}</div>
                        </div>
                        <div class="gsearch-stat">
                            <div class="gsearch-stat-value stock">${stats.currentStock}</div>
                            <div class="gsearch-stat-label">${this.t('globalSearch.currentStock', 'الرصيد الحالي')}</div>
                        </div>
                        <div class="gsearch-stat">
                            <div class="gsearch-stat-value">${movements.length}</div>
                            <div class="gsearch-stat-label">${this.t('globalSearch.movementCount', 'عدد الحركات')}</div>
                        </div>
                    </div>
                    
                    <div class="gsearch-movements-title">
                        <i class="fas fa-history"></i>
                        ${this.t('globalSearch.movementLog', 'سجل الحركات')}
                    </div>
                    
                    <div class="gsearch-movements-list">
            `;
            
            if (movements.length === 0) {
                html += `
                    <div class="gsearch-no-movements">
                        <i class="fas fa-inbox" style="font-size: 2rem; opacity: 0.5; margin-bottom: 10px; display: block;"></i>
                        ${this.t('globalSearch.noMovements', 'لا توجد حركات مسجلة لهذا الصنف')}
                    </div>
                `;
            } else {
                movements.forEach(mov => {
                    const isIn = mov.type === 'purchase' || mov.type === 'opening';
                    const iconClass = isIn ? 'in' : 'out';
                    const icon = isIn ? 'fa-arrow-down' : 'fa-arrow-up';
                    const qtyPrefix = isIn ? '+' : '-';
                    
                    const date = new Date(mov.date).toLocaleDateString('ar-EG', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    });
                    
                    html += `
                        <div class="gsearch-movement">
                            <div class="gsearch-movement-icon ${iconClass}">
                                <i class="fas ${icon}"></i>
                            </div>
                            <div class="gsearch-movement-info">
                                <div class="gsearch-movement-title">${mov.type_label}</div>
                                <div class="gsearch-movement-subtitle">
                                    ${mov.party_name} | ${this.t('globalSearch.invoiceLabel', 'فاتورة')}: ${mov.invoice_number} | ${date}
                                </div>
                            </div>
                            <div class="gsearch-movement-qty">
                                <div class="gsearch-movement-qty-value ${iconClass}">${qtyPrefix}${mov.quantity}</div>
                                <div class="gsearch-movement-qty-label">${mov.price.toLocaleString()} ${this.t('globalSearch.priceLabel', 'ج.م')}</div>
                            </div>
                        </div>
                    `;
                });
            }
            
            html += `
                    </div>
                </div>
            `;
            
            this.resultsContainer.innerHTML = html;
            
            // تحديث الـ Footer
            const footer = this.modal.querySelector('.gsearch-footer');
            footer.innerHTML = `
                <div class="gsearch-shortcut">
                    <kbd>Backspace</kbd> ${this.t('globalSearch.backHint', 'للرجوع')}
                </div>
                <div class="gsearch-shortcut">
                    <kbd>Esc</kbd> ${this.t('globalSearch.closeHint', 'للإغلاق')}
                </div>
            `;
            
        } catch (error) {
            console.error('Error loading item movements:', error);
            this.resultsContainer.innerHTML = `
                <div class="gsearch-empty">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${this.t('globalSearch.fetchMovementError', 'حدث خطأ في جلب حركة الصنف')}</p>
                </div>
            `;
        }
    }
    
    async showVoucherDetails(type, id) {
        this.currentView = 'voucher-details';
        this.showLoading();
        
        try {
            const transactions = await window.electronAPI.getTreasuryTransactions();
            const voucher = transactions.find(t => t.id === id);
            
            if (!voucher) {
                this.resultsContainer.innerHTML = `
                    <div class="gsearch-empty">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>${this.t('globalSearch.voucherNotFound', 'السند غير موجود')}</p>
                    </div>
                `;
                return;
            }
            
            const isReceipt = voucher.type === 'income';
            const customers = await window.electronAPI.getCustomers();
            const relatedCustomer = voucher.customer_id ? customers.find(c => c.id === voucher.customer_id) : null;
            
            // تحديث الـ Header
            const header = this.modal.querySelector('.gsearch-header');
            header.innerHTML = `
                <button class="gsearch-back" onclick="globalSearch.backToSearch()" title="${this.t('globalSearch.backToSearch', 'رجوع للبحث')}">
                    <i class="fas fa-arrow-right"></i>
                </button>
                <span style="flex: 1; font-weight: 600; color: var(--text-color);">
                    <i class="fas ${isReceipt ? 'fa-hand-holding-usd' : 'fa-money-bill-wave'}" style="color: ${isReceipt ? '#0891b2' : '#ea580c'}; margin-left: 8px;"></i>
                    ${isReceipt ? this.t('globalSearch.receiptDetails', 'تفاصيل سند التحصيل') : this.t('globalSearch.paymentDetails', 'تفاصيل سند السداد')}
                </span>
                <button class="gsearch-close" title="${this.t('globalSearch.close', 'إغلاق')} (Esc)" onclick="globalSearch.close()">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            // بناء محتوى السند
            let html = `
                <div class="gsearch-item-details">
                    <div class="gsearch-detail-header">
                        <h2 style="color: ${isReceipt ? '#0891b2' : '#ea580c'};">${voucher.voucher_number || '-'}</h2>
                        <p>${this.t('globalSearch.date', 'التاريخ')}: ${voucher.transaction_date || '-'}</p>
                    </div>
                    
                    <div class="gsearch-stats" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
                        <div class="gsearch-stat">
                            <div class="gsearch-stat-value" style="color: ${isReceipt ? '#0891b2' : '#ea580c'};">${(voucher.amount || 0).toLocaleString()} ج.م</div>
                            <div class="gsearch-stat-label">${this.t('globalSearch.amount', 'المبلغ')}</div>
                        </div>
                        ${relatedCustomer ? `
                        <div class="gsearch-stat">
                            <div class="gsearch-stat-value">${relatedCustomer.name}</div>
                            <div class="gsearch-stat-label">${isReceipt ? this.t('globalSearch.customer', 'العميل') : this.t('globalSearch.supplier', 'المورد')}</div>
                        </div>
                        ` : ''}
                    </div>
                    
                    ${voucher.description ? `
                    <div style="margin-top: 20px; padding: 16px; background: var(--table-header-bg, rgba(0,0,0,0.2)); border-radius: 8px;">
                        <strong style="color: var(--text-muted);">${this.t('globalSearch.description', 'الوصف')}:</strong>
                        <p style="margin: 8px 0 0 0; color: var(--text-color);">${voucher.description}</p>
                    </div>
                    ` : ''}
                </div>
            `;
            
            this.resultsContainer.innerHTML = html;
            
        } catch (error) {
            console.error('Error loading voucher details:', error);
            this.resultsContainer.innerHTML = `
                <div class="gsearch-empty">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${this.t('globalSearch.fetchError', 'حدث خطأ في جلب البيانات')}</p>
                </div>
            `;
        }
    }
    
    async showSalesInvoiceDetails(id) {
        this.currentView = 'invoice-details';
        this.showLoading();
        
        try {
            const invoices = await window.electronAPI.getSalesInvoices();
            const invoice = invoices.find(inv => inv.id === id);
            
            if (!invoice) {
                this.resultsContainer.innerHTML = `
                    <div class="gsearch-empty">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>${this.t('globalSearch.invoiceNotFound', 'الفاتورة غير موجودة')}</p>
                    </div>
                `;
                return;
            }
            
            const details = await window.electronAPI.getSalesInvoiceDetails(id);
            
            // تحديث الـ Header
            const header = this.modal.querySelector('.gsearch-header');
            header.innerHTML = `
                <button class="gsearch-back" onclick="globalSearch.backToSearch()" title="${this.t('globalSearch.backToSearch', 'رجوع للبحث')}">
                    <i class="fas fa-arrow-right"></i>
                </button>
                <span style="flex: 1; font-weight: 600; color: var(--text-color);">
                    <i class="fas fa-file-invoice" style="color: #10b981; margin-left: 8px;"></i>
                    ${this.t('globalSearch.salesInvoiceDetails', 'تفاصيل فاتورة البيع')}
                </span>
                <button class="gsearch-close" title="${this.t('globalSearch.close', 'إغلاق')} (Esc)" onclick="globalSearch.close()">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            // بناء جدول الأصناف
            let itemsTable = details.map(item => `
                <tr>
                    <td>${item.item_name || '-'}</td>
                    <td>${(item.quantity || 0).toLocaleString()}</td>
                    <td>${(item.price || 0).toLocaleString()}</td>
                    <td>${(item.discount_value || 0).toLocaleString()}</td>
                    <td style="font-weight: 600;">${(item.total_price || 0).toLocaleString()}</td>
                </tr>
            `).join('');
            
            let html = `
                <div class="gsearch-item-details">
                    <div class="gsearch-detail-header">
                        <h2 style="color: #10b981;">${invoice.invoice_number || '-'}</h2>
                        <p>${this.t('globalSearch.date', 'التاريخ')}: ${invoice.invoice_date || '-'}</p>
                    </div>
                    
                    <div class="gsearch-stats" style="grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));">
                        <div class="gsearch-stat">
                            <div class="gsearch-stat-value">${invoice.customer_name || '-'}</div>
                            <div class="gsearch-stat-label">${this.t('globalSearch.customer', 'العميل')}</div>
                        </div>
                        <div class="gsearch-stat">
                            <div class="gsearch-stat-value" style="color: #10b981;">${(invoice.total_amount || 0).toLocaleString()} ج.م</div>
                            <div class="gsearch-stat-label">${this.t('globalSearch.totalAmount', 'الإجمالي')}</div>
                        </div>
                        <div class="gsearch-stat">
                            <div class="gsearch-stat-value" style="color: #0891b2;">${(invoice.paid_amount || 0).toLocaleString()} ج.م</div>
                            <div class="gsearch-stat-label">${this.t('globalSearch.paidAmount', 'المدفوع')}</div>
                        </div>
                        <div class="gsearch-stat">
                            <div class="gsearch-stat-value" style="color: ${invoice.remaining_amount > 0 ? '#ea580c' : '#10b981'};">${(invoice.remaining_amount || 0).toLocaleString()} ج.م</div>
                            <div class="gsearch-stat-label">${this.t('globalSearch.remainingAmount', 'المتبقي')}</div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 20px;">
                        <h3 style="color: var(--text-muted); margin-bottom: 12px; font-size: 0.9rem;">
                            <i class="fas fa-box"></i> ${this.t('globalSearch.items', 'الأصناف')}
                        </h3>
                        <div style="overflow-x: auto; border-radius: 8px; border: 1px solid var(--table-border, rgba(255,255,255,0.1));">
                            <table style="width: 100%; border-collapse: collapse;">
                                <thead style="background: var(--table-header-bg, rgba(0,0,0,0.2));">
                                    <tr>
                                        <th style="padding: 12px; text-align: right; font-weight: 600;">${this.t('globalSearch.itemName', 'الصنف')}</th>
                                        <th style="padding: 12px; text-align: center; font-weight: 600;">${this.t('globalSearch.quantity', 'الكمية')}</th>
                                        <th style="padding: 12px; text-align: center; font-weight: 600;">${this.t('globalSearch.price', 'السعر')}</th>
                                        <th style="padding: 12px; text-align: center; font-weight: 600;">${this.t('globalSearch.discount', 'الخصم')}</th>
                                        <th style="padding: 12px; text-align: center; font-weight: 600;">${this.t('globalSearch.total', 'الإجمالي')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itemsTable}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    ${invoice.notes ? `
                    <div style="margin-top: 20px; padding: 16px; background: var(--table-header-bg, rgba(0,0,0,0.2)); border-radius: 8px;">
                        <strong style="color: var(--text-muted);">${this.t('globalSearch.notes', 'ملاحظات')}:</strong>
                        <p style="margin: 8px 0 0 0; color: var(--text-color);">${invoice.notes}</p>
                    </div>
                    ` : ''}
                </div>
            `;
            
            this.resultsContainer.innerHTML = html;
            
        } catch (error) {
            console.error('Error loading sales invoice:', error);
            this.resultsContainer.innerHTML = `
                <div class="gsearch-empty">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${this.t('globalSearch.fetchError', 'حدث خطأ في جلب البيانات')}</p>
                </div>
            `;
        }
    }
    
    async showPurchaseInvoiceDetails(id) {
        this.currentView = 'invoice-details';
        this.showLoading();
        
        try {
            const invoices = await window.electronAPI.getPurchaseInvoices();
            const invoice = invoices.find(inv => inv.id === id);
            
            if (!invoice) {
                this.resultsContainer.innerHTML = `
                    <div class="gsearch-empty">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>${this.t('globalSearch.invoiceNotFound', 'الفاتورة غير موجودة')}</p>
                    </div>
                `;
                return;
            }
            
            const details = await window.electronAPI.getPurchaseInvoiceDetails(id);
            
            // تحديث الـ Header
            const header = this.modal.querySelector('.gsearch-header');
            header.innerHTML = `
                <button class="gsearch-back" onclick="globalSearch.backToSearch()" title="${this.t('globalSearch.backToSearch', 'رجوع للبحث')}">
                    <i class="fas fa-arrow-right"></i>
                </button>
                <span style="flex: 1; font-weight: 600; color: var(--text-color);">
                    <i class="fas fa-file-invoice-dollar" style="color: #f59e0b; margin-left: 8px;"></i>
                    ${this.t('globalSearch.purchaseInvoiceDetails', 'تفاصيل فاتورة الشراء')}
                </span>
                <button class="gsearch-close" title="${this.t('globalSearch.close', 'إغلاق')} (Esc)" onclick="globalSearch.close()">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            // بناء جدول الأصناف
            let itemsTable = details.map(item => `
                <tr>
                    <td>${item.item_name || '-'}</td>
                    <td>${(item.quantity || 0).toLocaleString()}</td>
                    <td>${(item.price || 0).toLocaleString()}</td>
                    <td>${(item.discount_value || 0).toLocaleString()}</td>
                    <td style="font-weight: 600;">${(item.total_price || 0).toLocaleString()}</td>
                </tr>
            `).join('');
            
            let html = `
                <div class="gsearch-item-details">
                    <div class="gsearch-detail-header">
                        <h2 style="color: #f59e0b;">${invoice.invoice_number || '-'}</h2>
                        <p>${this.t('globalSearch.date', 'التاريخ')}: ${invoice.invoice_date || '-'}</p>
                    </div>
                    
                    <div class="gsearch-stats" style="grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));">
                        <div class="gsearch-stat">
                            <div class="gsearch-stat-value">${invoice.supplier_name || '-'}</div>
                            <div class="gsearch-stat-label">${this.t('globalSearch.supplier', 'المورد')}</div>
                        </div>
                        <div class="gsearch-stat">
                            <div class="gsearch-stat-value" style="color: #f59e0b;">${(invoice.total_amount || 0).toLocaleString()} ج.م</div>
                            <div class="gsearch-stat-label">${this.t('globalSearch.totalAmount', 'الإجمالي')}</div>
                        </div>
                        <div class="gsearch-stat">
                            <div class="gsearch-stat-value" style="color: #0891b2;">${(invoice.paid_amount || 0).toLocaleString()} ج.م</div>
                            <div class="gsearch-stat-label">${this.t('globalSearch.paidAmount', 'المدفوع')}</div>
                        </div>
                        <div class="gsearch-stat">
                            <div class="gsearch-stat-value" style="color: ${invoice.remaining_amount > 0 ? '#ea580c' : '#10b981'};">${(invoice.remaining_amount || 0).toLocaleString()} ج.م</div>
                            <div class="gsearch-stat-label">${this.t('globalSearch.remainingAmount', 'المتبقي')}</div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 20px;">
                        <h3 style="color: var(--text-muted); margin-bottom: 12px; font-size: 0.9rem;">
                            <i class="fas fa-box"></i> ${this.t('globalSearch.items', 'الأصناف')}
                        </h3>
                        <div style="overflow-x: auto; border-radius: 8px; border: 1px solid var(--table-border, rgba(255,255,255,0.1));">
                            <table style="width: 100%; border-collapse: collapse;">
                                <thead style="background: var(--table-header-bg, rgba(0,0,0,0.2));">
                                    <tr>
                                        <th style="padding: 12px; text-align: right; font-weight: 600;">${this.t('globalSearch.itemName', 'الصنف')}</th>
                                        <th style="padding: 12px; text-align: center; font-weight: 600;">${this.t('globalSearch.quantity', 'الكمية')}</th>
                                        <th style="padding: 12px; text-align: center; font-weight: 600;">${this.t('globalSearch.price', 'السعر')}</th>
                                        <th style="padding: 12px; text-align: center; font-weight: 600;">${this.t('globalSearch.discount', 'الخصم')}</th>
                                        <th style="padding: 12px; text-align: center; font-weight: 600;">${this.t('globalSearch.total', 'الإجمالي')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itemsTable}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    ${invoice.notes ? `
                    <div style="margin-top: 20px; padding: 16px; background: var(--table-header-bg, rgba(0,0,0,0.2)); border-radius: 8px;">
                        <strong style="color: var(--text-muted);">${this.t('globalSearch.notes', 'ملاحظات')}:</strong>
                        <p style="margin: 8px 0 0 0; color: var(--text-color);">${invoice.notes}</p>
                    </div>
                    ` : ''}
                </div>
            `;
            
            this.resultsContainer.innerHTML = html;
            
        } catch (error) {
            console.error('Error loading purchase invoice:', error);
            this.resultsContainer.innerHTML = `
                <div class="gsearch-empty">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${this.t('globalSearch.fetchError', 'حدث خطأ في جلب البيانات')}</p>
                </div>
            `;
        }
    }
    
    async showSalesReturnDetails(id) {
        this.currentView = 'return-details';
        this.showLoading();
        
        try {
            const returns = await window.electronAPI.getSalesReturns();
            const returnDoc = returns.find(ret => ret.id === id);
            
            if (!returnDoc) {
                this.resultsContainer.innerHTML = `
                    <div class="gsearch-empty">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>${this.t('globalSearch.returnNotFound', 'المرتجع غير موجود')}</p>
                    </div>
                `;
                return;
            }
            
            const details = await window.electronAPI.getSalesReturnDetails(id);
            
            // تحديث الـ Header
            const header = this.modal.querySelector('.gsearch-header');
            header.innerHTML = `
                <button class="gsearch-back" onclick="globalSearch.backToSearch()" title="${this.t('globalSearch.backToSearch', 'رجوع للبحث')}">
                    <i class="fas fa-arrow-right"></i>
                </button>
                <span style="flex: 1; font-weight: 600; color: var(--text-color);">
                    <i class="fas fa-undo-alt" style="color: #8b5cf6; margin-left: 8px;"></i>
                    ${this.t('globalSearch.salesReturnDetails', 'تفاصيل مرتجع البيع')}
                </span>
                <button class="gsearch-close" title="${this.t('globalSearch.close', 'إغلاق')} (Esc)" onclick="globalSearch.close()">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            // بناء جدول الأصناف
            let itemsTable = details.map(item => `
                <tr>
                    <td>${item.item_name || '-'}</td>
                    <td>${(item.quantity || 0).toLocaleString()}</td>
                    <td>${(item.price || 0).toLocaleString()}</td>
                    <td style="font-weight: 600;">${(item.total_price || 0).toLocaleString()}</td>
                </tr>
            `).join('');
            
            let html = `
                <div class="gsearch-item-details">
                    <div class="gsearch-detail-header">
                        <h2 style="color: #8b5cf6;">${returnDoc.return_number || '-'}</h2>
                        <p>${this.t('globalSearch.date', 'التاريخ')}: ${returnDoc.return_date || '-'}</p>
                    </div>
                    
                    <div class="gsearch-stats" style="grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));">
                        <div class="gsearch-stat">
                            <div class="gsearch-stat-value">${returnDoc.customer_name || '-'}</div>
                            <div class="gsearch-stat-label">${this.t('globalSearch.customer', 'العميل')}</div>
                        </div>
                        <div class="gsearch-stat">
                            <div class="gsearch-stat-value" style="color: #8b5cf6;">${(returnDoc.total_amount || 0).toLocaleString()} ج.م</div>
                            <div class="gsearch-stat-label">${this.t('globalSearch.returnAmount', 'مبلغ المرتجع')}</div>
                        </div>
                        ${returnDoc.original_invoice_number ? `
                        <div class="gsearch-stat">
                            <div class="gsearch-stat-value">${returnDoc.original_invoice_number}</div>
                            <div class="gsearch-stat-label">${this.t('globalSearch.originalInvoice', 'الفاتورة الأصلية')}</div>
                        </div>
                        ` : ''}
                    </div>
                    
                    <div style="margin-top: 20px;">
                        <h3 style="color: var(--text-muted); margin-bottom: 12px; font-size: 0.9rem;">
                            <i class="fas fa-box"></i> ${this.t('globalSearch.returnedItems', 'الأصناف المرتجعة')}
                        </h3>
                        <div style="overflow-x: auto; border-radius: 8px; border: 1px solid var(--table-border, rgba(255,255,255,0.1));">
                            <table style="width: 100%; border-collapse: collapse;">
                                <thead style="background: var(--table-header-bg, rgba(0,0,0,0.2));">
                                    <tr>
                                        <th style="padding: 12px; text-align: right; font-weight: 600;">${this.t('globalSearch.itemName', 'الصنف')}</th>
                                        <th style="padding: 12px; text-align: center; font-weight: 600;">${this.t('globalSearch.quantity', 'الكمية')}</th>
                                        <th style="padding: 12px; text-align: center; font-weight: 600;">${this.t('globalSearch.price', 'السعر')}</th>
                                        <th style="padding: 12px; text-align: center; font-weight: 600;">${this.t('globalSearch.total', 'الإجمالي')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itemsTable}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    ${returnDoc.notes ? `
                    <div style="margin-top: 20px; padding: 16px; background: var(--table-header-bg, rgba(0,0,0,0.2)); border-radius: 8px;">
                        <strong style="color: var(--text-muted);">${this.t('globalSearch.notes', 'ملاحظات')}:</strong>
                        <p style="margin: 8px 0 0 0; color: var(--text-color);">${returnDoc.notes}</p>
                    </div>
                    ` : ''}
                </div>
            `;
            
            this.resultsContainer.innerHTML = html;
            
        } catch (error) {
            console.error('Error loading sales return:', error);
            this.resultsContainer.innerHTML = `
                <div class="gsearch-empty">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${this.t('globalSearch.fetchError', 'حدث خطأ في جلب البيانات')}</p>
                </div>
            `;
        }
    }
    
    async showPurchaseReturnDetails(id) {
        this.currentView = 'return-details';
        this.showLoading();
        
        try {
            const returns = await window.electronAPI.getPurchaseReturns();
            const returnDoc = returns.find(ret => ret.id === id);
            
            if (!returnDoc) {
                this.resultsContainer.innerHTML = `
                    <div class="gsearch-empty">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>${this.t('globalSearch.returnNotFound', 'المرتجع غير موجود')}</p>
                    </div>
                `;
                return;
            }
            
            const details = await window.electronAPI.getPurchaseReturnDetails(id);
            
            // تحديث الـ Header
            const header = this.modal.querySelector('.gsearch-header');
            header.innerHTML = `
                <button class="gsearch-back" onclick="globalSearch.backToSearch()" title="${this.t('globalSearch.backToSearch', 'رجوع للبحث')}">
                    <i class="fas fa-arrow-right"></i>
                </button>
                <span style="flex: 1; font-weight: 600; color: var(--text-color);">
                    <i class="fas fa-undo" style="color: #ec4899; margin-left: 8px;"></i>
                    ${this.t('globalSearch.purchaseReturnDetails', 'تفاصيل مرتجع الشراء')}
                </span>
                <button class="gsearch-close" title="${this.t('globalSearch.close', 'إغلاق')} (Esc)" onclick="globalSearch.close()">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            // بناء جدول الأصناف
            let itemsTable = details.map(item => `
                <tr>
                    <td>${item.item_name || '-'}</td>
                    <td>${(item.quantity || 0).toLocaleString()}</td>
                    <td>${(item.price || 0).toLocaleString()}</td>
                    <td style="font-weight: 600;">${(item.total_price || 0).toLocaleString()}</td>
                </tr>
            `).join('');
            
            let html = `
                <div class="gsearch-item-details">
                    <div class="gsearch-detail-header">
                        <h2 style="color: #ec4899;">${returnDoc.return_number || '-'}</h2>
                        <p>${this.t('globalSearch.date', 'التاريخ')}: ${returnDoc.return_date || '-'}</p>
                    </div>
                    
                    <div class="gsearch-stats" style="grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));">
                        <div class="gsearch-stat">
                            <div class="gsearch-stat-value">${returnDoc.supplier_name || '-'}</div>
                            <div class="gsearch-stat-label">${this.t('globalSearch.supplier', 'المورد')}</div>
                        </div>
                        <div class="gsearch-stat">
                            <div class="gsearch-stat-value" style="color: #ec4899;">${(returnDoc.total_amount || 0).toLocaleString()} ج.م</div>
                            <div class="gsearch-stat-label">${this.t('globalSearch.returnAmount', 'مبلغ المرتجع')}</div>
                        </div>
                        ${returnDoc.original_invoice_number ? `
                        <div class="gsearch-stat">
                            <div class="gsearch-stat-value">${returnDoc.original_invoice_number}</div>
                            <div class="gsearch-stat-label">${this.t('globalSearch.originalInvoice', 'الفاتورة الأصلية')}</div>
                        </div>
                        ` : ''}
                    </div>
                    
                    <div style="margin-top: 20px;">
                        <h3 style="color: var(--text-muted); margin-bottom: 12px; font-size: 0.9rem;">
                            <i class="fas fa-box"></i> ${this.t('globalSearch.returnedItems', 'الأصناف المرتجعة')}
                        </h3>
                        <div style="overflow-x: auto; border-radius: 8px; border: 1px solid var(--table-border, rgba(255,255,255,0.1));">
                            <table style="width: 100%; border-collapse: collapse;">
                                <thead style="background: var(--table-header-bg, rgba(0,0,0,0.2));">
                                    <tr>
                                        <th style="padding: 12px; text-align: right; font-weight: 600;">${this.t('globalSearch.itemName', 'الصنف')}</th>
                                        <th style="padding: 12px; text-align: center; font-weight: 600;">${this.t('globalSearch.quantity', 'الكمية')}</th>
                                        <th style="padding: 12px; text-align: center; font-weight: 600;">${this.t('globalSearch.price', 'السعر')}</th>
                                        <th style="padding: 12px; text-align: center; font-weight: 600;">${this.t('globalSearch.total', 'الإجمالي')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itemsTable}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    ${returnDoc.notes ? `
                    <div style="margin-top: 20px; padding: 16px; background: var(--table-header-bg, rgba(0,0,0,0.2)); border-radius: 8px;">
                        <strong style="color: var(--text-muted);">${this.t('globalSearch.notes', 'ملاحظات')}:</strong>
                        <p style="margin: 8px 0 0 0; color: var(--text-color);">${returnDoc.notes}</p>
                    </div>
                    ` : ''}
                </div>
            `;
            
            this.resultsContainer.innerHTML = html;
            
        } catch (error) {
            console.error('Error loading purchase return:', error);
            this.resultsContainer.innerHTML = `
                <div class="gsearch-empty">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${this.t('globalSearch.fetchError', 'حدث خطأ في جلب البيانات')}</p>
                </div>
            `;
        }
    }
    
    backToSearch() {
        this.currentView = 'search';
        
        // إعادة الـ Header للحالة الأصلية
        const header = this.modal.querySelector('.gsearch-header');
        header.innerHTML = `
            <i class="fas fa-search"></i>
            <input type="text" class="gsearch-input" placeholder="${this.t('globalSearch.placeholder', 'ابحث عن صنف، عميل، أو مورد...')}">
            <button class="gsearch-close" title="${this.t('globalSearch.close', 'إغلاق')} (Esc)" onclick="globalSearch.close()">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // إعادة تعيين المرجعيات
        this.input = this.modal.querySelector('.gsearch-input');
        this.input.addEventListener('input', () => this.handleInput());
        this.input.addEventListener('keydown', (e) => this.handleKeydown(e));
        
        // إعادة الـ Footer للحالة الأصلية
        const footer = this.modal.querySelector('.gsearch-footer');
        footer.innerHTML = `
            <div class="gsearch-shortcut">
                <kbd>↑↓</kbd> ${this.t('globalSearch.navigateHint', 'للتنقل')}
            </div>
            <div class="gsearch-shortcut">
                <kbd>Enter</kbd> ${this.t('globalSearch.selectHint', 'للاختيار')}
            </div>
            <div class="gsearch-shortcut">
                <kbd>Esc</kbd> ${this.t('globalSearch.closeHint', 'للإغلاق')}
            </div>
        `;
        
        // عرض النتائج السابقة أو الحالة الافتراضية
        if (this.results.length > 0) {
            this.displayResults();
        } else {
            this.showDefaultState();
        }
        
        this.input.focus();
    }
}

// تهيئة البحث العام عند تحميل الصفحة
let globalSearch;
document.addEventListener('DOMContentLoaded', async () => {
    globalSearch = new GlobalSearch();
    await globalSearch.loadDictionary();
});
