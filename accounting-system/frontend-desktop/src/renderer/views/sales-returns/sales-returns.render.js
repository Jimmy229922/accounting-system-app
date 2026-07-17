(function () {
    function renderPage({ t, getNavHTML }) {
        document.title = t('salesReturns.title', 'مردودات المبيعات');

        const app = document.getElementById('app');
        app.innerHTML = `
        ${getNavHTML()}

        <div class="content sales-content">
            <div class="sales-page-header">
                <div class="sales-title-wrap">
                    <h1 class="page-title">${t('salesReturns.title', 'مردودات المبيعات')}</h1>
                    <p class="sales-subtitle">${t('salesReturns.subtitle', 'إدارة وتسجيل المرتجعات للفواتير بشكل سريع ومنظم.')}</p>
                </div>
            </div>

            <div id="invoiceForm" class="invoice-form-container">
                <div class="invoice-shell">
                    <div class="form-title-row">
                        <h2 class="form-title">${t('salesReturns.newReturnTitle', 'تسجيل مرتجع جديد')}</h2>
                        <div style="display: flex; gap: 8px; margin-inline-start: auto; align-items: center;">
                            <button class="btn btn-outline" type="button" data-action="print-return" id="printReturnBtn" disabled style="padding: 8px 12px; opacity: 0.5; cursor: not-allowed;" title="${t('salesReturns.printReturn', 'طباعة المرتجع')}">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                            </button>
                            <button class="btn btn-outline" type="button" data-action="load-prev-return" style="padding: 8px 10px;">
                                ${t('common.actions.previous', 'السابق')}
                            </button>
                            <button class="btn btn-outline" type="button" data-action="load-next-return" style="padding: 8px 10px;">
                                ${t('common.actions.next', 'التالي')}
                            </button>
                        </div>
                        <span class="form-status-chip" style="color: var(--danger-color); background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.35);">${t('salesReturns.formStatusChip', 'مرتجع مبيعات')}</span>
                    </div>

                    <div class="invoice-top-grid">
                        <div class="form-group">
                            <label>${t('salesReturns.customer', 'العميل')}</label>
                            <select id="customerSelect" class="form-control">
                                <option value="">${t('common.actions.selectCustomer', 'اختر العميل')}</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>${t('salesReturns.originalInvoice', 'الفاتورة الأصلية')}</label>
                            <select id="invoiceSelect" class="form-control" disabled>
                                <option value="">${t('common.actions.selectInvoice', 'اختر الفاتورة')}</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>${t('salesReturns.returnNumber', 'رقم المرتجع')}</label>
                            <input type="text" id="returnNumber" class="form-control" placeholder="${t('common.actions.auto', 'تلقائي')}" readonly>
                        </div>
                        <div class="form-group">
                            <label>${t('salesReturns.returnDate', 'تاريخ المرتجع')}</label>
                            <input type="date" id="returnDate" class="form-control">
                        </div>
                    </div>

                    <div id="itemsSection" class="items-section" style="display: none;">
                        <div class="items-section-head">
                            <div class="items-section-title-wrap">
                                <h3 class="items-section-title">${t('salesReturns.invoiceItems', 'أصناف الفاتورة')}</h3>
                            </div>
                        </div>

                        <div class="items-table-wrap">
                            <table class="items-table">
                                <thead>
                                    <tr>
                                        <th style="width: 4%; text-align: center;">#</th>
                                        <th style="width: 5%;">${t('salesReturns.returnItem', 'إرجاع')}</th>
                                        <th style="width: 26%;">${t('salesReturns.item', 'الصنف')}</th>
                                        <th style="width: 10%;">${t('salesReturns.unit', 'الوحدة')}</th>
                                        <th style="width: 12%;">${t('salesReturns.soldQty', 'الكمية المباعة')}</th>
                                        <th style="width: 12%;">${t('salesReturns.returnedQty', 'مرتجع سابق')}</th>
                                        <th style="width: 12%;">${t('salesReturns.returnQty', 'كمية المرتجع')}</th>
                                        <th style="width: 12%;">${t('salesReturns.price', 'السعر')}</th>
                                        <th style="width: 12%;">${t('salesReturns.total', 'الإجمالي')}</th>
                                    </tr>
                                </thead>
                                <tbody id="itemsBody"></tbody>
                            </table>
                        </div>
                    </div>

                    <div class="invoice-footer-grid">
                        <div class="notes-section">
                            <div class="form-group" style="height: 100%; display: flex; flex-direction: column;">
                                <label>${t('salesReturns.notes', 'ملاحظات / سبب الإرجاع')}</label>
                                <textarea id="returnNotes" class="form-control" placeholder="${t('salesReturns.notesPlaceholder', 'اكتب أي ملاحظات إضافية...')}" style="flex: 1; resize: none;"></textarea>
                            </div>
                        </div>

                        <div class="totals-panel" style="display: flex; flex-direction: column;">
                            <div class="total-row grand-total" style="border-top: none; margin-top: 0; padding-top: 0;">
                                <span>${t('salesReturns.returnTotal', 'إجمالي المرتجع:')}</span>
                                <span id="returnTotal" class="customer-due-value due-positive">0.00</span>
                            </div>
                            <div style="display: flex; gap: 10px; margin-top: auto; padding-top: 15px;">
                                <button class="btn btn-outline" style="flex: 1;" type="button" data-action="reset-form">
                                    <i class="fas fa-eraser"></i> ${t('common.actions.clear', 'تفريغ')}
                                </button>
                                <button class="btn btn-success" style="flex: 2; margin-top: 0; background: linear-gradient(135deg, #ef4444, #dc2626); box-shadow: 0 12px 24px rgba(239, 68, 68, 0.28);" id="saveBtn" type="button" data-action="save-return" disabled>
                                    <i class="fas fa-save"></i> ${t('salesReturns.saveReturn', 'حفظ المرتجع')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="invoice-form-container" style="margin-top: 30px;">
                <div class="history-header" style="padding: 20px 25px; border-bottom: 1px solid var(--card-border); display: flex; justify-content: space-between; align-items: center; background: var(--bg-color);">
                    <h3 style="margin: 0; color: var(--primary-color); display: flex; align-items: center; gap: 8px; font-weight: 800;"><i class="fas fa-history"></i> ${t('salesReturns.historyTitle', 'سجل المردودات')}</h3>
                </div>
                <div id="historyContent">
                    <div class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <p>${t('common.state.noReturns', 'لا توجد مردودات مسجلة')}</p>
                    </div>
                </div>
            </div>

            <div id="salesPrintPreviewModal" class="sales-print-preview-modal" style="display: none;" aria-hidden="true">
                <div class="sales-print-preview-panel" role="dialog" aria-modal="true" aria-label="معاينة مرتجع المبيعات">
                    <div class="sales-print-preview-header">
                        <div>
                            <h3 class="sales-print-preview-title">معاينة مرتجع مبيعات</h3>
                            <p id="salesPrintPrinterStatus" class="sales-print-preview-subtitle"></p>
                        </div>
                        <div class="sales-print-preview-actions">
                            <button class="btn btn-outline" type="button" data-action="change-print-printer" id="salesPrintChangePrinterBtn" style="display: none;">تغيير الطابعة</button>
                            <button class="btn btn-success" type="button" data-action="confirm-print-return" id="salesPrintConfirmBtn">طباعة</button>
                            <button class="btn btn-outline" type="button" data-action="close-print-preview">إغلاق</button>
                        </div>
                    </div>
                    <div id="salesPrintPrinterPicker" class="sales-print-printer-picker" style="display: none;">
                        <label for="salesPrintPrinterSelect">اختر الطابعة</label>
                        <select id="salesPrintPrinterSelect" class="form-control"></select>
                    </div>
                    <div class="sales-print-preview-body">
                        <div id="salesPrintPreviewPage" class="sales-print-preview-page"></div>
                    </div>
                </div>
            </div>

            <!-- Print Template -->
            <div id="printArea" class="print-shell"
                style="display: none; direction: rtl; font-family: 'Helvetica Neue', Arial, sans-serif; padding: 30px; color: #000; background: #fff;">
                <div class="print-head" style="text-align: center; margin-bottom: 20px;">
                    <h2 id="printCompanyName" class="print-company-name"
                        style="font-size: 28px; font-weight: bold; margin: 0 0 5px 0;"></h2>
                    <p style="font-size: 15px; margin: 0 0 15px 0;"><span id="printCompanyInfo"></span></p>

                    <div class="print-header-details"
                        style="display: flex; justify-content: space-between; margin-top: 20px; font-size: 15px; font-weight: 500; border-bottom: 3px solid #000; padding-bottom: 15px;">
                        <div><strong>العميل:</strong> <span id="printCustomerName"></span></div>
                        <div><strong>التاريخ:</strong> <span id="printInvoiceDate"></span></div>
                        <div><strong>رقم المرتجع:</strong> <span id="printInvoiceNumber"></span></div>
                    </div>

                    <h1
                        style="font-size: 22px; font-weight: bold; text-decoration: underline; margin: 20px 0 10px 0; letter-spacing: 1px;">
                        فاتورة مرتجع مبيعات</h1>
                </div>

                <div class="print-body">
                    <table class="print-items-table"
                        style="width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 10px; border-top: 2px solid #000; border-right: 2px solid #000; border-bottom: none; border-left: none;">
                        <thead>
                            <tr style="background-color: #f5f5f5;">
                                <th
                                    style="border-left: 1px solid #000; border-bottom: 2px solid #000; border-right: none; border-top: none; padding: 10px; font-size: 15px; font-weight: bold; text-align: center; width: 5%;">
                                    م</th>
                                <th
                                    style="border-left: 1px solid #000; border-bottom: 2px solid #000; border-right: none; border-top: none; padding: 10px; font-size: 15px; font-weight: bold; text-align: right; width: 55%;">
                                    الصنف</th>
                                <th
                                    style="border-left: 1px solid #000; border-bottom: 2px solid #000; border-right: none; border-top: none; padding: 10px; font-size: 15px; font-weight: bold; text-align: center; width: 10%;">
                                    الكمية المرتجعة</th>
                                <th
                                    style="border-left: 1px solid #000; border-bottom: 2px solid #000; border-right: none; border-top: none; padding: 10px; font-size: 15px; font-weight: bold; text-align: right; width: 15%;">
                                    السعر</th>
                                <th
                                    style="border-left: 1px solid #000; border-bottom: 2px solid #000; border-right: none; border-top: none; padding: 10px; font-size: 15px; font-weight: bold; text-align: right; width: 15%;">
                                    الإجمالي</th>
                            </tr>
                        </thead>
                        <tbody id="printInvoiceItems" style="font-size: 15px; font-weight: 500;">
                        </tbody>
                    </table>

                    <div class="print-summary" style="width: 100%; margin-top: 20px; page-break-inside: avoid; break-inside: avoid;">
                        <table class="print-summary-table"
                            style="width: 45%; margin-right: auto; border-collapse: collapse; border: 2px solid #000; font-size: 15px;">
                            <tr style="border-bottom: 1px solid #000;">
                                <td style="padding: 8px; text-align: right; font-weight: bold; width: 60%;">إجمالي المرتجع:
                                </td>
                                <td id="printInvoiceTotal"
                                    style="border-right: 1px solid #000; padding: 8px; text-align: left; font-weight: bold; width: 40%;">
                                    0.00</td>
                            </tr>
                        </table>
                    </div>
                </div>

                <div class="print-footer"
                    style="margin-top: 40px; text-align: center; font-size: 14px; font-weight: bold; border-top: 1px dashed #000; padding-top: 15px;">
                    <p id="printFooterText">شكراً لتعاملكم معنا</p>
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
            <td class="row-index"></td>
            <td style="text-align: center; vertical-align: middle;"><input type="checkbox" class="return-checkbox" data-index="${index}" ${availableToReturn <= 0 ? 'disabled' : ''}></td>
            <td class="item-name" style="text-align: center; vertical-align: middle;">
                <div style="display:flex; justify-content:center; align-items:center; gap:8px;">
                    ${item.item_name || t('common.state.deletedItem', 'Deleted Item')}
                    <span class="item-stock-badge empty"></span>
                </div>
            </td>
            <td style="text-align: center; vertical-align: middle;"><div class="unit-label" style="margin: 0 auto;">${item.unit_name || '-'}</div></td>
            <td style="text-align: center; vertical-align: middle; font-weight: 600;">${quantity}</td>
            <td class="returned-qty" style="text-align: center; vertical-align: middle;">${returnedQty > 0 ? returnedQty : '-'}</td>
            <td style="text-align: center; vertical-align: middle;">
                <input type="number" class="form-control quantity-input return-qty-input" data-fs-size="sm" data-index="${index}" min="0" max="${availableToReturn}" step="any" value="0" disabled>
            </td>
            <td style="text-align: center; vertical-align: middle;">
                <input type="number" class="form-control price-input return-price-input" data-fs-size="sm" data-index="${index}" value="${toSafeNumber(item.sale_price)}" step="any" disabled>
            </td>
            <td class="row-total" data-index="${index}" style="text-align: center; vertical-align: middle;">0.00</td>
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
            ? t('salesReturns.editReturnTitle', 'تعديل بيانات المرتجع')
            : t('salesReturns.newReturnTitle', 'تسجيل مرتجع جديد');

        const saveText = isEditing
            ? t('salesReturns.updateReturn', 'تحديث المرتجع')
            : t('salesReturns.saveReturn', 'حفظ المرتجع');

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
                ${rows.map((row) => {
                    const returnNumberCell = window.renderDocNumberCell
                        ? window.renderDocNumberCell(row.return_number, { numberTag: 'span' })
                        : (row.return_number || '-');
                    const originalInvoiceCell = window.renderDocNumberCell
                        ? window.renderDocNumberCell(row.original_invoice_number, { numberTag: 'span' })
                        : (row.original_invoice_number || '-');

                    return `
                    <tr>
                        <td><span class="badge badge-return"><i class="fas fa-undo-alt"></i> ${returnNumberCell}</span></td>
                        <td>${originalInvoiceCell}</td>
                        <td>${row.customer_name || '-'}</td>
                        <td>${row.return_date || '-'}</td>
                        <td style="font-weight: 700; color: #ef4444;">${(Number(row.total_amount) || 0).toFixed(2)}</td>
                        <td>
                            <button class="btn btn-sm btn-delete" type="button" data-action="delete-return" data-id="${row.id}">
                                <i class="fas fa-trash"></i> ${t('common.actions.delete', 'Delete')}
                            </button>
                        </td>
                    </tr>
                `;
                }).join('')}
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
