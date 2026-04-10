(function () {
    function renderPage({ t, getNavHTML }) {
        const app = document.getElementById('app');
        app.innerHTML = `
        ${getNavHTML()}

        <div class="page-header">
            <h1 class="page-title">${t('purchases.pageTitle', 'فواتير المشتريات')}</h1>
        </div>

        <div id="invoiceForm" class="invoice-form-container">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0; color: var(--primary-color);">${t('purchases.formTitle', 'تسجيل فاتورة شراء جديدة')}</h2>
            </div>

            <div class="invoice-top-grid">
                <div class="form-group">
                    <label>${t('purchases.supplier', 'المورد')}</label>
                    <select id="supplierSelect" class="form-control">
                        <option value="">${t('purchases.selectSupplier', 'اختر المورد')}</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>${t('purchases.invoiceNumber', 'رقم الفاتورة')}</label>
                    <input type="text" id="invoiceNumber" class="form-control" list="invoiceSuggestions" placeholder="${t('purchases.invoiceNumberPlaceholder', 'تلقائي ويمكن تعديله يدويًا')}" autocomplete="off">
                    <datalist id="invoiceSuggestions"></datalist>
                </div>
                <div class="form-group">
                    <label>${t('purchases.invoiceDate', 'تاريخ الفاتورة')}</label>
                    <input type="date" id="invoiceDate" class="form-control">
                </div>
                <div class="form-group">
                    <label>${t('purchases.paymentType', 'طريقة الدفع')}</label>
                    <select id="paymentType" class="form-control">
                        <option value="cash">${t('purchases.paymentCash', 'كاش (نقدي)')}</option>
                        <option value="credit">${t('purchases.paymentCredit', 'آجل (ذمم)')}</option>
                    </select>
                </div>
            </div>

            <table class="items-table">
                <thead>
                    <tr>
                        <th style="width: 40%">${t('purchases.tableHeaders.item', 'الصنف')}</th>
                        <th style="width: 15%">${t('purchases.tableHeaders.qty', 'الكمية')}</th>
                        <th style="width: 20%">${t('purchases.tableHeaders.price', 'السعر')}</th>
                        <th style="width: 20%">${t('purchases.tableHeaders.total', 'الإجمالي')}</th>
                        <th style="width: 5%"></th>
                    </tr>
                </thead>
                <tbody id="invoiceItemsBody"></tbody>
            </table>

            <button class="btn btn-primary" type="button" data-action="add-row">
                <span>+</span> ${t('purchases.addItemBtn', 'إضافة صنف')}
            </button>

            <div class="invoice-footer-grid">
                <div class="form-group">
                    <label>${t('purchases.notes', 'ملاحظات')}</label>
                    <textarea id="invoiceNotes" class="form-control" rows="4"></textarea>
                </div>
                <div class="totals-panel">
                    <div class="total-row">
                        <span>${t('purchases.totalLabel', 'الإجمالي:')}</span>
                        <span id="invoiceTotal">0.00</span>
                    </div>
                    <div class="grand-total">
                        <span>${t('purchases.netLabel', 'الصافي:')}</span>
                        <span id="finalTotal">0.00</span>
                    </div>
                    <button class="btn btn-success" type="button" style="width: 100%; margin-top: 20px;" data-action="submit-invoice">
                        ${t('purchases.saveInvoice', 'حفظ الفاتورة')}
                    </button>
                </div>
            </div>
        </div>
    `;
    }

    function buildItemsOptions({ allItems, existingItem, t, fmt }) {
        let itemsOptions = `<option value="">${t('purchases.selectItem', 'اختر الصنف')}</option>`;
        allItems.forEach((item) => {
            const isSelected = existingItem && existingItem.item_id === item.id ? 'selected' : '';
            itemsOptions += `<option value="${item.id}" data-price="${item.cost_price}" ${isSelected}>${item.name} (${fmt(t('purchases.available', 'متاح: {qty}'), { qty: item.stock_quantity })})</option>`;
        });
        return itemsOptions;
    }

    function createInvoiceRow({ allItems, existingItem, t, fmt }) {
        const row = document.createElement('tr');
        row.dataset.id = String(Date.now());

        const quantity = existingItem ? existingItem.quantity : '';
        const price = existingItem ? existingItem.cost_price : 0;
        const total = existingItem ? existingItem.total_price : 0;

        row.innerHTML = `
        <td>
            <select class="form-control item-select">
                ${buildItemsOptions({ allItems, existingItem, t, fmt })}
            </select>
        </td>
        <td>
            <input type="text" autocomplete="off" class="form-control quantity-input" value="${quantity}" placeholder="0">
        </td>
        <td>
            <input type="text" autocomplete="off" class="form-control price-input" value="${price}">
        </td>
        <td>
            <span class="row-total">${total.toFixed(2)}</span>
        </td>
        <td>
            <span class="remove-row" data-action="remove-row">❌</span>
        </td>
    `;

        return row;
    }

    function setEditModeUI(t) {
        const title = document.querySelector('#invoiceForm h2');
        if (title) {
            title.textContent = t('purchases.editFormTitle', 'تعديل فاتورة شراء');
        }
        const saveBtn = document.querySelector('#invoiceForm .btn-success');
        if (saveBtn) {
            saveBtn.textContent = t('purchases.updateAndSave', 'تحديث وحفظ الفاتورة');
            saveBtn.disabled = false;
            saveBtn.removeAttribute('disabled');
        }
    }

    function setCreateModeUI(t) {
        const title = document.querySelector('#invoiceForm h2');
        if (title) {
            title.textContent = t('purchases.formTitle', 'تسجيل فاتورة شراء جديدة');
        }
        const saveBtn = document.querySelector('#invoiceForm .btn-success');
        if (saveBtn) {
            saveBtn.textContent = t('purchases.saveInvoice', 'حفظ الفاتورة');
            saveBtn.disabled = false;
            saveBtn.removeAttribute('disabled');
        }
    }

    window.purchasesPageRender = {
        renderPage,
        createInvoiceRow,
        setEditModeUI,
        setCreateModeUI
    };
})();
