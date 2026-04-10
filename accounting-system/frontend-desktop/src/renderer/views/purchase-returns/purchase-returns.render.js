(function () {
    function renderPage({ t, getNavHTML }) {
        document.title = t('purchaseReturns.title', 'مردودات المشتريات');

        const app = document.getElementById('app');
        app.innerHTML = `
        ${getNavHTML()}

        <div class="content">
            <div class="page-header">
                <div class="page-title">
                    <i class="fas fa-undo-alt"></i>
                    ${t('purchaseReturns.title', 'مردودات المشتريات')}
                </div>
            </div>

            <div class="return-form-container">
                <h2 class="form-title">
                    <i class="fas fa-file-invoice"></i>
                    ${t('purchaseReturns.newReturnTitle', 'تسجيل مرتجع مشتريات جديد')}
                </h2>

                <div class="form-grid">
                    <div class="form-group">
                        <label>${t('purchaseReturns.supplier', 'المورد')}</label>
                        <select id="supplierSelect" class="form-control">
                            <option value="">${t('common.actions.selectSupplier', 'اختر المورد')}</option>
                        </select>
                    </div>
                    <div class="form-group form-group-original-invoice">
                        <label>${t('purchaseReturns.originalInvoice', 'فاتورة الشراء الأصلية')}</label>
                        <select id="invoiceSelect" class="form-control" disabled>
                            <option value="">${t('common.actions.selectInvoice', 'اختر الفاتورة')}</option>
                        </select>
                        <div id="originalInvoicePreview" class="original-invoice-preview is-empty">
                            <span>${t('purchaseReturns.originalInvoicePreview', 'تفاصيل الفاتورة المختارة')}</span>
                            <strong id="originalInvoicePreviewText">${t('purchaseReturns.noInvoiceSelected', 'لم يتم اختيار فاتورة شراء أصلية بعد')}</strong>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>${t('purchaseReturns.returnNumber', 'رقم المرتجع')}</label>
                        <input type="text" id="returnNumber" class="form-control" placeholder="${t('common.actions.auto', 'Auto')}" readonly style="background: var(--bg-color); cursor: not-allowed;">
                    </div>
                    <div class="form-group">
                        <label>${t('purchaseReturns.returnDate', 'تاريخ المرتجع')}</label>
                        <input type="date" id="returnDate" class="form-control">
                    </div>
                </div>

                <div id="itemsSection" class="items-section" style="display: none;">
                    <table class="items-table">
                        <thead>
                            <tr>
                                <th style="width: 5%;">${t('purchaseReturns.returnItem', 'إرجاع')}</th>
                                <th style="width: 30%;">${t('purchaseReturns.item', 'الصنف')}</th>
                                <th style="width: 10%;">${t('purchaseReturns.unit', 'الوحدة')}</th>
                                <th style="width: 12%;">${t('purchaseReturns.boughtQty', 'الكمية المشتراة')}</th>
                                <th style="width: 12%;">${t('purchaseReturns.returnedQty', 'تم إرجاعها')}</th>
                                <th style="width: 12%;">${t('purchaseReturns.returnQty', 'كمية الإرجاع')}</th>
                                <th style="width: 12%;">${t('purchaseReturns.price', 'السعر')}</th>
                                <th style="width: 12%;">${t('purchaseReturns.total', 'الإجمالي')}</th>
                            </tr>
                        </thead>
                        <tbody id="itemsBody"></tbody>
                    </table>
                </div>

                <div class="notes-section" style="margin-bottom: 15px;">
                    <div class="form-group">
                        <label>${t('purchaseReturns.notes', 'ملاحظات')}</label>
                        <textarea id="returnNotes" rows="2" placeholder="${t('purchaseReturns.notesPlaceholder', 'ملاحظات اختيارية...')}"></textarea>
                    </div>
                </div>

                <div class="form-footer">
                    <div class="total-section">
                        <span>${t('purchaseReturns.returnTotal', 'إجمالي المرتجع:')}</span>
                        <span class="total-value" id="returnTotal">0.00</span>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button class="btn btn-secondary" type="button" data-action="reset-form">
                            <i class="fas fa-eraser"></i> ${t('common.actions.clear', 'مسح')}
                        </button>
                        <button class="btn btn-warning" id="saveBtn" type="button" data-action="save-return" disabled>
                            <i class="fas fa-save"></i> ${t('purchaseReturns.saveReturn', 'حفظ المرتجع')}
                        </button>
                    </div>
                </div>
            </div>

            <div class="history-card">
                <div class="history-header">
                    <h3><i class="fas fa-history"></i> ${t('purchaseReturns.historyTitle', 'سجل المرتجعات')}</h3>
                </div>
                <div id="historyContent">
                    <div class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <p>${t('common.state.noReturns', 'لا توجد مرتجعات مسجلة')}</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    }

    function createInvoiceItemRow({ item, index, t, toSafeNumber, getAvailableToReturn }) {
        const quantity = toSafeNumber(item.quantity);
        const returnedQty = toSafeNumber(item.returned_quantity);
        const availableToReturn = getAvailableToReturn(item);

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><input type="checkbox" class="return-checkbox" data-index="${index}" ${availableToReturn <= 0 ? 'disabled' : ''}></td>
            <td class="item-name">${item.item_name || t('common.state.deletedItem', 'Deleted Item')}</td>
            <td>${item.unit_name || '-'}</td>
            <td>${quantity}</td>
            <td class="returned-qty">${returnedQty > 0 ? returnedQty : '-'}</td>
            <td>
                <input type="number" class="return-qty-input" data-index="${index}" min="0" max="${availableToReturn}" step="any" value="0" disabled style="max-width: 120px; margin: 0 auto;">
            </td>
            <td>
                <input type="number" class="return-price-input" data-index="${index}" value="${toSafeNumber(item.cost_price)}" step="any" disabled style="max-width: 120px; margin: 0 auto;">
            </td>
            <td class="row-total" data-index="${index}">0.00</td>
        `;

        if (availableToReturn <= 0) {
            row.style.opacity = '0.5';
        }

        return row;
    }

    function setFormMode(isEditing, t) {
        const formTitle = document.querySelector('.form-title');
        const saveBtn = document.getElementById('saveBtn');

        const titleText = isEditing
            ? t('purchaseReturns.editReturnTitle', 'تعديل مرتجع مشتريات')
            : t('purchaseReturns.newReturnTitle', 'تسجيل مرتجع مشتريات جديد');

        const saveText = isEditing
            ? t('purchaseReturns.updateReturn', 'تحديث المرتجع')
            : t('purchaseReturns.saveReturn', 'حفظ المرتجع');

        if (formTitle) {
            formTitle.innerHTML = `<i class="fas fa-file-invoice"></i> ${titleText}`;
        }

        if (saveBtn) {
            saveBtn.innerHTML = `<i class="fas fa-save"></i> ${saveText}`;
        }
    }

    function renderEmptyHistory(container, t) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>${t('common.state.noReturns', 'لا توجد مرتجعات مسجلة')}</p>
            </div>
        `;
    }

    function renderHistoryTable({ container, rows, page, totalPages, t, fmt }) {
        const hasPagination = totalPages > 1;

        const paginationHtml = hasPagination
            ? `
            <div style="display:flex;align-items:center;justify-content:center;gap:12px;padding:12px 0;">
                <button class="btn btn-sm" type="button" data-action="history-prev" ${page === 1 ? 'disabled' : ''}>السابق</button>
                <span style="font-weight:600;">صفحة ${page} من ${totalPages}</span>
                <button class="btn btn-sm" type="button" data-action="history-next" ${page === totalPages ? 'disabled' : ''}>التالي</button>
            </div>
        `
            : '';

        container.innerHTML = `
        <table class="history-table">
            <thead>
                <tr>
                    <th>${t('purchaseReturns.returnNumber', 'رقم المرتجع')}</th>
                    <th>${t('purchaseReturns.originalInvoice', 'فاتورة الشراء الأصلية')}</th>
                    <th>${t('purchaseReturns.supplier', 'المورد')}</th>
                    <th>${t('purchaseReturns.returnDate', 'التاريخ')}</th>
                    <th>${t('purchaseReturns.total', 'الإجمالي')}</th>
                    <th>${t('common.labels.actions', 'إجراءات')}</th>
                </tr>
            </thead>
            <tbody>
                ${rows.map((row) => `
                    <tr>
                        <td><span class="badge badge-return"><i class="fas fa-undo-alt"></i> ${row.return_number || '-'}</span></td>
                        <td>${fmt(t('purchaseReturns.invoiceLabel', 'Invoice #{number}'), { number: row.original_invoice_number || '-' })}</td>
                        <td>${row.supplier_name || '-'}</td>
                        <td>${row.return_date || '-'}</td>
                        <td style="font-weight: 700; color: #f59e0b;">${(Number(row.total_amount) || 0).toFixed(2)}</td>
                        <td>
                            <button class="btn btn-sm btn-delete" type="button" data-action="delete-return" data-id="${row.id}">
                                <i class="fas fa-trash"></i> ${t('common.actions.delete', 'حذف')}
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        ${paginationHtml}
    `;
    }

    window.purchaseReturnsPageRender = {
        renderPage,
        createInvoiceItemRow,
        setFormMode,
        renderEmptyHistory,
        renderHistoryTable
    };
})();
