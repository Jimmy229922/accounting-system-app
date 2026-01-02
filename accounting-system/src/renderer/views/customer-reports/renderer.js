let customerSelect, reportContainer, totalSalesEl, totalPurchasesEl, balanceEl, customerReportTableBody;

document.addEventListener('DOMContentLoaded', () => {
    renderPage();
    initializeElements();
    loadCustomers();
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
                <h1 class="page-title" style="font-size: 1.8rem; color: var(--primary-color); font-weight: bold; margin-bottom: 30px;">تقارير العملاء</h1>
            </div>

            <div class="selection-card">
                <h2 style="margin-bottom: 20px;">اختر العميل لعرض التقرير</h2>
                <select id="customerSelect" class="form-control">
                    <option value="">اختر العميل...</option>
                </select>
            </div>

            <div id="reportContainer" class="report-container">
                <div class="summary-cards">
                    <div class="summary-card">
                        <h3>إجمالي المبيعات</h3>
                        <div class="summary-value" id="totalSales">0.00</div>
                    </div>
                    <div class="summary-card">
                        <h3>إجمالي المشتريات</h3>
                        <div class="summary-value" id="totalPurchases">0.00</div>
                    </div>
                    <div class="summary-card">
                        <h3>الرصيد</h3>
                        <div class="summary-value" id="balance">0.00</div>
                    </div>
                </div>

                <div class="table-card">
                    <h3 style="padding: 20px; margin: 0; border-bottom: 1px solid #eee;">سجل العمليات</h3>
                    <table class="table">
                        <thead>
                            <tr>
                                <th>التاريخ</th>
                                <th>رقم الفاتورة</th>
                                <th>النوع</th>
                                <th>المبلغ</th>
                                <th>ملاحظات</th>
                                <th>إجراءات</th>
                            </tr>
                        </thead>
                        <tbody id="customerReportTableBody">
                            <!-- Rows will be populated here -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function initializeElements() {
    customerSelect = document.getElementById('customerSelect');
    reportContainer = document.getElementById('reportContainer');
    totalSalesEl = document.getElementById('totalSales');
    totalPurchasesEl = document.getElementById('totalPurchases');
    balanceEl = document.getElementById('balance');
    customerReportTableBody = document.getElementById('customerReportTableBody');

    customerSelect.addEventListener('change', () => {
        const customerId = customerSelect.value;
        if (customerId) {
            loadCustomerReport(customerId);
            reportContainer.style.display = 'block';
        } else {
            reportContainer.style.display = 'none';
        }
    });
}

async function loadCustomers() {
    const customers = await window.electronAPI.getCustomers();
    customerSelect.innerHTML = '<option value="">اختر العميل...</option>';
    customers.forEach(customer => {
        const option = document.createElement('option');
        option.value = customer.id;
        option.textContent = customer.name;
        customerSelect.appendChild(option);
    });

    // Check for URL param
    const urlParams = new URLSearchParams(window.location.search);
    const customerId = urlParams.get('customerId');
    if (customerId) {
        customerSelect.value = customerId;
        // Trigger change event manually if value was set
        if (customerSelect.value === customerId) {
            customerSelect.dispatchEvent(new Event('change'));
        }
    }
}

async function loadCustomerReport(customerId) {
    const report = await window.electronAPI.getCustomerFullReport(customerId);
    
    let totalSales = 0;
    let totalPurchases = 0;
    
    customerReportTableBody.innerHTML = '';
    
    if (report.length === 0) {
        customerReportTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">لا توجد عمليات لهذا العميل</td></tr>';
    } else {
        report.forEach(item => {
            const row = document.createElement('tr');
            const typeBadge = item.type === 'sales' 
                ? '<span class="badge badge-sales">مبيعات</span>' 
                : '<span class="badge badge-purchase">مشتريات</span>';
            
            if (item.type === 'sales') {
                totalSales += item.total_amount;
            } else {
                totalPurchases += item.total_amount;
            }

            row.innerHTML = `
                <td>${item.invoice_date}</td>
                <td>${item.invoice_number || item.id}</td>
                <td>${typeBadge}</td>
                <td>${item.total_amount.toFixed(2)}</td>
                <td>${item.notes || '-'}</td>
                <td>
                    <button class="btn btn-warning btn-sm" onclick="editInvoice(${item.id}, '${item.type}')">
                        <i class="fas fa-edit"></i> تعديل
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteInvoice(${item.id}, '${item.type}')">
                        <i class="fas fa-trash"></i> حذف
                    </button>
                </td>
            `;
            customerReportTableBody.appendChild(row);
        });
    }

    totalSalesEl.textContent = totalSales.toFixed(2);
    totalPurchasesEl.textContent = totalPurchases.toFixed(2);
    balanceEl.textContent = (totalSales - totalPurchases).toFixed(2);
}

window.editInvoice = (id, type) => {
    if (type === 'sales') {
        window.location.href = `../sales/index.html?editId=${id}`;
    } else if (type === 'purchase') {
        window.location.href = `../purchases/index.html?editId=${id}`;
    }
};

window.deleteInvoice = async (id, type) => {
    if (confirm('هل أنت متأكد من حذف هذه الفاتورة؟ سيتم إلغاء جميع التأثيرات المالية والمخزنية.')) {
        try {
            const result = await window.electronAPI.deleteInvoice(id, type);
            if (result.success) {
                alert('تم الحذف بنجاح');
                // Reload the report
                const customerId = document.getElementById('customerSelect').value;
                if (customerId) {
                    loadCustomerReport(customerId);
                }
            } else {
                alert('حدث خطأ أثناء الحذف: ' + result.error);
            }
        } catch (error) {
            console.error('Error deleting invoice:', error);
            alert('حدث خطأ غير متوقع');
        }
    }
};
