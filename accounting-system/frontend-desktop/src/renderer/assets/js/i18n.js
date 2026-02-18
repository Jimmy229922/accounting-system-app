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

window.i18n = {
    loadArabicDictionary,
    getText
};

