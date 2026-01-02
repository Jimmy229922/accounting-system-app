let treasuryBalanceEl;
let transactionsTableBody;
let transactionForm;
let transDateInput;
let newTransactionBtn;

document.addEventListener('DOMContentLoaded', () => {
    renderPage();
    initializeElements();
    transDateInput.valueAsDate = new Date();
    loadFinanceData();
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
                <li><a href="#" class="active">المالية</a></li>
                <li class="dropdown">
                    <a href="#">التقارير</a>
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
                <div class="page-title">المالية والخزينة</div>
                <div class="action-bar">
                    <button class="btn btn-primary" id="newTransactionBtn" onclick="showForm()">
                        <span>+</span> تسجيل حركة يدوية
                    </button>
                </div>
            </div>

            <div class="stats-container">
                <div class="stat-card">
                    <div class="stat-title">رصيد الخزينة الحالي</div>
                    <div class="stat-value" id="treasuryBalance">0.00</div>
                </div>
            </div>

            <!-- Transaction Form -->
            <div id="transactionForm" class="form-card">
                <div class="form-header">
                    <h3>تسجيل حركة مالية جديدة</h3>
                    <button class="btn btn-outline btn-sm" onclick="hideForm()">إغلاق</button>
                </div>
                
                <div class="form-grid">
                    <div class="form-group">
                        <label>نوع الحركة</label>
                        <select id="transType" class="form-control">
                            <option value="income">قبض (إيداع)</option>
                            <option value="expense">صرف (سحب)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>المبلغ</label>
                        <input type="number" id="transAmount" class="form-control" placeholder="0.00" step="0.01">
                    </div>
                    <div class="form-group">
                        <label>التاريخ</label>
                        <input type="date" id="transDate" class="form-control">
                    </div>
                    <div class="form-group">
                        <label>الوصف / البيان</label>
                        <input type="text" id="transDesc" class="form-control" placeholder="وصف الحركة">
                    </div>
                </div>

                <div style="text-align: left;">
                    <button class="btn btn-outline" onclick="hideForm()">إلغاء</button>
                    <button class="btn btn-success" onclick="saveTransaction()">حفظ الحركة</button>
                </div>
            </div>

            <!-- Edit Transaction Modal -->
            <div id="editModal" class="modal">
                <div class="modal-content">
                    <span class="close" onclick="closeEditModal()">&times;</span>
                    <h3>تعديل حركة</h3>
                    <input type="hidden" id="editTransId">
                    <div class="form-grid">
                        <div class="form-group">
                            <label>نوع الحركة</label>
                            <select id="editTransType" class="form-control">
                                <option value="income">قبض (إيداع)</option>
                                <option value="expense">صرف (سحب)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>المبلغ</label>
                            <input type="number" id="editTransAmount" class="form-control" step="0.01" min="0">
                        </div>
                        <div class="form-group">
                            <label>التاريخ</label>
                            <input type="date" id="editTransDate" class="form-control">
                        </div>
                        <div class="form-group">
                            <label>الوصف</label>
                            <input type="text" id="editTransDesc" class="form-control">
                        </div>
                    </div>
                    <button class="btn btn-primary" onclick="updateTransaction()">حفظ التعديلات</button>
                </div>
            </div>

            <!-- Transactions Table -->
            <div class="table-card">
                <table class="table">
                    <thead>
                        <tr>
                            <th>التاريخ</th>
                            <th>نوع الحركة</th>
                            <th>المبلغ</th>
                            <th>البيان</th>
                            <th>مرتبط بـ</th>
                            <th>إجراءات</th>
                        </tr>
                    </thead>
                    <tbody id="transactionsTableBody">
                        <!-- Data loaded via JS -->
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function initializeElements() {
    treasuryBalanceEl = document.getElementById('treasuryBalance');
    transactionsTableBody = document.getElementById('transactionsTableBody');
    transactionForm = document.getElementById('transactionForm');
    transDateInput = document.getElementById('transDate');
    newTransactionBtn = document.getElementById('newTransactionBtn');
}

async function loadFinanceData() {
    const balance = await window.electronAPI.getTreasuryBalance();
    const transactions = await window.electronAPI.getTreasuryTransactions();
    
    treasuryBalanceEl.textContent = balance.toFixed(2);
    if (balance >= 0) {
        treasuryBalanceEl.className = 'stat-value positive';
    } else {
        treasuryBalanceEl.className = 'stat-value negative';
    }

    renderTransactions(transactions);
}

function renderTransactions(transactions) {
    transactionsTableBody.innerHTML = '';
    
    transactions.forEach(t => {
        const row = document.createElement('tr');
        const typeBadge = t.type === 'income' 
            ? '<span class="badge badge-income">قبض</span>' 
            : '<span class="badge badge-expense">صرف</span>';
        
        let relatedText = '-';
        if (t.related_type === 'sales') relatedText = `فاتورة بيع #${t.related_invoice_id}`;
        if (t.related_type === 'purchase') relatedText = `فاتورة شراء #${t.related_invoice_id}`;

        // Disable edit for auto-generated transactions, but allow delete
        const isAuto = t.related_invoice_id != null;
        const actions = isAuto ? 
            `<span style="color: #999; font-size: 0.8rem; margin-left: 8px;">(آلي)</span>
             <button class="btn btn-danger btn-sm" onclick="deleteTransaction(${t.id})">حذف</button>` :
            `
            <button class="btn btn-warning btn-sm" onclick='openEditModal(${JSON.stringify(t)})'>تعديل</button>
            <button class="btn btn-danger btn-sm" onclick="deleteTransaction(${t.id})">حذف</button>
            `;

        row.innerHTML = `
            <td>${t.transaction_date}</td>
            <td>${typeBadge}</td>
            <td style="font-weight: bold; direction: ltr;">${t.amount.toFixed(2)}</td>
            <td>${t.description}</td>
            <td>${relatedText}</td>
            <td>${actions}</td>
        `;
        transactionsTableBody.appendChild(row);
    });
}

function showForm() {
    transactionForm.style.display = 'block';
    newTransactionBtn.style.display = 'none';
}

function hideForm() {
    transactionForm.style.display = 'none';
    newTransactionBtn.style.display = 'flex';
    
    // Clear inputs
    document.getElementById('transAmount').value = '';
    document.getElementById('transDesc').value = '';
    document.getElementById('transType').value = 'income';
    transDateInput.valueAsDate = new Date();
}

async function saveTransaction() {
    const type = document.getElementById('transType').value;
    const amount = parseFloat(document.getElementById('transAmount').value);
    const date = document.getElementById('transDate').value;
    const description = document.getElementById('transDesc').value;

    if (!amount || amount <= 0) {
        alert('الرجاء إدخال مبلغ صحيح');
        return;
    }
    if (!description) {
        alert('الرجاء إدخال وصف للحركة');
        return;
    }

    const result = await window.electronAPI.addTreasuryTransaction({
        type,
        amount,
        date,
        description
    });

    if (result.success) {
        alert('تم حفظ الحركة بنجاح');
        hideForm();
        loadFinanceData();
    } else {
        alert('حدث خطأ: ' + result.error);
    }
}

// --- Edit & Delete Functions ---

async function deleteTransaction(id) {
    if (confirm('هل أنت متأكد من حذف هذه الحركة؟ لا يمكن التراجع عن هذا الإجراء.')) {
        const result = await window.electronAPI.deleteTreasuryTransaction(id);
        if (result.success) {
            alert('تم الحذف بنجاح');
            loadFinanceData();
        } else {
            alert('حدث خطأ أثناء الحذف: ' + result.error);
        }
    }
}

function openEditModal(transaction) {
    document.getElementById('editTransId').value = transaction.id;
    document.getElementById('editTransType').value = transaction.type;
    document.getElementById('editTransAmount').value = transaction.amount;
    document.getElementById('editTransDate').value = transaction.transaction_date;
    document.getElementById('editTransDesc').value = transaction.description;
    
    document.getElementById('editModal').style.display = 'block';
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

async function updateTransaction() {
    const id = document.getElementById('editTransId').value;
    const type = document.getElementById('editTransType').value;
    const amount = parseFloat(document.getElementById('editTransAmount').value);
    const date = document.getElementById('editTransDate').value;
    const description = document.getElementById('editTransDesc').value;

    if (!amount || amount <= 0) {
        alert('الرجاء إدخال مبلغ صحيح');
        return;
    }

    const result = await window.electronAPI.updateTreasuryTransaction({
        id,
        type,
        amount,
        date,
        description
    });

    if (result.success) {
        alert('تم تحديث الحركة بنجاح');
        closeEditModal();
        loadFinanceData();
    } else {
        alert('حدث خطأ: ' + result.error);
    }
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('editModal');
    if (event.target == modal) {
        modal.style.display = "none";
    }
}
