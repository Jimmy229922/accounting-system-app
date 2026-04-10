(function () {
    function renderPage({ t, getNavHTML }) {
        document.title = t('salesReturns.title', 'Sales Returns');

        const app = document.getElementById('app');
        app.innerHTML = `
        ${getNavHTML()}

        <div class="content">
            <div class="page-header">
                <div class="page-title">
                    <i class="fas fa-undo-alt"></i>
                    ${t('salesReturns.title', 'Sales Returns')}
                </div>
            </div>

            <div class="return-form-container">
                <h2 class="form-title">
                    <i class="fas fa-file-invoice"></i>
                    ${t('salesReturns.newReturnTitle', 'New Sales Return')}
                </h2>

                <div class="form-grid">
                    <div class="form-group">
                        <label>${t('salesReturns.customer', 'Customer')}</label>
                        <select id="customerSelect" class="form-control">
                            <option value="">${t('common.actions.selectCustomer', 'Select Customer')}</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>${t('salesReturns.originalInvoice', 'Original Invoice')}</label>
                        <select id="invoiceSelect" class="form-control" disabled>
                            <option value="">${t('common.actions.selectInvoice', 'Select Invoice')}</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>${t('salesReturns.returnNumber', 'Return Number')}</label>
                        <input type="text" id="returnNumber" class="form-control" placeholder="${t('common.actions.auto', 'Auto')}" readonly style="background: var(--bg-color); cursor: not-allowed;">
                    </div>
                    <div class="form-group">
                        <label>${t('salesReturns.returnDate', 'Return Date')}</label>
                        <input type="date" id="returnDate" class="form-control">
                    </div>
                </div>

                <div id="itemsSection" class="items-section" style="display: none;">
                    <table class="items-table">
                        <thead>
                            <tr>
                                <th style="width: 5%;">${t('salesReturns.returnItem', 'Return')}</th>
                                <th style="width: 30%;">${t('salesReturns.item', 'Item')}</th>
                                <th style="width: 10%;">${t('salesReturns.unit', 'Unit')}</th>
                                <th style="width: 12%;">${t('salesReturns.soldQty', 'Sold Qty')}</th>
                                <th style="width: 12%;">${t('salesReturns.returnedQty', 'Already Returned')}</th>
                                <th style="width: 12%;">${t('salesReturns.returnQty', 'Return Qty')}</th>
                                <th style="width: 12%;">${t('salesReturns.price', 'Price')}</th>
                                <th style="width: 12%;">${t('salesReturns.total', 'Total')}</th>
                            </tr>
                        </thead>
                        <tbody id="itemsBody"></tbody>
                    </table>
                </div>

                <div class="notes-section" style="margin-bottom: 15px;">
                    <div class="form-group">
                        <label>${t('salesReturns.notes', 'Notes')}</label>
                        <textarea id="returnNotes" rows="2" placeholder="${t('salesReturns.notesPlaceholder', 'Optional notes...')}"></textarea>
                    </div>
                </div>

                <div class="form-footer">
                    <div class="total-section">
                        <span>${t('salesReturns.returnTotal', 'Return Total:')}</span>
                        <span class="total-value" id="returnTotal">0.00</span>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button class="btn btn-secondary" type="button" data-action="reset-form">
                            <i class="fas fa-eraser"></i> ${t('common.actions.clear', 'Clear')}
                        </button>
                        <button class="btn btn-danger" id="saveBtn" type="button" data-action="save-return" disabled>
                            <i class="fas fa-save"></i> ${t('salesReturns.saveReturn', 'Save Return')}
                        </button>
                    </div>
                </div>
            </div>

            <div class="history-card">
                <div class="history-header">
                    <h3><i class="fas fa-history"></i> ${t('salesReturns.historyTitle', 'Returns History')}</h3>
                </div>
                <div id="historyContent">
                    <div class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <p>${t('common.state.noReturns', 'No returns recorded')}</p>
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
                <input type="number" class="return-price-input" data-index="${index}" value="${toSafeNumber(item.sale_price)}" step="any" disabled style="max-width: 120px; margin: 0 auto;">
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
            ? t('salesReturns.editReturnTitle', 'Edit Sales Return')
            : t('salesReturns.newReturnTitle', 'New Sales Return');

        const saveText = isEditing
            ? t('salesReturns.updateReturn', 'Update Return')
            : t('salesReturns.saveReturn', 'Save Return');

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
                <p>${t('common.state.noReturns', 'No returns recorded')}</p>
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
                    <th>${t('salesReturns.returnNumber', 'Return Number')}</th>
                    <th>${t('salesReturns.originalInvoice', 'Original Invoice')}</th>
                    <th>${t('salesReturns.customer', 'Customer')}</th>
                    <th>${t('salesReturns.returnDate', 'Date')}</th>
                    <th>${t('salesReturns.total', 'Total')}</th>
                    <th>${t('common.labels.actions', 'Actions')}</th>
                </tr>
            </thead>
            <tbody>
                ${rows.map((row) => `
                    <tr>
                        <td><span class="badge badge-return"><i class="fas fa-undo-alt"></i> ${row.return_number || '-'}</span></td>
                        <td>${fmt(t('salesReturns.invoiceLabel', 'Invoice #{number}'), { number: row.original_invoice_number || '-' })}</td>
                        <td>${row.customer_name || '-'}</td>
                        <td>${row.return_date || '-'}</td>
                        <td style="font-weight: 700; color: #ef4444;">${(Number(row.total_amount) || 0).toFixed(2)}</td>
                        <td>
                            <button class="btn btn-sm btn-delete" type="button" data-action="delete-return" data-id="${row.id}">
                                <i class="fas fa-trash"></i> ${t('common.actions.delete', 'Delete')}
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        ${paginationHtml}
    `;
    }

    window.salesReturnsPageRender = {
        renderPage,
        createInvoiceItemRow,
        setFormMode,
        renderEmptyHistory,
        renderHistoryTable
    };
})();
