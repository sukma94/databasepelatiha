import React, { useState, useEffect, useMemo } from 'react';
import { getPemesananJersey, deletePemesananJersey, updatePemesananJersey } from '../utils/storage';
import { formatWhatsApp } from '../utils/formatters';
import { Search, ShoppingBag, Trash2, CheckCircle, ExternalLink, Clock, Package, MoreHorizontal, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import CustomSelect from '../components/CustomSelect';

export default function AdminPemesananJersey() {
    const [pesananList, setPesananList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const [statusFilter, setStatusFilter] = useState('Semua');
    const [sortBy, setSortBy] = useState('terbaru');

    const [toast, setToast] = useState(null);

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    };

    const loadData = async () => {
        setLoading(true);
        const data = await getPemesananJersey();
        setPesananList(data);
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    const filteredPesanan = useMemo(() => {
        let list = [...pesananList];

        if (statusFilter !== 'Semua') {
            list = list.filter(p => p.status === statusFilter);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(p => 
                p.namaPemesan?.toLowerCase().includes(q) ||
                p.nomorWA?.includes(q) ||
                p.namaPenerima?.toLowerCase().includes(q) ||
                p.nomorPenerima?.includes(q) ||
                p.kabupaten?.toLowerCase().includes(q) ||
                p.pembayaran?.toLowerCase().includes(q) ||
                p.ukuran?.join(', ').toLowerCase().includes(q)
            );
        }

        if (sortBy === 'terbaru') {
            list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        } else if (sortBy === 'terlama') {
            list.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
        } else if (sortBy === 'namaAsc') {
            list.sort((a, b) => (a.namaPemesan || '').localeCompare(b.namaPemesan || '', 'id', { sensitivity: 'base' }));
        }

        return list;
    }, [pesananList, statusFilter, searchQuery, sortBy]);

    const formatKab = (kab) => {
        if (!kab) return '-';
        if (!kab.toLowerCase().includes('kota')) {
            const cleanKab = kab.replace(/^Kabupaten\s+/i, '').replace(/^Kab\.?\s+/i, '');
            return `KAB. ${cleanKab.toUpperCase()}`;
        }
        return `KOTA ${kab.replace(/^Kota\s+/i, '').toUpperCase()}`;
    };

    const handleDelete = async (id) => {
        if (!confirm('Hapus pesanan jersey ini? Tindakan ini tidak bisa dibatalkan.')) return;
        const ok = await deletePemesananJersey(id);
        if (ok) {
            setPesananList(prev => prev.filter(p => p.id !== id));
            showToast('Pesanan berhasil dihapus.');
        } else {
            showToast('Gagal menghapus.', 'error');
        }
    };

    const handleUpdateStatus = async (id, newStatus) => {
        const ok = await updatePemesananJersey(id, { status: newStatus });
        if (ok) {
            setPesananList(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
            showToast(`Status diperbarui menjadi ${newStatus}.`);
        } else {
            showToast('Gagal mengubah status.', 'error');
        }
    };

    const handleExportExcel = () => {
        if (filteredPesanan.length === 0) {
            showToast('Tidak ada data yang bisa diekspor.', 'error');
            return;
        }

        const dataXLSX = filteredPesanan.map((item, index) => ({
            'No': index + 1,
            'Nama Pemesan': item.namaPemesan,
            'No. WhatsApp Pemesan': item.nomorWA,
            'Nama Penerima': item.namaPenerima || item.namaPemesan,
            'No. WhatsApp Penerima': item.nomorPenerima || item.nomorWA,
            'Jml Order': item.jumlahOrder,
            'Ukuran': item.ukuran ? item.ukuran.join(', ') : '-',
            'Alamat Detail': item.alamatDetail || '-',
            'Kelurahan/Desa': item.kelurahan || '-',
            'Kecamatan': item.kecamatan || '-',
            'Kabupaten/Kota': formatKab(item.kabupaten),
            'Provinsi': item.provinsi || '-',
            'Kode Pos': item.kodePos || '-',
            'Metode Pembayaran': item.pembayaran || '-',
            'Link Bukti Pembayaran': item.buktiPembayaranUrl || '-',
            'Status': item.status || 'Menunggu',
            'Tanggal Pesan': item.createdAt ? new Date(item.createdAt).toLocaleString('id-ID') : '-'
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(dataXLSX);

        ws['!cols'] = [
            { wch: 5 }, { wch: 25 }, { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 10 }, { wch: 15 },
            { wch: 40 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 10 },
            { wch: 20 }, { wch: 40 }, { wch: 15 }, { wch: 20 }
        ];

        XLSX.utils.book_append_sheet(wb, ws, "Data Pesanan Jersey");
        XLSX.writeFile(wb, `Data_Pesanan_Jersey_${new Date().getTime()}.xlsx`);
    };

    const getStatusUI = (status) => {
        switch (status) {
            case 'Menunggu':
                return { color: 'var(--accent-amber)', icon: <Clock size={12} />, bg: 'var(--accent-amber-light)' };
            case 'Diproses':
                return { color: 'var(--accent-blue)', icon: <MoreHorizontal size={12} />, bg: 'var(--accent-blue-light)' };
            case 'Dikirim':
                return { color: 'var(--accent-indigo)', icon: <Package size={12} />, bg: 'rgba(99, 102, 241, 0.1)' };
            case 'Selesai':
                return { color: 'var(--accent-emerald)', icon: <CheckCircle size={12} />, bg: 'var(--accent-emerald-light)' };
            default:
                return { color: 'var(--text-muted)', icon: <Clock size={12} />, bg: 'var(--bg-input)' };
        }
    };

    return (
        <div style={{ padding: '24px 32px' }}>
            <div style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '42px', height: '42px', borderRadius: '14px',
                        background: 'linear-gradient(135deg, #10b981, #3b82f6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                    }}>
                        <ShoppingBag size={22} />
                    </div>
                    Pemesanan Jersey
                </h1>
                <p style={{ fontSize: '15px', color: 'var(--text-muted)' }}>
                    Kelola data pemesanan jersey masuk dari halaman formulir publik
                </p>
                <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                    <button className="btn btn-outline" onClick={handleExportExcel}>
                        Export Excel
                    </button>
                    <a 
                        href={`${window.location.origin}/pesan-jersey`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="btn btn-primary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
                    >
                        Buka Form Publik <ExternalLink size={14} />
                    </a>
                </div>
            </div>

            <div className="card" style={{ padding: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '36px', height: '36px', borderRadius: '10px',
                            background: 'var(--accent-emerald-light)', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', color: 'var(--accent-emerald)',
                        }}>
                            <Package size={18} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Semua Pesanan</h2>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{filteredPesanan.length} pesanan total</p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flex: '1', minWidth: '280px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <div style={{ width: '160px' }}>
                            <CustomSelect
                                value={statusFilter}
                                onChange={setStatusFilter}
                                options={[
                                    { value: 'Semua', label: 'Semua Status' },
                                    { value: 'Menunggu', label: 'Menunggu' },
                                    { value: 'Diproses', label: 'Diproses' },
                                    { value: 'Dikirim', label: 'Dikirim' },
                                    { value: 'Selesai', label: 'Selesai' },
                                ]}
                            />
                        </div>
                        <div style={{ width: '160px' }}>
                            <CustomSelect
                                value={sortBy}
                                onChange={setSortBy}
                                options={[
                                    { value: 'terbaru', label: 'Paling Baru' },
                                    { value: 'terlama', label: 'Paling Lama' },
                                    { value: 'namaAsc', label: 'Nama (A-Z)' },
                                ]}
                            />
                        </div>
                        <div style={{ position: 'relative', width: '280px', maxWidth: '100%' }}>
                            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                className="input"
                                placeholder="Cari nama, WA, daerah..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                style={{ paddingLeft: '36px', fontSize: '13px' }}
                            />
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px' }}><div className="login-spinner" /></div>
                ) : filteredPesanan.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '64px 24px', background: 'var(--bg-input)', borderRadius: '12px' }}>
                        <ShoppingBag size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }} />
                        <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', fontWeight: 600 }}>Belum Ada Pesanan</h3>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px' }}>
                            Data pesanan jersey akan muncul di sini.
                        </p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <table style={{ minWidth: '1000px', width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                            <thead style={{ background: 'var(--bg-input)' }}>
                                <tr>
                                    <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>No</th>
                                    <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Pemesanan</th>
                                    <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Order & Size</th>
                                    <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Alamat</th>
                                    <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Status & Pembayaran</th>
                                    <th style={{ padding: '16px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'center' }}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPesanan.map((item, idx) => {
                                    const st = getStatusUI(item.status);
                                    return (
                                        <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>{idx + 1}</td>
                                            <td style={{ padding: '16px' }}>
                                                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                                                    {item.namaPemesan}
                                                </div>
                                                <a href={`https://wa.me/${formatWhatsApp(item.nomorWA)}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 600 }}>
                                                    {item.nomorWA}
                                                </a>
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                                    {new Date(item.createdAt).toLocaleDateString('id-ID')}
                                                </div>
                                            </td>
                                            <td style={{ padding: '16px' }}>
                                                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.jumlahOrder} Pcs</span>
                                                <div style={{ marginTop: '4px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                    {item.ukuran && item.ukuran.map((uk, i) => (
                                                        <span key={i} style={{ padding: '2px 6px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                                            {uk}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td style={{ padding: '16px' }}>
                                                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                                                    {item.namaPenerima || item.namaPemesan} 
                                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}> ({item.nomorPenerima || item.nomorWA})</span>
                                                </div>
                                                <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {item.alamatDetail}
                                                </div>
                                                <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                                                    {formatKab(item.kabupaten)}, {item.provinsi}
                                                </div>
                                            </td>
                                            <td style={{ padding: '16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                    <span style={{ 
                                                        display: 'inline-flex', alignItems: 'center', gap: '6px', 
                                                        background: st.bg, color: st.color, padding: '4px 10px', 
                                                        borderRadius: '99px', fontSize: '11px', fontWeight: 700 
                                                    }}>
                                                        {st.icon} {item.status || 'Menunggu'}
                                                    </span>
                                                    
                                                    <div style={{ position: 'relative', display: 'inline-block' }}>
                                                        <select
                                                            value={item.status || 'Menunggu'}
                                                            onChange={(e) => handleUpdateStatus(item.id, e.target.value)}
                                                            style={{
                                                                opacity: 0, position: 'absolute', top: 0, left: 0, 
                                                                width: '100%', height: '100%', cursor: 'pointer'
                                                            }}
                                                        >
                                                            <option value="Menunggu">Menunggu</option>
                                                            <option value="Diproses">Diproses</option>
                                                            <option value="Dikirim">Dikirim</option>
                                                            <option value="Selesai">Selesai</option>
                                                        </select>
                                                        <button type="button" style={{ 
                                                            border: '1px solid var(--border-color)', background: 'var(--bg-card)', 
                                                            color: 'var(--text-secondary)', padding: '4px 8px', borderRadius: '6px', 
                                                            fontSize: '11px', fontWeight: 600, pointerEvents: 'none' 
                                                        }}>
                                                            Ubah
                                                        </button>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ padding: '2px 6px', background: 'var(--bg-input)', borderRadius: '4px', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                                        {item.pembayaran}
                                                    </span>
                                                    {item.buktiPembayaranUrl && (
                                                        <a href={item.buktiPembayaranUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <ExternalLink size={11} /> Lihat Bukti
                                                        </a>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ padding: '16px', textAlign: 'center' }}>
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    style={{ 
                                                        background: 'transparent', border: 'none', color: 'var(--accent-rose)', 
                                                        padding: '6px', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s' 
                                                    }}
                                                    title="Hapus Pesanan"
                                                    onMouseOver={e => e.currentTarget.style.background = 'var(--accent-rose-light)'}
                                                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {toast && (
                <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
                    {toast.type === 'error' ? <X size={20} /> : <CheckCircle size={20} />}
                    {toast.message}
                </div>
            )}
        </div>
    );
}
