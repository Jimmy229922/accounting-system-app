const path = require('path');
const Module = require('module');

const FRONTEND_MAIN_DIR = path.resolve(__dirname, '../../../../frontend-desktop/src/main');
const FRONTEND_HANDLERS_DIR = path.join(FRONTEND_MAIN_DIR, 'handlers');

function isFrontendMainModule(parent) {
    return Boolean(parent && typeof parent.filename === 'string' && parent.filename.startsWith(FRONTEND_MAIN_DIR));
}

function loadFrontendHandler(handlerName) {
    const backendDbModule = require('../db');
    const handlerPath = path.join(FRONTEND_HANDLERS_DIR, `${handlerName}.js`);
    const originalLoad = Module._load;

    Module._load = function patchedLoad(request, parent, isMain) {
        if (request === '../db' && isFrontendMainModule(parent)) {
            return backendDbModule;
        }
        return originalLoad.call(this, request, parent, isMain);
    };

    try {
        return require(handlerPath);
    } finally {
        Module._load = originalLoad;
    }
}

module.exports = { loadFrontendHandler };
