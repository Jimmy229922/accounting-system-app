const { getCompatibilityReport, invokeChannel } = require('../src/compat/runtime');

async function main() {
    const report = getCompatibilityReport();

    console.log('[compat] preload channels:', report.preloadCount);
    console.log('[compat] registered handlers:', report.registeredCount);
    console.log('[compat] missing channels:', report.missingChannels.length);

    if (report.missingChannels.length > 0) {
        console.log('[compat] missing list:', report.missingChannels.join(', '));
        process.exitCode = 1;
        return;
    }

    // Minimal live smoke calls against core modules.
    const units = await invokeChannel('get-units', []);
    const items = await invokeChannel('get-items', []);
    const customers = await invokeChannel('get-customers', []);
    const stats = await invokeChannel('get-dashboard-stats', []);

    console.log('[smoke] units:', Array.isArray(units) ? units.length : 'invalid');
    console.log('[smoke] items:', Array.isArray(items) ? items.length : 'invalid');
    console.log('[smoke] customers:', Array.isArray(customers) ? customers.length : 'invalid');
    console.log('[smoke] dashboard stats keys:', stats && typeof stats === 'object' ? Object.keys(stats).length : 'invalid');
}

main().catch((error) => {
    console.error('[compat] failed:', error.message);
    process.exitCode = 1;
});
