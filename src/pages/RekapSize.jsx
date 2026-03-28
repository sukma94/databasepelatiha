import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Shirt, FileSpreadsheet, Check, Package, TrendingUp, Users, Archive } from 'lucide-react';
import XLSX from 'xlsx-js-style';
import { isLevelArchived } from '../utils/dateUtils';

const SIZE_COLORS = {
    'XS': { bg: '#ede9fe', color: '#7c3aed', border: '#c4b5fd' },
    'S': { bg: '#dbeafe', color: '#2563eb', border: '#93c5fd' },
    'M': { bg: '#d1fae5', color: '#059669', border: '#6ee7b7' },
    'L': { bg: '#fef3c7', color: '#d97706', border: '#fcd34d' },
    'XL': { bg: '#fee2e2', color: '#dc2626', border: '#fca5a5' },
    'XXL': { bg: '#fce7f3', color: '#db2777', border: '#f9a8d4' },
    'XXXL': { bg: '#ede9fe', color: '#7c3aed', border: '#c4b5fd' },
    '2XL': { bg: '#fce7f3', color: '#db2777', border: '#f9a8d4' },
    '3XL': { bg: '#ede9fe', color: '#7c3aed', border: '#c4b5fd' },
    '4XL': { bg: '#e0e7ff', color: '#4338ca', border: '#a5b4fc' },
    '5XL': { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
};

const getSizeColor = (size) => SIZE_COLORS[size] || { bg: 'var(--accent-blue-light)', color: 'var(--accent-blue)', border: 'var(--accent-blue-border)' };

export default function RekapSize() {
    const { peserta, levels } = useData();
    const [toast, setToast] = useState(null);
    const [showArchived, setShowArchived] = useState(false);

    const showToast = (msg, type = 'success') => {
        setToast({ message: msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const getKepesertaanStatus = (p) => {
        if (p.statusBayar === 'Lunas' || p.statusBayar === 'DP') return 'Terdaftar';
        return p.statusKepesertaan || 'Konfirmasi';
    };

    const pesertaTerdaftar = useMemo(() => {
        return peserta.filter(p => {
            if (getKepesertaanStatus(p) !== 'Terdaftar') return false;
            const archived = isLevelArchived(levels[p.level]);
            if (showArchived && !archived) return false;
            if (!showArchived && archived) return false;
            return true;
        });
    }, [peserta, levels, showArchived]);

    const allSizes = useMemo(() => {
        const sizeSet = new Set();
        pesertaTerdaftar.forEach(p => {
            if (p.ukuranBaju && p.ukuranBaju.trim()) {
                sizeSet.add(p.ukuranBaju.trim().toUpperCase());
            }
        });
        const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '2XL', '3XL', '4XL', '5XL'];
        const sorted = [...sizeSet].sort((a, b) => {
            const ia = sizeOrder.indexOf(a);
            const ib = sizeOrder.indexOf(b);
            if (ia !== -1 && ib !== -1) return ia - ib;
            if (ia !== -1) return -1;
            if (ib !== -1) return 1;
            return a.localeCompare(b);
        });
        return sorted;
    }, [pesertaTerdaftar]);

    const rekapByLevel = useMemo(() => {
        const result = {};
        Object.keys(levels).forEach(lvl => {
            const pesertaLevel = pesertaTerdaftar.filter(p => p.level === lvl);
            const sizeCounts = {};
            allSizes.forEach(s => sizeCounts[s] = 0);
            let noSize = 0;
            pesertaLevel.forEach(p => {
                const sz = p.ukuranBaju?.trim().toUpperCase();
                if (sz && allSizes.includes(sz)) {
                    sizeCounts[sz]++;
                } else {
                    noSize++;
                }
            });
            result[lvl] = { total: pesertaLevel.length, sizeCounts, noSize };
        });
        return result;
    }, [pesertaTerdaftar, levels, allSizes]);

    const grandTotal = useMemo(() => {
        const sizeCounts = {};
        allSizes.forEach(s => sizeCounts[s] = 0);
        let noSize = 0;
        let total = 0;
        Object.values(rekapByLevel).forEach(data => {
            total += data.total;
            noSize += data.noSize;
            allSizes.forEach(s => {
                sizeCounts[s] += data.sizeCounts[s] || 0;
            });
        });
        return { total, sizeCounts, noSize };
    }, [rekapByLevel, allSizes]);

    // Styled Excel Export
    const exportRekap = () => {
        try {
            const headerStyle = {
                font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 12, name: 'Calibri' },
                fill: { fgColor: { rgb: '2563EB' } },
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
                alignment: { horizontal: 'center', vertical: 'center' },
                border: {
                    top: { style: 'thin', color: { rgb: 'E5E7EB' } },
                    bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
                    left: { style: 'thin', color: { rgb: 'E5E7EB' } },
                    right: { style: 'thin', color: { rgb: 'E5E7EB' } },
                },
            };

            const labelStyle = {
                ...cellStyle,
                font: { ...cellStyle.font, bold: true },
                alignment: { ...cellStyle.alignment, horizontal: 'left' },
            };

            const totalRowStyle = {
                ...cellStyle,
                font: { ...cellStyle.font, bold: true, sz: 12 },
                fill: { fgColor: { rgb: 'DBEAFE' } },
            };

            const totalLabelStyle = {
                ...totalRowStyle,
                alignment: { ...totalRowStyle.alignment, horizontal: 'left' },
            };

            const evenRowFill = { fgColor: { rgb: 'F0F7FF' } };

            const headers = ['Jenis Pelatihan', ...allSizes, 'Belum Isi', 'Total'];
            const aoa = [headers];

            const levelEntries = Object.entries(rekapByLevel).filter(([, data]) => data.total > 0);

            levelEntries.forEach(([lvl, data]) => {
                const row = [lvl];
                allSizes.forEach(s => row.push(data.sizeCounts[s] || 0));
                row.push(data.noSize);
                row.push(data.total);
                aoa.push(row);
            });

            const totalRow = ['TOTAL KESELURUHAN'];
            allSizes.forEach(s => totalRow.push(grandTotal.sizeCounts[s] || 0));
            totalRow.push(grandTotal.noSize);
            totalRow.push(grandTotal.total);
            aoa.push(totalRow);

            if (levelEntries.length === 0) {
                showToast('Tidak ada data untuk diexport!', 'error');
                return;
            }

            const ws = XLSX.utils.aoa_to_sheet(aoa);
            const range = XLSX.utils.decode_range(ws['!ref']);

            for (let col = range.s.c; col <= range.e.c; col++) {
                const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
                if (ws[cellRef]) ws[cellRef].s = headerStyle;
            }

            const totalRowIdx = aoa.length - 1;
            for (let row = 1; row <= range.e.r; row++) {
                const isTotal = row === totalRowIdx;
                const isEven = row % 2 === 0;
                for (let col = range.s.c; col <= range.e.c; col++) {
                    const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
                    if (!ws[cellRef]) continue;
                    if (isTotal) {
                        ws[cellRef].s = col === 0 ? totalLabelStyle : totalRowStyle;
                    } else {
                        const base = col === 0 ? labelStyle : cellStyle;
                        ws[cellRef].s = isEven ? { ...base, fill: evenRowFill } : base;
                    }
                }
            }

            ws['!cols'] = headers.map((h, i) => ({
                wch: i === 0 ? 25 : Math.max(h.length + 2, 10)
            }));
            ws['!rows'] = [{ hpt: 28 }];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Rekap Size Baju');

            const timestamp = new Date().toISOString().slice(0, 10);
            XLSX.writeFile(wb, `rekap_size_baju_${timestamp}.xlsx`);
            showToast('Rekap berhasil diexport!');
        } catch (err) {
            console.error('Export error:', err);
            showToast('Gagal export! ' + (err.message || ''), 'error');
        }
    };

    // Export per level
    const exportRekapPerLevel = (lvl) => {
        try {
            const data = rekapByLevel[lvl];
            if (!data || data.total === 0) {
                showToast('Tidak ada data untuk diexport!', 'error');
                return;
            }

            const headerStyle = {
                font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 12, name: 'Calibri' },
                fill: { fgColor: { rgb: '2563EB' } },
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
                alignment: { horizontal: 'center', vertical: 'center' },
                border: {
                    top: { style: 'thin', color: { rgb: 'E5E7EB' } },
                    bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
                    left: { style: 'thin', color: { rgb: 'E5E7EB' } },
                    right: { style: 'thin', color: { rgb: 'E5E7EB' } },
                },
            };

            const labelStyle = {
                ...cellStyle,
                alignment: { ...cellStyle.alignment, horizontal: 'left' },
            };

            const totalRowStyle = {
                ...cellStyle,
                font: { ...cellStyle.font, bold: true, sz: 12 },
                fill: { fgColor: { rgb: 'DBEAFE' } },
            };

            const totalLabelStyle = {
                ...totalRowStyle,
                alignment: { ...totalRowStyle.alignment, horizontal: 'left' },
            };

            const evenRowFill = { fgColor: { rgb: 'F0F7FF' } };

            // ===== Sheet 1: Rekap Size =====
            const headers = ['Size', 'Jumlah'];
            const aoa = [headers];

            allSizes.forEach(s => {
                aoa.push([s, data.sizeCounts[s] || 0]);
            });
            if (data.noSize > 0) {
                aoa.push(['Belum Isi', data.noSize]);
            }
            aoa.push(['TOTAL', data.total]);

            const ws = XLSX.utils.aoa_to_sheet(aoa);
            const range = XLSX.utils.decode_range(ws['!ref']);

            for (let col = range.s.c; col <= range.e.c; col++) {
                const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
                if (ws[cellRef]) ws[cellRef].s = headerStyle;
            }

            const totalIdx = aoa.length - 1;
            for (let row = 1; row <= range.e.r; row++) {
                const isTotal = row === totalIdx;
                const isEven = row % 2 === 0;
                for (let col = range.s.c; col <= range.e.c; col++) {
                    const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
                    if (!ws[cellRef]) continue;
                    if (isTotal) {
                        ws[cellRef].s = col === 0 ? totalLabelStyle : totalRowStyle;
                    } else {
                        const base = col === 0 ? labelStyle : cellStyle;
                        ws[cellRef].s = isEven ? { ...base, fill: evenRowFill } : base;
                    }
                }
            }

            ws['!cols'] = [{ wch: 15 }, { wch: 12 }];
            ws['!rows'] = [{ hpt: 28 }];

            // ===== Sheet 2: Detail Peserta =====
            const pesertaLevel = pesertaTerdaftar
                .filter(p => p.level === lvl)
                .sort((a, b) => {
                    const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '2XL', '3XL', '4XL', '5XL'];
                    const sA = (a.ukuranBaju || '').trim().toUpperCase();
                    const sB = (b.ukuranBaju || '').trim().toUpperCase();
                    const iA = sizeOrder.indexOf(sA);
                    const iB = sizeOrder.indexOf(sB);
                    if (iA !== -1 && iB !== -1) return iA - iB;
                    if (iA !== -1) return -1;
                    if (iB !== -1) return 1;
                    return sA.localeCompare(sB);
                });

            const detailHeaders = ['No', 'Nama', 'Size'];
            const detailAoa = [detailHeaders];
            pesertaLevel.forEach((p, i) => {
                detailAoa.push([i + 1, p.nama || '-', (p.ukuranBaju || '-').trim().toUpperCase()]);
            });

            const wsDetail = XLSX.utils.aoa_to_sheet(detailAoa);
            const rangeDetail = XLSX.utils.decode_range(wsDetail['!ref']);

            for (let col = rangeDetail.s.c; col <= rangeDetail.e.c; col++) {
                const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
                if (wsDetail[cellRef]) wsDetail[cellRef].s = headerStyle;
            }

            for (let row = 1; row <= rangeDetail.e.r; row++) {
                const isEven = row % 2 === 0;
                for (let col = rangeDetail.s.c; col <= rangeDetail.e.c; col++) {
                    const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
                    if (!wsDetail[cellRef]) continue;
                    const base = col === 1 ? labelStyle : cellStyle;
                    wsDetail[cellRef].s = isEven ? { ...base, fill: evenRowFill } : base;
                }
            }

            wsDetail['!cols'] = [{ wch: 6 }, { wch: 30 }, { wch: 10 }];
            wsDetail['!rows'] = [{ hpt: 28 }];

            // ===== Create Workbook =====
            const wb = XLSX.utils.book_new();

            // Truncate sheet name to max 31 chars (Excel limit)
            const rekapSheetName = `Rekap Size`.substring(0, 31);
            const detailSheetName = `Detail Peserta`.substring(0, 31);

            XLSX.utils.book_append_sheet(wb, ws, rekapSheetName);
            XLSX.utils.book_append_sheet(wb, wsDetail, detailSheetName);

            const timestamp = new Date().toISOString().slice(0, 10);
            const safeName = lvl.replace(/[^a-zA-Z0-9]/g, '_');
            XLSX.writeFile(wb, `rekap_size_${safeName}_${timestamp}.xlsx`);
            showToast(`Rekap size ${lvl} berhasil diexport!`);
        } catch (err) {
            console.error('Export error:', err);
            showToast('Gagal export! ' + (err.message || ''), 'error');
        }
    };

    const levelNames = Object.keys(levels).filter(lvl => {
        const archived = isLevelArchived(levels[lvl]);
        return showArchived ? archived : !archived;
    });
    const hasData = pesertaTerdaftar.length > 0;
    const totalPeserta = peserta.length;
    const totalTerdaftar = pesertaTerdaftar.length;

    // Find most popular size
    const popularSize = useMemo(() => {
        let max = 0;
        let size = '-';
        allSizes.forEach(s => {
            if (grandTotal.sizeCounts[s] > max) {
                max = grandTotal.sizeCounts[s];
                size = s;
            }
        });
        return { size, count: max };
    }, [grandTotal, allSizes]);

    // Size card component
    const SizeCard = ({ size, count, isGrand = false }) => {
        const sizeColor = getSizeColor(size);
        const hasCount = count > 0;
        return (
            <div style={{
                padding: isGrand ? '18px 14px' : '16px 12px',
                borderRadius: '16px',
                border: `2px solid ${hasCount ? sizeColor.border : 'var(--border-color)'}`,
                background: hasCount ? sizeColor.bg : 'var(--bg-input)',
                textAlign: 'center',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'default',
                position: 'relative',
                overflow: 'hidden',
            }}
                onMouseEnter={e => {
                    if (hasCount) {
                        e.currentTarget.style.transform = 'translateY(-4px) scale(1.03)';
                        e.currentTarget.style.boxShadow = `0 12px 24px ${sizeColor.border}66`;
                    }
                }}
                onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0) scale(1)';
                    e.currentTarget.style.boxShadow = 'none';
                }}
            >
                <p style={{
                    fontSize: isGrand ? '22px' : '20px',
                    fontWeight: 800,
                    color: hasCount ? sizeColor.color : 'var(--text-muted)',
                    letterSpacing: '1px',
                    marginBottom: '4px',
                }}>{size}</p>
                <p style={{
                    fontSize: isGrand ? '32px' : '28px',
                    fontWeight: 900,
                    color: hasCount ? sizeColor.color : 'var(--text-muted)',
                    lineHeight: 1,
                    opacity: hasCount ? 1 : 0.4,
                }}>{count}</p>
                {hasCount && (
                    <p style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        color: sizeColor.color,
                        opacity: 0.6,
                        marginTop: '4px',
                    }}>pcs</p>
                )}
            </div>
        );
    };

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '28px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        Rekap Size Baju
                        {showArchived && <span className="badge badge-archived" style={{ fontSize: '14px', letterSpacing: '0.05em' }}>📦 Mode Arsip Aktif</span>}
                    </h1>
                    <p style={{ fontSize: '14px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        Rekapitulasi ukuran baju peserta <strong style={{ color: 'var(--accent-emerald)' }}>Terdaftar</strong>
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label className="custom-control custom-control-bulat" style={{ padding: '8px 12px', background: showArchived ? 'var(--bg-card-hover)' : 'var(--bg-input)', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s', boxShadow: showArchived ? 'var(--shadow-sm)' : 'none' }}>
                        <input
                            type="checkbox"
                            checked={showArchived}
                            onChange={(e) => setShowArchived(e.target.checked)}
                        />
                        <span className="control-bubble"></span>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: showArchived ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}><Archive style={{ width: '14px', height: '14px' }} /> Lihat Arsip</span>
                    </label>

                    {hasData && (
                        <button onClick={exportRekap} className="btn btn-success" style={{ padding: '8px 16px' }}>
                            <FileSpreadsheet style={{ width: '16px', height: '16px' }} />
                            Export Semua
                        </button>
                    )}
                </div>
            </div>

            {/* Summary Stats */}
            {hasData && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '28px' }}>
                    <div className="stat-card stat-card-blue" style={{ padding: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--accent-blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Users style={{ width: '20px', height: '20px', color: 'var(--accent-blue)' }} />
                            </div>
                            <div>
                                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Peserta</p>
                                <p style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>{totalPeserta}</p>
                            </div>
                        </div>
                    </div>
                    <div className="stat-card stat-card-emerald" style={{ padding: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--accent-emerald-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Check style={{ width: '20px', height: '20px', color: 'var(--accent-emerald)' }} />
                            </div>
                            <div>
                                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Terdaftar</p>
                                <p style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>{totalTerdaftar}</p>
                            </div>
                        </div>
                    </div>
                    <div className="stat-card stat-card-amber" style={{ padding: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--accent-amber-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <TrendingUp style={{ width: '20px', height: '20px', color: 'var(--accent-amber)' }} />
                            </div>
                            <div>
                                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Size Terpopuler</p>
                                <p style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>{popularSize.size} <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>({popularSize.count})</span></p>
                            </div>
                        </div>
                    </div>
                    <div className="stat-card stat-card-rose" style={{ padding: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--accent-rose-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Shirt style={{ width: '20px', height: '20px', color: 'var(--accent-rose)' }} />
                            </div>
                            <div>
                                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Variasi Size</p>
                                <p style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>{allSizes.length} <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>jenis</span></p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {!hasData ? (
                <div className="card" style={{ padding: '80px 24px', textAlign: 'center' }}>
                    <div style={{ width: '72px', height: '72px', borderRadius: '20px', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                        <Shirt style={{ width: '36px', height: '36px', color: 'var(--text-muted)' }} />
                    </div>
                    <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>Belum ada peserta Terdaftar</p>
                    <p style={{ fontSize: '14px', color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto' }}>
                        Hanya peserta dengan status kepesertaan "Terdaftar" yang masuk dalam rekapan size baju
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Per-Level Cards */}
                    {levelNames.map(lvl => {
                        const data = rekapByLevel[lvl];
                        if (!data || data.total === 0) return null;
                        return (
                            <div key={lvl} className="card" style={{ overflow: 'hidden' }}>
                                <div style={{
                                    padding: '20px 24px', borderBottom: '1px solid var(--border-color)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--accent-blue-light) 100%)',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                        <div style={{
                                            width: '42px', height: '42px', borderRadius: '12px',
                                            background: 'var(--accent-blue)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                                        }}>
                                            <Shirt style={{ width: '20px', height: '20px', color: '#fff' }} />
                                        </div>
                                        <div>
                                            <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)' }}>{lvl}</h3>
                                            {levels[lvl]?.tanggal && (
                                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{levels[lvl].tanggal}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span className="badge badge-emerald" style={{ fontSize: '11px' }}>Terdaftar</span>
                                        <span className="badge badge-blue" style={{ fontSize: '13px', padding: '5px 12px', fontWeight: 700 }}>{data.total} peserta</span>
                                        <button
                                            type="button"
                                            onClick={() => exportRekapPerLevel(lvl)}
                                            className="icon-btn icon-btn-emerald"
                                            data-tooltip={`Export ${lvl}`}
                                            style={{ width: '32px', height: '32px', position: 'relative', zIndex: 10 }}
                                        >
                                            <FileSpreadsheet style={{ width: '15px', height: '15px' }} />
                                        </button>
                                    </div>
                                </div>
                                <div style={{ padding: '24px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '14px' }}>
                                        {allSizes.map(size => (
                                            <SizeCard key={size} size={size} count={data.sizeCounts[size]} />
                                        ))}
                                        {data.noSize > 0 && (
                                            <div style={{
                                                padding: '16px 12px',
                                                borderRadius: '16px',
                                                border: '2px dashed var(--accent-rose-border)',
                                                background: 'var(--accent-rose-light)',
                                                textAlign: 'center',
                                                transition: 'all 0.3s ease',
                                            }}>
                                                <p style={{ fontSize: '12px', fontWeight: 800, color: 'var(--accent-rose)', marginBottom: '4px', letterSpacing: '0.5px' }}>BELUM ISI</p>
                                                <p style={{ fontSize: '28px', fontWeight: 900, color: 'var(--accent-rose)', lineHeight: 1 }}>{data.noSize}</p>
                                                <p style={{ fontSize: '10px', fontWeight: 600, color: 'var(--accent-rose)', opacity: 0.6, marginTop: '4px' }}>pcs</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Grand Total */}
                    {grandTotal.total > 0 && (
                        <div className="card" style={{
                            overflow: 'hidden',
                            border: '2px solid var(--accent-blue-border)',
                            boxShadow: '0 8px 32px rgba(59, 130, 246, 0.12)',
                        }}>
                            <div style={{
                                padding: '24px',
                                borderBottom: '1px solid var(--accent-blue-border)',
                                background: 'linear-gradient(135deg, var(--accent-blue-light) 0%, var(--bg-card) 50%, var(--accent-blue-light) 100%)',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                    <div style={{
                                        width: '48px', height: '48px', borderRadius: '14px',
                                        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        boxShadow: '0 6px 16px rgba(37, 99, 235, 0.4)',
                                    }}>
                                        <Package style={{ width: '22px', height: '22px', color: '#fff' }} />
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>Total Keseluruhan Pesanan</h3>
                                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>Gabungan semua jenis pelatihan</p>
                                    </div>
                                </div>
                                <span style={{
                                    fontSize: '15px', padding: '8px 18px', fontWeight: 800,
                                    background: 'var(--accent-blue)', color: '#fff',
                                    borderRadius: '10px', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                                }}>{grandTotal.total} peserta</span>
                            </div>
                            <div style={{ padding: '28px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '16px' }}>
                                    {allSizes.map(size => (
                                        <SizeCard key={size} size={size} count={grandTotal.sizeCounts[size]} isGrand={true} />
                                    ))}
                                    {grandTotal.noSize > 0 && (
                                        <div style={{
                                            padding: '18px 14px',
                                            borderRadius: '16px',
                                            border: '2px dashed var(--accent-rose)',
                                            background: 'var(--accent-rose-light)',
                                            textAlign: 'center',
                                        }}>
                                            <p style={{ fontSize: '14px', fontWeight: 800, color: 'var(--accent-rose)', marginBottom: '4px', letterSpacing: '0.5px' }}>BELUM ISI</p>
                                            <p style={{ fontSize: '32px', fontWeight: 900, color: 'var(--accent-rose)', lineHeight: 1 }}>{grandTotal.noSize}</p>
                                            <p style={{ fontSize: '10px', fontWeight: 600, color: 'var(--accent-rose)', opacity: 0.6, marginTop: '4px' }}>pcs</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {toast && (
                <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
                    <Check style={{ width: '18px', height: '18px' }} />
                    {toast.message}
                </div>
            )}
        </div>
    );
}
