# 🎯 خطة تحويل النظام إلى Online Multi-Tenant SaaS

<table>
<tr><td><strong>المشروع</strong></td><td>Accounting System — نظام محاسبة إلكتروني</td></tr>
<tr><td><strong>الإصدار الحالي</strong></td><td>v1.0.0 — Desktop (Electron + SQLite)</td></tr>
<tr><td><strong>الهدف</strong></td><td>تحويل التطبيق من Desktop محلي إلى منصة SaaS أونلاين متعددة المستأجرين (Multi-Tenant)</td></tr>
<tr><td><strong>المدة المقدّرة</strong></td><td>~61 يوم عمل (≈ 3 شهور)</td></tr>
<tr><td><strong>تاريخ المستند</strong></td><td>فبراير 2026</td></tr>
</table>

---

## 📖 جدول المحتويات

1. [نظرة عامة على النظام الحالي](#1--نظرة-عامة-على-النظام-الحالي)
2. [الهندسة المستهدفة](#2--الهندسة-المستهدفة-target-architecture)
3. [المراحل التفصيلية](#3--المراحل-التفصيلية)
4. [الجدول الزمني](#4--الجدول-الزمني-timeline)
5. [التكاليف التشغيلية](#5--التكاليف-التشغيلية)
6. [المخاطر وخطط التخفيف](#6--المخاطر-وخطط-التخفيف)
7. [معايير القبول](#7--معايير-القبول-acceptance-criteria)

---

## 1 — نظرة عامة على النظام الحالي

### 1.1 البنية التقنية (Current Architecture)

```
┌─────────────────────────────────────────────────────────┐
│                    Electron App                          │
│  ┌──────────────┐   IPC Bridge   ┌───────────────────┐  │
│  │  Renderer     │◄─────────────►│  Main Process     │  │
│  │  (18 pages)   │  80+ channels  │  (18 handlers)    │  │
│  │  HTML/CSS/JS  │               │  better-sqlite3   │  │
│  └──────────────┘               └─────────┬─────────┘  │
│                                            │            │
│                                   ┌────────▼────────┐   │
│                                   │  SQLite DB      │   │
│                                   │  (19 tables)    │   │
│                                   │  (~120 columns) │   │
│                                   └─────────────────┘   │
└─────────────────────────────────────────────────────────┘
          ▲ Optional HTTP bridge (dev/compat mode)
          │
┌─────────▼──────────────────────┐
│  Backend Server (Node.js)       │
│  Port 4000 — raw http module    │
│  POST /api/rpc/{channel}        │
│  Same 18 handler files mirrored │
└─────────────────────────────────┘
```

### 1.2 المقاييس الحالية (Current Metrics)

| المقياس | القيمة |
|---------|--------|
| قنوات IPC مسجّلة (contract) | **80** |
| قنوات إضافية (preload فقط) | **6** + 4 أحداث fire-and-forget |
| جداول قاعدة البيانات | **19** |
| أعمدة (إجمالي) | **~120** |
| ملفات Handlers (مزدوجة frontend + backend) | **18 × 2 = 36** |
| صفحات Frontend | **18** |
| مسارات HTTP في Backend | **5** (1 منها RPC ديناميكي) |
| محرك قاعدة البيانات | SQLite via `better-sqlite3` |
| نظام المصادقة | Token-based sessions — `crypto.scryptSync` + hex tokens |
| نموذج الصلاحيات | ثنائي: `admin` / `non-admin` |

### 1.3 جداول قاعدة البيانات الحالية (19 جدول)

| # | الجدول | الوصف | أعمدة رئيسية |
|---|--------|-------|-------------|
| 1 | `units` | وحدات القياس | `id`, `name` |
| 2 | `items` | الأصناف | `id`, `name`, `barcode`, `unit_id`, `cost_price`, `sale_price`, `stock_quantity`, `reorder_level`, `is_deleted` |
| 3 | `customers` | العملاء | `id`, `name`, `phone`, `address`, `balance`, `type`, `code`, `opening_balance` |
| 4 | `suppliers` | الموردين | `id`, `name`, `phone`, `address`, `balance` |
| 5 | `purchase_invoices` | فواتير الشراء | `id`, `invoice_number`, `supplier_id`, `invoice_date`, `payment_type`, `total_amount`, `paid_amount`, `remaining_amount`, `notes`, `created_at` |
| 6 | `purchase_invoice_details` | تفاصيل فاتورة شراء | `id`, `invoice_id` FK CASCADE, `item_id`, `quantity`, `cost_price`, `total_price` |
| 7 | `sales_invoices` | فواتير البيع | `id`, `invoice_number`, `customer_id`, `invoice_date`, `payment_type`, `total_amount`, `paid_amount`, `remaining_amount`, `notes`, `created_at` |
| 8 | `sales_invoice_details` | تفاصيل فاتورة بيع | `id`, `invoice_id` FK CASCADE, `item_id`, `quantity`, `sale_price`, `total_price` |
| 9 | `treasury_transactions` | حركات الخزينة | `id`, `type`, `amount`, `transaction_date`, `description`, `related_invoice_id`, `related_type`, `customer_id`, `supplier_id`, `created_at`, `voucher_number` |
| 10 | `settings` | إعدادات النظام | `key` PK, `value` |
| 11 | `warehouses` | المخازن | `id`, `name` |
| 12 | `opening_balances` | أرصدة أول المدة | `id`, `item_id`, `warehouse_id`, `quantity`, `cost_price`, `created_at`, `group_id` FK CASCADE |
| 13 | `opening_balance_groups` | مجموعات الأرصدة | `id`, `notes`, `created_at` |
| 14 | `sales_returns` | مردودات مبيعات | `id`, `return_number`, `original_invoice_id`, `customer_id`, `return_date`, `total_amount`, `notes`, `created_at` |
| 15 | `sales_return_details` | تفاصيل مردودات مبيعات | `id`, `return_id` FK CASCADE, `item_id`, `quantity`, `price`, `total_price` |
| 16 | `purchase_returns` | مردودات مشتريات | `id`, `return_number`, `original_invoice_id`, `supplier_id`, `return_date`, `total_amount`, `notes`, `created_at` |
| 17 | `purchase_return_details` | تفاصيل مردودات مشتريات | `id`, `return_id` FK CASCADE, `item_id`, `quantity`, `price`, `total_price` |
| 18 | `auth_users` | المستخدمين | `id`, `username` UNIQUE, `password_salt`, `password_hash`, `is_admin`, `is_active`, `created_at`, `last_login_at` |
| 19 | `auth_sessions` | الجلسات | `token` PK, `user_id` FK CASCADE, `created_at`, `last_seen_at`, `expires_at` |

### 1.4 قنوات IPC الحالية (80 قناة)

<details>
<summary>اضغط لعرض القائمة الكاملة</summary>

| المجال | القنوات |
|--------|---------|
| **الوحدات** | `add-unit` · `get-units` · `update-unit` · `delete-unit` |
| **الأصناف** | `add-item` · `get-items` · `update-item` · `delete-item` · `get-item-stock-details` · `get-item-movements` · `get-item-transactions` |
| **المخازن** | `add-warehouse` · `get-warehouses` · `update-warehouse` · `delete-warehouse` |
| **أرصدة أول المدة** | `add-opening-balance` · `get-opening-balances` · `save-opening-balances` · `update-opening-balance` · `delete-opening-balance` · `add-opening-balance-group` · `get-opening-balance-groups` · `get-opening-balance-group` · `get-group-details` · `update-opening-balance-group` · `delete-opening-balance-group` |
| **العملاء** | `add-customer` · `get-customers` · `update-customer` · `delete-customer` · `get-customer-sales-invoices` · `get-customer-full-report` · `get-customer-detailed-statement` · `get-debtor-creditor-report` |
| **الموردين** | `add-supplier` · `get-suppliers` · `delete-supplier` · `get-supplier-purchase-invoices` |
| **فواتير الشراء** | `get-purchase-invoices` · `save-purchase-invoice` · `update-purchase-invoice` |
| **فواتير البيع** | `get-sales-invoices` · `save-sales-invoice` · `update-sales-invoice` |
| **أدوات الفواتير** | `get-next-invoice-number` · `get-invoice-with-details` · `get-invoice-items-for-return` · `delete-invoice` |
| **الخزينة** | `get-treasury-balance` · `get-treasury-transactions` · `add-treasury-transaction` · `update-treasury-transaction` · `delete-treasury-transaction` |
| **مردودات البيع** | `get-sales-returns` · `save-sales-return` · `delete-sales-return` |
| **مردودات الشراء** | `get-purchase-returns` · `save-purchase-return` · `delete-purchase-return` |
| **لوحة التحكم** | `get-dashboard-stats` |
| **التقارير** | `get-all-reports` |
| **الإعدادات** | `get-settings` · `save-settings` |
| **المصادقة** | `get-auth-status` · `setup-auth-account` · `login-auth-account` · `get-active-auth-user` · `get-auth-users` · `create-auth-user` · `set-auth-user-active` · `reset-auth-user-password` |
| **الدعوات** | `get-invite-status` · `submit-invite-code` |
| **النسخ الاحتياطي** | `backup-database` · `restore-database` · `restart-app` |
| **PDF** | `save-customer-report-pdf` · `save-debtor-creditor-pdf` |
| **Backend** | `backend-health-check` |

</details>

### 1.5 نظام المصادقة الحالي

```
┌──────────┐      ┌──────────────┐      ┌──────────────┐      ┌──────────┐
│  Invite   │─────►│  Setup Admin  │─────►│   Login      │─────►│  Session  │
│  Code     │      │  (first run)  │      │  scrypt hash │      │  Token    │
│  Gate     │      │               │      │  + salt      │      │  (14 day) │
└──────────┘      └──────────────┘      └──────────────┘      └──────────┘
```

- **Invite Code**: رمز ثابت hardcoded مع إمكانية override عبر env var
- **تشفير كلمة المرور**: `crypto.scryptSync` مع salt عشوائي 16 bytes
- **الجلسات**: token عشوائي 32 bytes hex، مخزّن في DB مع expiry 14 يوم
- **Super Admin**: مستخدم ثابت في الكود (`Jimmy`) يتم ضمان وجوده عند كل تشغيل
- **الصلاحيات**: ثنائية فقط (admin / non-admin) — لا يوجد RBAC

### 1.6 صفحات الواجهة الأمامية (18 صفحة)

| # | المجلد | الوصف |
|---|--------|-------|
| 1 | `auth/` | شاشة الدخول/الإعداد |
| 2 | `auth-users/` | إدارة المستخدمين |
| 3 | `customer-reports/` | تقارير العملاء |
| 4 | `customers/` | إدارة العملاء |
| 5 | `dashboard/` | لوحة التحكم الرئيسية |
| 6 | `finance/` | الصفحة المالية |
| 7 | `inventory/` | تقرير المخزن |
| 8 | `invite/` | إدخال رمز الدعوة |
| 9 | `items/` | إدارة الأصناف |
| 10 | `opening-balance/` | أرصدة أول المدة |
| 11 | `payments/` | سندات القبض/الصرف |
| 12 | `purchase-returns/` | مردودات المشتريات |
| 13 | `purchases/` | فواتير الشراء |
| 14 | `reports/` | التقارير العامة + المدين/الدائن |
| 15 | `sales/` | فواتير البيع |
| 16 | `sales-returns/` | مردودات المبيعات |
| 17 | `search/` | البحث الشامل |
| 18 | `settings/` | الإعدادات |

---

## 2 — الهندسة المستهدفة (Target Architecture)

### 2.1 مخطط البنية الجديدة

```
                        ┌──────────────────────────────────────────┐
                        │           Cloud Infrastructure            │
                        │                                          │
┌───────────┐  HTTPS    │  ┌─────────────────────────────────────┐ │
│ Browser   │◄─────────►│  │  Reverse Proxy (Nginx / Caddy)      │ │
│ (SPA)     │  WSS      │  │  SSL Termination + Rate Limiting    │ │
│           │           │  └──────────┬──────────┬───────────────┘ │
└───────────┘           │             │          │                 │
                        │      ┌──────▼───┐ ┌───▼────────────┐    │
┌───────────┐  HTTPS    │      │ REST API │ │ WebSocket      │    │
│ Electron  │◄─────────►│      │ (Node.js)│ │ (Socket.io)    │    │
│ Desktop   │  WSS      │      │ Express  │ │ tenant rooms   │    │
│ (offline) │           │      └────┬─────┘ └───┬────────────┘    │
└─────┬─────┘           │           │            │                 │
      │ IndexedDB       │      ┌────▼────────────▼──────────┐     │
      │ (local cache)   │      │      PostgreSQL 15+         │     │
      └─────────────────│      │  ┌─────────────────────┐   │     │
                        │      │  │ tenant_1 data (RLS)  │   │     │
                        │      │  │ tenant_2 data (RLS)  │   │     │
                        │      │  │ tenant_N data (RLS)  │   │     │
                        │      │  └─────────────────────┘   │     │
                        │      └────────────────────────────┘     │
                        │                                          │
                        │      ┌────────────────┐ ┌────────────┐  │
                        │      │  Redis          │ │  PM2       │  │
                        │      │  sessions/cache │ │  process   │  │
                        │      └────────────────┘ └────────────┘  │
                        └──────────────────────────────────────────┘
```

### 2.2 نموذج Multi-Tenancy المختار

**Shared Database — Row-Level Isolation (RLS)**

| النموذج | الوصف | المناسب لنا |
|---------|-------|-------------|
| ❌ DB per tenant | قاعدة بيانات مستقلة لكل عميل | مكلف ومعقد |
| ❌ Schema per tenant | Schema منفصل لكل عميل | صعب الصيانة |
| ✅ **Shared DB + `tenant_id`** | جدول واحد + عمود `tenant_id` + RLS | **أبسط، أرخص، أسهل في الصيانة** |

### 2.3 التغييرات المطلوبة على كل جدول

```sql
-- كل جدول موجود (الـ 19 جدول) يضاف له:
ALTER TABLE {table_name} ADD COLUMN tenant_id UUID NOT NULL;
ALTER TABLE {table_name} ADD COLUMN created_by INTEGER REFERENCES users(id);
ALTER TABLE {table_name} ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();

-- + Row Level Security
CREATE POLICY tenant_isolation ON {table_name}
  USING (tenant_id = current_setting('app.current_tenant')::UUID);
```

### 2.4 الجداول الجديدة المطلوبة

| الجدول | الوصف | أعمدة رئيسية |
|--------|-------|-------------|
| `tenants` | المستأجرين (الشركات) | `id` UUID, `name`, `slug`, `plan`, `is_active`, `created_at`, `max_users` |
| `users` | المستخدمين (يحل محل `auth_users`) | `id`, `tenant_id` FK, `email`, `username`, `password_hash`, `role`, `is_active`, `last_login`, `refresh_token` |
| `invitations` | نظام الدعوات الديناميكي | `id`, `tenant_id`, `code`, `created_by`, `expires_at`, `used_by`, `used_at`, `max_uses` |
| `sync_log` | سجل التزامن | `id`, `tenant_id`, `user_id`, `entity`, `entity_id`, `action`, `payload`, `synced_at`, `client_timestamp` |
| `audit_log` | سجل المراجعة | `id`, `tenant_id`, `user_id`, `action`, `entity`, `entity_id`, `old_data`, `new_data`, `ip`, `created_at` |

### 2.5 مقارنة القبل والبعد

| الجانب | الحالي (Desktop) | المستهدف (SaaS) |
|--------|-----------------|----------------|
| قاعدة البيانات | SQLite محلي | PostgreSQL مركزي + RLS |
| المصادقة | Token عشوائي + scrypt | JWT (access + refresh) + bcrypt |
| الصلاحيات | admin / non-admin | RBAC: owner · admin · accountant · viewer |
| الاتصال | IPC (Electron) | REST API + WebSocket |
| الـ Offline | يعمل تلقائياً (محلي) | IndexedDB + Service Worker + sync queue |
| التحديث الفوري | لا يوجد | WebSocket per tenant room |
| النسخ الاحتياطي | يدوي (ملف) | يومي تلقائي + point-in-time recovery |
| الاستضافة | جهاز المستخدم | VPS / Cloud |
| الدعوات | رمز واحد ثابت | رموز ديناميكية per tenant مع صلاحية وعدد استخدامات |

---

## 3 — المراحل التفصيلية

---

### 📋 المرحلة 0: التحضير والتحليل
**المدة**: 1 يوم | **الأولوية**: 🔴 حرجة | **التبعيات**: لا يوجد

#### المهام

- [ ] **0.1** اختبار الـ Backend الحالي على `port 4000` والتأكد من عمل كل الـ 80 قناة عبر RPC
- [ ] **0.2** توثيق كل endpoint بالـ request/response schemas
- [ ] **0.3** رسم Entity Relationship Diagram للجداول الـ 19 الحالية
- [ ] **0.4** تحديد الـ breaking changes المتوقعة

#### المخرجات

| المخرج | الوصف |
|--------|-------|
| `docs/api-audit.md` | توثيق كامل لكل الـ endpoints الحالية وسلوكها |
| `docs/erd-current.png` | مخطط علاقات الجداول الحالي |
| `docs/breaking-changes.md` | قائمة بالتغييرات المؤثرة على التوافقية |

---

### 📋 المرحلة 1: قاعدة البيانات المركزية (Multi-Tenant DB)
**المدة**: 4 أيام | **الأولوية**: 🔴 حرجة | **التبعيات**: المرحلة 0

#### المهام

- [ ] **1.1** تصميم PostgreSQL schema مع `tenant_id` على كل جدول
- [ ] **1.2** كتابة migration: `001-initial-schema.sql` (19 جدول + 5 جداول جديدة = 24 جدول)
- [ ] **1.3** كتابة سكريبت `migrate-sqlite-to-postgres.js` لنقل البيانات المحلية
- [ ] **1.4** تفعيل Row Level Security (RLS) على PostgreSQL
- [ ] **1.5** إعداد connection pooling (pg-pool)
- [ ] **1.6** إعداد automated daily backup + retention policy

#### تفاصيل تقنية

**المخطط الجديد لجدول `tenants`:**
```sql
CREATE TABLE tenants (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    slug        VARCHAR(100) UNIQUE NOT NULL,
    plan        VARCHAR(50) DEFAULT 'free',  -- free | basic | pro
    is_active   BOOLEAN DEFAULT TRUE,
    max_users   INTEGER DEFAULT 3,
    settings    JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

**إضافة `tenant_id` لكل جدول موجود — مثال:**
```sql
-- items table (PostgreSQL version)
CREATE TABLE items (
    id              SERIAL PRIMARY KEY,
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    barcode         VARCHAR(100),
    unit_id         INTEGER REFERENCES units(id),
    cost_price      DECIMAL(12,2) DEFAULT 0,
    sale_price      DECIMAL(12,2) DEFAULT 0,
    stock_quantity  DECIMAL(12,2) DEFAULT 0,
    reorder_level   INTEGER DEFAULT 0,
    is_deleted      BOOLEAN DEFAULT FALSE,
    created_by      INTEGER REFERENCES users(id),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, barcode)
);

-- Row Level Security
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
CREATE POLICY items_tenant_policy ON items
    USING (tenant_id = current_setting('app.current_tenant')::UUID);
```

#### المخرجات

| المخرج | الوصف |
|--------|-------|
| `backend/migrations/001-initial-schema.sql` | مخطط PostgreSQL الكامل (24 جدول) |
| `backend/migrations/002-rls-policies.sql` | سياسات RLS لكل جدول |
| `backend/scripts/migrate-sqlite-to-postgres.js` | أداة نقل البيانات |
| `backend/src/db/pool.js` | اتصال PostgreSQL مع connection pooling |

---

### 📋 المرحلة 2: نظام المصادقة (Authentication)
**المدة**: 3 أيام | **الأولوية**: 🔴 حرجة | **التبعيات**: المرحلة 1

#### المهام

- [ ] **2.1** تنفيذ JWT authentication (access token 15min + refresh token 7 days)
- [ ] **2.2** تنفيذ RBAC مع 4 أدوار: `owner` · `admin` · `accountant` · `viewer`
- [ ] **2.3** تنفيذ نظام دعوات ديناميكي يحل محل `inviteConfig.js`
- [ ] **2.4** تنفيذ password hashing بـ bcrypt (يحل محل scrypt الحالي)
- [ ] **2.5** تنفيذ rate limiting على auth endpoints
- [ ] **2.6** كتابة middleware: `authenticate.js` + `authorize.js` + `tenantContext.js`

#### Endpoints الجديدة

| Method | Path | الوصف | Auth |
|--------|------|-------|------|
| `POST` | `/api/auth/register` | تسجيل tenant جديد + owner user | ❌ Public |
| `POST` | `/api/auth/login` | تسجيل دخول → access + refresh tokens | ❌ Public |
| `POST` | `/api/auth/refresh` | تجديد access token | 🔑 Refresh token |
| `POST` | `/api/auth/logout` | إنهاء الجلسة | 🔒 JWT |
| `POST` | `/api/auth/change-password` | تغيير كلمة المرور | 🔒 JWT |
| `POST` | `/api/invites` | إنشاء رمز دعوة | 🔒 Admin+ |
| `POST` | `/api/invites/validate` | التحقق من رمز دعوة | ❌ Public |
| `POST` | `/api/invites/accept` | قبول دعوة + إنشاء حساب | ❌ Public |
| `GET`  | `/api/users` | قائمة مستخدمي الـ tenant | 🔒 Admin+ |
| `PATCH`| `/api/users/:id/role` | تغيير دور مستخدم | 🔒 Owner |
| `PATCH`| `/api/users/:id/status` | تفعيل/تعطيل مستخدم | 🔒 Admin+ |

#### مصفوفة الصلاحيات (RBAC)

| العملية | owner | admin | accountant | viewer |
|---------|:-----:|:-----:|:----------:|:------:|
| إدارة المستأجر (tenant) | ✅ | ❌ | ❌ | ❌ |
| إدارة المستخدمين | ✅ | ✅ | ❌ | ❌ |
| إنشاء/تعديل دعوات | ✅ | ✅ | ❌ | ❌ |
| إنشاء فواتير | ✅ | ✅ | ✅ | ❌ |
| تعديل/حذف فواتير | ✅ | ✅ | ✅ | ❌ |
| عمليات الخزينة | ✅ | ✅ | ✅ | ❌ |
| إدارة الأصناف/العملاء | ✅ | ✅ | ✅ | ❌ |
| عرض التقارير | ✅ | ✅ | ✅ | ✅ |
| عرض لوحة التحكم | ✅ | ✅ | ✅ | ✅ |
| النسخ الاحتياطي | ✅ | ✅ | ❌ | ❌ |
| الإعدادات | ✅ | ✅ | ❌ | ❌ |

#### المخرجات

| المخرج | الوصف |
|--------|-------|
| `backend/src/auth/jwtService.js` | JWT token generation/validation |
| `backend/src/auth/passwordService.js` | bcrypt hashing |
| `backend/src/auth/inviteService.js` | نظام الدعوات الديناميكي |
| `backend/src/middleware/authenticate.js` | JWT verification middleware |
| `backend/src/middleware/authorize.js` | RBAC permission check |
| `backend/src/middleware/tenantContext.js` | إعداد `tenant_id` في كل request |

---

### 📋 المرحلة 3: تحويل Backend إلى REST API
**المدة**: 7 أيام | **الأولوية**: 🔴 حرجة | **التبعيات**: المرحلة 2

#### المهام

- [ ] **3.1** تثبيت Express.js (يحل محل raw http module الحالي)
- [ ] **3.2** تحويل الـ 80 قناة IPC إلى REST endpoints مع RESTful naming
- [ ] **3.3** إضافة `tenant_id` filtering لكل query تلقائياً
- [ ] **3.4** تنفيذ input validation (Joi / Zod)
- [ ] **3.5** تنفيذ standardized error responses
- [ ] **3.6** تنفيذ request logging (Morgan + Winston)
- [ ] **3.7** إضافة rate limiting عام + per-endpoint

#### خريطة تحويل الـ IPC → REST (80+ endpoint)

<details>
<summary>اضغط لعرض الخريطة الكاملة</summary>

| IPC Channel | REST Endpoint | Method |
|-------------|--------------|--------|
| **الوحدات** | | |
| `get-units` | `/api/units` | `GET` |
| `add-unit` | `/api/units` | `POST` |
| `update-unit` | `/api/units/:id` | `PUT` |
| `delete-unit` | `/api/units/:id` | `DELETE` |
| **الأصناف** | | |
| `get-items` | `/api/items` | `GET` |
| `add-item` | `/api/items` | `POST` |
| `update-item` | `/api/items/:id` | `PUT` |
| `delete-item` | `/api/items/:id` | `DELETE` |
| `get-item-stock-details` | `/api/items/:id/stock` | `GET` |
| `get-item-movements` | `/api/items/:id/movements` | `GET` |
| `get-item-transactions` | `/api/items/:id/transactions` | `GET` |
| **المخازن** | | |
| `get-warehouses` | `/api/warehouses` | `GET` |
| `add-warehouse` | `/api/warehouses` | `POST` |
| `update-warehouse` | `/api/warehouses/:id` | `PUT` |
| `delete-warehouse` | `/api/warehouses/:id` | `DELETE` |
| **أرصدة أول المدة** | | |
| `get-opening-balances` | `/api/opening-balances` | `GET` |
| `add-opening-balance` | `/api/opening-balances` | `POST` |
| `save-opening-balances` | `/api/opening-balances/bulk` | `POST` |
| `update-opening-balance` | `/api/opening-balances/:id` | `PUT` |
| `delete-opening-balance` | `/api/opening-balances/:id` | `DELETE` |
| `get-opening-balance-groups` | `/api/opening-balance-groups` | `GET` |
| `add-opening-balance-group` | `/api/opening-balance-groups` | `POST` |
| `get-opening-balance-group` | `/api/opening-balance-groups/:id` | `GET` |
| `get-group-details` | `/api/opening-balance-groups/:id/details` | `GET` |
| `update-opening-balance-group` | `/api/opening-balance-groups/:id` | `PUT` |
| `delete-opening-balance-group` | `/api/opening-balance-groups/:id` | `DELETE` |
| **العملاء** | | |
| `get-customers` | `/api/customers` | `GET` |
| `add-customer` | `/api/customers` | `POST` |
| `update-customer` | `/api/customers/:id` | `PUT` |
| `delete-customer` | `/api/customers/:id` | `DELETE` |
| `get-customer-sales-invoices` | `/api/customers/:id/sales-invoices` | `GET` |
| `get-customer-full-report` | `/api/customers/:id/report` | `GET` |
| `get-customer-detailed-statement` | `/api/customers/:id/statement` | `GET` |
| `get-debtor-creditor-report` | `/api/reports/debtor-creditor` | `GET` |
| **الموردين** | | |
| `get-suppliers` | `/api/suppliers` | `GET` |
| `add-supplier` | `/api/suppliers` | `POST` |
| `delete-supplier` | `/api/suppliers/:id` | `DELETE` |
| `get-supplier-purchase-invoices` | `/api/suppliers/:id/purchase-invoices` | `GET` |
| **فواتير الشراء** | | |
| `get-purchase-invoices` | `/api/purchase-invoices` | `GET` |
| `save-purchase-invoice` | `/api/purchase-invoices` | `POST` |
| `update-purchase-invoice` | `/api/purchase-invoices/:id` | `PUT` |
| **فواتير البيع** | | |
| `get-sales-invoices` | `/api/sales-invoices` | `GET` |
| `save-sales-invoice` | `/api/sales-invoices` | `POST` |
| `update-sales-invoice` | `/api/sales-invoices/:id` | `PUT` |
| **أدوات الفواتير** | | |
| `get-next-invoice-number` | `/api/invoices/next-number?type=` | `GET` |
| `get-invoice-with-details` | `/api/invoices/:id/details` | `GET` |
| `get-invoice-items-for-return` | `/api/invoices/:id/returnable-items` | `GET` |
| `delete-invoice` | `/api/invoices/:id` | `DELETE` |
| **الخزينة** | | |
| `get-treasury-balance` | `/api/treasury/balance` | `GET` |
| `get-treasury-transactions` | `/api/treasury/transactions` | `GET` |
| `add-treasury-transaction` | `/api/treasury/transactions` | `POST` |
| `update-treasury-transaction` | `/api/treasury/transactions/:id` | `PUT` |
| `delete-treasury-transaction` | `/api/treasury/transactions/:id` | `DELETE` |
| **مردودات البيع** | | |
| `get-sales-returns` | `/api/sales-returns` | `GET` |
| `save-sales-return` | `/api/sales-returns` | `POST` |
| `delete-sales-return` | `/api/sales-returns/:id` | `DELETE` |
| **مردودات الشراء** | | |
| `get-purchase-returns` | `/api/purchase-returns` | `GET` |
| `save-purchase-return` | `/api/purchase-returns` | `POST` |
| `delete-purchase-return` | `/api/purchase-returns/:id` | `DELETE` |
| **لوحة التحكم** | | |
| `get-dashboard-stats` | `/api/dashboard/stats` | `GET` |
| **التقارير** | | |
| `get-all-reports` | `/api/reports` | `GET` |
| **الإعدادات** | | |
| `get-settings` | `/api/settings` | `GET` |
| `save-settings` | `/api/settings` | `PUT` |
| **النسخ الاحتياطي** | | |
| `backup-database` | `/api/admin/backup` | `POST` |
| `restore-database` | `/api/admin/restore` | `POST` |
| **الصحة** | | |
| `backend-health-check` | `/api/health` | `GET` |

</details>

#### بنية المجلدات الجديدة

```
backend/src/
├── routes/
│   ├── auth.routes.js
│   ├── units.routes.js
│   ├── items.routes.js
│   ├── warehouses.routes.js
│   ├── openingBalances.routes.js
│   ├── customers.routes.js
│   ├── suppliers.routes.js
│   ├── purchases.routes.js
│   ├── sales.routes.js
│   ├── salesReturns.routes.js
│   ├── purchaseReturns.routes.js
│   ├── treasury.routes.js
│   ├── invoices.routes.js
│   ├── reports.routes.js
│   ├── dashboard.routes.js
│   ├── settings.routes.js
│   ├── admin.routes.js
│   └── index.js          ← router aggregator
├── controllers/           ← business logic (from current handlers)
│   └── (same 18 files)
├── validators/            ← Joi/Zod schemas
│   └── (per resource)
├── middleware/
│   ├── authenticate.js
│   ├── authorize.js
│   ├── tenantContext.js
│   ├── rateLimiter.js
│   ├── errorHandler.js
│   └── requestLogger.js
└── utils/
    ├── encryption.js
    ├── pagination.js
    └── response.js
```

#### المخرجات

| المخرج | الوصف |
|--------|-------|
| `backend/src/routes/` | 17+ route files |
| `backend/src/controllers/` | 18 controller files (refactored from handlers) |
| `backend/src/validators/` | Input validation schemas |
| `backend/src/middleware/` | 6 middleware files |

---

### 📋 المرحلة 4: Offline Support & Sync Engine
**المدة**: 10 أيام | **الأولوية**: 🟡 مهمة | **التبعيات**: المرحلة 3

#### المهام

- [ ] **4.1** تنفيذ IndexedDB local cache layer (مرآة لكل البيانات)
- [ ] **4.2** تنفيذ Service Worker للـ offline-first
- [ ] **4.3** تنفيذ operations queue (عمليات معلقة أثناء عدم الاتصال)
- [ ] **4.4** تنفيذ sync algorithm (pull + push + conflict detection)
- [ ] **4.5** تنفيذ conflict resolution strategies
- [ ] **4.6** تنفيذ background sync كل 30 ثانية

#### خوارزمية التزامن

```
┌──────────────────────────────────────────────────────────────┐
│                     Sync Cycle (كل 30 ثانية)                  │
│                                                              │
│  1. CHECK connection status                                  │
│     └─ Offline? → queue operations locally, EXIT             │
│                                                              │
│  2. PUSH pending local changes                               │
│     ├─ For each queued operation:                            │
│     │   POST /api/sync/push  {entity, action, data, ts}     │
│     │   ├─ 200 OK → remove from queue                       │
│     │   └─ 409 CONFLICT → add to conflicts list             │
│     └─ Report push results                                   │
│                                                              │
│  3. PULL remote changes since last_sync_at                   │
│     GET /api/sync/pull?since={last_sync_at}                  │
│     └─ Apply each change to IndexedDB                        │
│                                                              │
│  4. RESOLVE conflicts (if any)                               │
│     ├─ Auto-merge if non-overlapping fields                  │
│     └─ Show dialog to user if conflicting fields             │
│                                                              │
│  5. UPDATE last_sync_at                                      │
└──────────────────────────────────────────────────────────────┘
```

#### Conflict Resolution Strategies

| النوع | الاستراتيجية |
|-------|-------------|
| حقول مختلفة | Auto-merge (دمج تلقائي) |
| نفس الحقل — same value | No conflict |
| نفس الحقل — different values | **Server wins** (default) مع إشعار للمستخدم |
| حذف vs تعديل | الحذف يفوز مع أرشفة |
| إنشاء متزامن | كلاهما يُحفظ بـ IDs مختلفة |

#### المخرجات

| المخرج | الوصف |
|--------|-------|
| `frontend/src/services/syncEngine.js` | محرك التزامن الرئيسي |
| `frontend/src/services/offlineStorage.js` | IndexedDB wrapper |
| `frontend/src/services/operationQueue.js` | قائمة العمليات المعلقة |
| `backend/src/sync/syncController.js` | endpoints التزامن |
| `backend/src/sync/conflictResolver.js` | حل التعارضات |

---

### 📋 المرحلة 5: Real-Time Updates (WebSocket)
**المدة**: 5 أيام | **الأولوية**: 🟡 مهمة | **التبعيات**: المرحلة 3

#### المهام

- [ ] **5.1** تثبيت وإعداد Socket.io على Backend
- [ ] **5.2** تنفيذ tenant rooms (كل مستأجر في room منفصل)
- [ ] **5.3** تنفيذ event broadcasting لكل عملية CRUD
- [ ] **5.4** تنفيذ presence system (المستخدمين النشطين)
- [ ] **5.5** تنفيذ reconnection + fallback logic

#### الأحداث (Events)

| Event | الوصف | Payload |
|-------|-------|---------|
| `invoice:created` | فاتورة جديدة | `{ type, invoiceId, number }` |
| `invoice:updated` | تعديل فاتورة | `{ type, invoiceId }` |
| `invoice:deleted` | حذف فاتورة | `{ type, invoiceId }` |
| `item:updated` | تعديل صنف/مخزون | `{ itemId, field }` |
| `customer:updated` | تعديل عميل/رصيد | `{ customerId }` |
| `treasury:transaction` | حركة خزينة | `{ transactionId, type }` |
| `stock:changed` | تغير مخزون | `{ itemId, newQty }` |
| `user:joined` | مستخدم اتصل | `{ userId, username, page }` |
| `user:left` | مستخدم غادر | `{ userId }` |
| `sync:complete` | تزامن اكتمل | `{ timestamp }` |

#### المخرجات

| المخرج | الوصف |
|--------|-------|
| `backend/src/websocket/socketServer.js` | إعداد Socket.io |
| `backend/src/websocket/eventBroadcaster.js` | بث الأحداث |
| `frontend/src/services/realtimeClient.js` | عميل WebSocket |

---

### 📋 المرحلة 6: تعديل Frontend
**المدة**: 14 يوم | **الأولوية**: 🔴 حرجة | **التبعيات**: المرحلة 3, 4, 5

#### المهام

- [ ] **6.1** إنشاء `APIClient` layer يحل محل `window.electronAPI.*`
- [ ] **6.2** تعديل **18 صفحة** (50+ ملف JS) لاستخدام `APIClient`
- [ ] **6.3** إضافة loading states / skeletons لكل fetch
- [ ] **6.4** إضافة offline indicators + banners
- [ ] **6.5** تنفيذ Login/Register screens
- [ ] **6.6** إضافة sync status indicator في الـ navbar
- [ ] **6.7** إنشاء نسخة Web (يمكن تشغيلها في المتصفح بدون Electron)

#### API Client Layer

```javascript
// Before (Electron IPC):
const items = await window.electronAPI.getItems();

// After (API Client — يعمل في Electron و Browser):
const items = await APIClient.items.getAll();
// ↳ internally: GET /api/items (online) OR IndexedDB (offline)
```

#### خطة تعديل الصفحات

| الصفحة | عدد IPC calls | ملفات JS للتعديل | التعقيد |
|--------|:------------:|:----------------:|:-------:|
| `dashboard/` | 1 | 1 | 🟢 بسيط |
| `items/` | 4 | 2 | 🟡 متوسط |
| `customers/` | 4 | 1 | 🟡 متوسط |
| `sales/` | 8 | 1 | 🔴 معقد |
| `purchases/` | 8 | 1 | 🔴 معقد |
| `finance/` | 3 | 1 | 🟡 متوسط |
| `inventory/` | 3 | 1 | 🟡 متوسط |
| `payments/` | 5 | 2 | 🟡 متوسط |
| `sales-returns/` | 5 | 1 | 🟡 متوسط |
| `purchase-returns/` | 5 | 1 | 🟡 متوسط |
| `opening-balance/` | 11 | 1 | 🔴 معقد |
| `customer-reports/` | 6 | 1 | 🟡 متوسط |
| `reports/` | 2 | 2 | 🟢 بسيط |
| `settings/` | 4 | 1 | 🟡 متوسط |
| `auth/` | 3 | 1 | 🟡 متوسط |
| `auth-users/` | 4 | 1 | 🟡 متوسط |
| `invite/` | 2 | 1 | 🟢 بسيط |
| `search/` | 0 | 1 | 🟢 بسيط |

#### المخرجات

| المخرج | الوصف |
|--------|-------|
| `frontend/src/services/apiClient.js` | HTTP client wrapper |
| `frontend/src/services/authManager.js` | JWT storage + auto-refresh |
| تعديل 18 صفحة (50+ ملف JS) | استبدال `electronAPI` → `APIClient` |
| UI components جديدة | Login, Register, Sync Status, Offline Banner |

---

### 📋 المرحلة 7: Admin Dashboard & Monitoring
**المدة**: 4 أيام | **الأولوية**: 🟢 عادية | **التبعيات**: المرحلة 3

#### المهام

- [ ] **7.1** إنشاء Super Admin panel (إدارة المستأجرين)
- [ ] **7.2** إحصائيات الاستخدام (tenants, users, invoices, storage)
- [ ] **7.3** إدارة الاشتراكات والباقات
- [ ] **7.4** Logs viewer + error viewer
- [ ] **7.5** تنفيذ monitoring: response times, error rates, DB stats

#### Endpoints إدارية

| Method | Path | الوصف |
|--------|------|-------|
| `GET` | `/api/admin/tenants` | قائمة كل المستأجرين |
| `GET` | `/api/admin/tenants/:id/stats` | إحصائيات مستأجر |
| `PATCH` | `/api/admin/tenants/:id` | تعديل حالة/باقة |
| `GET` | `/api/admin/stats` | إحصائيات عامة |
| `GET` | `/api/admin/logs` | سجل الأحداث |

#### المخرجات

| المخرج | الوصف |
|--------|-------|
| `backend/src/admin/` | Admin routes + controllers |
| `frontend/views/admin/` | صفحة Admin Dashboard |

---

### 📋 المرحلة 8: Testing & Security
**المدة**: 7 أيام | **الأولوية**: 🔴 حرجة | **التبعيات**: المرحلة 6

#### المهام

- [ ] **8.1** Security audit كامل (OWASP Top 10)
- [ ] **8.2** كتابة unit tests للـ API endpoints (80+ test)
- [ ] **8.3** كتابة integration tests للـ sync engine
- [ ] **8.4** Load testing (100+ concurrent users per tenant)
- [ ] **8.5** Offline scenario testing
- [ ] **8.6** Penetration testing (SQL injection, XSS, CSRF, IDOR)
- [ ] **8.7** إعداد automated backup + restore testing

#### Security Checklist

| البند | التفاصيل | الأولوية |
|-------|----------|----------|
| SQL Injection | Parameterized queries (pg library) | 🔴 حرج |
| XSS | Input sanitization + CSP headers | 🔴 حرج |
| CSRF | SameSite cookies + CSRF tokens | 🔴 حرج |
| Rate Limiting | express-rate-limit (100 req/min general, 5/min auth) | 🔴 حرج |
| Input Validation | Joi/Zod schemas on every endpoint | 🔴 حرج |
| JWT Security | Short expiry (15min), httpOnly refresh, rotation | 🔴 حرج |
| Password Policy | Min 8 chars, bcrypt rounds=12 | 🟡 مهم |
| HTTPS Only | HSTS header, redirect HTTP → HTTPS | 🔴 حرج |
| Tenant Isolation | RLS + middleware double-check | 🔴 حرج |
| IDOR Prevention | Verify resource ownership in every query | 🔴 حرج |
| Data Encryption | AES-256 for sensitive fields | 🟡 مهم |
| Audit Logging | Log all write operations + auth events | 🟡 مهم |
| Dependency Audit | `npm audit` + Snyk | 🟡 مهم |
| Error Handling | Never expose stack traces in production | 🔴 حرج |

#### المخرجات

| المخرج | الوصف |
|--------|-------|
| `backend/tests/` | Unit + integration tests |
| `docs/security-checklist.md` | Security audit results |
| `scripts/backup-cron.sh` | Automated backup script |
| `scripts/load-test.js` | Load testing script |

---

### 📋 المرحلة 9: Deployment
**المدة**: 3 أيام | **الأولوية**: 🔴 حرجة | **التبعيات**: المرحلة 8

#### المهام

- [ ] **9.1** اختيار وإعداد VPS
- [ ] **9.2** تثبيت PostgreSQL 15+ و Redis و Node.js 20+ و PM2 و Nginx
- [ ] **9.3** شراء Domain + إعداد DNS + SSL (Let's Encrypt)
- [ ] **9.4** إعداد ملف `.env` production
- [ ] **9.5** إعداد CI/CD pipeline (Git push → auto deploy)
- [ ] **9.6** إعداد health checks + uptime monitoring
- [ ] **9.7** إعداد log rotation + error alerting

#### Environment Configuration

```env
# Production .env
NODE_ENV=production
PORT=4000

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/accounting_saas
DB_POOL_MIN=2
DB_POOL_MAX=20

# Auth
JWT_SECRET=<random-64-chars>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
BCRYPT_ROUNDS=12

# Redis
REDIS_URL=redis://localhost:6379

# Security
CORS_ORIGIN=https://app.yourapp.com
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=100

# Monitoring
SENTRY_DSN=<optional>
LOG_LEVEL=info
```

#### بنية السيرفر

```
VPS (4GB RAM, 2 CPUs)
├── Nginx (reverse proxy + SSL + static files)
│   ├── app.yourapp.com → frontend SPA
│   └── api.yourapp.com → Node.js backend (port 4000)
├── Node.js + PM2 (backend API, 2 instances, cluster mode)
├── PostgreSQL 15 (database)
├── Redis (session cache + rate limiting)
└── Cron Jobs
    ├── Daily backup → external storage (03:00 AM)
    └── SSL renewal → Let's Encrypt (monthly)
```

#### المخرجات

| المخرج | الوصف |
|--------|-------|
| Production server | `https://api.yourapp.com` |
| Frontend hosting | `https://app.yourapp.com` |
| `deploy.sh` | Deployment script |
| `ecosystem.config.js` | PM2 configuration |
| Nginx config files | Reverse proxy + SSL |

---

### 📋 المرحلة 10: Documentation & Training
**المدة**: 3 أيام | **الأولوية**: 🟢 عادية | **التبعيات**: المرحلة 9

#### المهام

- [ ] **10.1** API documentation (Swagger / OpenAPI 3.0)
- [ ] **10.2** User guide (PDF + web)
- [ ] **10.3** Admin guide
- [ ] **10.4** Developer onboarding guide
- [ ] **10.5** Troubleshooting + FAQ
- [ ] **10.6** فيديوهات تعليمية (اختياري)

#### المخرجات

| المخرج | الوصف |
|--------|-------|
| `/docs/api/` | Swagger/OpenAPI spec |
| `/docs/user-guide.md` | دليل المستخدم |
| `/docs/admin-guide.md` | دليل المدير |
| `/docs/developer-guide.md` | دليل المطور |

---

## 4 — الجدول الزمني (Timeline)

```
الأسبوع 1  ║████████████████████████████║ المرحلة 0 + 1 (تحضير + DB)
الأسبوع 2  ║████████████████████████████║ المرحلة 2 + 3-start (Auth + API)
الأسبوع 3  ║████████████████████████████║ المرحلة 3-cont (REST API)
الأسبوع 4  ║████████████████████████████║ المرحلة 4-start (Sync Engine)
الأسبوع 5  ║████████████████████████████║ المرحلة 4-cont + 5 (Sync + WebSocket)
الأسبوع 6  ║████████████████████████████║ المرحلة 5-cont + 6-start (WS + Frontend)
الأسبوع 7  ║████████████████████████████║ المرحلة 6-cont (Frontend pages 1-9)
الأسبوع 8  ║████████████████████████████║ المرحلة 6-cont (Frontend pages 10-18)
الأسبوع 9  ║████████████████████████████║ المرحلة 7 + 8-start (Admin + Testing)
الأسبوع 10 ║████████████████████████████║ المرحلة 8-cont (Security + Load test)
الأسبوع 11 ║████████████████████████████║ المرحلة 9 (Deployment)
الأسبوع 12 ║████████████████████████████║ المرحلة 10 + Buffer (Docs + fixes)
```

| المرحلة | المدة | يوم بداية | يوم نهاية | الأولوية |
|---------|:-----:|:---------:|:---------:|:--------:|
| 0. التحضير | 1 يوم | 1 | 1 | 🔴 حرجة |
| 1. قاعدة البيانات | 4 أيام | 2 | 5 | 🔴 حرجة |
| 2. Authentication | 3 أيام | 6 | 8 | 🔴 حرجة |
| 3. REST API | 7 أيام | 9 | 15 | 🔴 حرجة |
| 4. Offline Sync | 10 أيام | 16 | 25 | 🟡 مهمة |
| 5. Real-time | 5 أيام | 26 | 30 | 🟡 مهمة |
| 6. Frontend | 14 يوم | 31 | 44 | 🔴 حرجة |
| 7. Dashboard | 4 أيام | 45 | 48 | 🟢 عادية |
| 8. Testing | 7 أيام | 49 | 55 | 🔴 حرجة |
| 9. Deployment | 3 أيام | 56 | 58 | 🔴 حرجة |
| 10. Documentation | 3 أيام | 59 | 61 | 🟢 عادية |
| **الإجمالي** | **61 يوم** | | | |

---

## 5 — التكاليف التشغيلية

### تكاليف البنية التحتية (شهرياً)

| البند | المنخفض | المتوسط | الملاحظات |
|-------|:-------:|:-------:|-----------|
| VPS (4GB RAM, 2 CPUs) | $20 | $40 | DigitalOcean / Hetzner |
| PostgreSQL hosting | $15 | $30 | أو self-hosted على VPS |
| Redis | $0 | $15 | Self-hosted مجاني |
| SSL Certificate | $0 | $0 | Let's Encrypt |
| Domain | $1 | $1 | ~$12/year |
| Backup storage | $5 | $10 | S3/Spaces |
| **الإجمالي الشهري** | **$41** | **$96** | |

### أدوات اختيارية

| الأداة | التكلفة/شهر | الفائدة |
|--------|:-----------:|---------|
| Sentry (error tracking) | $26 | تتبع الأخطاء تلقائياً |
| UptimeRobot (monitoring) | $0-7 | مراقبة uptime مجانية |
| Cloudflare (CDN + DDoS) | $0 | حماية + سرعة مجانية |
| GitHub Actions (CI/CD) | $0 | 2000 دقيقة/شهر مجاناً |

---

## 6 — المخاطر وخطط التخفيف

| # | المخاطرة | الاحتمال | التأثير | خطة التخفيف |
|---|----------|:--------:|:-------:|------------|
| 1 | فقدان بيانات أثناء migration من SQLite | 🟡 متوسط | 🔴 عالي | نسخ احتياطية متعددة + dry-run + validation script |
| 2 | تعارضات sync معقدة تسبب بيانات خاطئة | 🟡 متوسط | 🔴 عالي | Server-wins strategy + audit log + rollback capability |
| 3 | Tenant data leakage (تسريب بين مستأجرين) | 🟢 منخفض | 🔴 كارثي | RLS + middleware double-check + integration tests |
| 4 | أداء بطيء معكثرة المستأجرين | 🟡 متوسط | 🟡 متوسط | Connection pooling + indexing + query optimization + caching |
| 5 | الـ Frontend يحتاج إعادة كتابة كاملة | 🟢 منخفض | 🟡 متوسط | API Client layer يعمل كـ adapter — الصفحات نفسها لا تتغير |
| 6 | WebSocket connection drops متكررة | 🟡 متوسط | 🟢 منخفض | Auto-reconnect + exponential backoff + fallback to polling |
| 7 | DDoS attack على API | 🟡 متوسط | 🟡 متوسط | Cloudflare + rate limiting + fail2ban |
| 8 | database corruption | 🟢 منخفض | 🔴 كارثي | Daily backups + WAL mode + point-in-time recovery |

---

## 7 — معايير القبول (Acceptance Criteria)

### ✅ الحد الأدنى للإطلاق (MVP)

- [ ] مستأجر جديد يقدر يسجّل ويدخل من المتصفح
- [ ] كل الوظائف الحالية (80 IPC channel) تعمل عبر REST API
- [ ] بيانات كل مستأجر معزولة بالكامل (لا يرى بيانات غيره)
- [ ] نظام RBAC مع 4 أدوار يعمل بشكل صحيح
- [ ] نظام الدعوات الديناميكي يعمل
- [ ] التطبيق يعمل offline ويتزامن عند عودة الاتصال
- [ ] تحديثات فورية عبر WebSocket بين مستخدمي نفس المستأجر
- [ ] HTTPS + SSL على الإنتاج
- [ ] نسخ احتياطي يومي تلقائي
- [ ] لا توجد ثغرات أمنية حرجة (OWASP Top 10)

### 📊 مقاييس الأداء المطلوبة

| المقياس | الهدف |
|---------|-------|
| API response time (p95) | < 200ms |
| WebSocket latency | < 100ms |
| Time to first sync | < 5 ثوان |
| Concurrent users per tenant | 50+ |
| Total concurrent tenants | 100+ |
| Uptime | 99.5%+ |
| Backup frequency | كل 24 ساعة |

---

> **ملاحظة**: هذا المستند مبني على تحليل فعلي للكود المصدري الحالي للنظام. كل الأرقام (80 قناة، 19 جدول، 18 صفحة) هي أرقام حقيقية مستخرجة من المشروع وليست تقديرات.
