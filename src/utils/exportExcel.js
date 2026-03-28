import XLSX from 'xlsx-js-style';

// ===== Shared Style Definitions =====
const headerStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 12, name: 'Calibri' },
    fill: { fgColor: { rgb: '2563EB' } },  // Blue accent
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
        top: { style: 'thin', color: { rgb: 'BFDBFE' } },
        bottom: { style: 'thin', color: { rgb: 'BFDBFE' } },
        left: { style: 'thin', color: { rgb: 'BFDBFE' } },
        right: { style: 'thin', color: { rgb: 'BFDBFE' } },
    },
};

const cellStyle = {
    font: { sz: 11, name: 'Calibri' },
    alignment: { vertical: 'center', wrapText: true },
    border: {
        top: { style: 'thin', color: { rgb: 'E5E7EB' } },
        bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
        left: { style: 'thin', color: { rgb: 'E5E7EB' } },
        right: { style: 'thin', color: { rgb: 'E5E7EB' } },
    },
};

const cellStyleCenter = { ...cellStyle, alignment: { ...cellStyle.alignment, horizontal: 'center' } };

const currencyStyle = {
    ...cellStyle,
    alignment: { ...cellStyle.alignment, horizontal: 'right' },
    numFmt: '#,##0',
};

const evenRowStyle = (base) => ({
    ...base,
    fill: { fgColor: { rgb: 'F0F7FF' } },
});

// ===== Helper: apply styles to worksheet =====
function applyStylesToSheet(ws, headers, dataLength) {
    const range = XLSX.utils.decode_range(ws['!ref']);

    // Style header row
    for (let col = range.s.c; col <= range.e.c; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
        if (ws[cellRef]) ws[cellRef].s = headerStyle;
    }

    // Style data rows
    for (let row = 1; row <= dataLength; row++) {
        const isEven = row % 2 === 0;
        for (let col = range.s.c; col <= range.e.c; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
            if (!ws[cellRef]) continue;
            const baseStyle = headers[col]?.style || cellStyle;
            ws[cellRef].s = isEven ? evenRowStyle(baseStyle) : baseStyle;
        }
    }

    // Auto-width columns
    ws['!cols'] = headers.map((h, i) => {
        let maxLen = h.label.length;
        for (let row = 1; row <= dataLength; row++) {
            const cellRef = XLSX.utils.encode_cell({ r: row, c: i });
            if (ws[cellRef] && ws[cellRef].v != null) {
                maxLen = Math.max(maxLen, String(ws[cellRef].v).length);
            }
        }
        return { wch: Math.min(maxLen + 3, 40) };
    });

    // Row height for header
    ws['!rows'] = [{ hpt: 28 }];
}

// ===== Export Peserta (Daftar Peserta) =====
export function exportToExcel(data, filename = 'data_peserta') {
    if (!data || data.length === 0) return;

    const headers = [
        { label: 'No', style: cellStyleCenter },
        { label: 'Nama Lengkap', style: cellStyle },
        { label: 'Nomor WA', style: cellStyle },
        { label: 'Ukuran Baju', style: cellStyleCenter },
        { label: 'Provinsi Asal', style: cellStyle },
        { label: 'Tempat, Tanggal Lahir', style: cellStyle },
        { label: 'Alamat Domisili', style: cellStyle },
        { label: 'Cabang Olahraga', style: cellStyle },
        { label: 'No Sertifikat Lv. 1', style: cellStyle },
        { label: 'Level Pelatihan', style: cellStyleCenter },
        { label: 'Tanggal Pelatihan', style: cellStyleCenter },
        { label: 'Jenis Biaya', style: cellStyleCenter },
        { label: 'Status Bayar', style: cellStyleCenter },
        { label: 'Status Kepesertaan', style: cellStyleCenter },
        { label: 'Nominal DP', style: currencyStyle },
        { label: 'Total Biaya', style: currencyStyle },
        { label: 'Sisa Tagihan', style: currencyStyle },
        { label: 'Tanggal Daftar', style: cellStyleCenter },
    ];

    const exportData = data.map((p, i) => [
        i + 1,
        p.nama || '',
        p.wa || '',
        p.ukuranBaju || '',
        p.provinsi || '',
        p.ttl || '',
        p.alamat || '',
        p.cabor || '',
        p.nomerSertifikatLevel1 || '',
        p.level || '',
        p.tanggalPelatihan || '-',
        p.jenisBiaya || 'Normal',
        p.statusBayar || '',
        p.kepesertaan || 'Konfirmasi',
        p.nominalDP || 0,
        p.biaya || 0,
        p.sisaTagihan || 0,
        p.createdAt ? new Date(p.createdAt).toLocaleString('id-ID') : '-',
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers.map(h => h.label), ...exportData]);
    applyStylesToSheet(ws, headers, exportData.length);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Peserta');

    const timestamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `${filename}_${timestamp}.xlsx`);
}

// ===== Export Pembayaran (Daftar Pembayaran) =====
export function exportPembayaranToExcel(data, filename = 'data_pembayaran', visibleColumns = null) {
    if (!data || data.length === 0) return;

    // Column key mapping for visibility
    const allColumns = [
        { key: 'no', label: 'No', style: cellStyleCenter },
        { key: 'nama', label: 'Nama', style: cellStyle },
        { key: 'wa', label: 'Nomor WA', style: cellStyle },
        { key: 'level', label: 'Level', style: cellStyleCenter },
        { key: 'kategori', label: 'Kategori Biaya', style: cellStyleCenter },
        { key: 'status', label: 'Status Bayar', style: cellStyleCenter },
        { key: 'totalBiaya', label: 'Total Biaya', style: currencyStyle },
        { key: 'nominal', label: 'Nominal DP', style: currencyStyle },
        { key: 'sisa', label: 'Sisa Tagihan', style: currencyStyle },
        { key: 'tanggal', label: 'Tanggal Daftar', style: cellStyleCenter },
    ];

    // Filter columns based on visibility (totalBiaya and tanggal always included if not in visibleColumns map)
    const cols = allColumns.filter(c => {
        if (!visibleColumns) return true;
        if (visibleColumns[c.key] !== undefined) return visibleColumns[c.key];
        return true; // columns not in visibleColumns map (totalBiaya, tanggal) are always shown
    });

    const headers = cols.map(c => ({ label: c.label, style: c.style }));

    const buildRow = (p, i) => {
        const map = {
            no: i + 1,
            nama: p.nama || '',
            wa: p.wa || '',
            level: p.level || '',
            kategori: p.jenisBiaya || 'Normal',
            status: p.statusBayar || '',
            totalBiaya: p.biaya || 0,
            nominal: p.nominalDP || 0,
            sisa: p.sisaTagihan || 0,
            tanggal: p.createdAt ? new Date(p.createdAt).toLocaleString('id-ID') : '-',
        };
        return cols.map(c => map[c.key]);
    };

    const exportData = data.map((p, i) => buildRow(p, i));

    // Calculate totals — find indices of currency columns in filtered set
    const totalBiaya = data.reduce((s, p) => s + (p.biaya || 0), 0);
    const totalDP = data.reduce((s, p) => s + (p.nominalDP || 0), 0);
    const totalSisa = data.reduce((s, p) => s + (p.sisaTagihan || 0), 0);
    const totalRow = cols.map(c => {
        if (c.key === 'totalBiaya') return totalBiaya;
        if (c.key === 'nominal') return totalDP;
        if (c.key === 'sisa') return totalSisa;
        if (c.key === 'status') return 'TOTAL';
        return '';
    });

    const ws = XLSX.utils.aoa_to_sheet([headers.map(h => h.label), ...exportData, totalRow]);
    applyStylesToSheet(ws, headers, exportData.length);

    // Style the TOTAL row
    const totalRowIdx = exportData.length + 1; // +1 for header
    const totalStyleObj = {
        font: { bold: true, sz: 12, name: 'Calibri', color: { rgb: '1E3A5F' } },
        fill: { fgColor: { rgb: 'FEF3C7' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: {
            top: { style: 'medium', color: { rgb: 'F59E0B' } },
            bottom: { style: 'medium', color: { rgb: 'F59E0B' } },
            left: { style: 'thin', color: { rgb: 'FDE68A' } },
            right: { style: 'thin', color: { rgb: 'FDE68A' } },
        },
    };
    const totalCurrencyStyle = { ...totalStyleObj, alignment: { ...totalStyleObj.alignment, horizontal: 'right' }, numFmt: '#,##0' };
    const currencyKeys = ['totalBiaya', 'nominal', 'sisa'];
    for (let colIdx = 0; colIdx < cols.length; colIdx++) {
        const cellRef = XLSX.utils.encode_cell({ r: totalRowIdx, c: colIdx });
        if (ws[cellRef]) {
            ws[cellRef].s = currencyKeys.includes(cols[colIdx].key) ? totalCurrencyStyle : totalStyleObj;
        }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pembayaran');

    const timestamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `${filename}_${timestamp}.xlsx`);
}

// ===== Export Formulir Update (DaftarFormulir) =====
const formulirHeaderStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 12, name: 'Calibri' },
    fill: { fgColor: { rgb: '7C3AED' } },  // Purple accent
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
        top: { style: 'thin', color: { rgb: 'C4B5FD' } },
        bottom: { style: 'thin', color: { rgb: 'C4B5FD' } },
        left: { style: 'thin', color: { rgb: 'C4B5FD' } },
        right: { style: 'thin', color: { rgb: 'C4B5FD' } },
    },
};

const formulirEvenRow = (base) => ({
    ...base,
    fill: { fgColor: { rgb: 'F5F3FF' } },  // Light purple tint
});

function applyFormulirStyles(ws, headers, dataLength) {
    const range = XLSX.utils.decode_range(ws['!ref']);

    for (let col = range.s.c; col <= range.e.c; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
        if (ws[cellRef]) ws[cellRef].s = formulirHeaderStyle;
    }

    for (let row = 1; row <= dataLength; row++) {
        const isEven = row % 2 === 0;
        for (let col = range.s.c; col <= range.e.c; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
            if (!ws[cellRef]) continue;
            const baseStyle = headers[col]?.style || cellStyle;
            ws[cellRef].s = isEven ? formulirEvenRow(baseStyle) : baseStyle;
        }
    }

    ws['!cols'] = headers.map((h, i) => {
        let maxLen = h.label.length;
        for (let row = 1; row <= dataLength; row++) {
            const cellRef = XLSX.utils.encode_cell({ r: row, c: i });
            if (ws[cellRef] && ws[cellRef].v != null) {
                maxLen = Math.max(maxLen, String(ws[cellRef].v).length);
            }
        }
        return { wch: Math.min(maxLen + 3, 45) };
    });

    ws['!rows'] = [{ hpt: 30 }];
}

export function exportFormulirToExcel(data, filename = 'data_formulir_update') {
    if (!data || data.length === 0) return;

    const headers = [
        { label: 'No', style: cellStyleCenter },
        { label: 'Nama Lengkap', style: cellStyle },
        { label: 'Level', style: cellStyleCenter },
        { label: 'Cabang Olahraga', style: cellStyle },
        { label: 'Jenis Kelamin', style: cellStyleCenter },
        { label: 'Tempat, Tanggal Lahir', style: cellStyle },
        { label: 'Alamat', style: cellStyle },
        { label: 'Provinsi', style: cellStyle },
        { label: 'Nomor WA', style: cellStyle },
        { label: 'Pekerjaan', style: cellStyle },
        { label: 'Pendidikan Terakhir', style: cellStyle },
        { label: 'Latar Pend. Olahraga', style: cellStyle },
        { label: 'Sertifikat Pelatih', style: cellStyle },
        { label: 'Khusus Pelatih Fisik', style: cellStyle },
        { label: 'Pengalaman Melatih', style: cellStyle },
        { label: 'Level Kepelatihan', style: cellStyle },
        { label: 'Bekerja Sebagai Pelatih di', style: cellStyle },
        { label: 'Plt. Level 1 & Tahun', style: cellStyle },
        { label: 'Pekerjaan Pasca Lv 1', style: cellStyle },
        { label: 'Peng. Melatih Fisik', style: cellStyle },
        { label: 'Level Melatih Fisik', style: cellStyle },
        { label: 'Tanggal Kirim', style: cellStyleCenter },
    ];

    const exportData = data.map((r, i) => [
        i + 1,
        r.nama || '',
        r.level || '',
        r.cabor || '',
        r.jenisKelamin || '',
        r.ttl || '',
        r.alamat || '',
        r.provinsi || '',
        r.wa || '',
        r.pekerjaan || '',
        r.pendidikan || '',
        r.latarPendidikanOlahraga || '',
        r.sertifikatPelatih || '',
        r.khususPelatihFisik || '',
        r.pengalamanMelatih || '',
        r.levelKepelatihan || '',
        Array.isArray(r.tempatKerja) ? r.tempatKerja.join(', ') : (r.tempatKerja || ''),
        r.pelatihanLevel1DiManaTahun || '',
        r.pekerjaanSetelahLevel1 || '',
        Array.isArray(r.pengalamanMelatihFisik) ? r.pengalamanMelatihFisik.join(', ') : (r.pengalamanMelatihFisik || ''),
        Array.isArray(r.levelMelatihFisik) ? r.levelMelatihFisik.join(', ') : (r.levelMelatihFisik || ''),
        r.submittedAt ? new Date(r.submittedAt).toLocaleString('id-ID') : '-',
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers.map(h => h.label), ...exportData]);
    applyFormulirStyles(ws, headers, exportData.length);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Formulir Update');

    const timestamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `${filename}_${timestamp}.xlsx`);
}

// ===== Export Cash Flow =====
const cashFlowHeaderStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 12, name: 'Calibri' },
    fill: { fgColor: { rgb: '0D9488' } },  // Teal accent
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
        top: { style: 'thin', color: { rgb: '5EEAD4' } },
        bottom: { style: 'thin', color: { rgb: '5EEAD4' } },
        left: { style: 'thin', color: { rgb: '5EEAD4' } },
        right: { style: 'thin', color: { rgb: '5EEAD4' } },
    },
};

const cashFlowInsertStyle = {
    font: { bold: true, sz: 11, name: 'Calibri', color: { rgb: '1E40AF' } },
    fill: { fgColor: { rgb: 'DBEAFE' } },
    alignment: { vertical: 'center', wrapText: true },
    border: {
        top: { style: 'thin', color: { rgb: 'BFDBFE' } },
        bottom: { style: 'thin', color: { rgb: 'BFDBFE' } },
        left: { style: 'thin', color: { rgb: 'BFDBFE' } },
        right: { style: 'thin', color: { rgb: 'BFDBFE' } },
    },
};

const cashFlowEvenRow = (base) => ({
    ...base,
    fill: { fgColor: { rgb: 'F0FDFA' } },  // Light teal tint
});

export function exportCashFlowToExcel(displayItems, summary, levelLabel, isGabungan, filename = 'cashflow', visibleColumns = null) {
    if (!displayItems || displayItems.length === 0) return;

    const hasLevel = isGabungan;

    const allColumns = [
        { key: 'no', label: 'No', style: cellStyleCenter },
        { key: 'tanggal', label: 'Tanggal', style: cellStyleCenter },
        ...(hasLevel ? [{ key: 'pelatihan', label: 'Pelatihan', style: cellStyleCenter }] : []),
        { key: 'jenis', label: 'Jenis', style: cellStyleCenter },
        { key: 'items', label: 'Items', style: cellStyle },
        { key: 'masuk', label: 'Masuk (Kredit)', style: currencyStyle },
        { key: 'keluar', label: 'Keluar (Debit)', style: currencyStyle },
        { key: 'saldo', label: 'Saldo', style: currencyStyle },
        { key: 'keterangan', label: 'Keterangan', style: cellStyle },
    ];

    const cols = allColumns.filter(c => {
        if (!visibleColumns) return true;
        if (visibleColumns[c.key] !== undefined) return visibleColumns[c.key];
        return true;
    });

    const headers = cols.map(c => ({ label: c.label, style: c.style }));

    const buildRow = (item, i) => {
        const map = {
            no: i + 1,
            tanggal: item.tanggal || '-',
            pelatihan: item.level || '',
            jenis: item.isAutoInsert ? 'INSERT' : (item.kredit > 0 ? 'MASUK' : 'KELUAR'),
            items: item.item || '',
            masuk: item.kredit || 0,
            keluar: item.debit || 0,
            saldo: item.saldo || 0,
            keterangan: item.keterangan || '',
        };
        return cols.map(c => map[c.key]);
    };

    const exportData = displayItems.map((item, i) => buildRow(item, i));

    // Build totals row
    const totalRow = cols.map(c => {
        if (c.key === 'jenis') return 'TOTAL';
        if (c.key === 'masuk') return summary.kredit || 0;
        if (c.key === 'keluar') return summary.debit || 0;
        if (c.key === 'saldo') return summary.saldo || 0;
        if (c.key === 'keterangan') return 'Saldo Akhir';
        return '';
    });

    const ws = XLSX.utils.aoa_to_sheet([headers.map(h => h.label), ...exportData, totalRow]);
    const range = XLSX.utils.decode_range(ws['!ref']);

    // Style header
    for (let col = range.s.c; col <= range.e.c; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
        if (ws[cellRef]) ws[cellRef].s = cashFlowHeaderStyle;
    }

    // Style data rows
    for (let row = 1; row <= exportData.length; row++) {
        const item = displayItems[row - 1];
        const isEven = row % 2 === 0;
        for (let col = range.s.c; col <= range.e.c; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
            if (!ws[cellRef]) continue;
            if (item && item.isAutoInsert) {
                ws[cellRef].s = cashFlowInsertStyle;
            } else {
                const baseStyle = headers[col]?.style || cellStyle;
                ws[cellRef].s = isEven ? cashFlowEvenRow(baseStyle) : baseStyle;
            }
        }
    }

    // Style totals row
    const totalRowIdx = exportData.length + 1;
    const totalStyle = {
        font: { bold: true, sz: 12, name: 'Calibri', color: { rgb: '1E3A5F' } },
        fill: { fgColor: { rgb: 'FEF3C7' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: {
            top: { style: 'medium', color: { rgb: 'F59E0B' } },
            bottom: { style: 'medium', color: { rgb: 'F59E0B' } },
            left: { style: 'thin', color: { rgb: 'FDE68A' } },
            right: { style: 'thin', color: { rgb: 'FDE68A' } },
        },
    };
    const totalCurrStyle = { ...totalStyle, alignment: { ...totalStyle.alignment, horizontal: 'right' }, numFmt: '#,##0' };
    const currencyKeys = ['masuk', 'keluar', 'saldo'];
    for (let colIdx = 0; colIdx < cols.length; colIdx++) {
        const cellRef = XLSX.utils.encode_cell({ r: totalRowIdx, c: colIdx });
        if (ws[cellRef]) {
            ws[cellRef].s = currencyKeys.includes(cols[colIdx].key) ? totalCurrStyle : totalStyle;
        }
    }

    // Auto-width
    ws['!cols'] = headers.map((h, i) => {
        let maxLen = h.label.length;
        for (let row = 1; row <= exportData.length + 1; row++) {
            const cellRef = XLSX.utils.encode_cell({ r: row, c: i });
            if (ws[cellRef] && ws[cellRef].v != null) {
                maxLen = Math.max(maxLen, String(ws[cellRef].v).length);
            }
        }
        return { wch: Math.min(maxLen + 3, 40) };
    });

    ws['!rows'] = [{ hpt: 30 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cash Flow');

    const timestamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `${filename}_${timestamp}.xlsx`);
}
