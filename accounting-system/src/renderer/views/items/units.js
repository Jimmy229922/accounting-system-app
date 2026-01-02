let unitIdInput, unitNameInput, unitsTableBody, deleteModal, formTitle, searchInput, totalUnitsElement, cancelEditBtn, saveBtnText, paginationContainer, clearSearchBtn;
let unitToDeleteId = null;

let allUnits = [];
let currentPage = 1;
const itemsPerPage = 10;
let currentFilteredUnits = [];

// Load units when page starts
document.addEventListener('DOMContentLoaded', () => {
    initializeElements();
    loadUnits();
    // Focus on input immediately for quick entry
    unitNameInput.focus();
});

function initializeElements() {
    unitIdInput = document.getElementById('unitId');
    unitNameInput = document.getElementById('unitName');
    unitsTableBody = document.getElementById('unitsTableBody');
    deleteModal = document.getElementById('deleteModal');
    formTitle = document.getElementById('formTitle');
    searchInput = document.getElementById('searchInput');
    clearSearchBtn = document.getElementById('clearSearchBtn');
    totalUnitsElement = document.getElementById('totalUnits');
    cancelEditBtn = document.getElementById('cancelEditBtn');
    saveBtnText = document.getElementById('saveBtnText');
    paginationContainer = document.getElementById('pagination');

    // Add search listener
    searchInput.addEventListener('input', (e) => {
        handleSearch(e.target.value);
    });

    // Clear search button
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            handleSearch('');
            searchInput.focus();
        });
    }
    
    // Handle Enter key in input
    unitNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveUnit();
    });

    // Close modal when clicking outside
    deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) hideDeleteModal();
    });
}

function handleSearch(term) {
    term = term.toLowerCase();
    
    // Toggle clear button
    if (clearSearchBtn) {
        clearSearchBtn.style.display = term ? 'block' : 'none';
    }

    if (term) {
        currentFilteredUnits = allUnits.filter(u => u.name.toLowerCase().includes(term));
    } else {
        currentFilteredUnits = [...allUnits];
    }
    
    currentPage = 1; // Reset to first page on new search
    renderTable();
}

async function loadUnits() {
    allUnits = await window.electronAPI.getUnits();
    
    // Re-apply current search if exists
    const searchTerm = searchInput.value;
    if (searchTerm) {
        handleSearch(searchTerm);
    } else {
        currentFilteredUnits = [...allUnits];
        renderTable();
    }
    
    updateStats();
}

function renderTable() {
    unitsTableBody.innerHTML = '';
    
    if (currentFilteredUnits.length === 0) {
        unitsTableBody.innerHTML = `
            <tr>
                <td colspan="3">
                    <div class="empty-state">
                        <div class="empty-icon">📦</div>
                        <div class="empty-text">لا توجد وحدات مطابقة للبحث</div>
                    </div>
                </td>
            </tr>
        `;
        paginationContainer.innerHTML = '';
        return;
    }

    // Calculate pagination
    const totalPages = Math.ceil(currentFilteredUnits.length / itemsPerPage);
    
    // Ensure currentPage is valid
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, currentFilteredUnits.length);
    const pageUnits = currentFilteredUnits.slice(startIndex, endIndex);

    pageUnits.forEach((unit, index) => {
        const row = document.createElement('tr');
        // Highlight search term if exists
        let displayName = unit.name;
        const searchTerm = searchInput.value.trim();
        if (searchTerm) {
            const regex = new RegExp(`(${searchTerm})`, 'gi');
            displayName = displayName.replace(regex, '<span class="highlight">$1</span>');
        }

        row.innerHTML = `
            <td>${startIndex + index + 1}</td>
            <td>${displayName}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-icon btn-edit" onclick="editUnit(${unit.id})" title="تعديل">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button class="btn-icon btn-delete" onclick="showDeleteModal(${unit.id})" title="حذف">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                </div>
            </td>
        `;
        unitsTableBody.appendChild(row);
    });

    renderPagination(totalPages);
}

function renderPagination(totalPages) {
    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    let paginationHTML = `
        <button class="pagination-btn" onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} title="السابق">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
        <span class="pagination-info">صفحة ${currentPage} من ${totalPages}</span>
        <button class="pagination-btn" onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''} title="التالي">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
    `;
    
    paginationContainer.innerHTML = paginationHTML;
}

function changePage(newPage) {
    const totalPages = Math.ceil(currentFilteredUnits.length / itemsPerPage);
    if (newPage < 1 || newPage > totalPages) return;
    currentPage = newPage;
    renderTable();
}

function updateStats() {
    if (totalUnitsElement) {
        totalUnitsElement.textContent = allUnits.length;
    }
}

function resetForm() {
    unitIdInput.value = '';
    unitNameInput.value = '';
    formTitle.textContent = 'إضافة وحدة جديدة';
    saveBtnText.textContent = 'حفظ الوحدة';
    cancelEditBtn.style.display = 'none';
    unitNameInput.focus();
}

function editUnit(id) {
    const unit = allUnits.find(u => u.id === id);
    if (!unit) return;

    unitIdInput.value = unit.id;
    unitNameInput.value = unit.name;

    formTitle.textContent = 'تعديل الوحدة';
    saveBtnText.textContent = 'حفظ التعديلات';
    cancelEditBtn.style.display = 'block';
    
    // Focus input and scroll to top on mobile
    unitNameInput.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function saveUnit() {
    const id = unitIdInput.value;
    const name = unitNameInput.value.trim();
    
    if (!name) {
        Toast.show('الرجاء إدخال اسم الوحدة', 'error');
        unitNameInput.focus();
        return;
    }

    // Check for duplicates
    const isDuplicate = allUnits.some(u => 
        u.name.toLowerCase() === name.toLowerCase() && u.id != id
    );

    if (isDuplicate) {
        Toast.show('اسم الوحدة موجود بالفعل، يرجى اختيار اسم آخر', 'error');
        unitNameInput.select();
        return;
    }

    let result;
    if (id) {
        result = await window.electronAPI.updateUnit({ id, name });
    } else {
        result = await window.electronAPI.addUnit(name);
    }

    if (result.success) {
        resetForm(); // Reset form immediately for next entry
        loadUnits();
        Toast.show(id ? 'تم تعديل الوحدة بنجاح' : 'تم إضافة الوحدة بنجاح', 'success');
    } else {
        // Fallback for backend errors
        if (result.error && (result.error.includes('UNIQUE') || result.error.includes('constraint'))) {
            Toast.show('اسم الوحدة موجود بالفعل', 'error');
        } else {
            Toast.show('حدث خطأ: ' + result.error, 'error');
        }
    }
}

function showDeleteModal(id) {
    unitToDeleteId = id;
    deleteModal.classList.add('active');
}

function hideDeleteModal() {
    unitToDeleteId = null;
    deleteModal.classList.remove('active');
}

async function confirmDelete() {
    if (!unitToDeleteId) return;
    
    const result = await window.electronAPI.deleteUnit(unitToDeleteId);
    if (result.success) {
        loadUnits();
        Toast.show('تم حذف الوحدة بنجاح', 'success');
        // If we were editing the deleted unit, reset form
        if (unitIdInput.value == unitToDeleteId) {
            resetForm();
        }
    } else {
        Toast.show('حدث خطأ أثناء الحذف', 'error');
    }
    hideDeleteModal();
}
