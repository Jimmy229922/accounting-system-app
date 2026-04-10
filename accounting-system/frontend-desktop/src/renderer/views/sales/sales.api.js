(function () {
    async function getNextInvoiceNumber() {
        return window.electronAPI.getNextInvoiceNumber('sales');
    }

    async function getInvoiceWithDetails(id) {
        return window.electronAPI.getInvoiceWithDetails(id, 'sales');
    }

    async function getCustomers() {
        const customers = await window.electronAPI.getCustomers();
        return customers.filter((c) => c.type === 'customer' || c.type === 'both');
    }

    async function getSalesInvoices() {
        return window.electronAPI.getSalesInvoices();
    }

    async function getItems() {
        return window.electronAPI.getItems();
    }

    async function saveInvoice(invoiceData) {
        return window.electronAPI.saveSalesInvoice(invoiceData);
    }

    async function updateInvoice(invoiceData) {
        return window.electronAPI.updateSalesInvoice(invoiceData);
    }

    window.salesPageApi = {
        getNextInvoiceNumber,
        getInvoiceWithDetails,
        getCustomers,
        getSalesInvoices,
        getItems,
        saveInvoice,
        updateInvoice
    };
})();

