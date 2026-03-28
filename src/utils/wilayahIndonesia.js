// ===== WILAYAH INDONESIA API (api.co.id + cors-anywhere.fly.dev Proxy) =====
// Menggunakan proxy public untuk menghindari policy CORS di Firebase Hosting.

const IS_DEV = import.meta.env.DEV;
const API_KEY = 'bsvpXqFhfiLquJCM70fdk1MvyWeZ2zLl9t778a7nLl02TzdHcr';
const ORIGINAL_URL = 'https://use.api.co.id/regional/indonesia';
const PROXY_URL = `https://cors-anywhere.fly.dev/${ORIGINAL_URL}`;

const BASE_URL = IS_DEV ? '/api-wilayah/regional/indonesia' : PROXY_URL;

const _wilayahCache = {};

// Helper untuk membaca dan menyimpan cache di sessionStorage
const getFromCache = (key) => {
    if (_wilayahCache[key]) return _wilayahCache[key];
    try {
        const cached = sessionStorage.getItem(`wilayah_${key}`);
        if (cached) {
            const parsed = JSON.parse(cached);
            _wilayahCache[key] = parsed;
            return parsed;
        }
    } catch(e) {}
    return null;
};

const saveToCache = (key, data) => {
    _wilayahCache[key] = data;
    try {
        sessionStorage.setItem(`wilayah_${key}`, JSON.stringify(data));
    } catch(e) {}
};

async function fetchWilayah(endpoint) {
    const cached = getFromCache(endpoint);
    if (cached) return cached;

    try {
        // Fetch first page via Proxy
        const res = await fetch(`${BASE_URL}/${endpoint}`, {
            headers: { 'x-api-co-id': API_KEY }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        // api.co.id returns { is_success, data: [...], paging }
        let data = json.data || [];

        // Handle pagination: fetch remaining pages if total_page > 1
        const paging = json.paging;
        if (paging && paging.total_page > 1) {
            const separator = endpoint.includes('?') ? '&' : '?';
            const pageRequests = [];
            for (let page = 2; page <= paging.total_page; page++) {
                pageRequests.push(
                    fetch(`${BASE_URL}/${endpoint}${separator}page=${page}`, {
                        headers: { 'x-api-co-id': API_KEY }
                    }).then(r => r.ok ? r.json() : { data: [] })
                );
            }
            const results = await Promise.all(pageRequests);
            for (const r of results) {
                if (r.data && Array.isArray(r.data)) {
                    data = data.concat(r.data);
                }
            }
        }

        // Normalize: map { code, name } → { id, name } for compatibility
        const normalized = Array.isArray(data)
            ? data.map(item => ({ id: item.code, name: item.name, raw: item }))
            : [];
        saveToCache(endpoint, normalized);
        return normalized;
    } catch (e) {
        console.error('Error fetching wilayah:', endpoint, e);
        return [];
    }
}

/** Get all provinces */
export function getProvinsi() {
    return fetchWilayah('provinces');
}

/** Get kabupaten/kota by province code */
export function getKabupaten(provinsiCode) {
    if (!provinsiCode) return Promise.resolve([]);
    return fetchWilayah(`provinces/${provinsiCode}/regencies`);
}

/** Get kecamatan by regency code */
export function getKecamatan(regencyCode) {
    if (!regencyCode) return Promise.resolve([]);
    return fetchWilayah(`regencies/${regencyCode}/districts`);
}

/** Get kelurahan/desa by district code.
 *  Each item includes raw.postal_codes[] for auto-fill. */
export function getKelurahan(districtCode) {
    if (!districtCode) return Promise.resolve([]);
    return fetchWilayah(`districts/${districtCode}/villages`);
}

/** Search all regional data by query (name or postal code). Premium endpoint.
 *  Returns array of { province_code, province, city_code, city,
 *    district_code, district, village_code, village, postal_code }
 */
export async function searchWilayah(query) {
    if (!query) return [];
    const cacheKey = `search/${query}`;
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    try {
        const res = await fetch(
            `${BASE_URL}/search?query=${encodeURIComponent(query)}`,
            { headers: { 'x-api-co-id': API_KEY } }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        // search returns { result: [...] }
        const result = json.result || json.data || [];
        saveToCache(cacheKey, result);
        return result;
    } catch (e) {
        console.error('Error searching wilayah:', query, e);
        return [];
    }
}

/** Get villages by postal code (Premium). Returns full hierarchy. */
export async function getByKodePos(kodePos) {
    if (!kodePos || kodePos.length !== 5) return [];
    const cacheKey = `postal-codes/${kodePos}`;
    const cached = getFromCache(cacheKey);
    if (cached) return cached;
    try {
        const res = await fetch(`${BASE_URL}/postal-codes/${kodePos}`, {
            headers: { 'x-api-co-id': API_KEY }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const data = json.data || [];
        saveToCache(cacheKey, data);
        return data;
    } catch (e) {
        console.error('Error fetching by kode pos:', kodePos, e);
        return [];
    }
}
