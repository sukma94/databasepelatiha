import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { getAlamatPengiriman, deleteAlamatPengiriman, slugify } from '../utils/storage';
import { formatWhatsApp } from '../utils/formatters';
import { MapPinned, Search, Package, Trash2, CheckCircle, Copy, Check, ExternalLink, Link2, Clock, Users, MessageCircle } from 'lucide-react';
import './AlamatPengiriman.css';
import * as XLSX from 'xlsx';
import PrintAlamatPengiriman from './PrintAlamatPengiriman';
import CustomSelect from '../components/CustomSelect';

export default function AlamatPengiriman() {
    const { levels, peserta } = useData();

    // Level filter
    const [selectedLevel, setSelectedLevel] = useState('');
    useEffect(() => {
        const keys = Object.keys(levels);
        if (keys.length > 0 && !selectedLevel) setSelectedLevel(keys[0]);
    }, [levels]);

    const [alamatList, setAlamatList] = useState([]);
    const [loadingAlamat, setLoadingAlamat] = useState(true);
    const [searchAlamat, setSearchAlamat] = useState('');

    // Tabs & Sort
    const [activeTab, setActiveTab] = useState('sudah'); // 'sudah' or 'belum'
    const [sortBy, setSortBy] = useState('terbaru');

    // Toast
    const [toast, setToast] = useState(null);
    const [copiedLink, setCopiedLink] = useState(false);
    const [copiedNames, setCopiedNames] = useState(false);
    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    };

    // Load addresses
    useEffect(() => {
        setLoadingAlamat(true);
        getAlamatPengiriman().then(data => {
            setAlamatList(data);
            setLoadingAlamat(false);
        });
    }, []);

    // Filter by search & level
    const filteredAlamat = useMemo(() => {
        let list = [...alamatList];
        if (selectedLevel) {
            list = list.filter(a => a.level === selectedLevel);
        }
        if (searchAlamat.trim()) {
            const q = searchAlamat.toLowerCase();
            list = list.filter(a =>
                a.namaPeserta?.toLowerCase().includes(q) ||
                a.namaPenerima?.toLowerCase().includes(q) ||
                a.alamatDetail?.toLowerCase().includes(q) ||
                a.kabupaten?.toLowerCase().includes(q) ||
                (a.kabupaten && !a.kabupaten.toLowerCase().includes('kota') && `kab. ${a.kabupaten.toLowerCase()}`.includes(q))
            );
        }
        
        // Sorting logic integrated
        if (sortBy === 'terbaru') {
            list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        } else if (sortBy === 'terlama') {
            list.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
        } else if (sortBy === 'namaAsc') {
            list.sort((a, b) => (a.namaPeserta || '').localeCompare(b.namaPeserta || '', 'id', { sensitivity: 'base' }));
        } else if (sortBy === 'namaDesc') {
            list.sort((a, b) => (b.namaPeserta || '').localeCompare(a.namaPeserta || '', 'id', { sensitivity: 'base' }));
        }

        return list;
    }, [alamatList, selectedLevel, searchAlamat, sortBy]);

    // Derived: Peserta yang BELUM mengisi
    const belumMengisiList = useMemo(() => {
        let pList = peserta || [];
        
        // Filter by Level Name mostly (check if levels map holds the level Name)
        if (selectedLevel) {
            // Find level ID that matches the selectedLevel name
            const levelId = Object.keys(levels).find(key => levels[key].name === selectedLevel || key === selectedLevel);
            if (levelId) {
                pList = pList.filter(p => p.level === levelId || p.level === selectedLevel);
            }
        }

        // Exclude Cancelled
        pList = pList.filter(p => p.statusKepesertaan !== 'Batal');

        // IDs of those who have submitted
        const submittedIds = new Set(alamatList.map(a => a.pesertaId));

        // Those who haven't
        let pending = pList.filter(p => !submittedIds.has(p.id));

        // Search Filter
        if (searchAlamat.trim()) {
            const q = searchAlamat.toLowerCase();
            pending = pending.filter(p =>
                p.nama?.toLowerCase().includes(q) ||
                p.wa?.toLowerCase().includes(q)
            );
        }

        // Sorting for Belum Mengisi tab (Since they don't have dates, just sort by name)
        if (sortBy === 'namaDesc') {
            pending.sort((a, b) => (b.nama || '').localeCompare(a.nama || '', 'id', { sensitivity: 'base' }));
        } else {
            // Default to A-Z for missing entries
            pending.sort((a, b) => (a.nama || '').localeCompare(b.nama || '', 'id', { sensitivity: 'base' }));
        }

        return pending;
    }, [peserta, alamatList, selectedLevel, searchAlamat, levels, sortBy]);

    // Helper Format Kabupaten
    const formatKab = (kab) => {
        if (!kab) return '-';
        if (!kab.toLowerCase().includes('kota')) {
            const cleanKab = kab.replace(/^Kabupaten\s+/i, '').replace(/^Kab\.?\s+/i, '');
            return `KAB. ${cleanKab.toUpperCase()}`;
        }
        return `KOTA ${kab.replace(/^Kota\s+/i, '').toUpperCase()}`;
    };

    // Delete
    const handleDelete = async (id) => {
        if (!confirm('Hapus daftar alamat pengiriman ini?')) return;
        const ok = await deleteAlamatPengiriman(id);
        if (ok) {
            setAlamatList(prev => prev.filter(a => a.id !== id));
            showToast('Alamat berhasil dihapus.');
        } else {
            showToast('Gagal menghapus.', 'error');
        }
    };

    // Export to Excel
    const handleExportExcel = () => {
        if (activeTab === 'sudah') {
            if (filteredAlamat.length === 0) {
                showToast('Tidak ada data untuk diekspor', 'error');
                return;
            }

            const dataXLSX = filteredAlamat.map((item, index) => ({
                'No': index + 1,
                'Nama Peserta': item.namaPeserta,
                'Kategori Pelatihan': item.level || '-',
                'Nama Penerima': item.namaPenerima,
                'No HP Penerima': item.nomorHP,
                'Provinsi': item.provinsi || '-',
                'Kabupaten/Kota': formatKab(item.kabupaten),
                'Kecamatan': item.kecamatan || '-',
                'Kelurahan/Desa': item.kelurahan || '-',
                'Kode Pos': item.kodePos || '-',
                'Alamat Detail (Jalan/Patokan)': item.alamatDetail || '-',
                'Link Bukti Pembayaran': item.buktiPembayaranUrl || '-',
                'Tanggal Isi Form': item.createdAt ? new Date(item.createdAt).toLocaleDateString('id-ID') : '-'
            }));

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(dataXLSX);

            ws['!cols'] = [
                { wch: 5 }, { wch: 25 }, { wch: 20 }, { wch: 25 },
                { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 20 },
                { wch: 20 }, { wch: 10 }, { wch: 40 }, { wch: 40 }, { wch: 15 },
            ];
            XLSX.utils.book_append_sheet(wb, ws, "Sudah Mengisi");
            XLSX.writeFile(wb, `Alamat_Sudah_Mengisi_${selectedLevel || 'Semua'}_${new Date().getTime()}.xlsx`);
        } else {
            if (belumMengisiList.length === 0) {
                showToast('Tidak ada data untuk diekspor', 'error');
                return;
            }

            const dataXLSX = belumMengisiList.map((item, index) => ({
                'No': index + 1,
                'Nama Peserta': item.nama || '-',
                'Kategori Pelatihan': selectedLevel || levels[item.level]?.name || item.level || '-',
                'No HP / WA': item.wa || '-'
            }));

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(dataXLSX);

            ws['!cols'] = [
                { wch: 5 }, { wch: 30 }, { wch: 20 }, { wch: 15 }
            ];
            XLSX.utils.book_append_sheet(wb, ws, "Belum Mengisi");
            XLSX.writeFile(wb, `Alamat_Belum_Mengisi_${selectedLevel || 'Semua'}_${new Date().getTime()}.xlsx`);
        }
    };

    // Copy daftar nama peserta belum mengisi
    const handleCopyBelumMengisi = () => {
        if (belumMengisiList.length === 0) {
            showToast('Tidak ada peserta yang belum mengisi.', 'error');
            return;
        }
        // Sort A-Z by name
        const sorted = [...belumMengisiList].sort((a, b) =>
            (a.nama || '').localeCompare(b.nama || '', 'id', { sensitivity: 'base' })
        );
        const text = sorted.map((p, i) => `${i + 1} ${p.nama}`).join('\n');
        navigator.clipboard.writeText(text).then(() => {
            setCopiedNames(true);
            showToast(`${sorted.length} nama peserta berhasil disalin!`);
            setTimeout(() => setCopiedNames(false), 2500);
        });
    };


    return (
        <div className="ap-container">
            {/* Header */}
            <div style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '42px', height: '42px', borderRadius: '14px',
                        background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                    }}>
                        <Package size={22} />
                    </div>
                    Data Alamat Pengiriman
                </h1>
                <p style={{ fontSize: '15px', color: 'var(--text-muted)' }}>
                    Kelola data alamat pengiriman peserta yang telah masuk ke dalam sistem
                </p>
                <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                     <button className="btn btn-outline" onClick={handleExportExcel}>
                        Export Data ke Excel
                    </button>
                    <button className="btn btn-primary" onClick={() => window.print()}>
                        Cetak Label Pengiriman
                    </button>
                </div>
            </div>

            {/* Level Selection */}
            <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px' }}>
                    Filter Berdasarkan Kategori Pelatihan
                </h2>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        onClick={() => setSelectedLevel('')}
                        style={{
                            padding: '10px 20px', borderRadius: '12px',
                            border: '2px solid', fontWeight: 700, fontSize: '13px',
                            borderColor: !selectedLevel ? 'var(--accent-blue)' : 'var(--border-color)',
                            background: !selectedLevel ? 'var(--accent-blue-light)' : 'var(--bg-card)',
                            color: !selectedLevel ? 'var(--accent-blue)' : 'var(--text-secondary)',
                            cursor: 'pointer', transition: 'all 0.2s',
                            boxShadow: !selectedLevel ? '0 4px 12px rgba(59,130,246,0.15)' : 'none',
                        }}
                    >
                        Tampilkan Semua
                    </button>
                    {Object.keys(levels).map((lvl) => {
                        const active = selectedLevel === lvl;
                        return (
                            <button
                                key={lvl}
                                type="button"
                                onClick={() => setSelectedLevel(lvl)}
                                style={{
                                    padding: '10px 20px', borderRadius: '12px',
                                    border: '2px solid', fontWeight: 700, fontSize: '13px',
                                    borderColor: active ? 'var(--accent-blue)' : 'var(--border-color)',
                                    background: active ? 'var(--accent-blue-light)' : 'var(--bg-card)',
                                    color: active ? 'var(--accent-blue)' : 'var(--text-secondary)',
                                    cursor: 'pointer', transition: 'all 0.2s',
                                    boxShadow: active ? '0 4px 12px rgba(59,130,246,0.15)' : 'none',
                                }}
                            >
                                {lvl}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Public Link Card */}
            {selectedLevel && (
                <div className="card" style={{ padding: '16px 20px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                        <Link2 style={{ width: '16px', height: '16px', color: 'var(--accent-blue)' }} />
                        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            Link Publik Formulir Alamat — {selectedLevel}
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <code style={{
                            flex: 1, fontSize: '12px', color: 'var(--accent-blue)',
                            background: 'var(--accent-blue-light)', padding: '10px 14px',
                            borderRadius: '10px', fontWeight: 600, wordBreak: 'break-all',
                            border: '1px solid var(--accent-blue-border)', minWidth: '200px',
                        }}>
                            {`${window.location.origin}/alamat-pengiriman/${slugify(selectedLevel)}`}
                        </code>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/alamat-pengiriman/${slugify(selectedLevel)}`);
                                setCopiedLink(true);
                                showToast('Link berhasil disalin!');
                                setTimeout(() => setCopiedLink(false), 2000);
                            }}
                            className="btn btn-ghost"
                            style={{ padding: '8px 14px', fontSize: '12px', gap: '6px' }}
                        >
                            {copiedLink ? <Check style={{ width: '14px', height: '14px' }} /> : <Copy style={{ width: '14px', height: '14px' }} />}
                            {copiedLink ? 'Disalin!' : 'Salin Link'}
                        </button>
                        <a
                            href={`${window.location.origin}/alamat-pengiriman/${slugify(selectedLevel)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-ghost"
                            style={{ padding: '8px 14px', fontSize: '12px', gap: '6px', textDecoration: 'none' }}
                        >
                            <ExternalLink style={{ width: '14px', height: '14px' }} />
                            Buka
                        </a>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                        Bagikan link ini ke peserta {selectedLevel} agar mereka bisa mengisi alamat pengiriman secara mandiri.
                    </p>
                </div>
            )}

            {/* Saved Addresses Table */}
            <div className="card" style={{ padding: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '36px', height: '36px', borderRadius: '10px',
                            background: 'var(--accent-blue-light)', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', color: 'var(--accent-blue)',
                        }}>
                            {activeTab === 'sudah' ? <MapPinned size={18} /> : <Clock size={18} />}
                        </div>
                        <div>
                            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {activeTab === 'sudah' ? 'Daftar Alamat' : 'Belum Mengisi'} {selectedLevel && <span>({selectedLevel})</span>}
                            </h2>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                {activeTab === 'sudah' ? filteredAlamat.length : belumMengisiList.length} peserta
                            </p>
                        </div>
                    </div>
                    
                    {/* Tabs */}
                    <div style={{ display: 'flex', backgroundColor: 'var(--bg-body)', padding: '4px', borderRadius: '10px' }}>
                        <button
                            onClick={() => setActiveTab('sudah')}
                            style={{
                                padding: '8px 16px', border: 'none', background: activeTab === 'sudah' ? 'white' : 'transparent',
                                borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                                color: activeTab === 'sudah' ? 'var(--text-primary)' : 'var(--text-muted)',
                                boxShadow: activeTab === 'sudah' ? '0 2px 6px rgba(0,0,0,0.05)' : 'none',
                                display: 'flex', alignItems: 'center', gap: '6px'
                            }}
                        >
                            <MapPinned size={14} /> Sudah Mengisi
                        </button>
                        <button
                            onClick={() => setActiveTab('belum')}
                            style={{
                                padding: '8px 16px', border: 'none', background: activeTab === 'belum' ? 'white' : 'transparent',
                                borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                                color: activeTab === 'belum' ? 'var(--text-primary)' : 'var(--text-muted)',
                                boxShadow: activeTab === 'belum' ? '0 2px 6px rgba(0,0,0,0.05)' : 'none',
                                display: 'flex', alignItems: 'center', gap: '6px'
                            }}
                        >
                            <Users size={14} /> Belum Mengisi
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flex: '1', minWidth: '280px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <div style={{ width: '160px' }}>
                            <CustomSelect
                                value={sortBy}
                                onChange={(val) => setSortBy(val)}
                                options={[
                                    { value: "terbaru", label: "Tgl Terbaru" },
                                    { value: "terlama", label: "Tgl Terlama" },
                                    { value: "namaAsc", label: "Nama (A - Z)" },
                                    { value: "namaDesc", label: "Nama (Z - A)" }
                                ]}
                            />
                        </div>

                        <div style={{ position: 'relative', width: '280px', maxWidth: '100%' }}>
                            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                className="input"
                                placeholder="Cari peserta/alamat..."
                                value={searchAlamat}
                                onChange={e => setSearchAlamat(e.target.value)}
                                style={{ paddingLeft: '36px', fontSize: '13px' }}
                            />
                        </div>
                    </div>
                </div>

                {loadingAlamat ? (
                    <div style={{ textAlign: 'center', padding: '40px' }}>
                        <div className="login-spinner" />
                    </div>
                ) : activeTab === 'sudah' ? (
                    filteredAlamat.length === 0 ? (
                        <div className="ap-empty" style={{ padding: '64px 24px' }}>
                            <div className="ap-empty-icon" style={{ marginBottom: '20px' }}>
                                <Package size={28} style={{ color: 'var(--text-muted)' }} />
                            </div>
                            <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                Belum ada alamat pengiriman tercatat
                            </p>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px', maxWidth: '300px', margin: '6px auto 0' }}>
                                Data dari peserta akan otomatis muncul di sini setelah mereka mengisi formulir publik.
                            </p>
                        </div>
                    ) : (
                    <div className="ap-table-wrap">
                        <table className="ap-table">
                            <thead>
                                <tr>
                                    <th>No</th>
                                    <th>Peserta</th>
                                    <th>Penerima</th>
                                    <th>No. HP</th>
                                    <th>Kode Pos</th>
                                    <th>Alamat Lengkap</th>
                                    <th style={{ textAlign: 'center' }}>Bukti Pembayaran</th>
                                    <th style={{ textAlign: 'center' }}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAlamat.map((item, idx) => (
                                    <tr key={item.id}>
                                        <td style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '12px' }}>{idx + 1}</td>
                                        <td>
                                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.namaPeserta}</span>
                                            {item.level && (
                                                <span className="badge badge-blue" style={{ fontSize: '10px', marginLeft: '6px' }}>{item.level}</span>
                                            )}
                                        </td>
                                        <td style={{ fontWeight: 500 }}>{item.namaPenerima}</td>
                                        <td style={{ whiteSpace: 'nowrap' }}>{item.nomorHP}</td>
                                        <td>{item.kodePos || '-'}</td>
                                        <td>
                                            <div className="ap-address-cell">
                                                <strong>{item.alamatDetail}</strong>
                                                <div className="ap-region-pills">
                                                    {item.kelurahan && <span className="ap-region-pill">{item.kelurahan}</span>}
                                                    {item.kecamatan && <span className="ap-region-pill">{item.kecamatan}</span>}
                                                    {item.kabupaten && <span className="ap-region-pill">{formatKab(item.kabupaten)}</span>}
                                                    {item.provinsi && <span className="ap-region-pill">{item.provinsi}</span>}
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {item.buktiPembayaranUrl ? (
                                                <a href={item.buktiPembayaranUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline" style={{ padding: '6px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                                                    <ExternalLink size={12} /> Buka
                                                </a>
                                            ) : (
                                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>-</span>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                className="btn btn-ghost"
                                                style={{ padding: '6px 10px', fontSize: '12px', color: 'var(--accent-rose)' }}
                                                title="Hapus"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    )
                ) : (
                    // BELOW IS activeTab === 'belum'
                    belumMengisiList.length === 0 ? (
                        <div className="ap-empty" style={{ padding: '64px 24px' }}>
                            <div className="ap-empty-icon" style={{ marginBottom: '20px', backgroundColor: 'var(--accent-emerald-light)', color: 'var(--accent-emerald)' }}>
                                <CheckCircle size={28} />
                            </div>
                            <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                Luar biasa!
                            </p>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px', maxWidth: '300px', margin: '6px auto 0' }}>
                                Semua peserta di kategori ini sudah mengisi formulir alamat pengiriman mereka.
                            </p>
                        </div>
                    ) : (
                        <>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                            <button
                                onClick={handleCopyBelumMengisi}
                                className="btn btn-outline"
                                style={{
                                    padding: '8px 16px', fontSize: '13px', gap: '6px',
                                    display: 'flex', alignItems: 'center',
                                    borderColor: copiedNames ? 'var(--accent-emerald)' : undefined,
                                    color: copiedNames ? 'var(--accent-emerald)' : undefined,
                                }}
                            >
                                {copiedNames ? <Check size={14} /> : <Copy size={14} />}
                                {copiedNames ? 'Tersalin!' : 'Copy Daftar Nama'}
                            </button>
                        </div>
                        <div className="ap-table-wrap">
                            <table className="ap-table">
                                <thead>
                                    <tr>
                                        <th>No</th>
                                        <th>ID Peserta</th>
                                        <th>Nama Peserta</th>
                                        <th>No. HP / WhatsApp</th>
                                        <th style={{ textAlign: 'center' }}>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {belumMengisiList.map((item, idx) => {
                                        const formLink = `${window.location.origin}/alamat-pengiriman/${slugify(selectedLevel || item.level)}`;
                                        const waMessage = `Halo Coach ${item.nama}, anda belum mengisi form alamat pengiriman benefit, harap segera mengisi di link berikut ${formLink}`;
                                        const waLink = item.wa ? `https://wa.me/${formatWhatsApp(item.wa)}?text=${encodeURIComponent(waMessage)}` : null;
                                        return (
                                        <tr key={item.id}>
                                            <td style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '12px' }}>{idx + 1}</td>
                                            <td style={{ fontSize: '12px', fontFamily: 'monospace' }}>{item.id.slice(0, 8)}</td>
                                            <td>
                                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.nama}</span>
                                                {item.level && (
                                                    <span className="badge badge-blue" style={{ fontSize: '10px', marginLeft: '6px' }}>{levels[item.level]?.name || item.level}</span>
                                                )}
                                            </td>
                                            <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    {item.wa || '-'}
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                {waLink ? (
                                                    <a
                                                        href={waLink}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        title={`Hubungi ${item.nama} via WhatsApp`}
                                                        className="icon-btn icon-btn-emerald"
                                                        style={{ width: '32px', height: '32px' }}
                                                    >
                                                        <MessageCircle style={{ width: '16px', height: '16px' }} />
                                                    </a>
                                                ) : (
                                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>—</span>
                                                )}
                                            </td>
                                        </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        </>
                    )
                )}
            </div>

            {/* Toast */}
            {toast && (
                <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
                    <CheckCircle style={{ width: '18px', height: '18px' }} />
                    {toast.message}
                </div>
            )}

            {/* Hidden Print Wrapper */}
            <PrintAlamatPengiriman alamatList={filteredAlamat} />
        </div>
    );
}
