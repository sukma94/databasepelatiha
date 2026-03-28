import { collection, doc, getDoc, getDocs, setDoc, addDoc, query, orderBy, where, writeBatch } from "firebase/firestore";
import { db } from './firebase';
import { slugify } from './storage';

// Collection keys (mirrored from storage.js)
const STORAGE_KEY = 'databasePelatihan_peserta';
const LEVELS_KEY = 'databasePelatihan_levels';
const CASHFLOW_KEY = 'databasePelatihan_cashflow';
const SERTIFIKAT_KEY = 'databasePelatihan_sertifikat';
const PUBLIC_SETTINGS_KEY = 'databasePelatihan_public_settings';
const ALAMAT_KEY = 'databasePelatihan_alamat_pengiriman';
const EDIT_SUGGESTIONS_KEY = 'databasePelatihan_edit_suggestions';
const FORMULIR_KEY = 'databasePelatihan_formulir';

const EXPORT_VERSION = '1.0';

// ===== EXPORT =====

/**
 * Export all data related to a specific level.
 * Returns an object ready to be serialized to JSON.
 */
export async function exportLevelData(levelName, onProgress) {
    const report = (step, detail) => onProgress?.({ step, detail });

    report('level', 'Mengambil konfigurasi pelatihan...');
    // 1. Level config
    const levelDocSnap = await getDoc(doc(db, LEVELS_KEY, levelName));
    const levelConfig = levelDocSnap.exists() ? levelDocSnap.data() : null;

    // 2. Peserta with this level
    report('peserta', 'Mengambil data peserta...');
    const pesertaSnap = await getDocs(query(collection(db, STORAGE_KEY), where('level', '==', levelName)));
    const peserta = [];
    const pesertaIds = new Set();
    pesertaSnap.forEach(d => {
        const data = { ...d.data() };
        // Store original Firestore ID for reference but import will generate new IDs
        data._originalId = d.id;
        peserta.push(data);
        pesertaIds.add(d.id);
    });

    // 3. Cashflow for this level
    report('cashflow', 'Mengambil data cashflow...');
    const cashflowCollKey = `${CASHFLOW_KEY}_${levelName}`;
    let cashflow = [];
    try {
        const cfSnap = await getDocs(query(collection(db, cashflowCollKey), orderBy('createdAt', 'asc')));
        cfSnap.forEach(d => {
            const data = { ...d.data() };
            data._originalId = d.id;
            cashflow.push(data);
        });
    } catch (e) {
        // Collection might not exist
        console.warn('Cashflow collection not found for', levelName);
    }

    // 4. Sertifikat for this level
    report('sertifikat', 'Mengambil data sertifikat...');
    const sertSnap = await getDocs(query(collection(db, SERTIFIKAT_KEY), where('level', '==', levelName)));
    const sertifikat = [];
    sertSnap.forEach(d => {
        const data = { ...d.data() };
        data._originalId = d.id;
        sertifikat.push(data);
    });

    // 5. Public settings
    report('publicSettings', 'Mengambil pengaturan publik...');
    const slug = slugify(levelName);
    const pubDocSnap = await getDoc(doc(db, PUBLIC_SETTINGS_KEY, slug));
    const publicSettings = pubDocSnap.exists() ? pubDocSnap.data() : null;

    // 6-8. Fetch related data using batched 'in' queries for efficiency
    // Instead of reading ALL docs in each collection and filtering client-side,
    // we use Firestore 'where in' queries (limit 30 per query) to only read relevant docs.
    async function queryByPesertaIds(collectionKey, ids) {
        const idArray = Array.from(ids);
        const results = [];
        for (let i = 0; i < idArray.length; i += 30) {
            const batch = idArray.slice(i, i + 30);
            const q = query(collection(db, collectionKey), where('pesertaId', 'in', batch));
            const snap = await getDocs(q);
            snap.forEach(d => {
                results.push({ ...d.data(), _originalId: d.id });
            });
        }
        return results;
    }

    // 6. Alamat pengiriman (linked via pesertaId)
    report('alamat', 'Mengambil data alamat pengiriman...');
    let alamatPengiriman = [];
    if (pesertaIds.size > 0) {
        alamatPengiriman = await queryByPesertaIds(ALAMAT_KEY, pesertaIds);
    }

    // 7. Edit suggestions (linked via pesertaId)
    report('editSuggestions', 'Mengambil saran edit...');
    let editSuggestions = [];
    if (pesertaIds.size > 0) {
        editSuggestions = await queryByPesertaIds(EDIT_SUGGESTIONS_KEY, pesertaIds);
    }

    // 8. Formulir responses (linked via pesertaId)
    report('formulir', 'Mengambil respon formulir...');
    let formulirResponses = [];
    if (pesertaIds.size > 0) {
        formulirResponses = await queryByPesertaIds(FORMULIR_KEY, pesertaIds);
    }

    report('done', 'Export selesai!');

    return {
        exportVersion: EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        levelName,
        levelConfig,
        peserta,
        cashflow,
        sertifikat,
        publicSettings,
        alamatPengiriman,
        editSuggestions,
        formulirResponses,
        summary: {
            peserta: peserta.length,
            cashflow: cashflow.length,
            sertifikat: sertifikat.length,
            alamatPengiriman: alamatPengiriman.length,
            editSuggestions: editSuggestions.length,
            formulirResponses: formulirResponses.length,
        }
    };
}

/**
 * Download the export data as a JSON file
 */
export function downloadJson(data, filename) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ===== IMPORT =====

/**
 * Parse and validate an import file.
 * Returns the parsed data or throws an error.
 */
export function parseImportFile(jsonString) {
    const data = JSON.parse(jsonString);

    if (!data.exportVersion || !data.levelName) {
        throw new Error('File tidak valid: bukan file backup yang dikenali.');
    }

    return data;
}

/**
 * Import data from a parsed JSON backup.
 * Options:
 *   - sections: array of section keys to import (e.g. ['peserta', 'cashflow'])
 *     Defaults to all sections.
 *
 * Behavior:
 *   - Skip duplicates for peserta (matched by nama + wa + level)
 *   - Auto-create level config if it doesn't exist
 *   - IDs are new; original IDs are not preserved
 */
export async function importLevelData(data, options = {}, onProgress) {
    const report = (step, detail) => onProgress?.({ step, detail });
    const sectionsToImport = options.sections || ['levelConfig', 'peserta', 'cashflow', 'sertifikat', 'publicSettings', 'alamatPengiriman', 'editSuggestions', 'formulirResponses'];
    const levelName = data.levelName;
    const results = { imported: {}, skipped: {} };

    // 1. Level config — auto-create if not exists
    if (sectionsToImport.includes('levelConfig') && data.levelConfig) {
        report('levelConfig', 'Memeriksa konfigurasi pelatihan...');
        const existingSnap = await getDoc(doc(db, LEVELS_KEY, levelName));
        if (!existingSnap.exists()) {
            await setDoc(doc(db, LEVELS_KEY, levelName), data.levelConfig);
            results.imported.levelConfig = 'created';
        } else {
            results.imported.levelConfig = 'already exists (skipped)';
        }
    }

    // 2. Peserta — skip duplicates
    if (sectionsToImport.includes('peserta') && data.peserta?.length > 0) {
        report('peserta', `Mengimport ${data.peserta.length} peserta...`);

        // Fetch existing peserta for this level to detect duplicates
        const existingSnap = await getDocs(query(collection(db, STORAGE_KEY), where('level', '==', levelName)));
        const existingKeys = new Set();
        existingSnap.forEach(d => {
            const p = d.data();
            existingKeys.add(`${(p.nama || '').toLowerCase().trim()}|${(p.wa || '').trim()}`);
        });

        const toImport = [];
        let skipped = 0;

        for (const p of data.peserta) {
            const key = `${(p.nama || '').toLowerCase().trim()}|${(p.wa || '').trim()}`;
            if (existingKeys.has(key)) {
                skipped++;
                continue;
            }
            // Remove internal fields
            const { _originalId, ...cleanData } = p;
            toImport.push(cleanData);
            existingKeys.add(key); // prevent duplicates within import file itself
        }

        // Batch write in chunks of 450
        for (let i = 0; i < toImport.length; i += 450) {
            const chunk = toImport.slice(i, i + 450);
            const batch = writeBatch(db);
            chunk.forEach(item => {
                const docRef = doc(collection(db, STORAGE_KEY));
                batch.set(docRef, item);
            });
            await batch.commit();
            report('peserta', `Mengimport peserta... (${Math.min(i + 450, toImport.length)}/${toImport.length})`);
        }

        results.imported.peserta = toImport.length;
        results.skipped.peserta = skipped;
    }

    // 3. Cashflow
    if (sectionsToImport.includes('cashflow') && data.cashflow?.length > 0) {
        report('cashflow', `Mengimport ${data.cashflow.length} cashflow...`);
        const cashflowCollKey = `${CASHFLOW_KEY}_${levelName}`;

        for (let i = 0; i < data.cashflow.length; i += 450) {
            const chunk = data.cashflow.slice(i, i + 450);
            const batch = writeBatch(db);
            chunk.forEach(item => {
                const { _originalId, ...cleanData } = item;
                const docRef = doc(collection(db, cashflowCollKey));
                batch.set(docRef, cleanData);
            });
            await batch.commit();
        }
        results.imported.cashflow = data.cashflow.length;
    }

    // 4. Sertifikat — skip duplicates by nomorSertifikat
    if (sectionsToImport.includes('sertifikat') && data.sertifikat?.length > 0) {
        report('sertifikat', `Mengimport ${data.sertifikat.length} sertifikat...`);

        const existingSnap = await getDocs(query(collection(db, SERTIFIKAT_KEY), where('level', '==', levelName)));
        const existingNomors = new Set();
        existingSnap.forEach(d => {
            const s = d.data();
            if (s.nomorSertifikat) existingNomors.add(s.nomorSertifikat);
        });

        const toImport = [];
        let skipped = 0;

        for (const s of data.sertifikat) {
            if (s.nomorSertifikat && existingNomors.has(s.nomorSertifikat)) {
                skipped++;
                continue;
            }
            const { _originalId, ...cleanData } = s;
            toImport.push(cleanData);
            if (s.nomorSertifikat) existingNomors.add(s.nomorSertifikat);
        }

        for (let i = 0; i < toImport.length; i += 450) {
            const chunk = toImport.slice(i, i + 450);
            const batch = writeBatch(db);
            chunk.forEach(item => {
                const docRef = doc(collection(db, SERTIFIKAT_KEY));
                batch.set(docRef, item);
            });
            await batch.commit();
        }
        results.imported.sertifikat = toImport.length;
        results.skipped.sertifikat = skipped;
    }

    // 5. Public settings
    if (sectionsToImport.includes('publicSettings') && data.publicSettings) {
        report('publicSettings', 'Mengimport pengaturan publik...');
        const slug = slugify(levelName);
        const existingSnap = await getDoc(doc(db, PUBLIC_SETTINGS_KEY, slug));
        if (!existingSnap.exists()) {
            await setDoc(doc(db, PUBLIC_SETTINGS_KEY, slug), data.publicSettings);
            results.imported.publicSettings = 'created';
        } else {
            results.imported.publicSettings = 'already exists (skipped)';
        }
    }

    // 6. Alamat pengiriman (no duplicate check — just add all)
    if (sectionsToImport.includes('alamatPengiriman') && data.alamatPengiriman?.length > 0) {
        report('alamat', `Mengimport ${data.alamatPengiriman.length} alamat...`);

        for (let i = 0; i < data.alamatPengiriman.length; i += 450) {
            const chunk = data.alamatPengiriman.slice(i, i + 450);
            const batch = writeBatch(db);
            chunk.forEach(item => {
                const { _originalId, ...cleanData } = item;
                const docRef = doc(collection(db, ALAMAT_KEY));
                batch.set(docRef, cleanData);
            });
            await batch.commit();
        }
        results.imported.alamatPengiriman = data.alamatPengiriman.length;
    }

    // 7. Edit suggestions
    if (sectionsToImport.includes('editSuggestions') && data.editSuggestions?.length > 0) {
        report('editSuggestions', `Mengimport ${data.editSuggestions.length} saran edit...`);

        for (let i = 0; i < data.editSuggestions.length; i += 450) {
            const chunk = data.editSuggestions.slice(i, i + 450);
            const batch = writeBatch(db);
            chunk.forEach(item => {
                const { _originalId, ...cleanData } = item;
                const docRef = doc(collection(db, EDIT_SUGGESTIONS_KEY));
                batch.set(docRef, cleanData);
            });
            await batch.commit();
        }
        results.imported.editSuggestions = data.editSuggestions.length;
    }

    // 8. Formulir responses
    if (sectionsToImport.includes('formulirResponses') && data.formulirResponses?.length > 0) {
        report('formulir', `Mengimport ${data.formulirResponses.length} respon formulir...`);

        for (let i = 0; i < data.formulirResponses.length; i += 450) {
            const chunk = data.formulirResponses.slice(i, i + 450);
            const batch = writeBatch(db);
            chunk.forEach(item => {
                const { _originalId, ...cleanData } = item;
                const docRef = doc(collection(db, FORMULIR_KEY));
                batch.set(docRef, cleanData);
            });
            await batch.commit();
        }
        results.imported.formulirResponses = data.formulirResponses.length;
    }

    report('done', 'Import selesai!');
    return results;
}
