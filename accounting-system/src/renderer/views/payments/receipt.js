document.addEventListener('DOMContentLoaded', () => {
    renderPage();
    loadCustomers();
    setupEventListeners();
});

function renderPage() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <nav class="top-nav">
            <div class="nav-brand">نظام المحاسبة</div>
            <ul class="nav-links">
                <li><a href="../../views/dashboard/index.html">لوحة التحكم</a></li>
                <li class="dropdown">
                    <a href="#">البيانات الأساسية</a>
                    <div class="dropdown-content">
                        <a href="../../views/items/units.html">الوحدات</a>
                        <a href="../../views/items/items.html">الأصناف</a>
                        <a href="../../views/customers/index.html">العملاء والموردين</a>
                        <a href="../../views/opening-balance/index.html">بيانات أول المدة</a>
                    </div>
                </li>
                <li><a href="../../views/sales/index.html">المبيعات</a></li>
                <li><a href="../../views/purchases/index.html">المشتريات</a></li>
                <li><a href="../../views/inventory/index.html">المخزن</a></li>
                <li><a href="../../views/finance/index.html">المالية</a></li>
                <li><a href="receipt.html" class="active">تحصيل من عميل</a></li>
                <li><a href="payment.html">سداد لمورد</a></li>
                <li class="dropdown">
                    <a href="#">التقارير</a>
                    <div class="dropdown-content">
                        <a href="../../views/reports/index.html">التقارير العامة</a>
                        <a href="../../views/customer-reports/index.html">تقارير العملاء</a>
                        <a href="../../views/reports/debtor-creditor/index.html">كشف المدين والدائن</a>
                    </div>
                </li>
                <li><a href="../../views/settings/index.html">الإعدادات</a></li>
            </ul>
        </nav>

        <div class="content">
            <div class="page-header">
                <h1 class="page-title" style="margin-bottom: 20px; color: var(--primary-color);">تحصيل نقدية من عميل</h1>
            </div>

            <div class="form-card">
                <form id="receiptForm">
                    <div class="form-group">
                        <label>التاريخ</label>
                        <input type="date" id="date" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>العميل</label>
                        <select id="customer" class="form-control" required>
                            <option value="">اختر العميل...</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>المبلغ</label>
                        <input type="number" id="amount" class="form-control" step="0.01" min="0" required>
                    </div>
                    <div class="form-group">
                        <label>البيان / ملاحظات</label>
                        <textarea id="description" class="form-control" rows="3" placeholder="مثال: دفعة من الحساب"></textarea>
                    </div>
                    <button type="submit" class="btn-primary">حفظ العملية</button>
                </form>
            </div>
        </div>
    `;
    
    document.getElementById('date').valueAsDate = new Date();
}

async function loadCustomers() {
    try {
        const customers = await window.electronAPI.getCustomers();
        const select = document.getElementById('customer');
        // Filter for customers or both
        const validCustomers = customers.filter(c => c.type === 'customer' || c.type === 'both');
        
        validCustomers.forEach(c => {
            const option = document.createElement('option');
            option.value = c.id;
            option.textContent = c.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error(error);
    }
}

function setupEventListeners() {
    document.getElementById('receiptForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const data = {
            type: 'income',
            date: document.getElementById('date').value,
            customer_id: document.getElementById('customer').value,
            amount: parseFloat(document.getElementById('amount').value),
            description: document.getElementById('description').value || 'تحصيل نقدية'
        };

        try {
            const result = await window.electronAPI.addTreasuryTransaction(data);
            if (result.success) {
                alert('تم حفظ العملية بنجاح');
                window.location.href = '../../views/finance/index.html';
            } else {
                alert('حدث خطأ: ' + result.error);
            }
        } catch (error) {
            console.error(error);
            alert('حدث خطأ غير متوقع');
        }
    });
}
