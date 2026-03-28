import React, { useMemo, useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { Users, CheckCircle, Clock, AlertCircle, DollarSign, UserPlus, List, ArrowRight, Archive, Globe, FileText, Award, Layers } from 'lucide-react';
import { Link } from 'react-router-dom';
import { isLevelArchived } from '../utils/dateUtils';
import { getCashFlowItems } from '../utils/storage';

export default function Dashboard() {
    const { peserta, levels } = useData();
    const [allCashFlowItems, setAllCashFlowItems] = useState({});

    // Load cash flow data for all levels
    useEffect(() => {
        const loadCashFlow = async () => {
            const levelKeys = Object.keys(levels);
            const allItems = {};
            await Promise.all(levelKeys.map(async (lvl) => {
                allItems[lvl] = await getCashFlowItems(lvl);
            }));
            setAllCashFlowItems(allItems);
        };
        if (Object.keys(levels).length > 0) {
            loadCashFlow();
        }
    }, [levels]);

    const stats = useMemo(() => {
        const activePeserta = peserta.filter(p => !isLevelArchived(levels[p.level]));
        const archivedPeserta = peserta.filter(p => isLevelArchived(levels[p.level]));

        const getKepesertaanStatus = (p) => {
            if (p.statusBayar === 'Lunas' || p.statusBayar === 'DP') return 'Terdaftar';
            return p.statusKepesertaan || 'Konfirmasi';
        };

        const totalRevenue = activePeserta.reduce((sum, p) => {
            const levelData = levels[p.level];
            let biaya = levelData?.biayaNormal || levelData?.biaya || 0;
            if (p.jenisBiaya === 'Early Bird' && levelData?.biayaEarly) {
                biaya = levelData.biayaEarly;
            } else if (p.jenisBiaya === 'Khusus' && levelData?.biayaKhusus) {
                biaya = levelData.biayaKhusus;
            }

            if (p.statusBayar === 'Lunas') return sum + biaya;
            if (p.statusBayar === 'DP') return sum + (p.nominalDP || 0);
            return sum;
        }, 0);

        return {
            grandTotal: peserta.length,
            totalActive: activePeserta.filter(p => getKepesertaanStatus(p) !== 'Batal').length,
            totalArchived: archivedPeserta.length,
            lunas: activePeserta.filter((p) => p.statusBayar === 'Lunas').length,
            dp: activePeserta.filter((p) => p.statusBayar === 'DP').length,
            belumBayar: activePeserta.filter((p) => p.statusBayar === 'Belum Bayar').length,
            totalRevenue,
        };
    }, [peserta, levels]);

    const combinedCashflowStats = useMemo(() => {
        let totalKredit = 0;
        let totalDebit = 0;

        // Same calculation logic as Gabungan CashFlow
        Object.keys(levels).forEach(lvl => {
            const filteredPeserta = peserta.filter(p => p.level === lvl);
            const ld = levels[lvl] || {};

            // Calculate pemasukan per level (Auto Insert)
            const pemasukanLevel = filteredPeserta.reduce((sum, p) => {
                if (p.statusBayar === 'Lunas') {
                    let biaya = ld.biayaNormal || ld.biaya || 0;
                    if (p.jenisBiaya === 'Early Bird' && ld.biayaEarly) biaya = ld.biayaEarly;
                    else if (p.jenisBiaya === 'Khusus' && ld.biayaKhusus) biaya = ld.biayaKhusus;
                    return sum + biaya;
                }
                if (p.statusBayar === 'DP') return sum + (p.nominalDP || 0);
                return sum;
            }, 0);

            totalKredit += pemasukanLevel;

            // Add manual items
            const items = allCashFlowItems[lvl] || [];
            items.forEach(item => {
                totalKredit += Number(item.kredit) || 0;
                totalDebit += Number(item.debit) || 0;
            });
        });

        return {
            kredit: totalKredit,
            debit: totalDebit,
            saldo: totalKredit - totalDebit
        };
    }, [allCashFlowItems, levels, peserta]);

    const fmt = (n) =>
        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

    const cards = [
        { label: 'Total Seluruh Peserta', value: stats.grandTotal, icon: Users, cls: 'stat-card-blue', iconColor: 'var(--accent-blue)' },
        { label: 'Total Peserta Aktif', value: stats.totalActive, icon: CheckCircle, cls: 'stat-card-emerald', iconColor: 'var(--accent-emerald)' },
        { label: 'Pembayaran Lunas', value: stats.lunas, icon: DollarSign, cls: 'stat-card-emerald', iconColor: 'var(--accent-emerald)' },
        { label: 'Total Peserta Arsip', value: stats.totalArchived, icon: Archive, cls: 'stat-card-amber', iconColor: 'var(--accent-amber)' },
    ];

    const badges = ['badge-blue', 'badge-amber', 'badge-rose', 'badge-emerald'];

    const activeLevels = Object.entries(levels).filter(([_, data]) => !isLevelArchived(data));
    const archivedLevels = Object.entries(levels).filter(([_, data]) => isLevelArchived(data));

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    Dashboard
                </h1>
                <p style={{ fontSize: '15px', color: 'var(--text-muted)' }}>Ringkasan data peserta pelatihan</p>
            </div>

            {/* Stat Cards */}
            <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                {cards.map((card) => (
                    <div key={card.label} className={`stat-card ${card.cls}`}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                {card.label}
                            </span>
                            <div style={{
                                width: '36px', height: '36px', borderRadius: '10px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: card.iconColor + '15',
                            }}>
                                <card.icon style={{ width: '18px', height: '18px', color: card.iconColor }} />
                            </div>
                        </div>
                        <p style={{ fontSize: '36px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                            {card.value}
                        </p>
                    </div>
                ))}
            </div>

            {/* Revenue & Saldo Akhir Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                {/* Revenue Card */}
                <div className="card" style={{ padding: '28px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '10px',
                            background: 'var(--accent-emerald-light)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <DollarSign style={{ width: '20px', height: '20px', color: 'var(--accent-emerald)' }} />
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Total Pemasukan Peserta
                        </span>
                    </div>
                    <p style={{ fontSize: '34px', fontWeight: 800, color: 'var(--accent-emerald)' }}>
                        {fmt(stats.totalRevenue)}
                    </p>
                    <div style={{ marginTop: '16px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                        <div>
                            <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Lunas (Aktif)</p>
                            <p style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>{stats.lunas}</p>
                        </div>
                        <div>
                            <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>DP (Aktif)</p>
                            <p style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>{stats.dp}</p>
                        </div>
                    </div>
                </div>

                {/* Saldo Akhir Card */}
                <div className="card" style={{ padding: '28px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '10px',
                            background: 'var(--accent-blue-light)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Layers style={{ width: '20px', height: '20px', color: 'var(--accent-blue)' }} />
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Saldo Akhir (Cash Flow)
                        </span>
                    </div>
                    <p style={{ fontSize: '34px', fontWeight: 800, color: combinedCashflowStats.saldo < 0 ? 'var(--accent-rose)' : 'var(--accent-blue)' }}>
                        {fmt(combinedCashflowStats.saldo)}
                    </p>
                    <div style={{ marginTop: '16px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                        <div>
                            <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Total Pemasukan Keseluruhan</p>
                            <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent-emerald)' }}>{fmt(combinedCashflowStats.kredit)}</p>
                        </div>
                        <div>
                            <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Total Pengeluaran Manual</p>
                            <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent-rose)' }}>{fmt(combinedCashflowStats.debit)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Level Breakdown */}
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>Pelatihan Aktif</h2>
            {activeLevels.length === 0 ? (
                <div className="card" style={{ padding: '24px', textAlign: 'center', marginBottom: '24px', border: '1px dashed var(--border-color)', background: 'transparent', boxShadow: 'none' }}>
                    <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Tidak ada pelatihan aktif.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                    {activeLevels.map(([lvl, data], idx) => {
                        const count = peserta.filter(p => p.level === lvl).length;
                        return (
                            <div key={lvl} className="card" style={{ padding: '24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div>
                                        <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>{lvl}</p>
                                        <p style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)' }}>{count}</p>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '6px' }}>
                                            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Normal: {fmt(data.biayaNormal || data.biaya)}</p>
                                            {data.biayaEarly > 0 && (
                                                <p style={{ fontSize: '11px', color: 'var(--accent-blue)', fontWeight: 600 }}>EB: {fmt(data.biayaEarly)}</p>
                                            )}
                                            {data.biayaKhusus > 0 && (
                                                <p style={{ fontSize: '11px', color: 'var(--accent-emerald)', fontWeight: 600 }}>HK: {fmt(data.biayaKhusus)}</p>
                                            )}
                                            {data.tanggal && <span style={{ fontSize: '11px', marginTop: '4px', padding: '2px 6px', background: 'var(--bg-input)', borderRadius: '4px', color: 'var(--text-secondary)', alignSelf: 'flex-start' }}>{data.tanggal}</span>}
                                        </div>
                                    </div>
                                    <span className={`badge ${badges[idx % badges.length]}`}>{lvl}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {archivedLevels.length > 0 && (
                <>
                    <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Archive style={{ width: '16px', height: '16px' }} />
                        Pelatihan Selesai (Arsip)
                    </h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                        {archivedLevels.map(([lvl, data]) => {
                            const count = peserta.filter(p => p.level === lvl).length;
                            return (
                                <div key={lvl} className="card" style={{ padding: '20px', opacity: 0.8, filter: 'grayscale(0.5)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                        <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-secondary)' }}>{lvl}</p>
                                        <span className="badge badge-archived" style={{ fontSize: '10px' }}>Arsip</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'end', gap: '8px' }}>
                                        <p style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-secondary)' }}>{count}</p>
                                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', paddingBottom: '4px' }}>peserta</p>
                                    </div>
                                    {data.tanggal && (
                                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                                            Selesai pada: {data.tanggal}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* Quick Actions */}
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>Shortcut Menu</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                <Link to="/pengelola/tambah" style={{ textDecoration: 'none' }}>
                    <div className="card" style={{
                        padding: '24px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', transition: 'transform 0.2s',
                    }}>
                        <div style={{
                            width: '48px', height: '48px', borderRadius: '12px',
                            background: 'var(--accent-blue-light)', border: '1px solid var(--accent-blue-border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                            <UserPlus style={{ width: '22px', height: '22px', color: 'var(--accent-blue)' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '15px' }}>Tambah Peserta</p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>Input data baru atau Magic Paste</p>
                        </div>
                        <ArrowRight style={{ width: '18px', height: '18px', color: 'var(--text-muted)' }} />
                    </div>
                </Link>
                <Link to="/pengelola/peserta" style={{ textDecoration: 'none' }}>
                    <div className="card" style={{
                        padding: '24px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', transition: 'transform 0.2s',
                    }}>
                        <div style={{
                            width: '48px', height: '48px', borderRadius: '12px',
                            background: 'var(--accent-emerald-light)', border: '1px solid var(--accent-emerald-border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                            <List style={{ width: '22px', height: '22px', color: 'var(--accent-emerald)' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '15px' }}>Daftar Peserta</p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>Kelola data & export Excel</p>
                        </div>
                        <ArrowRight style={{ width: '18px', height: '18px', color: 'var(--text-muted)' }} />
                    </div>
                </Link>
            </div>

            {/* Halaman Publik */}
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>Halaman Publik</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                <Link to="/" target="_blank" style={{ textDecoration: 'none' }}>
                    <div className="card" style={{
                        padding: '24px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', transition: 'transform 0.2s',
                    }}>
                        <div style={{
                            width: '48px', height: '48px', borderRadius: '12px',
                            background: '#e0f2fe', border: '1px solid #bae6fd',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                            <Globe style={{ width: '22px', height: '22px', color: '#0284c7' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '15px' }}>Public Peserta</p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>Lihat data peserta yang dikurasi</p>
                        </div>
                        <ArrowRight style={{ width: '18px', height: '18px', color: 'var(--text-muted)' }} />
                    </div>
                </Link>

                <Link to="/formulir" target="_blank" style={{ textDecoration: 'none' }}>
                    <div className="card" style={{
                        padding: '24px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', transition: 'transform 0.2s',
                    }}>
                        <div style={{
                            width: '48px', height: '48px', borderRadius: '12px',
                            background: '#f3e8ff', border: '1px solid #e9d5ff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                            <FileText style={{ width: '22px', height: '22px', color: '#9333ea' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '15px' }}>Formulir Update</p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>Formulir bagi peserta (Landing)</p>
                        </div>
                        <ArrowRight style={{ width: '18px', height: '18px', color: 'var(--text-muted)' }} />
                    </div>
                </Link>

                <Link to="/sertifikat" target="_blank" style={{ textDecoration: 'none' }}>
                    <div className="card" style={{
                        padding: '24px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', transition: 'transform 0.2s',
                    }}>
                        <div style={{
                            width: '48px', height: '48px', borderRadius: '12px',
                            background: '#fef3c7', border: '1px solid #fde68a',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                            <Award style={{ width: '22px', height: '22px', color: '#d97706' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '15px' }}>Public Sertifikat</p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>Cek & Download e-sertifikat</p>
                        </div>
                        <ArrowRight style={{ width: '18px', height: '18px', color: 'var(--text-muted)' }} />
                    </div>
                </Link>
            </div>
        </div>
    );
}
