const mem = new Map();
const DEFAULT_TTL_MS = Number(process.env.PRODUCTS_CACHE_TTL_MS || 24 * 60 * 60 * 1000);

function memSet(key, value, ttl = DEFAULT_TTL_MS) {
    const expiresAt = Date.now() + ttl;
    mem.set(key, { value, expiresAt });
}

function memGet(key) {
    const entry = mem.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        mem.delete(key);
        return null;
    }
    return entry.value;
}

function memDel(key) { mem.delete(key); }
function memFlushAll() { mem.clear(); }

export async function cacheGet(key) { return memGet(key); }
export async function cacheSet(key, value, ttlMs = DEFAULT_TTL_MS) { return memSet(key, value, ttlMs); }
export async function cacheDel(key) { return memDel(key); }
export async function cacheFlushAll() { return memFlushAll(); }
