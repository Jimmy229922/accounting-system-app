# Page Map — دليل صفحات التطبيق

> **الغرض**: مرجع سريع لكل صفحة ومساراتها وعلاقاتها. يُقرأ أولاً قبل أي تعديل.
> **آخر تحديث**: 2026-04-11

> [!IMPORTANT]
> **قاعدة الصيانة**: يجب تحديث هذا الملف عند أي تغيير يشمل:
> - إضافة صفحة جديدة أو حذف صفحة
> - إضافة/تعديل/حذف قناة IPC
> - إضافة/تعديل جدول DB أو أعمدة جديدة
> - إضافة/تعديل CSS classes رئيسية أو dark mode selectors
> - إضافة ملفات مشتركة جديدة (assets)
> - تغيير هيكل المجلدات أو أسماء الملفات
>
> عند تنفيذ أي تعديل، حدّث القسم المناسب هنا فوراً في نفس الخطوة.

---

## الهيكل العام

```
frontend-desktop/src/
├── main/                          ← العملية الرئيسية (Electron Main Process)
│   ├── main.js                    ← نقطة الدخول + single-instance lock + quit backup
│   ├── autoBackup.js              ← النسخ الاحتياطي التلقائي + فحص سلامة DB
│   ├── windowManager.js           ← إدارة النوافذ (invite → auth → shell)
│   ├── preload.js                 ← جسر electronAPI (89 قناة IPC)
│   ├── db.js                      ← إنشاء الجداول والـ migrations
│   ├── ipcHandlers.js             ← تسجيل كل الـ handlers
│   ├── inviteConfig.js            ← إعدادات التفعيل (INVITE_CODE, INVITE_DURATION_DAYS)
│   └── handlers/                  ← ملفات الـ IPC handlers (18 ملف)
│
└── renderer/                      ← واجهة المستخدم
    ├── views/                     ← صفحات التطبيق (20 صفحة + Shell)
    │   └── shell/                 ← Shell Router داخلي + Loading Curtain + iframe container
    ├── assets/
    │   ├── js/                    ← سكربتات مشتركة
    │   ├── styles/                ← أنماط مشتركة + themes
    │   ├── config/                ← navigation.json
    │   └── i18n/                  ← ar.json (القاموس العربي)
    └── css/
        └── navbar.css             ← شريط التنقل

backend/src/desktop-compat/        ← نسخة متطابقة (يجب تحديثها مع frontend)
├── db.js
├── ipcHandlers.js
├── inviteConfig.js
└── handlers/                      ← نفس الـ 18 ملف
```

---

## الملفات المشتركة (Shared Assets)

| الملف | المسار | الوصف |
|-------|--------|-------|
| main.css | `renderer/assets/styles/main.css` | الأنماط الأساسية + import للثيمات |
| light.css | `renderer/assets/styles/themes/light.css` | متغيرات الوضع الفاتح |
| dark.css | `renderer/assets/styles/themes/dark.css` | متغيرات الوضع المظلم + overrides عامة |
| navbar.css | `renderer/css/navbar.css` | شريط التنقل |
| autocomplete.css | `renderer/assets/styles/autocomplete.css` | قائمة الإكمال التلقائي |
| toast.css | `renderer/assets/styles/toast.css` | إشعارات Toast |
| theme.js | `renderer/assets/js/theme.js` | إدارة الثيم (data-theme attribute) |
| i18n.js | `renderer/assets/js/i18n.js` | نظام الترجمة t() و fmt() |
| toast.js | `renderer/assets/js/toast.js` | وظائف الإشعارات |
| autocomplete.js | `renderer/assets/js/autocomplete.js` | الإكمال التلقائي |
| globalSearch.js | `renderer/assets/js/globalSearch.js` | البحث الشامل Ctrl+K |
| permissionManager.js | `renderer/assets/js/permissionManager.js` | إدارة الصلاحيات على مستوى الصفحات |
| navManager.js | `renderer/assets/js/shared/navManager.js` | إدارة التنقل |
| navigation.json | `renderer/assets/config/navigation.json` | خريطة التنقل |
| ar.json | `renderer/assets/i18n/ar.json` | قاموس الترجمة العربي |
| shell.js | `renderer/views/shell/shell.js` | Router داخلي + جسر التنقل + إدارة history |
| shell.css | `renderer/views/shell/shell.css` | تنسيق shell + loading curtain |

---

## متغيرات الثيم (CSS Variables)

### الوضع المظلم (dark.css)
```
--bg-color: #0a0f1a          --text-color: #f1f5f9         --text-muted: #a8b3cf
--card-bg: #131b2e            --secondary-bg: #0f1729       --card-border: #2d3b56
--border-color: #3d4f6b      --input-bg: #0f1729           --input-border: #3d4f6b
--table-header-bg: #131b2e   --table-border: #2d3b56       --shadow-color: rgba(0,0,0,0.5)
--accent-color: #70b5ff      --success-color: #34d875      --danger-color: #ff8787
--warning-color: #ffb347     --sales-color: #34d875        --purchase-color: #ffab5e
--nav-bg: #0a0f1a            --nav-text: #f1f5f9           --dropdown-bg: #0f1729
```

### الوضع الفاتح (light.css)
```
--bg-color: #f4f6fb          --text-color: #1f2937         --text-muted: #6b7280
--card-bg: #ffffff            --secondary-bg: #f8fafc       --card-border: #dbe3ed
--border-color: #dbe3ed      --input-bg: #ffffff           --input-border: #cfd8e3
--table-header-bg: #f3f6fb   --table-border: #d8e1eb       --shadow-color: rgba(15,23,42,0.16)
--accent-color: #2563eb      --success-color: #16a34a      --danger-color: #dc2626
--warning-color: #d97706     --sales-color: #15803d        --purchase-color: #c2410c
--nav-bg: #0f172a            --nav-text: #e2e8f0           --dropdown-bg: #111827
```

---

## خريطة الصفحات التفصيلية

---

### 0. قشرة التطبيق (Shell Router)
| | المسار |
|---|---|
| **HTML** | `renderer/views/shell/index.html` |
| **CSS** | `renderer/views/shell/shell.css` |
| **JS** | `renderer/views/shell/shell.js` |
| **Main Entry** | `main/windowManager.js` |

**الدور**:
- تحميل واجهة واحدة ثابتة للتطبيق بدل إعادة تحميل BrowserWindow عند كل تنقل.
- عرض `Loading Curtain` موحد أثناء تغيير الصفحات.
- تشغيل الصفحات داخل iframe واحد (`#shellFrame`) مع جسر تنقل داخلي.
- إخفاء navbar الداخلي للصفحات المحمّلة داخل الإطار والاعتماد على navbar واحد في shell.
- مزامنة الثيم مع المحتوى الداخلي عبر `__syncThemeFromChild`.

**CSS Classes الرئيسية**:
- `.shell-root`, `.shell-top-nav`, `.shell-stage`, `.shell-frame`
- `.shell-curtain`, `.shell-curtain.is-visible`, `.shell-curtain-card`, `.shell-spinner`

---

### 1. لوحة التحكم (Dashboard)
| | المسار |
|---|---|
| **HTML** | `renderer/views/dashboard/index.html` |
| **CSS** | `renderer/views/dashboard/dashboard.css` |
| **JS** | `renderer/views/dashboard/dashboard.js` |
| **Handler** | `handlers/settings.js` |

**قنوات IPC**: `get-dashboard-stats`
**جداول DB**: `customers`, `items`, `settings`, `sales_invoices`, `sales_invoice_details`, `purchase_invoices`, `purchase_invoice_details`, `treasury_transactions`
**CSS Classes الرئيسية**:
- **Layout**: `.content`
- **Hero**: `.dashboard-hero`, `.hero-shapes`, `.hero-shape`, `.shape-1`→`.shape-5`, `.hero-content`, `.hero-bottom`, `.last-updated`, `.dashboard-actions`
- **Today Summary**: `.today-summary`, `.today-stat`, `.today-stat-icon`, `.today-stat-info`, `.today-stat-value`, `.today-stat-label`
- **Cards**: `.metrics-grid`, `.metric-card`, `.metric-header`, `.metric-icon`, `.metric-value`, `.metric-trend`, `.trend-up`, `.trend-down`, `.trend-same`
- **Chart**: `.chart-section`, `.chart-header`, `.chart-controls`, `.chart-legend`, `.legend-item`, `.legend-color`, `.legend-sales`, `.legend-purchases`, `.chart-toggle`, `.chart-btn`, `#dashChart`
- **Recent Transactions**: `.dashboard-middle-grid`, `.recent-table-wrap`, `.recent-table`, `.type-badge`, `.type-sale`, `.type-purchase`
- **Top Items**: `.top-items-list`, `.top-item-rank`
- **Alerts**: `.alerts-list`, `.alert-item`, `.alert-warning`, `.alert-info`, `.alert-danger`, `.alert-success`
- **Quick Actions**: `.quick-actions-grid`, `.action-card`, `.action-icon`, `.action-label`
- **System Status**: `.system-status-grid`, `.status-row`
- **Buttons**: `.btn-refresh`, `.refresh-spin`
- **Other**: `.section-title`, `.dashboard-bottom-grid`, `.card`

**Dark Mode CSS**: يعيد تعريف `--card-bg`, `--bg-color`, `--text-color`, `--border-color`, `--shadow-color` + overrides لـ `.dashboard-hero` (gradient glow + radial overlays + top accent line), `.hero-shape` (hidden), `.btn-refresh`, `.action-card`, `.last-updated`, `.today-stat`, `.chart-toggle`, `.chart-btn`, `.recent-table`, `.status-row`, `.top-item-rank`, `.alert-*`, `.type-*`

---

### 2. الأصناف (Items)
| | المسار |
|---|---|
| **HTML** | `renderer/views/items/items.html` |
| **CSS** | `renderer/views/items/items.css` |
| **JS** | `renderer/views/items/items.js` |
| **Handler** | `handlers/items.js` |

**قنوات IPC**: `get-items`, `get-item-stock-details`, `add-item`, `update-item`, `delete-item`, `get-item-movements`, `get-item-transactions`, `get-units`
**جداول DB**: `items`, `units`, `opening_balances`, `warehouses`, `sales_invoice_details`, `purchase_invoice_details`, `sales_invoices`, `purchase_invoices`, `sales_returns`, `sales_return_details`, `purchase_returns`, `purchase_return_details`, `customers`
**CSS Classes الرئيسية**:
- **Layout**: `.page-container`, `.page-title`
- **Stats**: `.stats-grid`, `.stat-card`, `.stat-icon`, `.stat-info`
- **Forms**: `.top-form-card`, `.form-header`, `.form-grid`, `.form-row`, `.form-group`, `.form-control`, `.form-actions`
- **Tables**: `.table-section`, `.table-controls`, `.table-header-title`, `.table-wrapper`, `.table`
- **Search**: `.search-box`, `.search-input`, `.search-icon`
- **Modals**: `.modal`, `.modal-content`, `.modal-header`, `.modal-body`, `.modal-footer`, `.modal-form-grid`
- **Buttons**: `.btn-save-item`, `.btn-icon`, `.btn-edit`, `.btn-delete`, `.btn-primary`, `.btn-danger`
- **Pagination**: `.pagination-container`, `.pagination-btn`
- **Badges**: `.low-stock-badge`, `.warning-icon`
- **Other**: `.empty-state`, `.details-card`, `.stock-breakdown`, `.breakdown-item`, `.profit-margin-display`

**Dark Mode CSS**: يعيد تعريف `--items-gradient-1`, `--items-accent`, `--items-accent-light` + overrides لـ `.stat-card`, `.top-form-card`, `.table-section`, `.form-control`, `.table th/tr`, `.btn-save-item`, `.search-input`, `.pagination-btn`, `.low-stock-badge`, `.modal-*`

---

### 3. الوحدات (Units)
| | المسار |
|---|---|
| **HTML** | `renderer/views/items/units.html` |
| **CSS** | `renderer/views/items/units.css` |
| **JS** | `renderer/views/items/units.js` |
| **Handler** | `handlers/units.js` |

**قنوات IPC**: `get-units`, `add-unit`, `update-unit`, `delete-unit`
**جداول DB**: `units`
**CSS Classes الرئيسية**:
- **Layout**: `.content`, `.page-header`, `.page-title`, `.page-grid`
- **Stats**: `.stats-card`, `.stats-icon`, `.stats-info`
- **Forms**: `.form-card-static`, `.form-header-static`, `.form-group`, `.form-control`
- **Tables**: `.table-card`, `.table-container`, `.table`
- **Search**: `.controls-bar`, `.search-container`, `.search-input`
- **Modals**: `.modal-overlay`, `.modal-content`, `.modal-header`, `.modal-title`
- **Buttons**: `.btn-primary`, `.btn-icon`, `.btn-edit`, `.btn-delete`
- **Pagination**: `.pagination-container`, `.pagination-btn`, `.pagination-info`
- **Other**: `.empty-state`, `.highlight`

**Dark Mode CSS**: لا يوجد (يعتمد على المتغيرات العامة)

---

### 4. العملاء (Customers)
| | المسار |
|---|---|
| **HTML** | `renderer/views/customers/index.html` |
| **CSS** | `renderer/views/customers/customers.css` |
| **JS** | `renderer/views/customers/customers.js` |
| **Handler** | `handlers/customers.js` |

**قنوات IPC**: `get-customers`, `add-customer`, `update-customer`, `delete-customer`, `get-debtor-creditor-report`
**جداول DB**: `customers`, `sales_invoices`, `purchase_invoices`, `treasury_transactions`
**CSS Classes الرئيسية**:
- **Layout**: `.page-container`, `.page-title`
- **Stats**: `.stats-grid`, `.stat-card`, `.stat-card.receivables`, `.stat-card.payables`, `.stat-icon`, `.stat-info`
- **Tables**: `.table-section`, `.table-controls`, `.table-wrapper`, `.table`
- **Search**: `.search-box`, `.search-input`, `.search-icon`
- **Modals**: `.modal`, `.modal-content`, `.modal-header`, `.modal-body`, `.modal-footer`, `.modal-form-grid`
- **Forms**: `.form-group`, `.form-control`, `.balance-direction-row`, `.balance-direction-toggle`, `.balance-direction-btn`
- **Buttons**: `.btn-icon`, `.btn-edit`, `.btn-delete`, `.btn-primary`, `.btn-danger`
- **Pagination**: `.pagination-container`, `.pagination-btn`
- **Badges**: `.badge-customer`, `.badge-supplier`, `.badge-both`
- **Filters**: `.filter-buttons`, `.filter-btn`
- **Other**: `.empty-state`, `.balance-positive`, `.balance-negative`, `.balance-neutral`, `.balance-tag`

**Dark Mode CSS**: يعيد تعريف `--items-gradient-1`, `--items-accent`, `--items-accent-light` + overrides لـ `.modal-body` scrollbar

---

### 5. فواتير المبيعات (Sales)
| | المسار |
|---|---|
| **HTML** | `renderer/views/sales/index.html` |
| **CSS** | `renderer/views/sales/sales.css` |
| **JS** | `renderer/views/sales/sales.js` |
| **Handler** | `handlers/sales.js`, `handlers/invoices.js` |

**قنوات IPC**: `get-sales-invoices`, `save-sales-invoice`, `update-sales-invoice`, `get-next-invoice-number`, `get-invoice-with-details`, `get-customers`, `get-items`
**جداول DB**: `sales_invoices`, `sales_invoice_details`, `customers`, `items`, `treasury_transactions`
**حقول مالية مهمة (sales_invoices)**: `total_amount`, `discount_type`, `discount_value`, `discount_amount`, `paid_amount`, `remaining_amount`
**Stock Validation**: `save-sales-invoice` و `update-sales-invoice` يتحققان من أن الكمية المطلوبة ≤ المخزون المتاح قبل الخصم
**CSS Classes الرئيسية**:
- **Layout**: `.sales-content`, `.sales-page-header`, `.sales-title-wrap`, `.page-title`, `.page-title-icon`, `.sales-title-text`
- **Forms**: `.invoice-form-container`, `.invoice-shell`, `.form-title-row`, `.invoice-top-grid`, `.form-group`, `.form-group-header`, `.form-control`, `.invoice-financial-grid`
- **Tables**: `.items-section`, `.items-section-head`, `.items-section-title-wrap`, `.items-table-wrap`, `.items-table`
- **Footer/Totals**: `.invoice-footer-grid`, `.notes-section`, `.totals-panel`, `.total-row`, `.total-row-secondary`, `.grand-total`, `.total-row-paid-summary`, `.total-row-due`, `.customer-due-label`, `.customer-due-value`, `.due-positive`, `.due-negative`
- **Buttons**: `.btn-success`, `.btn-outline`
- **Other**: `.customer-balance`, `.balance-positive`, `.balance-negative`, `.unit-label`, `.row-total`, `.remove-row`, `.selected-item-availability`, `.selected-item-overage`
- **Profit Indicator**: `.profit-indicator`, `.profit-positive`, `.profit-negative`, `.profit-neutral`

**Dark Mode CSS**: override لـ `.invoice-shell` مع radial-gradient, `.profit-indicator` dark overrides

---

### 6. مرتجعات المبيعات (Sales Returns)
| | المسار |
|---|---|
| **HTML** | `renderer/views/sales-returns/index.html` |
| **CSS** | `renderer/views/sales-returns/sales-returns.css` |
| **JS** | `renderer/views/sales-returns/sales-returns.js` |
| **Handler** | `handlers/salesReturns.js`, `handlers/invoices.js` |

**قنوات IPC**: `get-sales-returns`, `get-customer-sales-invoices`, `get-invoice-items-for-return`, `save-sales-return`, `delete-sales-return`, `get-next-invoice-number`, `get-customers`
**جداول DB**: `sales_returns`, `sales_return_details`, `sales_invoices`, `customers`, `items`, `treasury_transactions`
**CSS Classes الرئيسية**:
- **Layout**: `.content`, `.page-header`, `.page-title`
- **Forms**: `.return-form-container`, `.form-title`, `.form-grid`, `.form-group`, `.form-control`
- **Tables**: `.items-section`, `.items-table`, `.return-checkbox`
- **Footer/Totals**: `.form-footer`, `.total-section`, `.total-value`
- **History**: `.history-card`, `.history-header`, `.history-table`
- **Buttons**: `.btn-danger`, `.btn-secondary`, `.btn-sm`, `.btn-delete`
- **Badges**: `.badge-return`
- **Other**: `.empty-state`, `.notes-section`

**Dark Mode CSS**: overrides لـ `select.form-control`, `.badge-return`, `.btn-delete`

---

### 7. فواتير المشتريات (Purchases)
| | المسار |
|---|---|
| **HTML** | `renderer/views/purchases/index.html` |
| **CSS** | `renderer/views/purchases/purchases.css` |
| **JS** | `renderer/views/purchases/purchases.js` |
| **Handler** | `handlers/purchases.js`, `handlers/invoices.js` |

**قنوات IPC**: `get-purchase-invoices`, `save-purchase-invoice`, `update-purchase-invoice`, `get-next-invoice-number`, `get-invoice-with-details`, `get-customers`, `get-items`
**جداول DB**: `purchase_invoices`, `purchase_invoice_details`, `customers`, `items`, `treasury_transactions`
**حقول مالية مهمة (purchase_invoices)**: `total_amount`, `discount_type`, `discount_value`, `discount_amount`, `paid_amount`, `remaining_amount`
**CSS Classes الرئيسية**:
- **Layout**: `.sales-content`, `.sales-page-header`, `.sales-title-wrap`, `.page-title`
- **Forms**: `.invoice-form-container`, `.invoice-shell`, `.form-title-row`, `.invoice-top-grid`, `.form-group`, `.form-control`, `.invoice-financial-grid`
- **Tables**: `.items-section`, `.items-section-head`, `.items-section-title-wrap`, `.items-table-wrap`, `.items-table`
- **Footer/Totals**: `.invoice-footer-grid`, `.notes-section`, `.totals-panel`, `.total-row`, `.total-row-secondary`, `.grand-total`, `.total-row-paid-summary`, `.total-row-due`, `.customer-due-label`, `.customer-due-value`, `.due-positive`, `.due-negative`
- **Buttons**: `.btn-success`, `.btn-outline`
- **Other**: `.customer-balance`, `.balance-positive`, `.balance-negative`, `.unit-label`, `.row-total`, `.remove-row`, `.selected-item-availability`

**Dark Mode CSS**: override لـ `.invoice-shell` مع radial-gradient

---

### 8. مرتجعات المشتريات (Purchase Returns)
| | المسار |
|---|---|
| **HTML** | `renderer/views/purchase-returns/index.html` |
| **CSS** | `renderer/views/purchase-returns/purchase-returns.css` |
| **JS** | `renderer/views/purchase-returns/purchase-returns.js` |
| **Handler** | `handlers/purchaseReturns.js`, `handlers/invoices.js` |

**قنوات IPC**: `get-purchase-returns`, `get-supplier-purchase-invoices`, `get-invoice-items-for-return`, `save-purchase-return`, `delete-purchase-return`, `get-next-invoice-number`, `get-customers`
**جداول DB**: `purchase_returns`, `purchase_return_details`, `purchase_invoices`, `customers`, `items`, `treasury_transactions`
**Stock Validation**: `save-purchase-return` يتحقق من أن كمية الإرجاع ≤ المخزون المتاح قبل الخصم
**CSS Classes الرئيسية**:
- **Layout**: `.content`, `.page-header`, `.page-title`
- **Forms**: `.return-form-container`, `.form-title`, `.form-grid`, `.form-group`, `.form-control`
- **Tables**: `.items-section`, `.items-table`, `.return-checkbox`
- **Footer/Totals**: `.form-footer`, `.total-section`, `.total-value`
- **History**: `.history-card`, `.history-header`, `.history-table`
- **Buttons**: `.btn-warning`, `.btn-secondary`, `.btn-sm`, `.btn-delete`
- **Badges**: `.badge-return`
- **Other**: `.empty-state`, `.notes-section`

**Dark Mode CSS**: overrides لـ `select.form-control`, `.badge-return`, `.btn-delete`

---

### 9. الأرصدة الافتتاحية (Opening Balance)
| | المسار |
|---|---|
| **HTML** | `renderer/views/opening-balance/index.html` |
| **CSS** | `renderer/views/opening-balance/opening-balance.css` |
| **JS** | `renderer/views/opening-balance/opening-balance.js` |
| **Handler** | `handlers/openingBalances.js` |

**قنوات IPC**: `get-opening-balances`, `save-opening-balances`, `add-opening-balance`, `update-opening-balance`, `delete-opening-balance`, `add-opening-balance-group`, `get-opening-balance-groups`, `get-opening-balance-group`, `get-group-details`, `update-opening-balance-group`, `delete-opening-balance-group`, `get-warehouses`, `get-items`, `add-warehouse`, `update-warehouse`, `delete-warehouse`
**جداول DB**: `opening_balances`, `opening_balance_groups`, `items`, `warehouses`
**CSS Classes الرئيسية**:
- **Layout**: `.content`, `.page-header`, `.page-title`
- **Stats**: `.stats-grid`, `.stat-card`, `.stat-card.value-card`, `.stat-icon`, `.stat-info`
- **Cards**: `.card`, `.card-header`, `.card-body`
- **Forms**: `.entry-form`, `.form-group`, `.form-control`
- **Tables**: `.table-container`, `.entry-table`
- **Modals**: `.modal`, `.modal-content`
- **Buttons**: `.btn-primary`, `.btn-success`, `.btn-outline`, `.btn-danger`
- **Badges**: `.warehouse-badge`
- **Other**: `.warehouse-selection-box`, `.warehouse-selection-main`, `.text-success-gradient`

**Dark Mode CSS**: يعيد تعريف عدة متغيرات: `--items-gradient-1`, `--items-accent`, `--card-bg`, `--bg-color`, `--text-color`, `--border-color`

---

### 10. المخزن (Inventory)
| | المسار |
|---|---|
| **HTML** | `renderer/views/inventory/index.html` |
| **CSS** | `renderer/views/inventory/inventory.css` |
| **JS** | `renderer/views/inventory/inventory.js` |
| **Handler** | `handlers/items.js` |

**قنوات IPC**: `get-items`, `get-item-movements`
**جداول DB**: `items`, (+ نفس جداول items.js handler)
**CSS Classes الرئيسية**:
- **Layout**: `.content`
- **Hero**: `.inv-hero`, `.hero-shapes`, `.hero-shape`, `.shape-1`, `.shape-2`, `.shape-3`
- **Stats**: `.inv-stats`, `.inv-stat-card`, `.stat-items`, `.stat-qty`, `.stat-cost`, `.stat-sale`, `.stat-profit`, `.stat-low`, `.inv-stat-icon`, `.inv-stat-info`, `.inv-stat-label`, `.inv-stat-value`
- **Controls**: `.inv-controls`, `.inv-search`, `.inv-filter-btn`, `.inv-filter-btn.active`
- **Tables**: `.inv-table-card`, `.inv-table-header`, `.inv-table`, `.inv-count-badge`, `.amount-cell`, `.qty-low`
- **Status Badges**: `.inv-status-badge`, `.status-ok`, `.status-low`, `.status-out`
- **Modals**: `.inv-modal`, `.inv-modal-content`, `.inv-modal-header`, `.inv-modal-close`, `.inv-modal-stats`, `.modal-stat`
- **Buttons**: `.inv-btn-card`, `.inv-filter-btn`
- **Movement Badges**: `.inv-mv-badge`, `.mv-in`, `.mv-out`
- **Other**: `.transaction-in`, `.transaction-out`

**Dark Mode CSS**: `.inv-hero` dark radial gradients + status/movement badge dark overrides

---

### 11. الخزينة (Finance / Treasury)
| | المسار |
|---|---|
| **HTML** | `renderer/views/finance/index.html` |
| **CSS** | `renderer/views/finance/finance.css` |
| **JS** | `renderer/views/finance/finance.js` |
| **Handler** | `handlers/treasury.js` |

**قنوات IPC**: `get-treasury-balance`, `get-treasury-transactions`, `add-treasury-transaction`, `update-treasury-transaction`, `delete-treasury-transaction`
**جداول DB**: `treasury_transactions`, `customers`, `sales_invoices`, `purchase_invoices`, `suppliers`
**CSS Classes الرئيسية**:
- **Hero**: `.finance-hero`, `.hero-shapes`, `.hero-shape`, `.shape-1`, `.shape-2`, `.shape-3`
- **Stats**: `.stats-container`, `.stat-card`, `.stat-icon`, `.stat-info`, `.stat-title`, `.stat-value`, `.stat-balance`, `.stat-income`, `.stat-expense`, `.stat-count`, `.stat-today-in`, `.stat-today-out`
- **Forms**: `.form-card`, `.form-header`, `.form-grid`, `.form-group`, `.form-control`
- **Tables**: `.table-card`, `.table`
- **Modals**: `.modal`, `.modal-content`, `.close`
- **Buttons**: `.btn-primary`, `.btn-success`, `.btn-outline`, `.btn-sm`, `.btn-danger`, `.btn-warning`
- **Badges**: `.badge-income`, `.badge-expense`

**Dark Mode CSS**: `.finance-hero` dark radial gradients, `.stat-card` dark backgrounds, accent line top border

---

### 12. سند صرف (Payment)
| | المسار |
|---|---|
| **HTML** | `renderer/views/payments/payment.html` |
| **CSS** | `renderer/views/payments/payments.css` ← مشترك مع receipt |
| **JS** | `renderer/views/payments/payment.js` |
| **Handler** | `handlers/treasury.js` |

**قنوات IPC**: `get-customers`, `get-treasury-transactions`, `add-treasury-transaction`, `search-treasury-by-voucher`
**جداول DB**: `treasury_transactions`, `customers`
**CSS Classes الرئيسية** (مشترك مع Receipt):
- **Layout**: `.content`, `.page-header`, `.page-title`, `.main-grid`
- **Form Card**: `.form-card`, `.card-header`, `.voucher-block`, `.form-row`, `.form-group`, `.form-control`, `.amount-input`
- **Entity Info**: `.info-card`, `.entity-avatar`, `.entity-name`, `.entity-type`, `.balance-display`, `.balance-amount`
- **Buttons**: `.btn-submit`, `.btn-submit.payment`, `.btn-action`, `.quick-btn`, `.btn-voucher-search`
- **Transactions**: `.recent-section`, `.transactions-list`, `.transaction-item`, `.transaction-info`, `.transaction-amount`
- **Stats**: `.stats-row`, `.stat-card`, `.stat-value`, `.stat-label`
- **Voucher Search**: `.voucher-search-wrapper`, `.voucher-search-result`, `.voucher-result-item`
- **Other**: `.placeholder-card`, `.no-transactions`, `.quick-actions`

**Dark Mode CSS**: لا يوجد (يعتمد على المتغيرات العامة)
| | المسار |
|---|---|
| **HTML** | `renderer/views/payments/receipt.html` |
| **CSS** | `renderer/views/payments/payments.css` ← مشترك مع payment |
| **JS** | `renderer/views/payments/receipt.js` |
| **Handler** | `handlers/treasury.js` |

**قنوات IPC**: `get-customers`, `get-treasury-transactions`, `add-treasury-transaction`, `search-treasury-by-voucher`
**جداول DB**: `treasury_transactions`, `customers`
**CSS Classes الرئيسية** (مشترك مع Payment + إضافي):
- نفس classes الـ Payment + التالي:
- **Receipt Layout**: `.receipt-layout`, `.receipt-form-card`, `.receipt-form-layout`, `.voucher-panel`, `.compact-meta-grid`, `.details-grid`
- **Receipt Side**: `.receipt-side-stack`, `.receipt-info-card`, `.receipt-help-card`, `.receipt-balance-preview`, `.preview-item`

**Dark Mode CSS**: لا يوجد (يعتمد على المتغيرات العامة)
| | المسار |
|---|---|
| **HTML** | `renderer/views/customer-reports/index.html` |
| **CSS** | `renderer/views/customer-reports/customer-reports.css` |
| **JS** | `renderer/views/customer-reports/customer-reports.js` |
| **Handler** | `handlers/reports.js`, `handlers/treasury.js`, `handlers/invoices.js`, `handlers/salesReturns.js`, `handlers/purchaseReturns.js` |

**قنوات IPC**: `get-customers`, `get-customer-detailed-statement`, `get-settings`, `get-statement-item-details`, `delete-treasury-transaction`, `delete-invoice`, `delete-sales-return`, `delete-purchase-return`, `save-customer-report-pdf`
**جداول DB**: `sales_invoices`, `purchase_invoices`, `sales_returns`, `purchase_returns`, `treasury_transactions`, `customers`, `sales_invoice_details`, `purchase_invoice_details`, `sales_return_details`, `purchase_return_details`, `items`, `units`, `settings`
**CSS Classes الرئيسية**:
- **Layout**: `.content`, `.page-hero`, `.page-hero-right`, `.page-hero-icon`
- **Selection**: `.selection-card`, `.date-group`
- **Summary**: `.summary-strip`, `.summary-card`, `.sc-icon`, `.sc-label`, `.sc-value`
- **Tables**: `.table-card`, `.table-card-header`, `.items-detail-row`, `.items-detail-box`, `.items-inner-table`
- **Forms**: `.form-group`, `.form-control`
- **Buttons**: `.btn-show-report`, `.btn-icon`, `.btn-sm`, `.btn-edit`, `.btn-delete`, `.btn-toggle`
- **Badges**: `.badge-sales`, `.badge-purchase`, `.badge-receipt`, `.badge-payment`, `.badge-sales-return`, `.badge-purchase-return`
- **Balance/Amounts**: `.amount`, `.amount.debit`, `.amount.credit`, `.running-bal`, `.balance-footer`, `.bf-label`, `.bf-value`
- **Other**: `.report-container`, `.empty-state`, `.opening-row`, `.notes-cell`, `.items-loading`, `.row-actions`, `.print-header`

**Dark Mode CSS**: overrides لـ `.items-detail-box`, `.items-inner-table th`, `.items-inner-table td`, `.items-inner-table tbody tr:hover`
**ملاحظة**: يحتوي على كتلة `@media print` كبيرة (سطر 552+) تعيد تعريف ألوان الطباعة

---

### 15. التقارير العامة (Reports)
| | المسار |
|---|---|
| **HTML** | `renderer/views/reports/index.html` |
| **CSS** | `renderer/views/reports/reports.css` |
| **JS** | `renderer/views/reports/reports.js` |
| **Handler** | `handlers/reports.js`, `handlers/invoices.js` |

**قنوات IPC**: `get-customers`, `get-all-reports`, `delete-invoice`
**جداول DB**: `sales_invoices`, `purchase_invoices`, `sales_returns`, `purchase_returns`, `treasury_transactions`, `customers`
**CSS Classes الرئيسية**:
- **Layout**: `.content`, `.page-hero`, `.page-hero-right`, `.page-hero-icon`
- **Summary**: `.summary-strip`, `.summary-card`, `.sc-icon`, `.sc-label`, `.sc-value`
- **Filters**: `.filters-card`, `.form-group`, `.form-control`
- **Tables**: `.table-card`, `.table-card-header`, `.table`
- **Buttons**: `.btn-primary`, `.btn-sm`, `.btn-edit`, `.btn-delete`
- **Badges**: `.badge-sales`, `.badge-purchase`, `.badge-sales-return`, `.badge-purchase-return`, `.badge-receipt`, `.badge-payment`
- **Amounts**: `.amount`, `.amount-sales`, `.amount-purchase`, `.amount-receipt`, `.amount-payment`
- **Pagination**: `.pagination-bar`, `.pagination-info`, `.pagination-btns`
- **Other**: `.empty-state`, `.row-actions`

**Dark Mode CSS**: لا يوجد (يعتمد على المتغيرات العامة)

---

### 16. تقرير المدين/الدائن (Debtor-Creditor)
| | المسار |
|---|---|
| **HTML** | `renderer/views/reports/debtor-creditor/index.html` |
| **CSS** | `renderer/views/reports/debtor-creditor/debtor-creditor.css` |
| **JS** | `renderer/views/reports/debtor-creditor/debtor-creditor.js` |
| **Handler** | `handlers/customers.js` |

**قنوات IPC**: `get-debtor-creditor-report`
**جداول DB**: `customers`, `sales_invoices`, `purchase_invoices`, `treasury_transactions`
**CSS Classes الرئيسية**:
- **Hero**: `.dc-hero`, `.hero-shapes`, `.hero-shape`, `.shape-1`, `.shape-2`, `.shape-3`
- **Summary**: `.dc-summary`, `.dc-summary-card`, `.card-debtor`, `.card-creditor`, `.card-net`, `.dc-card-icon`, `.dc-card-info`, `.dc-card-label`, `.dc-card-value`
- **Filters**: `.dc-filters`, `.form-group`, `.form-control`, `.btn-print`
- **Tables**: `.dc-table-card`, `.dc-table-header`, `.dc-table`, `.count-badge`
- **Badges**: `.dc-badge`, `.dc-badge-debtor`, `.dc-badge-creditor`, `.dc-badge-balanced`, `.dc-badge-customer`, `.dc-badge-supplier`, `.dc-badge-both`
- **Other**: `.dc-empty`, `.text-red`, `.text-green`, `.print-header-info`

**Dark Mode CSS**: `.dc-hero` dark radial gradients + dark badge overrides + print overrides داخل `@media print`

---

### 17. الإعدادات (Settings)
| | المسار |
|---|---|
| **HTML** | `renderer/views/settings/index.html` |
| **CSS** | `renderer/views/settings/settings.css` |
| **JS** | `renderer/views/settings/settings.js` |
| **Handler** | `handlers/settings.js`, `handlers/backup.js` |

**قنوات IPC**: `get-settings`, `save-settings`, `backup-database`, `restore-database`, `restart-app`
**جداول DB**: `settings`
**CSS Classes الرئيسية**:
- **Layout**: `.content`, `.page-hero`, `.page-hero-right`, `.page-hero-icon`
- **Section Headers**: `.section-header`, `.section-header-icon`, `.section-header-icon.company`, `.section-header-icon.appearance`, `.section-header-icon.backup`
- **Cards**: `.settings-card`
- **Forms**: `.form-grid`, `.form-group`, `.form-control`
- **Profile**: `.profile-image-section`, `.profile-image-preview`, `.profile-placeholder-icon`, `.profile-image-actions`
- **Action Cards**: `.action-cards-grid`, `.action-card`, `.action-card.theme-card`, `.action-card.backup-card`, `.action-card.restore-card`
- **Buttons**: `.btn-save`, `.btn-upload`, `.btn-remove-image`, `.btn-action`, `.btn-action.theme-btn`, `.btn-action.backup-btn`
- **System Info**: `.system-info-grid`, `.info-item`, `.info-item-icon`, `.info-item-value`
- **Other**: `.status-text`, `.status-text.error`, `.status-text.success`

**Dark Mode CSS**: لا يوجد (يعتمد على المتغيرات العامة)
| | المسار |
|---|---|
| **HTML** | `renderer/views/search/index.html` |
| **CSS** | `renderer/views/search/search.css` |
| **JS** | `renderer/views/search/search.js` |
| **Handler** | — (يستخدم globalSearch.js) |

**قنوات IPC**: لا يوجد مباشرة (يعمل عبر globalSearch.js)
**جداول DB**: —
**CSS Classes الرئيسية**:
- **Layout**: `.content`, `.search-header`, `.search-title`, `.search-subtitle`
- **Search Box**: `.search-box-container`, `.search-box`, `.search-input-wrapper`, `.search-input`, `.search-btn`
- **Filters**: `.search-filters`, `.filter-btn`
- **Results**: `.results-section`, `.results-grid`, `.result-card`, `.result-card-header`, `.result-icon`, `.result-info`, `.result-title`, `.result-type`, `.result-card-body`, `.result-detail`
- **Stats**: `.quick-stats`, `.stat-card`, `.stat-value`, `.stat-label`
- **Movements**: `.movements-section`, `.movements-table`, `.movement-type`, `.movement-qty`
- **Buttons**: `.action-btn`, `.action-btn.primary`, `.action-btn.secondary`
- **Other**: `.no-results`, `.loading-state`, `.loading-spinner`, `.recent-searches`, `.recent-list`, `.recent-item`

**Dark Mode CSS**: لا يوجد

---

### 19. تسجيل الدخول (Auth)
| | المسار |
|---|---|
| **HTML** | `renderer/views/auth/index.html` |
| **CSS** | `renderer/views/auth/auth.css` |
| **JS** | `renderer/views/auth/auth.js` |
| **Handler** | `handlers/auth.js` |

**قنوات IPC**: `get-auth-status`, `setup-auth-account`, `login-auth-account`
**جداول DB**: `auth_users`, `auth_sessions`, `settings`
**CSS Classes الرئيسية**:
- **Layout**: `.auth-card`
- **Forms**: `.form-group`, `.btn-primary`, `.password-field-wrapper`, `.password-toggle-btn`, `.password-toggle-icon`
- **Other**: `.status`, `.status.error`, `.status.success`, `.auth-loading-overlay`, `.auth-loading-spinner`, `.auth-loading-text`

**Dark Mode CSS**: لا يوجد (يعتمد على المتغيرات العامة)

---

### 20. إدارة المستخدمين (Auth Users)
| | المسار |
|---|---|
| **HTML** | `renderer/views/auth-users/index.html` |
| **CSS** | `renderer/views/auth-users/auth-users.css` |
| **JS** | `renderer/views/auth-users/auth-users.js` |
| **Handler** | `handlers/auth.js` |

**قنوات IPC**: `get-auth-users`, `create-auth-user`, `set-auth-user-active`, `reset-auth-user-password`, `get-active-auth-user`, `get-auth-session-token`, `get-user-permissions`, `update-user-permissions`
**جداول DB**: `auth_users`, `auth_sessions`, `user_permissions`
**CSS Classes الرئيسية**:
- **Layout**: `.users-page`, `.users-subtitle`, `.users-notice`
- **Forms**: `.users-form`, `.form-group`, `.form-control`, `.form-check-line`
- **Tables**: `.users-table-wrap`, `.users-table`, `.users-actions-cell`
- **Buttons**: `.btn-secondary`, `.btn-warning`, `.btn-sm`, `.btn-permissions`
- **Permissions Modal**: `.perm-modal`, `.perm-modal-body`, `.perm-admin-note`, `.perm-actions-row`, `.perm-table-wrap`, `.perm-table`, `.perm-page-name`, `.perm-cb`
- **Password Modal**: `.rp-modal-overlay`, `.rp-modal`, `.rp-modal-header`, `.rp-modal-close`, `.rp-modal-body`, `.rp-modal-actions`, `.btn-cancel`
- **Other**: `.status-text`, `.users-empty`

**Dark Mode CSS**: override لـ `.users-subtitle`

---

### 21. تفعيل البرنامج (Invite Code)
| | المسار |
|---|---|
| **HTML** | `renderer/views/invite/index.html` |
| **CSS** | `renderer/views/invite/invite.css` |
| **JS** | `renderer/views/invite/invite.js` |
| **Handler** | `handlers/auth.js` |
| **Config** | `inviteConfig.js` (INVITE_CODE, INVITE_DURATION_DAYS) |

**قنوات IPC**: `get-invite-status`, `submit-invite-code`, `get-machine-id`
**جداول DB**: `settings` (keys: `invite_code`, `invite_expiry`)
**CSS Classes الرئيسية**:
- **Layout**: `.invite-card`, `.machine-id-box`, `.copy-group`
- **Forms**: `.form-group`, `.btn-primary`, `.btn-icon`
- **Other**: `.status`, `.status.error`, `.status.success`

**ملاحظات**:
- كود دعوة واحد يشتغل على أي جهاز — صالح لمدة 30 يوم
- أحجام النوافذ responsive تلقائياً مع حجم الشاشة

**Dark Mode CSS**: لا يوجد

---

## جداول قاعدة البيانات (DB Schema)

| الجدول | الأعمدة | Handler الرئيسي |
|--------|---------|-----------------|
| `units` | id, name | units.js |
| `items` | id, name, barcode, unit_id, cost_price, sale_price, stock_quantity, reorder_level, is_deleted | items.js |
| `customers` | id, name, phone, address, balance, type, code, opening_balance | customers.js |
| `suppliers` | id, name, phone, address, balance | suppliers.js |
| `warehouses` | id, name | warehouses.js |
| `sales_invoices` | id, invoice_number, customer_id, invoice_date, payment_type, total_amount, paid_amount, remaining_amount, notes, created_at | sales.js |
| `sales_invoice_details` | id, invoice_id, item_id, quantity, sale_price, total_price | sales.js |
| `purchase_invoices` | id, invoice_number, supplier_id, invoice_date, payment_type, total_amount, paid_amount, remaining_amount, notes, created_at | purchases.js |
| `purchase_invoice_details` | id, invoice_id, item_id, quantity, cost_price, total_price | purchases.js |
| `sales_returns` | id, return_number, original_invoice_id, customer_id, return_date, total_amount, notes, created_at | salesReturns.js |
| `sales_return_details` | id, return_id, item_id, quantity, price, total_price | salesReturns.js |
| `purchase_returns` | id, return_number, original_invoice_id, supplier_id, return_date, total_amount, notes, created_at | purchaseReturns.js |
| `purchase_return_details` | id, return_id, item_id, quantity, price, total_price | purchaseReturns.js |
| `treasury_transactions` | id, type, amount, transaction_date, description, related_invoice_id, related_type, customer_id, supplier_id, created_at, voucher_number | treasury.js |
| `opening_balances` | id, item_id, warehouse_id, quantity, cost_price, created_at, group_id | openingBalances.js |
| `opening_balance_groups` | id, notes, created_at | openingBalances.js |
| `settings` | key, value | settings.js |
| `auth_users` | id, username, password_salt, password_hash, is_admin, is_active, created_at, last_login_at | auth.js (ديناميكي) |
| `auth_sessions` | token, user_id, created_at, last_seen_at, expires_at | auth.js (ديناميكي) |
| `user_permissions` | user_id, page, can_view, can_add, can_edit, can_delete | auth.js |

---

## ملفات يجب تحديثها بالتوازي (Dual Sync)

عند تعديل أي من هذه الملفات، **يجب** تطبيق نفس التعديل على النسختين:

| Frontend | Backend |
|----------|---------|
| `frontend-desktop/src/main/db.js` | `backend/src/desktop-compat/db.js` |
| `frontend-desktop/src/main/ipcHandlers.js` | `backend/src/desktop-compat/ipcHandlers.js` |
| `frontend-desktop/src/main/handlers/*.js` | `backend/src/desktop-compat/handlers/*.js` |

---

## قنوات IPC الكاملة (89 قناة)

> **ملاحظة:** جميع قنوات الكتابة (add/save/update/delete) محمية بـ `requirePermission()` server-side.
> الدالة مُصدّرة من `auth.js` ومستوردة في كل handler file يحتاج فحص صلاحيات.

### auth.js (13)
`get-auth-status` · `setup-auth-account` · `login-auth-account` · `get-active-auth-user` · `get-auth-users` · `create-auth-user` · `set-auth-user-active` · `reset-auth-user-password` · `get-user-permissions` · `update-user-permissions` · `get-my-permissions` · `get-invite-status` · `submit-invite-code`

### backup.js (3)
`backup-database` · `restore-database` · `restart-app`

### customers.js (5)
`get-customers` · `get-debtor-creditor-report` · `add-customer` · `update-customer` · `delete-customer`

### invoices.js (8)
`get-invoice-with-details` · `get-next-invoice-number` · `get-invoice-items-for-return` · `get-sales-invoice-details` · `get-purchase-invoice-details` · `get-sales-return-details` · `get-purchase-return-details` · `delete-invoice`

### items.js (7)
`get-items` · `get-item-stock-details` · `add-item` · `update-item` · `delete-item` · `get-item-movements` · `get-item-transactions`

### openingBalances.js (11)
`get-opening-balances` · `save-opening-balances` · `add-opening-balance-group` · `get-opening-balance-groups` · `get-opening-balance-group` · `get-group-details` · `update-opening-balance-group` · `delete-opening-balance-group` · `add-opening-balance` · `update-opening-balance` · `delete-opening-balance`

### purchaseReturns.js (5)
`get-purchase-returns` · `get-supplier-purchase-invoices` · `save-purchase-return` · `update-purchase-return` · `delete-purchase-return`

### purchases.js (3)
`get-purchase-invoices` · `save-purchase-invoice` · `update-purchase-invoice`

### reports.js (6)
`get-all-reports` · `get-customer-full-report` · `get-customer-detailed-statement` · `get-statement-item-details` · `save-debtor-creditor-pdf` · `save-customer-report-pdf`

### sales.js (3)
`get-sales-invoices` · `save-sales-invoice` · `update-sales-invoice`

### salesReturns.js (5)
`get-sales-returns` · `get-customer-sales-invoices` · `save-sales-return` · `update-sales-return` · `delete-sales-return`

### settings.js (3)
`get-settings` · `save-settings` · `get-dashboard-stats`

### suppliers.js (3)
`get-suppliers` · `add-supplier` · `delete-supplier`

### treasury.js (6)
`get-treasury-balance` · `get-treasury-transactions` · `add-treasury-transaction` · `update-treasury-transaction` · `delete-treasury-transaction` · `search-treasury-by-voucher`

### units.js (4)
`get-units` · `add-unit` · `update-unit` · `delete-unit`

### warehouses.js (4)
`get-warehouses` · `add-warehouse` · `update-warehouse` · `delete-warehouse`

### index.js (1)
`backend-health-check`

---

## صفحات بدون Dark Mode مخصص (تعتمد على المتغيرات فقط)

`units.css` · `payments.css` · `reports.css` · `settings.css` · `search.css` · `auth.css` · `invite.css` · `toast.css`
