(function () {
    function createInitialState() {
        return {
            allItems: [],
            editingInvoiceId: null,
            customerAutocomplete: null,
            isSubmitting: false,
            ar: {},
            dom: {
                app: null,
                customerSelect: null,
                invoiceDateInput: null,
                invoiceItemsBody: null,
                invoiceTotalSpan: null,
                invoiceForm: null
            }
        };
    }

    function initializeDomRefs(state) {
        state.dom.app = document.getElementById('app');
        state.dom.customerSelect = document.getElementById('customerSelect');
        state.dom.invoiceDateInput = document.getElementById('invoiceDate');
        state.dom.invoiceItemsBody = document.getElementById('invoiceItemsBody');
        state.dom.invoiceTotalSpan = document.getElementById('invoiceTotal');
        state.dom.invoiceForm = document.getElementById('invoiceForm');
        return state.dom;
    }

    window.salesPageState = {
        createInitialState,
        initializeDomRefs
    };
})();

