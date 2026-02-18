const fs = require('fs');
const path = require('path');

const CONTRACT_PATH = path.resolve(__dirname, '../contracts/public-channels.json');

function extractInvokeChannels() {
    const raw = fs.readFileSync(CONTRACT_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
        throw new Error(`Invalid channel contract format in ${CONTRACT_PATH}`);
    }
    return parsed.slice().sort();
}

module.exports = {
    extractInvokeChannels,
    CONTRACT_PATH
};
