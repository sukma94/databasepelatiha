import { collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, orderBy, where, writeBatch } from "firebase/firestore";
import { db } from './firebase';

// ===== IN-MEMORY CACHE =====
const _cache = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function cachedGet(key) {
    const entry = _cache[key];
    if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
    return undefined;
}

function cachedSet(key, data) {
    _cache[key] = { data, ts: Date.now() };
}

function cacheInvalidate(...keys) {
    keys.forEach(k => {
        // Support prefix invalidation with wildcard
        if (k.endsWith('*')) {
            const prefix = k.slice(0, -1);
            Object.keys(_cache).forEach(ck => { if (ck.startsWith(prefix)) delete _cache[ck]; });
        } else {
            delete _cache[k];
        }
    });
}

const STORAGE_KEY = 'databasePelatihan_peserta';
const LEVELS_KEY = 'databasePelatihan_levels';
const SETTINGS_KEY = 'databasePelatihan_app_settings';
const CASHFLOW_KEY = 'databasePelatihan_cashflow';

const DEFAULT_SETTINGS = {
    appTitle: 'DATABASE PELATIHAN',
    logoLight: '', // Base64 or Blob URL
    logoDark: '',
    fontFamily: 'Inter',
};

const DEFAULT_LEVELS = {
    'Level 1': { biayaNormal: 750000, biayaEarly: 0, biayaKhusus: 0, tanggal: '' },
    'Level 2': { biayaNormal: 1500000, biayaEarly: 0, biayaKhusus: 0, tanggal: '' },
};

export async function getLevels() {
    const cached = cachedGet('levels');
    if (cached) return cached;
    try {
        const querySnapshot = await getDocs(collection(db, LEVELS_KEY));
        if (!querySnapshot.empty) {
            const list = {};
            querySnapshot.forEach((doc) => {
                list[doc.id] = doc.data();
            });
            cachedSet('levels', list);
            return list;
        }
        return DEFAULT_LEVELS;
    } catch (e) {
        console.error("Error getting levels:", e);
        return DEFAULT_LEVELS;
    }
}

export async function saveLevels(levels) {
    try {
        const batch = writeBatch(db);

        // 1. Identification
        const querySnapshot = await getDocs(collection(db, LEVELS_KEY));
        const newKeys = Object.keys(levels).map(k => k.trim());

        // 2. Queue Deletions
        querySnapshot.docs.forEach((snap) => {
            if (!newKeys.includes(snap.id)) {
                batch.delete(snap.ref);
            }
        });

        // 3. Queue Updates/Sets
        for (const [key, val] of Object.entries(levels)) {
            const trimmedKey = key.trim();
            if (!trimmedKey) continue;
            batch.set(doc(db, LEVELS_KEY, trimmedKey), val);
        }

        await batch.commit();
        cacheInvalidate('levels');
        return true;
    } catch (e) {
        console.error("Save Levels Critical Error:", e.code, e.message);
        if (e.code === 'permission-denied') {
            alert("Error: Izin ditolak oleh Firebase. Silakan periksa Security Rules di Console Firebase.");
        }
        return false;
    }
}

export async function getAppSettings() {
    const cached = cachedGet('appSettings');
    if (cached) return cached;
    try {
        const docSnap = await getDoc(doc(db, SETTINGS_KEY, 'main_settings'));
        if (docSnap.exists()) {
            const result = { ...DEFAULT_SETTINGS, ...docSnap.data() };
            cachedSet('appSettings', result);
            return result;
        }
        return DEFAULT_SETTINGS;
    } catch (e) {
        console.error("Error getting settings:", e);
        return DEFAULT_SETTINGS;
    }
}

export async function saveAppSettings(settings) {
    try {
        await setDoc(doc(db, SETTINGS_KEY, 'main_settings'), settings);
        cacheInvalidate('appSettings');
    } catch (e) {
        console.error("Error saving settings:", e);
    }
}

export async function getPeserta() {
    const cached = cachedGet('peserta');
    if (cached) return cached;
    try {
        const q = query(collection(db, STORAGE_KEY), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const list = [];
        querySnapshot.forEach((doc) => {
            list.push({ id: doc.id, ...doc.data() });
        });
        cachedSet('peserta', list);
        return list;
    } catch (e) {
        console.error("Error getting peserta:", e);
        return [];
    }
}

export async function getPesertaByLevel(levelName) {
    if (!levelName) return [];
    const cacheKey = `peserta_level_${levelName}`;
    const cached = cachedGet(cacheKey);
    if (cached) return cached;
    try {
        const q = query(
            collection(db, STORAGE_KEY),
            where('level', '==', levelName),
            orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        const list = [];
        querySnapshot.forEach((doc) => {
            list.push({ id: doc.id, ...doc.data() });
        });
        cachedSet(cacheKey, list);
        return list;
    } catch (e) {
        console.error("Error getting peserta by level:", e);
        return [];
    }
}

export async function addPeserta(item) {
    try {
        const newItem = {
            ...item,
            createdAt: new Date().toISOString(),
            statusBayar: 'Belum Bayar',
            nominalDP: 0,
            jenisBiaya: item.jenisBiaya || 'Normal',
        };
        const docRef = await addDoc(collection(db, STORAGE_KEY), newItem);
        cacheInvalidate('peserta_level_*');
        return { id: docRef.id, ...newItem };
    } catch (e) {
        console.error("Error adding peserta:", e);
        return null;
    }
}

export async function batchAddPeserta(items) {
    try {
        const batch = writeBatch(db);
        const results = [];

        items.forEach(item => {
            const docRef = doc(collection(db, STORAGE_KEY));
            const newItem = {
                ...item,
                createdAt: new Date().toISOString(),
                statusBayar: 'Belum Bayar',
                nominalDP: 0,
                jenisBiaya: item.jenisBiaya || 'Normal',
            };
            batch.set(docRef, newItem);
            results.push({ id: docRef.id, ...newItem });
        });

        await batch.commit();
        cacheInvalidate('peserta_level_*');
        return results;
    } catch (e) {
        console.error("Error batch adding peserta:", e);
        return null;
    }
}

export async function updatePeserta(id, updates) {
    try {
        const docRef = doc(db, STORAGE_KEY, id);
        // Ensure numbers are numbers
        const cleanedUpdates = { ...updates };
        if (cleanedUpdates.nominalDP !== undefined) cleanedUpdates.nominalDP = Number(cleanedUpdates.nominalDP);
        if (cleanedUpdates.sisaTagihan !== undefined) cleanedUpdates.sisaTagihan = Number(cleanedUpdates.sisaTagihan);
        if (cleanedUpdates.biaya !== undefined) cleanedUpdates.biaya = Number(cleanedUpdates.biaya);

        await updateDoc(docRef, cleanedUpdates);
        cacheInvalidate('peserta_level_*');
        return { id, ...cleanedUpdates };
    } catch (e) {
        console.error("Error updating peserta:", e);
        return null;
    }
}

export async function deletePeserta(id) {
    try {
        await deleteDoc(doc(db, STORAGE_KEY, id));
        cacheInvalidate('peserta_level_*');
        return id;
    } catch (e) {
        console.error("Error deleting peserta:", e);
        return null;
    }
}

export function hitungSisa(levelsData, level, nominalDP, statusBayar, jenisBiaya = 'Normal') {
    if (statusBayar === 'Lunas') return 0;
    const levelData = levelsData[level];
    if (!levelData) return 0;

    let total = levelData.biayaNormal || 0;
    if (jenisBiaya === 'Early Bird' && levelData.biayaEarly) {
        total = levelData.biayaEarly;
    } else if (jenisBiaya === 'Khusus' && levelData.biayaKhusus) {
        total = levelData.biayaKhusus;
    }

    return Math.max(0, total - (nominalDP || 0));
}

export async function getCashFlowItems(level) {
    if (!level) return [];
    const cacheKey = `cashflow_${level}`;
    const cached = cachedGet(cacheKey);
    if (cached) return cached;
    try {
        const q = query(collection(db, `${CASHFLOW_KEY}_${level}`), orderBy("createdAt", "asc"));
        const querySnapshot = await getDocs(q);
        const list = [];
        querySnapshot.forEach((doc) => {
            list.push({ id: doc.id, ...doc.data() });
        });
        cachedSet(cacheKey, list);
        return list;
    } catch (e) {
        console.error("Error getting cashflow:", e);
        return [];
    }
}

export async function addCashFlowItem(level, item) {
    try {
        const newItem = {
            ...item,
            createdAt: new Date().toISOString(),
        };
        const docRef = await addDoc(collection(db, `${CASHFLOW_KEY}_${level}`), newItem);
        cacheInvalidate(`cashflow_${level}`);
        return { id: docRef.id, ...newItem };
    } catch (e) {
        console.error("Error adding cashflow item:", e);
        return null;
    }
}

export async function updateCashFlowItem(level, id, updates) {
    try {
        const docRef = doc(db, `${CASHFLOW_KEY}_${level}`, id);
        await updateDoc(docRef, updates);
        cacheInvalidate(`cashflow_${level}`);
        return { id, ...updates };
    } catch (e) {
        console.error("Error updating cashflow item:", e);
        return null;
    }
}

export async function deleteCashFlowItem(level, id) {
    try {
        await deleteDoc(doc(db, `${CASHFLOW_KEY}_${level}`, id));
        cacheInvalidate(`cashflow_${level}`);
        return id;
    } catch (e) {
        console.error("Error deleting cashflow item:", e);
        return null;
    }
}

// ===== INDEPENDENT CASHFLOW (MANDIRI) =====
const INDEPENDENT_CF_KEY = 'databasePelatihan_independent_cashflows';

export async function getIndependentCashFlows() {
    const cached = cachedGet('independentCFs');
    if (cached) return cached;
    try {
        const q = query(collection(db, INDEPENDENT_CF_KEY), orderBy('createdAt', 'desc'));
        const qs = await getDocs(q);
        const list = [];
        qs.forEach(d => {
            list.push({ id: d.id, ...d.data() });
        });
        cachedSet('independentCFs', list);
        return list;
    } catch (e) {
        console.error("Error getting independent cashflows:", e);
        return [];
    }
}

export async function addIndependentCashFlow(name) {
    try {
        const newItem = { name, createdAt: new Date().toISOString() };
        const docRef = await addDoc(collection(db, INDEPENDENT_CF_KEY), newItem);
        cacheInvalidate('independentCFs');
        return { id: docRef.id, ...newItem };
    } catch (e) {
        console.error("Error adding independent cashflow:", e);
        return null;
    }
}

export async function renameIndependentCashFlow(id, newName) {
    try {
        await updateDoc(doc(db, INDEPENDENT_CF_KEY, id), { name: newName });
        cacheInvalidate('independentCFs');
        return true;
    } catch (e) {
        console.error("Error renaming independent cashflow:", e);
        return false;
    }
}

export async function deleteIndependentCashFlow(id) {
    try {
        // Delete all items in subcollection first
        const itemsSnap = await getDocs(collection(db, INDEPENDENT_CF_KEY, id, 'items'));
        if (!itemsSnap.empty) {
            const batch = writeBatch(db);
            itemsSnap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
        }
        await deleteDoc(doc(db, INDEPENDENT_CF_KEY, id));
        cacheInvalidate('independentCFs', `independentCF_items_${id}`);
        return true;
    } catch (e) {
        console.error("Error deleting independent cashflow:", e);
        return false;
    }
}

export async function getIndependentCashFlowItems(cashflowId) {
    if (!cashflowId) return [];
    const cacheKey = `independentCF_items_${cashflowId}`;
    const cached = cachedGet(cacheKey);
    if (cached) return cached;
    try {
        const q = query(collection(db, INDEPENDENT_CF_KEY, cashflowId, 'items'), orderBy('createdAt', 'asc'));
        const qs = await getDocs(q);
        const list = [];
        qs.forEach(d => {
            list.push({ id: d.id, ...d.data() });
        });
        cachedSet(cacheKey, list);
        return list;
    } catch (e) {
        console.error("Error getting independent cashflow items:", e);
        return [];
    }
}

export async function addIndependentCashFlowItem(cashflowId, item) {
    try {
        const newItem = { ...item, createdAt: new Date().toISOString() };
        const docRef = await addDoc(collection(db, INDEPENDENT_CF_KEY, cashflowId, 'items'), newItem);
        cacheInvalidate(`independentCF_items_${cashflowId}`);
        return { id: docRef.id, ...newItem };
    } catch (e) {
        console.error("Error adding independent cashflow item:", e);
        return null;
    }
}

export async function updateIndependentCashFlowItem(cashflowId, itemId, updates) {
    try {
        const docRef = doc(db, INDEPENDENT_CF_KEY, cashflowId, 'items', itemId);
        await updateDoc(docRef, updates);
        cacheInvalidate(`independentCF_items_${cashflowId}`);
        return { id: itemId, ...updates };
    } catch (e) {
        console.error("Error updating independent cashflow item:", e);
        return null;
    }
}

export async function deleteIndependentCashFlowItem(cashflowId, itemId) {
    try {
        await deleteDoc(doc(db, INDEPENDENT_CF_KEY, cashflowId, 'items', itemId));
        cacheInvalidate(`independentCF_items_${cashflowId}`);
        return itemId;
    } catch (e) {
        console.error("Error deleting independent cashflow item:", e);
        return null;
    }
}

// ===== PUBLIC PUBLISH SETTINGS (PER-LEVEL) =====
const PUBLIC_SETTINGS_KEY = 'databasePelatihan_public_settings';

export function slugify(str) {
    return (str || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/[\s]+/g, '-')
        .replace(/-+/g, '-');
}

const DEFAULT_PUBLIC_SETTINGS = {
    levelName: '',
    publishedIds: [],
    visibleColumns: {
        no: true,
        nama: true,
        jenisKelamin: false,
        provinsi: true,
        wa: false,
        cabor: true,
        sizeBaju: true,
        lahir: false,
        level: true,
        kepesertaan: true,
        alamat: false,
    },
    publishAll: false,
    isPublished: false,
};

/** Get public settings for ALL levels (returns { slug: settings }) */
export async function getAllPublicSettings() {
    const cached = cachedGet('allPublicSettings');
    if (cached) return cached;
    try {
        const querySnapshot = await getDocs(collection(db, PUBLIC_SETTINGS_KEY));
        const result = {};
        querySnapshot.forEach((d) => {
            result[d.id] = { ...DEFAULT_PUBLIC_SETTINGS, ...d.data() };
        });
        cachedSet('allPublicSettings', result);
        return result;
    } catch (e) {
        console.error("Error getting all public settings:", e);
        return {};
    }
}

/** Get public settings for a single level by slug */
export async function getPublicSettingsBySlug(slug) {
    const cacheKey = `publicSettings_${slug}`;
    const cached = cachedGet(cacheKey);
    if (cached !== undefined) return cached;
    try {
        const docSnap = await getDoc(doc(db, PUBLIC_SETTINGS_KEY, slug));
        if (docSnap.exists()) {
            const result = { ...DEFAULT_PUBLIC_SETTINGS, ...docSnap.data() };
            cachedSet(cacheKey, result);
            return result;
        }
        cachedSet(cacheKey, null);
        return null;
    } catch (e) {
        console.error("Error getting public settings by slug:", e);
        return null;
    }
}

/** Save public settings for a single level by slug */
export async function savePublicSettingsBySlug(slug, settings) {
    try {
        await setDoc(doc(db, PUBLIC_SETTINGS_KEY, slug), settings);
        cacheInvalidate(`publicSettings_${slug}`, 'allPublicSettings');
        return true;
    } catch (e) {
        console.error("Error saving public settings:", e);
        return false;
    }
}

// ===== SUGGEST EDIT SETTINGS =====
const EDIT_SUGGESTIONS_KEY = 'databasePelatihan_edit_suggestions';

export async function addEditSuggestion(suggestion) {
    try {
        await addDoc(collection(db, EDIT_SUGGESTIONS_KEY), {
            ...suggestion,
            createdAt: new Date().toISOString(),
            status: 'pending'
        });
        cacheInvalidate('editSuggestions');
        return true;
    } catch (e) {
        console.error("Error adding edit suggestion:", e);
        return false;
    }
}

export async function getEditSuggestions() {
    const cached = cachedGet('editSuggestions');
    if (cached) return cached;
    try {
        const q = query(collection(db, EDIT_SUGGESTIONS_KEY), orderBy('createdAt', 'desc'));
        const qs = await getDocs(q);
        const list = [];
        qs.forEach(doc => {
            list.push({ id: doc.id, ...doc.data() });
        });
        cachedSet('editSuggestions', list);
        return list;
    } catch (e) {
        console.error("Error getting edit suggestions:", e);
        return [];
    }
}

export async function approveEditSuggestion(suggestionId, pesertaId, updates) {
    try {
        const batch = writeBatch(db);
        // Apply updates to peserta
        const pesertaRef = doc(db, STORAGE_KEY, pesertaId);
        batch.update(pesertaRef, updates);

        // Mark suggestion as approved (keep for history)
        const suggestionRef = doc(db, EDIT_SUGGESTIONS_KEY, suggestionId);
        batch.update(suggestionRef, { status: 'approved', reviewedAt: new Date().toISOString() });

        await batch.commit();
        cacheInvalidate('editSuggestions', 'peserta_level_*');
        return true;
    } catch (e) {
        console.error("Error approving suggestion:", e);
        return false;
    }
}

export async function rejectEditSuggestion(suggestionId) {
    try {
        await updateDoc(doc(db, EDIT_SUGGESTIONS_KEY, suggestionId), {
            status: 'rejected',
            reviewedAt: new Date().toISOString()
        });
        cacheInvalidate('editSuggestions');
        return true;
    } catch (e) {
        console.error("Error rejecting suggestion:", e);
        return false;
    }
}

// ===== FORMULIR UPDATE PESERTA =====
const FORMULIR_KEY = 'databasePelatihan_formulir';

export async function addFormulirResponse(data) {
    try {
        await addDoc(collection(db, FORMULIR_KEY), {
            ...data,
            submittedAt: new Date().toISOString(),
        });
        cacheInvalidate('formulirResponses');
        return true;
    } catch (e) {
        console.error("Error adding formulir response:", e);
        return false;
    }
}

export async function checkFormulirExistsByPesertaId(pesertaId) {
    try {
        const q = query(collection(db, FORMULIR_KEY), where('pesertaId', '==', pesertaId));
        const qs = await getDocs(q);
        return !qs.empty;
    } catch (e) {
        console.error("Error checking formulir existence:", e);
        return false;
    }
}

export async function getFormulirResponses() {
    const cached = cachedGet('formulirResponses');
    if (cached) return cached;
    try {
        const q = query(collection(db, FORMULIR_KEY), orderBy('submittedAt', 'desc'));
        const qs = await getDocs(q);
        const list = [];
        qs.forEach(d => {
            list.push({ id: d.id, ...d.data() });
        });
        cachedSet('formulirResponses', list);
        return list;
    } catch (e) {
        console.error("Error getting formulir responses:", e);
        return [];
    }
}

export async function deleteFormulirResponse(id) {
    try {
        await deleteDoc(doc(db, FORMULIR_KEY, id));
        cacheInvalidate('formulirResponses');
        return true;
    } catch (e) {
        console.error("Error deleting formulir response:", e);
        return false;
    }
}

export async function approveFormulirResponse(formulirId, pesertaId, updates) {
    try {
        const batch = writeBatch(db);
        const pesertaRef = doc(db, STORAGE_KEY, pesertaId);
        batch.update(pesertaRef, updates);
        const formulirRef = doc(db, FORMULIR_KEY, formulirId);
        batch.delete(formulirRef);
        await batch.commit();
        cacheInvalidate('formulirResponses', 'peserta_level_*');
        return true;
    } catch (e) {
        console.error("Error approving formulir response:", e);
        return false;
    }
}

// ===== SERTIFIKAT PESERTA =====
const SERTIFIKAT_KEY = 'databasePelatihan_sertifikat';

export async function getSertifikatData() {
    const cached = cachedGet('sertifikat');
    if (cached) return cached;
    try {
        const q = query(collection(db, SERTIFIKAT_KEY), orderBy('createdAt', 'asc'));
        const qs = await getDocs(q);
        const list = [];
        qs.forEach(d => {
            list.push({ id: d.id, ...d.data() });
        });
        cachedSet('sertifikat', list);
        return list;
    } catch (e) {
        console.error("Error getting sertifikat:", e);
        return [];
    }
}

export async function saveSertifikatBatch(items) {
    try {
        // Firestore batch limit is 500, chunk if needed
        const chunks = [];
        for (let i = 0; i < items.length; i += 450) {
            chunks.push(items.slice(i, i + 450));
        }
        const allResults = [];
        for (const chunk of chunks) {
            const batch = writeBatch(db);
            const results = [];
            chunk.forEach(item => {
                const docRef = doc(collection(db, SERTIFIKAT_KEY));
                const newItem = {
                    ...item,
                    createdAt: new Date().toISOString(),
                };
                batch.set(docRef, newItem);
                results.push({ id: docRef.id, ...newItem });
            });
            await batch.commit();
            allResults.push(...results);
        }
        cacheInvalidate('sertifikat');
        return allResults;
    } catch (e) {
        console.error("Error batch saving sertifikat:", e);
        return null;
    }
}

export async function deleteSertifikat(id) {
    try {
        await deleteDoc(doc(db, SERTIFIKAT_KEY, id));
        cacheInvalidate('sertifikat');
        return true;
    } catch (e) {
        console.error("Error deleting sertifikat:", e);
        return false;
    }
}

export async function updateSertifikat(id, updates) {
    try {
        const docRef = doc(db, SERTIFIKAT_KEY, id);
        await updateDoc(docRef, updates);
        cacheInvalidate('sertifikat');
        return true;
    } catch (e) {
        console.error("Error updating sertifikat:", e);
        return false;
    }
}

export async function deleteAllSertifikat() {
    try {
        const qs = await getDocs(collection(db, SERTIFIKAT_KEY));
        const chunks = [];
        const docs = qs.docs;
        for (let i = 0; i < docs.length; i += 450) {
            chunks.push(docs.slice(i, i + 450));
        }
        for (const chunk of chunks) {
            const batch = writeBatch(db);
            chunk.forEach(d => batch.delete(d.ref));
            await batch.commit();
        }
        cacheInvalidate('sertifikat');
        return true;
    } catch (e) {
        console.error("Error deleting all sertifikat:", e);
        return false;
    }
}

// ===== ALAMAT PENGIRIMAN =====
const ALAMAT_KEY = 'databasePelatihan_alamat_pengiriman';

export async function checkAlamatExistsByPesertaId(pesertaId) {
    try {
        const q = query(collection(db, ALAMAT_KEY), where('pesertaId', '==', pesertaId));
        const qs = await getDocs(q);
        return !qs.empty;
    } catch (e) {
        console.error("Error checking alamat exists:", e);
        return false;
    }
}

export async function getAlamatByPesertaId(pesertaId) {
    try {
        const q = query(collection(db, ALAMAT_KEY), where('pesertaId', '==', pesertaId));
        const qs = await getDocs(q);
        if (!qs.empty) {
            const doc = qs.docs[0];
            return { id: doc.id, ...doc.data() };
        }
        return null;
    } catch (e) {
        console.error("Error getting alamat by peserta:", e);
        return null;
    }
}

export async function getAlamatPengiriman() {
    const cached = cachedGet('alamatPengiriman');
    if (cached) return cached;
    try {
        const q = query(collection(db, ALAMAT_KEY), orderBy('createdAt', 'desc'));
        const qs = await getDocs(q);
        const list = [];
        qs.forEach(d => {
            list.push({ id: d.id, ...d.data() });
        });
        cachedSet('alamatPengiriman', list);
        return list;
    } catch (e) {
        console.error("Error getting alamat pengiriman:", e);
        return [];
    }
}

export async function addAlamatPengiriman(data) {
    try {
        const newItem = {
            ...data,
            createdAt: new Date().toISOString(),
        };
        const docRef = await addDoc(collection(db, ALAMAT_KEY), newItem);
        cacheInvalidate('alamatPengiriman');
        return { id: docRef.id, ...newItem };
    } catch (e) {
        console.error("Error adding alamat pengiriman:", e);
        return null;
    }
}

export async function updateAlamatPengiriman(id, updates) {
    try {
        const docRef = doc(db, ALAMAT_KEY, id);
        await updateDoc(docRef, updates);
        cacheInvalidate('alamatPengiriman');
        return true;
    } catch (e) {
        console.error("Error updating alamat pengiriman:", e);
        return false;
    }
}

export async function deleteAlamatPengiriman(id) {
    try {
        await deleteDoc(doc(db, ALAMAT_KEY, id));
        cacheInvalidate('alamatPengiriman');
        return true;
    } catch (e) {
        console.error("Error deleting alamat pengiriman:", e);
        return false;
    }
}

// ===== CERTIFICATE VIEW TRACKING =====
const CERT_VIEWS_KEY = 'databasePelatihan_cert_views';

export async function logCertView({ sertifikatId, nama, level, certType }) {
    try {
        await addDoc(collection(db, CERT_VIEWS_KEY), {
            sertifikatId,
            nama,
            level,
            certType, // 'Lankor', 'ICCA', 'Sportunys'
            viewedAt: new Date().toISOString(),
        });
        return true;
    } catch (e) {
        console.error("Error logging cert view:", e);
        return false;
    }
}

export async function getCertViews() {
    const cached = cachedGet('certViews');
    if (cached) return cached;
    try {
        const q = query(collection(db, CERT_VIEWS_KEY), orderBy('viewedAt', 'desc'));
        const qs = await getDocs(q);
        const list = [];
        qs.forEach(d => {
            list.push({ id: d.id, ...d.data() });
        });
        cachedSet('certViews', list);
        return list;
    } catch (e) {
        console.error("Error getting cert views:", e);
        return [];
    }
}

// ===== PEMESANAN JERSEY =====
const JERSEY_KEY = 'databasePelatihan_pemesanan_jersey';

export async function addPemesananJersey(data) {
    try {
        const newItem = {
            ...data,
            createdAt: new Date().toISOString(),
            status: 'Menunggu', // Default status: Menunggu, Diproses, Dikirim, Selesai
        };
        const docRef = await addDoc(collection(db, JERSEY_KEY), newItem);
        cacheInvalidate('pemesananJersey');
        return { id: docRef.id, ...newItem };
    } catch (e) {
        console.error("Error adding pemesanan jersey:", e);
        return null;
    }
}

export async function getPemesananJersey() {
    const cached = cachedGet('pemesananJersey');
    if (cached) return cached;
    try {
        const q = query(collection(db, JERSEY_KEY), orderBy('createdAt', 'desc'));
        const qs = await getDocs(q);
        const list = [];
        qs.forEach(d => {
            list.push({ id: d.id, ...d.data() });
        });
        cachedSet('pemesananJersey', list);
        return list;
    } catch (e) {
        console.error("Error getting pemesanan jersey:", e);
        return [];
    }
}

export async function updatePemesananJersey(id, updates) {
    try {
        const docRef = doc(db, JERSEY_KEY, id);
        await updateDoc(docRef, updates);
        cacheInvalidate('pemesananJersey');
        return true;
    } catch (e) {
        console.error("Error updating pemesanan jersey:", e);
        return false;
    }
}

export async function deletePemesananJersey(id) {
    try {
        await deleteDoc(doc(db, JERSEY_KEY, id));
        cacheInvalidate('pemesananJersey');
        return true;
    } catch (e) {
        console.error("Error deleting pemesanan jersey:", e);
        return false;
    }
}
