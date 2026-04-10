(function () {
    function createInitialState() {
        return {
            allItems: [],
            editingInvoiceId: null,
            supplierAutocomplete: null,
            isSubmitting: false,
            ar: {},
            dom: {
                app: null,
                supplierSelect: null,
                invoiceDateInput: null,
                invoiceItemsBody: null,
                invoiceTotalSpan: null,
                invoiceForm: null
            }
        };
    }

    function initializeDomRefs(state) {
        state.dom.app = document.getElementById('app');
        state.dom.supplierSelect = document.getElementById('supplierSelect');
        state.dom.invoiceDateInput = document.getElementById('invoiceDate');
        state.dom.invoiceItemsBody = document.getElementById('invoiceItemsBody');
        state.dom.invoiceTotalSpan = document.getElementById('invoiceTotal');
        state.dom.invoiceForm = document.getElementById('invoiceForm');
        return state.dom;
    }

    window.purchasesPageState = {
        createInitialState,
        initializeDomRefs
    };
})();
