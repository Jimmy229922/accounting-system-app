let arDictionaryCache = null;

function resolvePathCandidates() {
    return [
        '../../assets/i18n/ar.json',
        '../../../assets/i18n/ar.json',
        '../assets/i18n/ar.json',
        './assets/i18n/ar.json'
    ];
}

async function loadArabicDictionary() {
    if (arDictionaryCache) return arDictionaryCache;

    const paths = resolvePathCandidates();
    for (const p of paths) {
        try {
            const res = await fetch(p);
            if (!res.ok) continue;
            arDictionaryCache = await res.json();
            return arDictionaryCache;
        } catch (err) {
            // Try next candidate path.
        }
    }

    arDictionaryCache = {};
    return arDictionaryCache;
}

function getText(dict, key, fallback = '') {
    if (!dict || !key) return fallback;
    const value = key.split('.').reduce((acc, part) => {
        if (acc && typeof acc === 'object' && part in acc) return acc[part];
        return undefined;
    }, dict);
    return typeof value === 'string' ? value : fallback;
}

function formatTemplate(template, values = {}) {
    const source = String(template || '');
    return source.replace(/\{(\w+)\}/g, (match, key) => {
        if (Object.prototype.hasOwnProperty.call(values, key)) {
            return String(values[key]);
        }
        return match;
    });
}

function createPageHelpers(dictAccessor) {
    const getDict = typeof dictAccessor === 'function'
        ? dictAccessor
        : () => (dictAccessor && typeof dictAccessor === 'object' ? dictAccessor : {});

    return {
        t: (key, fallback = '') => getText(getDict(), key, fallback),
        fmt: (template, values = {}) => formatTemplate(template, values)
    };
}

window.i18n = {
    loadArabicDictionary,
    getText,
    formatTemplate,
    createPageHelpers
};

