(function () {
    function bindEvents({ root, dom, handlers }) {
        if (dom.supplierSelect) {
            dom.supplierSelect.addEventListener('change', handlers.onSupplierChange);
        }

        if (dom.invoiceSelect) {
            dom.invoiceSelect.addEventListener('change', handlers.onInvoiceChange);
        }

        if (dom.itemsBody) {
            dom.itemsBody.addEventListener('change', (event) => {
                const target = event.target;
                if (!target) return;

                if (target.classList.contains('return-checkbox')) {
                    handlers.onCheckboxChange(target);
                }
            });

            dom.itemsBody.addEventListener('input', (event) => {
                const target = event.target;
                if (!target) return;

                if (target.classList.contains('return-qty-input')) {
                    handlers.onQtyInput(target);
                    return;
                }

                if (target.classList.contains('return-price-input')) {
                    handlers.onPriceInput(target);
                }
            });
        }

        if (root) {
            root.addEventListener('click', (event) => {
                const actionEl = event.target.closest('[data-action]');
                if (!actionEl) return;

                const action = actionEl.dataset.action;
                if (action === 'reset-form') {
                    handlers.onResetForm();
                    return;
                }

                if (action === 'save-return') {
                    handlers.onSaveReturn();
                    return;
                }

                if (action === 'history-prev') {
                    handlers.onHistoryPrev();
                    return;
                }

                if (action === 'history-next') {
                    handlers.onHistoryNext();
                    return;
                }

                if (action === 'delete-return') {
                    const returnId = Number.parseInt(actionEl.dataset.id, 10);
                    handlers.onDeleteReturn(returnId);
                }
            });
        }
    }

    window.purchaseReturnsPageEvents = {
        bindEvents
    };
})();
