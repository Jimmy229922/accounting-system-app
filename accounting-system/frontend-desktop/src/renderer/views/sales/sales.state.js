(function () {
    function createInitialState() {
        return {
            allItems: [],
            editingInvoiceId: null,
            originalInvoiceItemTotalsByItemId: {},
            customerAutocomplete: null,
            isSubmitting: false,
            ar: {},
            dom: {
                app: null,
                customerSelect: null,
                invoiceDateInput: null,
                invoiceItemsBody: null,
                selectedItemAvailability: null,
                discountTypeSelect: null,
                discountValueInput: null,
                paidAmountInput: null,
                invoiceSubtotalSpan: null,
                invoiceDiscountAmountSpan: null,
                invoiceTotalSpan: null,
                invoicePaidDisplaySpan: null,
                invoiceRemainingSpan: null,
                invoiceForm: null
            }
        };
    }

    function initializeDomRefs(state) {
        state.dom.app = document.getElementById('app');
        state.dom.customerSelect = document.getElementById('customerSelect');
        state.dom.invoiceDateInput = document.getElementById('invoiceDate');
        state.dom.invoiceItemsBody = document.getElementById('invoiceItemsBody');
        state.dom.selectedItemAvailability = document.getElementById('selectedItemAvailability');
        state.dom.discountTypeSelect = document.getElementById('discountType');
        state.dom.discountValueInput = document.getElementById('discountValue');
        state.dom.paidAmountInput = document.getElementById('paidAmount');
        state.dom.invoiceSubtotalSpan = document.getElementById('invoiceSubtotal');
        state.dom.invoiceDiscountAmountSpan = document.getElementById('invoiceDiscountAmount');
        state.dom.invoiceTotalSpan = document.getElementById('invoiceTotal');
        state.dom.invoicePaidDisplaySpan = document.getElementById('invoicePaidDisplay');
        state.dom.invoiceRemainingSpan = document.getElementById('invoiceRemaining');
        state.dom.invoiceForm = document.getElementById('invoiceForm');
        return state.dom;
    }

    window.salesPageState = {
        createInitialState,
        initializeDomRefs
    };
})();

