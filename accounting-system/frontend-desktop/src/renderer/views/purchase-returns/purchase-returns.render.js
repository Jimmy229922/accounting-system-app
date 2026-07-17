(function () {
    function renderPage({ t, getNavHTML }) {
        document.title = t('purchaseReturns.title', 'مردودات المشتريات');

        const app = document.getElementById('app');
        app.innerHTML = `
        ${getNavHTML()}

        <div class="content purchase-content">
            <div class="purchase-page-header" style="margin-bottom: 25px; padding: 20px 25px; background: linear-gradient(135deg, var(--bg-color), rgba(var(--primary-rgb), 0.03)); border-radius: 12px; border: 1px solid var(--card-border); box-shadow: 0 4px 6px rgba(0,0,0,0.02); display: flex; justify-content: space-between; align-items: center;">
                <div class="purchase-title-wrap">
                    <h1 class="page-title" style="margin: 0 0 5px 0; font-size: 1.5rem; color: var(--text-color); display: flex; align-items: center; gap: 10px;"><i class="fas fa-undo-alt" style="color: var(--warning-color);"></i> ${t('purchaseReturns.title', 'مردودات المشتريات')}</h1>
                    <p class="purchase-subtitle" style="margin: 0; color: var(--text-muted); font-size: 0.95rem;">${t('purchaseReturns.subtitle', 'إدارة وتسجيل المرتجعات لفواتير الشراء بشكل سريع ومنظم.')}</p>
                </div>
            </div>

            <div id="invoiceForm" class="invoice-form-container">
                <div class="invoice-shell" style="background: var(--card-bg); border-radius: 16px; box-shadow: 0 8px 30px rgba(0,0,0,0.04); border: 1px solid var(--card-border); padding: 25px;">
                    <div class="form-title-row" style="display: flex; align-items: center; gap: 10px; border-bottom: 2px solid rgba(var(--primary-rgb), 0.1); padding-bottom: 15px; margin-bottom: 25px;">
                        <h2 class="form-title" style="margin: 0; display: flex; align-items: center; gap: 10px; font-size: 1.3rem; color: var(--primary-color);">
                            <i class="fas fa-file-invoice"></i> ${t('purchaseReturns.newReturnTitle', 'تسجيل مرتجع مشتريات جديد')}
                        </h2>
                        <div style="display: flex; gap: 8px; margin-inline-start: auto; align-items: center;">
                            <button class="btn btn-outline" type="button" data-action="print-return" id="printReturnBtn" disabled style="padding: 8px 12px; opacity: 0.5; cursor: not-allowed;" title="${t('purchaseReturns.printReturn', 'طباعة المرتجع')}">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                            </button>
                            <button class="btn btn-outline" type="button" data-action="load-prev-return" style="padding: 8px 10px;">
                                ${t('common.actions.previous', 'السابق')}
                            </button>
                            <button class="btn btn-outline" type="button" data-action="load-next-return" style="padding: 8px 10px;">
                                ${t('common.actions.next', 'التالي')}
                            </button>
                        </div>
                        <span class="form-status-chip" style="color: var(--warning-color); background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.35); padding: 6px 16px; border-radius: 20px; font-size: 0.85rem; font-weight: 600;">
                            ${t('purchaseReturns.formStatusChip', 'مرتجع مشتريات')}
                        </span>
                    </div>

                    <div class="invoice-top-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-bottom: 30px;">
                        <div class="form-group">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-color);">${t('purchaseReturns.supplier', 'المورد')}</label>
                            <select id="supplierSelect" class="form-control" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color);">
                                <option value="">${t('common.actions.selectSupplier', 'اختر المورد')}</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-color);">${t('purchaseReturns.originalInvoice', 'الفاتورة الأصلية')}</label>
                            <select id="invoiceSelect" class="form-control" disabled style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color);">
                                <option value="">${t('common.actions.selectInvoice', 'اختر الفاتورة')}</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-color);">${t('purchaseReturns.returnNumber', 'رقم المرتجع')}</label>
                            <input type="text" id="returnNumber" class="form-control" placeholder="${t('common.actions.auto', 'تلقائي')}" readonly style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-color);">
                        </div>
                        <div class="form-group">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-color);">${t('purchaseReturns.returnDate', 'تاريخ المرتجع')}</label>
                            <input type="date" id="returnDate" class="form-control" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color);">
                        </div>
                    </div>

                    <div id="itemsSection" class="items-section" style="display: none; background: rgba(var(--primary-rgb), 0.02); border-radius: 12px; padding: 20px; border: 1px solid var(--card-border); margin-bottom: 30px;">
                        <div class="items-section-head" style="margin-bottom: 15px;">
                            <div class="items-section-title-wrap">
                                <h3 class="items-section-title" style="margin: 0; font-size: 1.1rem; color: var(--text-color);"><i class="fas fa-list"></i> ${t('purchaseReturns.invoiceItems', 'أصناف الفاتورة')}</h3>
                            </div>
                        </div>

                        <div class="items-table-wrap" style="overflow-x: auto;">
                            <table class="items-table" style="width: 100%; border-collapse: collapse; background: var(--card-bg); border-radius: 8px; overflow: hidden;">
                                <thead>
                                    <tr style="background: var(--bg-color); border-bottom: 2px solid var(--card-border);">
                                        <th style="padding: 12px; text-align: center; width: 4%;">#</th>
                                        <th style="padding: 12px; text-align: center; width: 5%;">${t('purchaseReturns.returnItem', 'إرجاع')}</th>
                                        <th style="padding: 12px; text-align: center; width: 26%;">${t('purchaseReturns.item', 'الصنف')}</th>
                                        <th style="padding: 12px; text-align: center; width: 10%;">${t('purchaseReturns.unit', 'الوحدة')}</th>
                                        <th style="padding: 12px; text-align: center; width: 12%;">${t('purchaseReturns.boughtQty', 'الكمية المشتراة')}</th>
                                        <th style="padding: 12px; text-align: center; width: 12%;">${t('purchaseReturns.returnedQty', 'مرتجع سابق')}</th>
                                        <th style="padding: 12px; text-align: center; width: 12%;">${t('purchaseReturns.returnQty', 'كمية المرتجع')}</th>
                                        <th style="padding: 12px; text-align: center; width: 12%;">${t('purchaseReturns.price', 'السعر')}</th>
                                        <th style="padding: 12px; text-align: center; width: 12%;">${t('purchaseReturns.total', 'الإجمالي')}</th>
                                    </tr>
                                </thead>
                                <tbody id="itemsBody"></tbody>
                            </table>
                        </div>
                    </div>

                    <div class="invoice-footer-grid" style="display: grid; grid-template-columns: 2fr 1fr; gap: 30px; margin-top: 20px;">
                        <div class="notes-section">
                            <div class="form-group" style="height: 100%; display: flex; flex-direction: column;">
                                <label style="margin-bottom: 8px; font-weight: 600; color: var(--text-color);">${t('purchaseReturns.notes', 'ملاحظات / سبب الإرجاع')}</label>
                                <textarea id="returnNotes" class="form-control" placeholder="${t('purchaseReturns.notesPlaceholder', 'اكتب أي ملاحظات إضافية...')}" style="flex: 1; resize: none; padding: 15px; border-radius: 8px; border: 1px solid var(--border-color);"></textarea>
                            </div>
                        </div>

                        <div class="totals-panel" style="background: rgba(var(--primary-rgb), 0.03); border: 1px solid rgba(var(--primary-rgb), 0.1); border-radius: 12px; padding: 20px; display: flex; flex-direction: column;">
                            <div class="total-row grand-total" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 15px; margin-bottom: 15px;">
                                <span style="font-size: 1.1rem; font-weight: 600;">${t('purchaseReturns.returnTotal', 'إجمالي المرتجع:')}</span>
                                <span id="returnTotal" class="supplier-due-value due-negative" style="font-size: 1.5rem; font-weight: 800; color: var(--warning-color);">0.00</span>
                            </div>
                            <div style="display: flex; gap: 10px; margin-top: auto;">
                                <button class="btn btn-outline" style="flex: 1; padding: 12px; border-radius: 8px;" type="button" data-action="reset-form">
                                    <i class="fas fa-eraser"></i> ${t('common.actions.clear', 'تفريغ')}
                                </button>
                                <button class="btn btn-warning" style="flex: 2; padding: 12px; border-radius: 8px; background: linear-gradient(135deg, #f59e0b, #d97706); border: none; color: white; font-weight: bold; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);" id="saveBtn" type="button" data-action="save-return" disabled>
                                    <i class="fas fa-save"></i> ${t('purchaseReturns.saveReturn', 'حفظ المرتجع')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="invoice-form-container" style="margin-top: 30px;">
                <div class="history-header" style="padding: 20px 25px; border: 1px solid var(--card-border); border-radius: 12px 12px 0 0; border-bottom: none; display: flex; justify-content: space-between; align-items: center; background: var(--card-bg);">
                    <h3 style="margin: 0; color: var(--primary-color); display: flex; align-items: center; gap: 8px; font-weight: 800;"><i class="fas fa-history"></i> ${t('purchaseReturns.historyTitle', 'سجل المرتجعات')}</h3>
                </div>
                <div id="historyContent" style="background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 0 0 12px 12px; overflow: hidden;">
                    <div class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <p>${t('common.state.noReturns', 'لا توجد مرتجعات مسجلة')}</p>
                    </div>
                </div>
            </div>

            <div id="salesPrintPreviewModal" class="sales-print-preview-modal" style="display: none;" aria-hidden="true">
                <div class="sales-print-preview-panel" role="dialog" aria-modal="true" aria-label="معاينة مرتجع المشتريات">
                    <div class="sales-print-preview-header">
                        <div>
                            <h3 class="sales-print-preview-title">معاينة مرتجع مشتريات</h3>
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
                        <div><strong>المورد:</strong> <span id="printCustomerName"></span></div>
                        <div><strong>التاريخ:</strong> <span id="printInvoiceDate"></span></div>
                        <div><strong>رقم المرتجع:</strong> <span id="printInvoiceNumber"></span></div>
                    </div>

                    <h1
                        style="font-size: 22px; font-weight: bold; text-decoration: underline; margin: 20px 0 10px 0; letter-spacing: 1px;">
                        فاتورة مرتجع مشتريات</h1>
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
                <input type="number" class="form-control quantity-input return-qty-input" data-index="${index}" min="0" max="${availableToReturn}" step="any" value="0" disabled style="width: 100%; border: 1px solid var(--border-color); padding: 5px; border-radius: 4px; text-align: center;">
            </td>
            <td style="text-align: center; vertical-align: middle;">
                <input type="number" class="form-control price-input return-price-input" data-index="${index}" value="${toSafeNumber(item.cost_price)}" step="any" disabled style="width: 100%; border: 1px solid var(--border-color); padding: 5px; border-radius: 4px; text-align: center;">
            </td>
            <td class="row-total" data-index="${index}" style="text-align: center; vertical-align: middle; font-weight: 600; color: var(--primary-color);">0.00</td>
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
            ? t('purchaseReturns.editReturnTitle', 'تعديل بيانات المرتجع')
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
                        <td>${row.supplier_name || '-'}</td>
                        <td>${row.return_date || '-'}</td>
                        <td style="font-weight: 700; color: #f59e0b;">${(Number(row.total_amount) || 0).toFixed(2)}</td>
                        <td>
                            <button class="btn btn-sm btn-delete" type="button" data-action="delete-return" data-id="${row.id}">
                                <i class="fas fa-trash"></i> ${t('common.actions.delete', 'حذف')}
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

    window.purchaseReturnsPageRender = {
        renderPage,
        createInvoiceItemRow,
        setFormMode,
        renderEmptyHistory,
        renderHistoryTable
    };
})();
