const { db } = require('../db');

function sanitizeSuggestedFileName(name) {
    const safe = String(name || '').trim() || 'report.pdf';
    // Remove characters illegal on Windows filenames.
    return safe
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
        .replace(/\.+$/g, '.')
        .replace(/\s+/g, ' ')
        .trim();
}

function decodeArabicMojibake(value) {
    if (typeof value !== 'string' || !/[ØÙ]/.test(value)) {
        return value;
    }

    try {
        const decoded = Buffer.from(value, 'latin1').toString('utf8');
        if (decoded && !decoded.includes('�') && /[\u0600-\u06FF]/.test(decoded)) {
            return decoded;
        }
    } catch (error) {
        // Keep original on decode failure
    }

    return value;
}

function repairWarehouseNamesEncoding() {
    try {
        const rows = db.prepare('SELECT id, name FROM warehouses').all();
        for (const row of rows) {
            const decoded = decodeArabicMojibake(row.name);
            if (decoded !== row.name) {
                db.prepare('UPDATE warehouses SET name = ? WHERE id = ?').run(decoded, row.id);
            }
        }
    } catch (error) {
        // Table may not exist yet – safe to ignore
    }
}

module.exports = { sanitizeSuggestedFileName, decodeArabicMojibake, repairWarehouseNamesEncoding };
