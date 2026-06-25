const { ipcMain } = require('electron');
const { checkBackendHealth } = require('../backendClient');
const { repairWarehouseNamesEncoding } = require('./utils');
const auth = require('./auth');
const units = require('./units');
const warehouses = require('./warehouses');
const openingBalances = require('./openingBalances');
const items = require('./items');
const customers = require('./customers');

const purchases = require('./purchases');
const sales = require('./sales');
const treasury = require('./treasury');
const settings = require('./settings');
const invoices = require('./invoices');
const reports = require('./reports');
const backup = require('./backup');
const salesReturns = require('./salesReturns');
const purchaseReturns = require('./purchaseReturns');
const updater = require('./updater');

function setupIPC() {
    repairWarehouseNamesEncoding();

    ipcMain.handle('backend-health-check', async () => {
        return checkBackendHealth();
    });

    auth.register();
    units.register();
    warehouses.register();
    openingBalances.register();
    items.register();
    customers.register();

    purchases.register();
    sales.register();
    treasury.register();
    settings.register();
    invoices.register();
    reports.register();
    backup.register();
    salesReturns.register();
    purchaseReturns.register();
    updater.register();
}

module.exports = { setupIPC };
