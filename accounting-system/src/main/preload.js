const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Units API
    getUnits: () => ipcRenderer.invoke('get-units'),
    addUnit: (name) => ipcRenderer.invoke('add-unit', name),
    updateUnit: (unit) => ipcRenderer.invoke('update-unit', unit),
    deleteUnit: (id) => ipcRenderer.invoke('delete-unit', id),

    // Items API
    getItems: () => ipcRenderer.invoke('get-items'),
    addItem: (item) => ipcRenderer.invoke('add-item', item),
    updateItem: (item) => ipcRenderer.invoke('update-item', item),
    deleteItem: (id) => ipcRenderer.invoke('delete-item', id),

    // Warehouses & Opening Balance
    getWarehouses: () => ipcRenderer.invoke('get-warehouses'),
    addWarehouse: (name) => ipcRenderer.invoke('add-warehouse', name),
    updateWarehouse: (data) => ipcRenderer.invoke('update-warehouse', data),
    deleteWarehouse: (id) => ipcRenderer.invoke('delete-warehouse', id),
    getOpeningBalances: () => ipcRenderer.invoke('get-opening-balances'),
    saveOpeningBalances: (entries) => ipcRenderer.invoke('save-opening-balances', { entries }),
    addOpeningBalance: (entry) => ipcRenderer.invoke('add-opening-balance', entry),
    updateOpeningBalance: (entry) => ipcRenderer.invoke('update-opening-balance', entry),
    deleteOpeningBalance: (id) => ipcRenderer.invoke('delete-opening-balance', id),
    addOpeningBalanceGroup: (data) => ipcRenderer.invoke('add-opening-balance-group', data),
    getOpeningBalanceGroups: () => ipcRenderer.invoke('get-opening-balance-groups'),
    getOpeningBalanceGroup: (id) => ipcRenderer.invoke('get-opening-balance-group', id),
    getGroupDetails: (groupId) => ipcRenderer.invoke('get-group-details', groupId),
    updateOpeningBalanceGroup: (data) => ipcRenderer.invoke('update-opening-balance-group', data),
    deleteOpeningBalanceGroup: (groupId) => ipcRenderer.invoke('delete-opening-balance-group', groupId),

    // Customers API
    getCustomers: () => ipcRenderer.invoke('get-customers'),
    addCustomer: (customer) => ipcRenderer.invoke('add-customer', customer),
    updateCustomer: (customer) => ipcRenderer.invoke('update-customer', customer),
    deleteCustomer: (id) => ipcRenderer.invoke('delete-customer', id),

    // Suppliers API
    getSuppliers: () => ipcRenderer.invoke('get-suppliers'),
    addSupplier: (supplier) => ipcRenderer.invoke('add-supplier', supplier),
    deleteSupplier: (id) => ipcRenderer.invoke('delete-supplier', id),

    // Purchase Invoices API
    getPurchaseInvoices: () => ipcRenderer.invoke('get-purchase-invoices'),
    savePurchaseInvoice: (data) => ipcRenderer.invoke('save-purchase-invoice', data),

    // Sales Invoices API
    getSalesInvoices: () => ipcRenderer.invoke('get-sales-invoices'),
    saveSalesInvoice: (data) => ipcRenderer.invoke('save-sales-invoice', data),

    // Treasury API
    getTreasuryBalance: () => ipcRenderer.invoke('get-treasury-balance'),
    getTreasuryTransactions: () => ipcRenderer.invoke('get-treasury-transactions'),
    addTreasuryTransaction: (data) => ipcRenderer.invoke('add-treasury-transaction', data),
    updateTreasuryTransaction: (data) => ipcRenderer.invoke('update-treasury-transaction', data),
    deleteTreasuryTransaction: (id) => ipcRenderer.invoke('delete-treasury-transaction', id),

    // Inventory API
    getItemTransactions: (itemId, startDate = null, endDate = null) => ipcRenderer.invoke('get-item-transactions', { itemId, startDate, endDate }),

    // Dashboard API
    getDashboardStats: () => ipcRenderer.invoke('get-dashboard-stats'),

    // Helper API
    getNextInvoiceNumber: (type) => ipcRenderer.invoke('get-next-invoice-number', type),

    // Reports API
    getAllReports: (filters) => ipcRenderer.invoke('get-all-reports', filters),
    getCustomerFullReport: (customerId) => ipcRenderer.invoke('get-customer-full-report', customerId),
    deleteInvoice: (id, type) => ipcRenderer.invoke('delete-invoice', { id, type }),
    getInvoiceWithDetails: (id, type) => ipcRenderer.invoke('get-invoice-with-details', { id, type }),
    updateSalesInvoice: (data) => ipcRenderer.invoke('update-sales-invoice', data),
    updatePurchaseInvoice: (data) => ipcRenderer.invoke('update-purchase-invoice', data),

    // Settings API
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

    // Invite Code API
    checkInviteStatus: () => ipcRenderer.invoke('get-invite-status'),
    submitInviteCode: (code) => ipcRenderer.invoke('submit-invite-code', code),
    notifyInviteUnlocked: () => ipcRenderer.send('invite-unlocked'),

    // Backup & Restore API
    backupDatabase: () => ipcRenderer.invoke('backup-database'),
    restoreDatabase: () => ipcRenderer.invoke('restore-database'),
    restartApp: () => ipcRenderer.invoke('restart-app')
});