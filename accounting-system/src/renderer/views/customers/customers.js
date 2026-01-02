// DOM Elements
const customersTableBody = document.getElementById('customers-table-body');
const searchInput = document.getElementById('search-input');
const filterButtons = document.querySelectorAll('.filter-btn');
const emptyState = document.getElementById('empty-state');

// Modal Elements
const modal = document.getElementById('customer-modal');
const addCustomerBtn = document.getElementById('add-customer-btn');
const closeModalBtn = document.getElementById('close-modal');
const cancelModalBtn = document.getElementById('cancel-modal');
const saveCustomerBtn = document.getElementById('save-customer-btn');
const modalTitle = document.getElementById('modal-title');
const customerForm = document.getElementById('customer-form');

// Form Inputs
const customerIdInput = document.getElementById('customer-id');
const customerNameInput = document.getElementById('customer-name');
const customerTypeSelect = document.getElementById('customer-type');
const customerPhoneInput = document.getElementById('customer-phone');
const customerAddressInput = document.getElementById('customer-address');
const customerBalanceInput = document.getElementById('customer-balance');
const customerNotesInput = document.getElementById('customer-notes');

// Stats Elements
const totalReceivablesEl = document.getElementById('total-receivables');
const totalPayablesEl = document.getElementById('total-payables');
const totalCountEl = document.getElementById('total-count');

// State
let allCustomers = [];
let currentFilter = 'all';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadCustomers();
    setupEventListeners();
});

/* Navbar loading removed - hardcoded in HTML */

function setupEventListeners() {
    // Search
    searchInput.addEventListener('input', (e) => {
        filterAndRender();
    });

    // Filters
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update filter
            currentFilter = btn.dataset.filter;
            filterAndRender();
        });
    });

    // Modal
    addCustomerBtn.addEventListener('click', () => openModal());
    closeModalBtn.addEventListener('click', closeModal);
    cancelModalBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Save
    saveCustomerBtn.addEventListener('click', saveCustomer);
}

async function loadCustomers() {
    try {
        allCustomers = await window.electronAPI.getCustomers();
        updateStats();
        filterAndRender();
    } catch (error) {
        console.error('Error loading customers:', error);
        showToast('خطأ في تحميل البيانات', 'error');
    }
}

function updateStats() {
    let totalReceivables = 0;
    let totalPayables = 0;

    allCustomers.forEach(c => {
        const balance = parseFloat(c.balance) || 0;
        const type = (c.type || 'customer').toLowerCase();

        // Logic:
        // Customer (Positive) -> Receivable (They owe us)
        // Customer (Negative) -> Payable (We owe them)
        // Supplier (Positive) -> Payable (We owe them)
        // Supplier (Negative) -> Receivable (They owe us)

        if (type === 'customer' || type === 'both') {
            if (balance > 0) {
                totalReceivables += balance;
            } else if (balance < 0) {
                totalPayables += Math.abs(balance);
            }
        } else if (type === 'supplier') {
            if (balance > 0) {
                totalPayables += balance;
            } else if (balance < 0) {
                totalReceivables += Math.abs(balance);
            }
        }
    });

    console.log('Stats Updated:', { totalReceivables, totalPayables, count: allCustomers.length });

    totalReceivablesEl.textContent = formatCurrency(totalReceivables);
    totalPayablesEl.textContent = formatCurrency(totalPayables);
    totalCountEl.textContent = allCustomers.length;
}

function filterAndRender() {
    const searchTerm = searchInput.value.toLowerCase();
    
    const filtered = allCustomers.filter(c => {
        const matchesSearch = (c.name && c.name.toLowerCase().includes(searchTerm)) || 
                              (c.phone && c.phone.includes(searchTerm));
        
        const matchesFilter = currentFilter === 'all' || 
                              (currentFilter === 'customer' && c.type === 'customer') ||
                              (currentFilter === 'supplier' && c.type === 'supplier') ||
                              (currentFilter === 'both' && c.type === 'both');

        return matchesSearch && matchesFilter;
    });

    renderTable(filtered);
}

function renderTable(customers) {
    customersTableBody.innerHTML = '';

    if (customers.length === 0) {
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    customers.forEach(customer => {
        const tr = document.createElement('tr');
        
        // Determine Badge Class
        let badgeClass = 'badge-both';
        let typeText = 'عميل ومورد';
        if (customer.type === 'customer') {
            badgeClass = 'badge-customer';
            typeText = 'عميل';
        } else if (customer.type === 'supplier') {
            badgeClass = 'badge-supplier';
            typeText = 'مورد';
        }

        // Determine Balance Class & Color
        const balance = parseFloat(customer.balance) || 0;
        let balanceClass = 'balance-neutral';
        
        if (customer.type === 'supplier') {
            // Supplier: Positive = Liability (Red), Negative = Asset (Green)
            if (balance > 0) balanceClass = 'balance-negative';
            if (balance < 0) balanceClass = 'balance-positive';
        } else {
            // Customer: Positive = Asset (Green), Negative = Liability (Red)
            if (balance > 0) balanceClass = 'balance-positive';
            if (balance < 0) balanceClass = 'balance-negative';
        }

        tr.innerHTML = `
            <td>${customer.name}</td>
            <td><span class="badge ${badgeClass}">${typeText}</span></td>
            <td>${customer.phone || '-'}</td>
            <td>${customer.address || '-'}</td>
            <td class="${balanceClass}" dir="ltr">${formatCurrency(balance)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-icon btn-edit" onclick="editCustomer(${customer.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-delete" onclick="deleteCustomer(${customer.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        customersTableBody.appendChild(tr);
    });
}

function openModal(customer = null) {
    if (customer) {
        modalTitle.textContent = 'تعديل بيانات';
        customerIdInput.value = customer.id;
        customerNameInput.value = customer.name;
        customerTypeSelect.value = customer.type;
        customerPhoneInput.value = customer.phone || '';
        customerAddressInput.value = customer.address || '';
        customerBalanceInput.value = customer.balance || 0;
        customerNotesInput.value = customer.notes || '';
    } else {
        modalTitle.textContent = 'إضافة عميل/مورد جديد';
        customerForm.reset();
        customerIdInput.value = '';
        customerBalanceInput.value = 0;
    }
    
    modal.classList.add('show');
}

function closeModal() {
    modal.classList.remove('show');
}

async function saveCustomer() {
    const customerData = {
        name: customerNameInput.value,
        type: customerTypeSelect.value,
        phone: customerPhoneInput.value,
        address: customerAddressInput.value,
        balance: parseFloat(customerBalanceInput.value) || 0,
        notes: customerNotesInput.value
    };

    if (!customerData.name) {
        showToast('يرجى إدخال الاسم', 'error');
        return;
    }

    const id = customerIdInput.value;

    try {
        let result;
        if (id) {
            result = await window.electronAPI.updateCustomer({ ...customerData, id });
        } else {
            result = await window.electronAPI.addCustomer(customerData);
        }

        if (result && result.success) {
            showToast(id ? 'تم تحديث البيانات بنجاح' : 'تمت الإضافة بنجاح');
            closeModal();
            loadCustomers();
        } else {
            console.error('Save failed:', result);
            showToast('حدث خطأ أثناء الحفظ: ' + (result?.error || 'خطأ غير معروف'), 'error');
        }
    } catch (error) {
        console.error('Error saving customer:', error);
        showToast('حدث خطأ أثناء الحفظ', 'error');
    }
}

window.editCustomer = (id) => {
    const customer = allCustomers.find(c => c.id === id);
    if (customer) {
        openModal(customer);
    }
};

window.deleteCustomer = async (id) => {
    if (confirm('هل أنت متأكد من حذف هذا السجل؟')) {
        try {
            const result = await window.electronAPI.deleteCustomer(id);
            if (result && result.success) {
                showToast('تم الحذف بنجاح');
                loadCustomers();
            } else {
                console.error('Delete failed:', result);
                const errorMsg = result?.error || 'خطأ غير معروف';
                if (errorMsg.includes('FOREIGN KEY')) {
                    showToast('لا يمكن حذف هذا السجل لأنه مرتبط ببيانات أخرى (فواتير أو حركات)', 'error');
                } else {
                    showToast('فشل الحذف: ' + errorMsg, 'error');
                }
            }
        } catch (error) {
            console.error('Error deleting customer:', error);
            showToast('حدث خطأ أثناء الحذف', 'error');
        }
    }
};

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount).replace('$', '') + ' $';
}

function showToast(message, type = 'success') {
    // Check if toast container exists, if not create it
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.position = 'fixed';
        toastContainer.style.bottom = '20px';
        toastContainer.style.left = '20px';
        toastContainer.style.zIndex = '10000';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.style.background = type === 'success' ? '#10b981' : '#ef4444';
    toast.style.color = 'white';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '8px';
    toast.style.marginBottom = '10px';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    toast.style.animation = 'slideIn 0.3s ease-out';
    toast.textContent = message;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease-in';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Add styles for toast animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(-100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
`;
document.head.appendChild(style);
