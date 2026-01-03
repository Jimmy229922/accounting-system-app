let customers = [];
let filteredCustomers = [];

document.addEventListener('DOMContentLoaded', () => {
    renderPage();
    loadReport();
    setupEventListeners();
});

function renderPage() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <nav class="top-nav">
            <div class="nav-brand">نظام المحاسبة</div>
            <ul class="nav-links">
                <li><a href="../../dashboard/index.html">لوحة التحكم</a></li>
                <li class="dropdown">
                    <a href="#">البيانات الأساسية</a>
                    <div class="dropdown-content">
                        <a href="../../items/units.html">الوحدات</a>
                        <a href="../../items/items.html">الأصناف</a>
                        <a href="../../customers/index.html">العملاء والموردين</a>
                        <a href="../../opening-balance/index.html">بيانات أول المدة</a>
                    </div>
                </li>
                <li><a href="../../sales/index.html">المبيعات</a></li>
                <li><a href="../../purchases/index.html">المشتريات</a></li>
                <li><a href="../../inventory/index.html">المخزن</a></li>
                <li><a href="../../finance/index.html">المالية</a></li>
                <li><a href="../../payments/receipt.html">تحصيل من عميل</a></li>
                <li><a href="../../payments/payment.html">سداد لمورد</a></li>
                <li class="dropdown">
                    <a href="#" class="active">التقارير</a>
                    <div class="dropdown-content">
                        <a href="../index.html">التقارير العامة</a>
                        <a href="../../customer-reports/index.html">تقارير العملاء</a>
                        <a href="index.html" class="active">كشف المدين والدائن</a>
                    </div>
                </li>
                <li><a href="../../settings/index.html">الإعدادات</a></li>
            </ul>
        </nav>

        <div class="content">
            <div class="page-header">
                <h1 class="page-title" style="font-size: 1.8rem; color: var(--primary-color); font-weight: bold; margin-bottom: 30px;">كشف المدين والدائن</h1>
            </div>

            <div class="summary-cards">
                <div class="summary-card">
                    <div class="summary-title">إجمالي المدين (لنا)</div>
                    <div class="summary-value text-green" id="totalDebtor">0.00</div>
                </div>
                <div class="summary-card">
                    <div class="summary-title">إجمالي الدائن (علينا)</div>
                    <div class="summary-value text-red" id="totalCreditor">0.00</div>
                </div>
                <div class="summary-card">
                    <div class="summary-title">صافي الرصيد</div>
                    <div class="summary-value" id="netBalance">0.00</div>
                </div>
            </div>

            <div class="filters-card">
                <div class="form-group">
                    <label>من تاريخ</label>
                    <input type="date" id="startDate" class="form-control">
                </div>
                <div class="form-group">
                    <label>إلى تاريخ</label>
                    <input type="date" id="endDate" class="form-control">
                </div>
                <div class="form-group">
                    <label>نوع الحساب</label>
                    <select id="typeFilter" class="form-control">
                        <option value="all">الكل</option>
                        <option value="customer">عملاء</option>
                        <option value="supplier">موردين</option>
                        <option value="both">عميل ومورد معاً</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>حالة الرصيد</label>
                    <select id="balanceStatusFilter" class="form-control">
                        <option value="all">الكل</option>
                        <option value="debtor">مدين (لنا)</option>
                        <option value="creditor">دائن (علينا)</option>
                        <option value="balanced">متزن (صفر)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>بحث بالاسم</label>
                    <input type="text" id="searchInput" class="form-control" placeholder="بحث باسم العميل/المورد...">
                </div>
                <div class="form-group" style="flex: 0;">
                    <button id="printBtn" class="btn-primary">طباعة التقرير</button>
                </div>
            </div>

            <div class="table-card">
                <table class="table">
                    <thead>
                        <tr>
                            <th>الاسم</th>
                            <th>النوع</th>
                            <th>رصيد افتتاحي</th>
                            <th>مدين (لنا)</th>
                            <th>دائن (علينا)</th>
                            <th>رصيد ختامي</th>
                            <th>الحالة</th>
                        </tr>
                    </thead>
                    <tbody id="reportTableBody">
                        <!-- Rows will be populated here -->
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function loadReport() {
    try {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        customers = await window.electronAPI.getDebtorCreditorReport({ startDate, endDate });
        filterAndRender();
    } catch (error) {
        console.error('Error loading report:', error);
        alert('حدث خطأ أثناء تحميل البيانات');
    }
}

function setupEventListeners() {
    document.getElementById('typeFilter').addEventListener('change', filterAndRender);
    document.getElementById('balanceStatusFilter').addEventListener('change', filterAndRender);
    document.getElementById('searchInput').addEventListener('input', filterAndRender);
    document.getElementById('startDate').addEventListener('change', loadReport);
    document.getElementById('endDate').addEventListener('change', loadReport);
    document.getElementById('printBtn').addEventListener('click', () => window.print());
}

function filterAndRender() {
    const typeFilter = document.getElementById('typeFilter').value;
    const balanceStatusFilter = document.getElementById('balanceStatusFilter').value;
    const searchText = document.getElementById('searchInput').value.toLowerCase();

    filteredCustomers = customers.filter(customer => {
        // Type Filter
        if (typeFilter !== 'all' && customer.type !== typeFilter) return false;

        // Search Filter
        if (searchText && !customer.name.toLowerCase().includes(searchText)) return false;

        // Balance Status Filter
        // Use closingBalance for status
        const balance = customer.closingBalance || 0;
        let status = 'balanced';
        
        if (customer.type === 'customer' || customer.type === 'both') {
            if (balance > 0) status = 'debtor'; // They owe us
            else if (balance < 0) status = 'creditor'; // We owe them
        } else { // supplier
            if (balance > 0) status = 'creditor'; // We owe them
            else if (balance < 0) status = 'debtor'; // They owe us
        }

        if (balanceStatusFilter !== 'all' && status !== balanceStatusFilter) return false;

        return true;
    });

    renderTable();
    updateSummary();
}

function renderTable() {
    const tbody = document.getElementById('reportTableBody');
    tbody.innerHTML = '';

    if (filteredCustomers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">لا توجد بيانات</td></tr>';
        return;
    }

    filteredCustomers.forEach(customer => {
        const tr = document.createElement('tr');
        const balance = customer.closingBalance || 0;
        let statusText = 'متزن';
        let statusClass = 'badge-balanced';
        let displayBalance = Math.abs(balance).toFixed(2);

        if (customer.type === 'customer' || customer.type === 'both') {
            if (balance > 0) {
                statusText = 'مدين (لنا)';
                statusClass = 'badge-debtor';
            } else if (balance < 0) {
                statusText = 'دائن (علينا)';
                statusClass = 'badge-creditor';
            }
        } else { // supplier
            if (balance > 0) {
                statusText = 'دائن (علينا)';
                statusClass = 'badge-creditor';
            } else if (balance < 0) {
                statusText = 'مدين (لنا)';
                statusClass = 'badge-debtor';
            }
        }

        let typeText = 'عميل';
        if (customer.type === 'supplier') typeText = 'مورد';
        if (customer.type === 'both') typeText = 'عميل ومورد';

        tr.innerHTML = `
            <td>${customer.name}</td>
            <td>${typeText}</td>
            <td>${(customer.openingBalance || 0).toFixed(2)}</td>
            <td>${(customer.debitAmount || 0).toFixed(2)}</td>
            <td>${(customer.creditAmount || 0).toFixed(2)}</td>
            <td style="font-weight: bold; direction: ltr;">${displayBalance}</td>
            <td><span class="badge ${statusClass}">${statusText}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function updateSummary() {
    // Calculate totals
    let totalDebtor = 0;
    let totalCreditor = 0;

    filteredCustomers.forEach(customer => {
        const balance = customer.closingBalance || 0;
        if (customer.type === 'customer' || customer.type === 'both') {
            if (balance > 0) totalDebtor += balance;
            else if (balance < 0) totalCreditor += Math.abs(balance);
        } else { // supplier
            if (balance > 0) totalCreditor += balance;
            else if (balance < 0) totalDebtor += Math.abs(balance);
        }
    });

    document.getElementById('totalDebtor').textContent = totalDebtor.toFixed(2);
    document.getElementById('totalCreditor').textContent = totalCreditor.toFixed(2);
    
    const net = totalDebtor - totalCreditor;
    const netElement = document.getElementById('netBalance');
    netElement.textContent = Math.abs(net).toFixed(2) + (net >= 0 ? ' (لنا)' : ' (علينا)');
    netElement.className = 'summary-value ' + (net >= 0 ? 'text-green' : 'text-red');
}
