/**
 * Mengubah nama bulan Indonesia menjadi angka indeks bulan (0-11)
 * @param {string} monthStr Nama bulan dalam bahasa Indonesia
 * @returns {number} Indeks bulan 0-11, atau -1 jika gagal
 */
function getIndonesianMonthIndex(monthStr) {
    const months = {
        'januari': 0, 'februari': 1, 'maret': 2, 'april': 3, 'mei': 4, 'juni': 5,
        'juli': 6, 'agustus': 7, 'september': 8, 'oktober': 9, 'november': 10, 'desember': 11,
        'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'aug': 7, 'sep': 8, 'okt': 9, 'nov': 10, 'des': 11
    };
    return months[monthStr.toLowerCase()] !== undefined ? months[monthStr.toLowerCase()] : -1;
}

/**
 * Mengubah string tanggal (contoh: "3 Maret 2026") menjadi object Date.
 * Karena kita membandingkan dengan HARI INI tanpa peduli jam, 
 * kita set jam pembatas perhitungan di hari terakhir pelaksanaan.
 * @param {string} dateStr String tanggal dalam format Indonesia
 * @returns {Date|null} Date object, atau null jika tidak bisa diparse
 */
export function parseIndonesianDate(dateStr) {
    if (!dateStr || dateStr === '-') return null;

    // Bersihkan spasi ekstra
    dateStr = dateStr.trim();

    // Check untuk ranges, misal "3-5 Maret 2026" atau "3 s/d 5 Maret 2026"
    // Kita ambil tanggal terakhirnya saja (misal 5 Maret 2026) untuk penentuan archived
    let dayStr, monthStr, yearStr;
    const parts = dateStr.split(/[\s-]+/);

    if (parts.length >= 3) {
        yearStr = parts[parts.length - 1];
        monthStr = parts[parts.length - 2];
        dayStr = parts[parts.length - 3];
    } else {
        return null;
    }

    const day = parseInt(dayStr, 10);
    const month = getIndonesianMonthIndex(monthStr);
    const year = parseInt(yearStr, 10);

    if (isNaN(day) || month === -1 || isNaN(year)) {
        return null;
    }

    // Set end of day pada tanggal pelaksanaan terakhir
    return new Date(year, month, day, 23, 59, 59, 999);
}

/**
 * Mengecek apakah sebuah level pelatihan sudah expired (Archived)
 * @param {object} levelData Data level dari 'levels'
 * @returns {boolean} true jika tanggal sudah lewat dari hari ini
 */
export function isLevelArchived(levelData) {
    if (!levelData) return false;

    // Manual archive flag (tombol arsipkan)
    if (levelData.archived === true) return true;

    // Auto-archive: 60 hari setelah tanggal pelaksanaan selesai
    if (!levelData.tanggal || levelData.tanggal === '-') return false;
    const pelaksanaanDate = parseIndonesianDate(levelData.tanggal);
    if (!pelaksanaanDate) return false;

    const archivedDate = new Date(pelaksanaanDate.getTime() + 60 * 24 * 60 * 60 * 1000);

    const now = new Date();
    return now.getTime() > archivedDate.getTime();
}
