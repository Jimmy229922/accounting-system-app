(function () {
    function bindStaticEvents({ root, dom, handlers }) {
        if (dom.customerSelect) {
            dom.customerSelect.addEventListener('change', handlers.onCustomerChange);
        }

        if (root) {
            root.addEventListener('click', (event) => {
                const actionEl = event.target.closest('[data-action]');
                if (!actionEl) return;

                const action = actionEl.dataset.action;
                if (action === 'add-row') {
                    handlers.onAddRow();
                    return;
                }

                if (action === 'submit-invoice') {
                    handlers.onSubmitInvoice();
                    return;
                }

                if (action === 'remove-row') {
                    handlers.onRemoveRow(actionEl);
                }
            });
        }
    }

    function bindRowsEvents({ dom, handlers }) {
        if (!dom.invoiceItemsBody) return;

        dom.invoiceItemsBody.addEventListener('change', (event) => {
            const target = event.target;
            if (target && target.classList.contains('item-select')) {
                handlers.onItemSelect(target);
            }
        });

        dom.invoiceItemsBody.addEventListener('input', (event) => {
            const target = event.target;
            if (!target) return;
            if (target.classList.contains('quantity-input') || target.classList.contains('price-input')) {
                handlers.onRowInput(target);
            }
        });
    }

    window.salesPageEvents = {
        bindStaticEvents,
        bindRowsEvents
    };
})();

