const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const preloadPath = path.join(rootDir, 'frontend-desktop', 'src', 'main', 'preload.js');
const contractPath = path.join(rootDir, 'backend', 'src', 'contracts', 'public-channels.json');

const preloadSource = fs.readFileSync(preloadPath, 'utf8');
const invokeRegex = /invokeChannel\(\s*['"]([^'"]+)['"]/g;
const channels = new Set();

let match = invokeRegex.exec(preloadSource);
while (match) {
    channels.add(match[1]);
    match = invokeRegex.exec(preloadSource);
}

const sortedChannels = [...channels].sort();
fs.mkdirSync(path.dirname(contractPath), { recursive: true });
fs.writeFileSync(contractPath, `${JSON.stringify(sortedChannels, null, 2)}\n`);

console.log(`[sync] backend channel contract updated (${sortedChannels.length} channels)`);
