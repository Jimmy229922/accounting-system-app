# Page Map — خريطة الصفحات الفعلية (نسخة تشغيلية)

> **الغرض:** مرجع عملي سريع يربط كل صفحة بملفاتها الفعلية وواجهات `electronAPI` والـ handlers المسؤولة.
> **آخر تحديث:** 2026-04-12
> **مصدر الحقيقة:** الملفات داخل `frontend-desktop/src/main` و `frontend-desktop/src/renderer/views`.

---

## 1) تدفق فتح التطبيق (فعليًا من الكود)

1. نقطة البداية: `frontend-desktop/src/main/main.js`.
2. يتم استدعاء `openAppFlow()` من `frontend-desktop/src/main/windowManager.js`.
3. التسلسل:
   - فحص التفعيل `isInviteValid()`.
   - عند الحاجة: فتح `views/invite/index.html`.
   - ثم دائمًا: فتح `views/auth/index.html`.
   - بعد نجاح الدخول: فتح `views/shell/index.html`.
4. داخل `shell` يتم تحميل صفحات النظام في `iframe` (`#shellFrame`) بدل فتح نافذة جديدة.

---

## 2) مصدر التوجيه الحقيقي داخل الواجهة

- التوجيه الأساسي داخل Shell يعتمد على:
  - `frontend-desktop/src/renderer/assets/js/shared/navManager.js` (الدالة `buildTopNavItems`)
  - `frontend-desktop/src/renderer/views/shell/shell.js`
- المسار الافتراضي داخل Shell: `../dashboard/index.html`.
- `navigation.json` موجود، لكنه ليس المصدر الرئيسي لشريط التنقل العلوي في وضع Shell (يُستخدم فقط عبر `renderNavigation` في السياقات القديمة).

---

## 3) خريطة الصلاحيات (Shell/Auth)

### مفاتيح الصلاحيات المعتمدة

`dashboard`, `customers`, `items`, `sales`, `purchases`, `sales-returns`, `purchase-returns`, `treasury`, `reports`, `customer-reports`, `inventory`, `opening-balance`, `settings`, `finance`

### ربط Route -> Permission (من `shell.js`)

| Pattern داخل الرابط | Permission Key |
|---|---|
| `auth-users/` | `__admin_only__` |
| `dashboard/` | `dashboard` |
| `items/items` + `items/units` | `items` |
| `customers/` | `customers` |
| `sales/` | `sales` |
| `sales-returns/` | `sales-returns` |
| `purchases/` | `purchases` |
| `purchase-returns/` | `purchase-returns` |
| `opening-balance/` | `opening-balance` |
| `inventory/` | `inventory` |
| `finance/` | `finance` |
| `payments/payment` + `payments/receipt` | `treasury` |
| `reports/` + `reports/debtor-creditor` | `reports` |
| `customer-reports/` | `customer-reports` |
| `settings/` | `settings` |

---

## 4) خريطة صفحات Shell (Route + ملفات + API + Handler)

| الصفحة | Route | ملفات الصفحة الأساسية | APIs مستخدمة في الصفحة | Main Handlers | Permission |
|---|---|---|---|---|---|
| Dashboard | `../dashboard/index.html` | `dashboard/index.html`, `dashboard.css`, `dashboard.js`, `dashboard.render.js` | `getDashboardStats` | `handlers/settings.js` | `dashboard` |
| Items | `../items/items.html` | `items/items.html`, `items.css`, `items.js`, `items.crud.js` | `getItems`, `getUnits`, `addItem`, `updateItem`, `deleteItem`, `addUnit`, `updateUnit`, `deleteUnit` | `handlers/items.js`, `handlers/units.js` | `items` |
| Units | `../items/units.html` | `items/units.html`, `units.css`, `units.js` | `getUnits`, `addUnit`, `updateUnit`, `deleteUnit` | `handlers/units.js` | `items` |
| Customers | `../customers/index.html` | `customers/index.html`, `customers.css`, `customers.js`, `customers.bootstrap.js` | `getCustomers`, `addCustomer`, `updateCustomer`, `deleteCustomer` | `handlers/customers.js` | `customers` |
| Sales | `../sales/index.html` | `sales/index.html`, `sales.css`, `sales.js`, `sales.api.js`, `sales.bootstrap.js`, `sales.events.js`, `sales.render.js`, `sales.state.js` | `getNextInvoiceNumber`, `getInvoiceWithDetails`, `getCustomers`, `getItems`, `getSalesInvoices`, `saveSalesInvoice`, `updateSalesInvoice` | `handlers/sales.js`, `handlers/invoices.js` | `sales` |
| Sales Returns | `../sales-returns/index.html` | `sales-returns/index.html`, `sales-returns.css`, `sales-returns.js`, `sales-returns.api.js`, `sales-returns.bootstrap.js`, `sales-returns.events.js`, `sales-returns.render.js`, `sales-returns.state.js` | `getNextInvoiceNumber`, `getCustomers`, `getCustomerSalesInvoices`, `getInvoiceItemsForReturn`, `saveSalesReturn`, `updateSalesReturn`, `getSalesReturns`, `getSalesReturnDetails`, `deleteSalesReturn` | `handlers/salesReturns.js`, `handlers/invoices.js` | `sales-returns` |
| Purchases | `../purchases/index.html` | `purchases/index.html`, `purchases.css`, `purchases.js`, `purchases.api.js`, `purchases.events.js`, `purchases.render.js`, `purchases.state.js` | `getNextInvoiceNumber`, `getInvoiceWithDetails`, `getCustomers`, `getItems`, `getPurchaseInvoices`, `savePurchaseInvoice`, `updatePurchaseInvoice` | `handlers/purchases.js`, `handlers/invoices.js` | `purchases` |
| Purchase Returns | `../purchase-returns/index.html` | `purchase-returns/index.html`, `purchase-returns.css`, `purchase-returns.js`, `purchase-returns.api.js`, `purchase-returns.bootstrap.js`, `purchase-returns.events.js`, `purchase-returns.render.js`, `purchase-returns.state.js` | `getNextInvoiceNumber`, `getCustomers`, `getSupplierPurchaseInvoices`, `getInvoiceItemsForReturn`, `savePurchaseReturn`, `updatePurchaseReturn`, `getPurchaseReturns`, `getPurchaseReturnDetails`, `deletePurchaseReturn` | `handlers/purchaseReturns.js`, `handlers/invoices.js` | `purchase-returns` |
| Opening Balance | `../opening-balance/index.html` | `opening-balance/index.html`, `opening-balance.css`, `opening-balance.js`, `opening-balance.bootstrap.js`, `opening-balance.render.js`, `opening-balance.utils.js` | `getWarehouses`, `getItems`, `getOpeningBalances`, `addOpeningBalance`, `updateOpeningBalance`, `deleteOpeningBalance`, `addWarehouse`, `updateWarehouse`, `deleteWarehouse` | `handlers/openingBalances.js`, `handlers/warehouses.js`, `handlers/items.js` | `opening-balance` |
| Inventory | `../inventory/index.html` | `inventory/index.html`, `inventory.css`, `inventory.js` | `getItems`, `getItemMovements`, `getWarehouses`, `getDamagedStockEntries`, `addDamagedStockEntry`, `updateDamagedStockEntry`, `deleteDamagedStockEntry`, `getMyPermissions` | `handlers/items.js`, `handlers/warehouses.js`, `handlers/auth.js` | `inventory` |
| Finance | `../finance/index.html` | `finance/index.html`, `finance.css`, `finance.js` | `getTreasuryBalance`, `getTreasuryTransactions`, `addTreasuryTransaction`, `updateTreasuryTransaction`, `deleteTreasuryTransaction` | `handlers/treasury.js` | `finance` |
| Receipt | `../payments/receipt.html` | `payments/receipt.html`, `payments.css`, `receipt.js`, `treasury-page.shared.js`, `treasury-page.renderer.js` | `getCustomers`, `getTreasuryTransactions`, `getNextTreasuryVoucherNumber`, `addTreasuryTransaction`, `searchTreasuryByVoucher` | `handlers/treasury.js`, `handlers/customers.js` | `treasury` |
| Payment | `../payments/payment.html` | `payments/payment.html`, `payments.css`, `payment.js`, `treasury-page.shared.js`, `treasury-page.renderer.js` | `getCustomers`, `getTreasuryTransactions`, `getNextTreasuryVoucherNumber`, `addTreasuryTransaction`, `searchTreasuryByVoucher` | `handlers/treasury.js`, `handlers/customers.js` | `treasury` |
| Reports | `../reports/index.html` | `reports/index.html`, `reports.css`, `reports.js`, `reports.bootstrap.js`, `reports.render.js`, `reports.voucher.js` | `getAllReports`, `getCustomers`, `deleteInvoice`, `getTreasuryTransactions` | `handlers/reports.js`, `handlers/invoices.js`, `handlers/treasury.js` | `reports` |
| Debtor/Creditor | `../reports/debtor-creditor/index.html` | `reports/debtor-creditor/index.html`, `debtor-creditor.css`, `debtor-creditor.js` | `getDebtorCreditorReport` | `handlers/customers.js` | `reports` |
| Customer Reports | `../customer-reports/index.html` | `customer-reports/index.html`, `customer-reports.css`, `customer-reports.js`, `customer-reports.bootstrap.js`, `customer-reports.render.js`, `customer-reports.utils.js` | `getCustomers`, `getCustomerDetailedStatement`, `getStatementItemDetails`, `deleteTreasuryTransaction`, `deleteInvoice`, `deleteSalesReturn`, `deletePurchaseReturn`, `saveCustomerReportPdf`, `getSettings` | `handlers/reports.js`, `handlers/treasury.js`, `handlers/invoices.js`, `handlers/salesReturns.js`, `handlers/purchaseReturns.js`, `handlers/settings.js` | `customer-reports` |
| Settings | `../settings/index.html` | `settings/index.html`, `settings.css`, `settings.js` | `getSettings`, `saveSettings`, `backupDatabase`, `restoreDatabase`, `restartApp` | `handlers/settings.js`, `handlers/backup.js` | `settings` |
| Auth Users | `../auth-users/index.html` | `auth-users/index.html`, `auth-users.css`, `auth-users.js`, `auth-users.bootstrap.js`, `auth-users.render.js`, `auth-users.utils.js` | `getAuthSessionToken`, `getAuthUsers`, `createAuthUser`, `setAuthUserActive`, `resetAuthUserPassword`, `getUserPermissions`, `updateUserPermissions` | `handlers/auth.js` | `__admin_only__` |
| Search | `../search/index.html` | `search/index.html`, `search.css`, `search.js` | لا يوجد استهلاك مباشر لـ `electronAPI` في الملف الحالي | يعتمد على `globalSearch.js` | غير مربوط في `SHELL_HREF_TO_PERMISSION` |

> ملاحظة: `search/search.js` فارغ حاليًا.

> ملاحظة Inventory (2026-04-12): إدارة التالف داخل صفحة `inventory` تعمل كمودال داخلي يفتح بزر من شريط التحكم (`data-action="open-damaged-manager"`) وتغلق بزر الإغلاق أو النقر خارج المودال.

### Settings UI Structure (2026-04-12)

- الصفحة `settings/index.html` (عبر `settings.js`) أصبحت مقسمة بصريًا داخل الفورم إلى 4 أقسام واضحة:
   - بيانات المؤسسة
   - الشعار
   - العنوان
   - ملاحظات الفاتورة
- CSS Classes المضافة في `settings.css`:
   - `.settings-sections`
   - `.settings-subsection`
   - `.subsection-title`
   - `.subsection-title-main`
   - `.subsection-title-sub`
   - `.subsection-grid`
   - `.btn-upload-meta`
   - `.settings-save-bar`
   - `.btn-save.is-saving`
   - `.btn-save.is-success`
   - `.btn-save.is-error`
   - `.change-log-grid`
   - `.change-log-row`
   - `.change-log-label`
   - `.change-log-value`
   - `.btn-save.has-unsaved`
- سلوك إضافي في `settings.js`:
   - سجل تغييرات مستقل يعرض:
      - آخر تعديل
      - من عدّل
      - ماذا تم تغييره
   - تخزين السجل داخل مفاتيح `settings`:
      - `settings_last_modified_at`
      - `settings_modified_by`
      - `settings_change_summary`
   - تحذير عند مغادرة الصفحة إذا كانت هناك تغييرات غير محفوظة (`beforeunload` + تأكيد عند النقر على روابط التنقل) مع bypass مؤقت بعد الموافقة لتجنب قفل التنقل.

---

## 5) صفحات خارج Shell

| الصفحة | المسار | الملفات | APIs أساسية | Handler |
|---|---|---|---|---|
| Invite Gate | `views/invite/index.html` | `invite.css`, `invite.js` | `checkInviteStatus`, `getMachineId`, `submitInviteCode`, `notifyInviteUnlocked` | `handlers/auth.js` |
| Auth Gate | `views/auth/index.html` | `auth.css`, `auth.js`, `auth.api.js`, `auth.state.js`, `auth.ui.js` | `getAuthStatus`, `setupAuthAccount`, `loginAuthAccount`, `setAuthSessionToken`, `notifyAuthUnlocked` | `handlers/auth.js` |
| Shell Router | `views/shell/index.html` | `shell.css`, `shell.js` | `getAuthSessionToken`, `getMyPermissions` | `handlers/auth.js` + `ipcMain.handle('get-auth-session-token')` في `main.js` |

---

## 6) الملفات المشتركة الحرجة

- `frontend-desktop/src/renderer/assets/styles/main.css` (الثيم العام + قواعد RTL/LTR العامة)
- `frontend-desktop/src/renderer/css/navbar.css` (شريط التنقل)
- `frontend-desktop/src/renderer/assets/js/theme.js`
- `frontend-desktop/src/renderer/assets/js/i18n.js`
- `frontend-desktop/src/renderer/assets/js/toast.js`
- `frontend-desktop/src/renderer/assets/js/autocomplete.js`
- `frontend-desktop/src/renderer/assets/js/globalSearch.js`
- `frontend-desktop/src/renderer/assets/js/globalSearch.bootstrap.js`
- `frontend-desktop/src/renderer/assets/js/globalSearch.details.js`
- `frontend-desktop/src/renderer/assets/js/shared/navManager.js`
- `frontend-desktop/src/renderer/assets/js/permissionManager.js`

### UI Consistency Layer (2026-04-12)

- تم تطبيق طبقة توحيد UI مشتركة بدون أي تعديل في منطق الأعمال على الملفات التالية:
   - `frontend-desktop/src/renderer/assets/styles/main.css`
   - `frontend-desktop/src/renderer/assets/styles/themes/light.css`
   - `frontend-desktop/src/renderer/assets/styles/themes/dark.css`
   - `frontend-desktop/src/renderer/css/navbar.css`
   - `frontend-desktop/src/renderer/views/shell/shell.css`
- وتم تعزيز الاتساق البصري داخل الصفحات التشغيلية الأساسية بإضافة نفس الطبقة في:
   - `views/sales/sales.css`
   - `views/purchases/purchases.css`
   - `views/sales-returns/sales-returns.css`
   - `views/purchase-returns/purchase-returns.css`
   - `views/payments/payments.css`
   - `views/reports/reports.css`
   - `views/settings/settings.css`
   - `views/dashboard/dashboard.css`
- وتم استكمال التغطية لباقي صفحات `views` بنفس طبقة الاتساق في:
   - `views/customers/customers.css`
   - `views/items/items.css`
   - `views/items/units.css`
   - `views/inventory/inventory.css`
   - `views/opening-balance/opening-balance.css`
   - `views/finance/finance.css`
   - `views/customer-reports/customer-reports.css`
   - `views/reports/debtor-creditor/debtor-creditor.css`
   - `views/search/search.css`
   - `views/auth/auth.css`
   - `views/auth-users/auth-users.css`
   - `views/invite/invite.css`
   - `views/shell/shell.css`
- نطاق التغيير: تحسينات CSS فقط (focus states, controls, buttons, cards, tables, responsive spacing)، بدون تعديل IPC أو DB أو صلاحيات.

---

## 7) جداول قاعدة البيانات (الحالي)

### جداول `db.js`

`units`, `items`, `customers`, `suppliers`, `purchase_invoices`, `purchase_invoice_details`, `sales_invoices`, `sales_invoice_details`, `treasury_transactions`, `settings`, `warehouses`, `opening_balances`, `opening_balance_groups`, `sales_returns`, `sales_return_details`, `purchase_returns`, `purchase_return_details`, `damaged_stock_logs`, `user_permissions`

### جداول تُنشأ من `handlers/auth.js`

`auth_users`, `auth_sessions`

### Migrations فعالة يجب الانتباه لها

- `items`: إضافة `reorder_level`, `is_deleted`.
- `customers`: إضافة `type`, `code`, `opening_balance`.
- `sales_invoices` و `purchase_invoices`: حقول الخصم + `paid_amount` + `remaining_amount` + `payment_type`.
- `treasury_transactions`: `customer_id`, `supplier_id`, `voucher_number` + trigger لتوليد رقم السند.
- `opening_balances`: إضافة `group_id`.
- Data Safety Guard Rails (في `frontend-desktop/src/main/db.js` و `backend/src/desktop-compat/db.js`):
   - Triggers تمنع `stock_quantity` السالب في `items`.
   - جدول `damaged_stock_logs` لتسجيل التالف مع خصم/إرجاع المخزون عبر IPC في `handlers/items.js`.
   - Triggers تمنع إدخال/تعديل كمية تالف أقل من أو تساوي صفر.
   - Triggers تمنع تكرار أرقام المستندات: `sales_invoices.invoice_number`, `purchase_invoices.invoice_number`, `sales_returns.return_number`, `purchase_returns.return_number`.

---

## 8) خريطة IPC حسب الملف (مختصر سريع)

- `handlers/auth.js`: المصادقة + المستخدمين + الصلاحيات + invite.
- `handlers/units.js`: الوحدات.
- `handlers/items.js`: الأصناف وحركات المخزون + سجل التالف (إضافة/عرض/تعديل/حذف).
- `handlers/customers.js`: العملاء + تقرير مدين/دائن.
- `handlers/purchases.js`: فواتير الشراء.
- `handlers/sales.js`: فواتير البيع.
- `handlers/salesReturns.js`: مرتجعات البيع.
- `handlers/purchaseReturns.js`: مرتجعات الشراء.
- `handlers/treasury.js`: الخزينة + السندات.
- `handlers/openingBalances.js`: أرصدة أول المدة.
- `handlers/warehouses.js`: المخازن.
- `handlers/reports.js`: التقارير العامة + كشف حساب العميل + PDF.
- `handlers/invoices.js`: تفاصيل الفواتير/المرتجعات + الترقيم + الحذف.
- `handlers/settings.js`: الإعدادات + إحصائيات الداشبورد.
- `handlers/backup.js`: النسخ الاحتياطي والاسترجاع وإعادة التشغيل.

---

## 9) Checklist إلزامي عند أي إضافة/تعديل صفحة

1. تحديث ملف الصفحة داخل `views/...` (HTML/CSS/JS).
2. إضافة/تعديل Route في `navManager.js` (`buildTopNavItems`) عند الحاجة.
3. إضافة/تعديل صلاحية المسار في `shell.js` (`SHELL_HREF_TO_PERMISSION`).
4. إضافة مفتاح الصلاحية في `handlers/auth.js` (`PERMISSION_PAGES`) إذا الصفحة محمية.
5. إضافة/تعديل API في `preload.js` + `ipcMain.handle` في handler المناسب.
6. إذا التعديل يمس قاعدة البيانات أو IPC:
   - طبق نفس التعديل في `backend/src/desktop-compat/` (نسخة التوافق).
7. تحديث هذا الملف مباشرة في نفس التغيير.
