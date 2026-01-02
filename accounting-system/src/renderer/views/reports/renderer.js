let typeFilter, customerFilter, startDateInput, endDateInput, searchBtn, reportsTableBody;

document.addEventListener('DOMContentLoaded', () => {
    renderPage();
    initializeElements();
    
    loadCustomers();
    // Default to current month
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    startDateInput.valueAsDate = firstDay;
    endDateInput.valueAsDate = now;
    
    loadReports();
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
                <li><a href="../inventory/index.html">المخزن</a></li>
                <li><a href="../finance/index.html">المالية</a></li>
                <li class="dropdown">
                    <a href="#" class="active">التقارير</a>
                    <div class="dropdown-content">
                        <a href="../reports/index.html">التقارير العامة</a>
                        <a href="../customer-reports/index.html">تقارير العملاء</a>
                    </div>
                </li>
                <li><a href="../settings/index.html">الإعدادات</a></li>
            </ul>
        </nav>

            <div class="content">
                <div class="page-header">
                    <h1 class="page-title" style="font-size: 1.8rem; color: var(--primary-color); font-weight: bold; margin-bottom: 30px;">التقارير العامة</h1>
                </div>

            <div class="filters-card">
                <div class="form-group">
                    <label>نوع الفاتورة</label>
                    <select id="typeFilter" class="form-control">
                        <option value="all">الكل</option>
                        <option value="sales">مبيعات</option>
                        <option value="purchase">مشتريات</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>العميل / المورد</label>
                    <select id="customerFilter" class="form-control">
                        <option value="">الكل</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>من تاريخ</label>
                    <input type="date" id="startDate" class="form-control">
                </div>
                <div class="form-group">
                    <label>إلى تاريخ</label>
                    <input type="date" id="endDate" class="form-control">
                </div>
                <div class="form-group" style="flex: 0;">
                    <button id="searchBtn" class="btn-primary">بحث</button>
                </div>
            </div>

            <div class="table-card">
                <table class="table">
                    <thead>
                        <tr>
                            <th>التاريخ</th>
                            <th>رقم الفاتورة</th>
                            <th>النوع</th>
                            <th>العميل / المورد</th>
                            <th>المبلغ</th>
                            <th>إجراءات</th>
                        </tr>
                    </thead>
                    <tbody id="reportsTableBody">
                        <!-- Rows will be populated here -->
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function initializeElements() {
    typeFilter = document.getElementById('typeFilter');
    customerFilter = document.getElementById('customerFilter');
    startDateInput = document.getElementById('startDate');
    endDateInput = document.getElementById('endDate');
    searchBtn = document.getElementById('searchBtn');
    reportsTableBody = document.getElementById('reportsTableBody');

    searchBtn.addEventListener('click', loadReports);
    reportsTableBody.addEventListener('click', handleTableAction);
}

async function loadCustomers() {
    const customers = await window.electronAPI.getCustomers();
    // We want all customers and suppliers
    customerFilter.innerHTML = '<option value="">الكل</option>';
    customers.forEach(customer => {
        const option = document.createElement('option');
        option.value = customer.id;
        option.textContent = customer.name;
        customerFilter.appendChild(option);
    });
}

async function loadReports() {
    const filters = {
        type: typeFilter.value,
        customerId: customerFilter.value,
        startDate: startDateInput.value,
        endDate: endDateInput.value
    };

    const reports = await window.electronAPI.getAllReports(filters);
    renderReports(reports);
}

function renderReports(reports) {
    reportsTableBody.innerHTML = '';
    
    if (reports.length === 0) {
        reportsTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">لا توجد بيانات</td></tr>';
        return;
    }

    reports.forEach(report => {
        const row = document.createElement('tr');
        const typeBadge = report.type === 'sales' 
            ? '<span class="badge badge-sales">مبيعات</span>' 
            : '<span class="badge badge-purchase">مشتريات</span>';
            
        row.innerHTML = `
            <td>${report.invoice_date}</td>
            <td>${report.invoice_number || report.id}</td>
            <td>${typeBadge}</td>
            <td>${report.customer_name || '-'}</td>
            <td>${report.total_amount.toFixed(2)}</td>
            <td>
                <button class="btn-primary" data-action="edit" data-id="${report.id}" data-type="${report.type}" style="padding: 5px 10px; font-size: 0.8rem; margin-left: 5px;">تعديل</button>
                <button class="btn-danger" data-action="delete" data-id="${report.id}" data-type="${report.type}" style="padding: 5px 10px; font-size: 0.8rem;">حذف</button>
            </td>
        `;
        reportsTableBody.appendChild(row);
    });
}

function handleTableAction(event) {
    const actionBtn = event.target.closest('[data-action]');
    if (!actionBtn) return;

    const id = actionBtn.getAttribute('data-id');
    const type = actionBtn.getAttribute('data-type');
    const action = actionBtn.getAttribute('data-action');

    if (action === 'edit') {
        const page = type === 'sales' ? '../sales/index.html' : '../purchases/index.html';
        window.location.href = `${page}?editId=${id}`;
    }

    if (action === 'delete') {
        deleteInvoice(id, type);
    }
}

async function deleteInvoice(id, type) {
    if (confirm('هل أنت متأكد من حذف هذه الفاتورة؟ سيتم عكس جميع التأثيرات المالية والمخزنية.')) {
        const result = await window.electronAPI.deleteInvoice(Number(id), type);
        if (result.success) {
            alert('تم حذف الفاتورة بنجاح');
            loadReports();
        } else {
            alert('حدث خطأ أثناء الحذف: ' + result.error);
        }
    }
}
