import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { getCashFlowItems, addCashFlowItem, updateCashFlowItem, deleteCashFlowItem, getIndependentCashFlows, addIndependentCashFlow, deleteIndependentCashFlow, renameIndependentCashFlow, getIndependentCashFlowItems, addIndependentCashFlowItem, updateIndependentCashFlowItem, deleteIndependentCashFlowItem } from '../utils/storage';
import { useData } from '../context/DataContext';
import { TrendingDown, Plus, Trash2, Edit3, Save, X, Check, Wallet, Layers, FileSpreadsheet, Layout, Printer, ArrowLeft, MoreVertical, PenLine, FolderPlus } from 'lucide-react';
import CustomSelect from '../components/CustomSelect';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { isLevelArchived } from '../utils/dateUtils';
import { exportCashFlowToExcel } from '../utils/exportExcel';
import { printCashFlow } from '../utils/printPdf';

export default function CashFlow() {
    const { peserta, levels } = useData();
    const [activeTab, setActiveTab] = useState('pelatihan'); // 'pelatihan' | 'mandiri'
    const [selectedLevel, setSelectedLevel] = useState('');
    const [cashFlowItems, setCashFlowItems] = useState([]);
    const [allCashFlowItems, setAllCashFlowItems] = useState({}); // { levelName: [...items] }
    const [toast, setToast] = useState(null);

    // === Mandiri (Independent) State ===
    const [independentCFs, setIndependentCFs] = useState([]);
    const [selectedCF, setSelectedCF] = useState(null); // currently viewed cashflow
    const [cfItems, setCfItems] = useState([]);
    const [showCreateCF, setShowCreateCF] = useState(false);
    const [newCFName, setNewCFName] = useState('');
    const [cfMenuOpen, setCfMenuOpen] = useState(null); // id of cashflow with open menu
    const [renamingCF, setRenamingCF] = useState(null); // { id, name }
    const [deletingCF, setDeletingCF] = useState(null); // id
    const [isAddingCF, setIsAddingCF] = useState(false);
    const [newCFItem, setNewCFItem] = useState({ tanggal: new Date(), item: '', nominal: 0, jenis: 'Keluar', keterangan: '' });
    const [editingCFId, setEditingCFId] = useState(null);
    const [editCFData, setEditCFData] = useState({});
    const [deleteCFItemConfirm, setDeleteCFItemConfirm] = useState(null);

    // Form state
    const [isAdding, setIsAdding] = useState(false);
    const [newItem, setNewItem] = useState({ tanggal: new Date(), item: '', nominal: 0, jenis: 'Keluar', keterangan: '', level: '' });

    // Edit state
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({});
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    // Column visibility
    const [visibleColumns, setVisibleColumns] = useState({
        no: true,
        tanggal: true,
        pelatihan: true,
        jenis: true,
        items: true,
        masuk: true,
        keluar: true,
        saldo: true,
        keterangan: true,
        aksi: true,
    });
    const [showColumnPicker, setShowColumnPicker] = useState(false);

    const toggleColumn = (key) => {
        setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const isGabungan = selectedLevel === '__gabungan__';

    // Set default selected level when levels load
    useEffect(() => {
        const levelKeys = Object.keys(levels);
        if (levelKeys.length > 0 && !selectedLevel) {
            setSelectedLevel(levelKeys[0]);
        }
    }, [levels, selectedLevel]);

    useEffect(() => {
        const loadItems = async () => {
            if (selectedLevel === '__gabungan__') {
                // Load all levels' cashflow items
                const levelKeys = Object.keys(levels);
                const allItems = {};
                await Promise.all(levelKeys.map(async (lvl) => {
                    allItems[lvl] = await getCashFlowItems(lvl);
                }));
                setAllCashFlowItems(allItems);
                setCashFlowItems([]);
            } else if (selectedLevel) {
                const items = await getCashFlowItems(selectedLevel);
                setCashFlowItems(items);
                setAllCashFlowItems({});
            }
            setIsAdding(false);
            setEditingId(null);
        };
        loadItems();
    }, [selectedLevel, levels]);

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const fmt = (n) =>
        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

    const fmtDate = (d) => {
        if (!d) return '';
        const dObj = new Date(d);
        if (isNaN(dObj.getTime())) return d;
        const day = dObj.getDate().toString().padStart(2, '0');
        const month = (dObj.getMonth() + 1).toString().padStart(2, '0');
        const year = dObj.getFullYear();
        return `${year}-${month}-${day}`;
    };

    // Calculate pemasukan per level
    const getPemasukanForLevel = (levelName) => {
        const filteredPeserta = peserta.filter(p => p.level === levelName);
        const ld = levels[levelName] || {};
        return filteredPeserta.reduce((sum, p) => {
            if (p.statusBayar === 'Lunas') {
                let biaya = ld.biayaNormal || ld.biaya || 0;
                if (p.jenisBiaya === 'Early Bird' && ld.biayaEarly) biaya = ld.biayaEarly;
                else if (p.jenisBiaya === 'Khusus' && ld.biayaKhusus) biaya = ld.biayaKhusus;
                return sum + biaya;
            }
            if (p.statusBayar === 'DP') return sum + (p.nominalDP || 0);
            return sum;
        }, 0);
    };

    // For single level view
    const totalPemasukanPeserta = useMemo(() => {
        if (!selectedLevel || isGabungan) return 0;
        return getPemasukanForLevel(selectedLevel);
    }, [peserta, levels, selectedLevel]);

    // Combined view items
    const gabunganItemsWithSaldo = useMemo(() => {
        if (!isGabungan) return [];

        const levelKeys = Object.keys(levels);
        let currentSaldo = 0;
        const allRows = [];

        levelKeys.forEach(lvl => {
            const pemasukanLevel = getPemasukanForLevel(lvl);
            currentSaldo += pemasukanLevel;

            // Auto-insert row for this level
            allRows.push({
                id: `auto-insert-${lvl}`,
                tanggal: null,
                item: `INSERT ${lvl}`,
                kredit: pemasukanLevel,
                debit: 0,
                saldo: currentSaldo,
                keterangan: `Pemasukan peserta ${lvl}`,
                isAutoInsert: true,
                level: lvl,
            });

            // Manual items for this level
            const levelItems = allCashFlowItems[lvl] || [];
            levelItems.forEach(item => {
                const deb = Number(item.debit) || 0;
                const kred = Number(item.kredit) || 0;
                currentSaldo = currentSaldo + kred - deb;
                allRows.push({
                    ...item,
                    saldo: currentSaldo,
                    level: lvl,
                });
            });
        });

        return allRows;
    }, [allCashFlowItems, levels, peserta, isGabungan]);

    const gabunganSummary = useMemo(() => {
        if (!isGabungan) return { kredit: 0, debit: 0, saldo: 0 };
        const levelKeys = Object.keys(levels);
        let totalKredit = 0;
        let totalDebit = 0;

        levelKeys.forEach(lvl => {
            totalKredit += getPemasukanForLevel(lvl);
            const items = allCashFlowItems[lvl] || [];
            items.forEach(item => {
                totalKredit += Number(item.kredit) || 0;
                totalDebit += Number(item.debit) || 0;
            });
        });

        return { kredit: totalKredit, debit: totalDebit, saldo: totalKredit - totalDebit };
    }, [allCashFlowItems, levels, peserta, isGabungan]);

    // Single level view
    const itemsWithSaldo = useMemo(() => {
        if (isGabungan) return [];
        let currentSaldo = totalPemasukanPeserta;
        const autoInsertItem = {
            id: 'auto-insert',
            tanggal: null,
            item: 'INSERT PESERTA',
            kredit: totalPemasukanPeserta,
            debit: 0,
            saldo: currentSaldo,
            keterangan: '',
            isAutoInsert: true
        };

        const formattedItems = [autoInsertItem];

        cashFlowItems.forEach(item => {
            const deb = Number(item.debit) || 0;
            const kred = Number(item.kredit) || 0;
            currentSaldo = currentSaldo + kred - deb;
            formattedItems.push({
                ...item,
                saldo: currentSaldo
            });
        });

        return formattedItems;
    }, [cashFlowItems, totalPemasukanPeserta, isGabungan]);

    const summary = useMemo(() => {
        if (isGabungan) return gabunganSummary;
        const totalDebit = cashFlowItems.reduce((sum, i) => sum + (Number(i.debit) || 0), 0);
        const totalKreditManual = cashFlowItems.reduce((sum, i) => sum + (Number(i.kredit) || 0), 0);
        const totalKredit = totalPemasukanPeserta + totalKreditManual;
        return {
            kredit: totalKredit,
            debit: totalDebit,
            saldo: totalKredit - totalDebit
        };
    }, [cashFlowItems, totalPemasukanPeserta, isGabungan, gabunganSummary]);

    const handleSaveNew = async () => {
        if (!newItem.item.trim()) {
            showToast('Nama items harus diisi', 'error');
            return;
        }

        const targetLevel = isGabungan ? newItem.level : selectedLevel;
        if (!targetLevel) {
            showToast('Pilih pelatihan terlebih dahulu', 'error');
            return;
        }

        const dateStr = fmtDate(newItem.tanggal);
        const itemData = {
            tanggal: dateStr,
            item: newItem.item,
            debit: newItem.jenis === 'Keluar' ? (Number(newItem.nominal) || 0) : 0,
            kredit: newItem.jenis === 'Masuk' ? (Number(newItem.nominal) || 0) : 0,
            keterangan: newItem.keterangan || ''
        };
        const savedItem = await addCashFlowItem(targetLevel, itemData);

        setIsAdding(false);
        setNewItem({ tanggal: new Date(), item: '', nominal: '', jenis: 'Keluar', keterangan: '', level: '' });

        // Optimistic local update — no re-fetch
        if (savedItem) {
            if (isGabungan) {
                setAllCashFlowItems(prev => ({
                    ...prev,
                    [targetLevel]: [...(prev[targetLevel] || []), savedItem]
                }));
            } else {
                setCashFlowItems(prev => [...prev, savedItem]);
            }
        }
        showToast(`Item ${newItem.jenis === 'Masuk' ? 'pemasukan' : 'pengeluaran'} berhasil ditambahkan`);
    };

    const startEdit = (item) => {
        setEditingId(item.id);
        const tgl = item.tanggal ? new Date(item.tanggal) : new Date();
        const isMasuk = (item.kredit || 0) > 0;
        setEditData({
            tanggal: isNaN(tgl.getTime()) ? new Date() : tgl,
            item: item.item,
            nominal: isMasuk ? item.kredit : item.debit,
            jenis: isMasuk ? 'Masuk' : 'Keluar',
            keterangan: item.keterangan || '',
            level: item.level || selectedLevel, // track level for gabungan edits
        });
    };

    const handleSaveEdit = async () => {
        if (!editData.item.trim()) {
            showToast('Nama items harus diisi', 'error');
            return;
        }

        const targetLevel = editData.level || selectedLevel;
        const updatedFields = {
            tanggal: fmtDate(editData.tanggal),
            item: editData.item,
            debit: editData.jenis === 'Keluar' ? (Number(editData.nominal) || 0) : 0,
            kredit: editData.jenis === 'Masuk' ? (Number(editData.nominal) || 0) : 0,
            keterangan: editData.keterangan || ''
        };
        await updateCashFlowItem(targetLevel, editingId, updatedFields);

        // Optimistic local update — no re-fetch
        const editId = editingId;
        setEditingId(null);
        if (isGabungan) {
            setAllCashFlowItems(prev => ({
                ...prev,
                [targetLevel]: (prev[targetLevel] || []).map(item =>
                    item.id === editId ? { ...item, ...updatedFields } : item
                )
            }));
        } else {
            setCashFlowItems(prev => prev.map(item =>
                item.id === editId ? { ...item, ...updatedFields } : item
            ));
        }
        showToast('Item berhasil diupdate');
    };

    const confirmDelete = async (id) => {
        if (isGabungan) {
            // Find which level this item belongs to
            const levelKeys = Object.keys(levels);
            let deletedLevel = null;
            for (const lvl of levelKeys) {
                const items = allCashFlowItems[lvl] || [];
                if (items.find(i => i.id === id)) {
                    await deleteCashFlowItem(lvl, id);
                    deletedLevel = lvl;
                    break;
                }
            }
            // Optimistic local update — no re-fetch
            if (deletedLevel) {
                setAllCashFlowItems(prev => ({
                    ...prev,
                    [deletedLevel]: (prev[deletedLevel] || []).filter(i => i.id !== id)
                }));
            }
        } else {
            await deleteCashFlowItem(selectedLevel, id);
            // Optimistic local update — no re-fetch
            setCashFlowItems(prev => prev.filter(i => i.id !== id));
        }
        setDeleteConfirm(null);
        showToast('Item berhasil dihapus');
    };

    const levelOptions = Object.keys(levels);

    const handleExport = () => {
        if (displayItems.length === 0) {
            showToast('Tidak ada data untuk diexport!', 'error');
            return;
        }
        const label = isGabungan ? 'gabungan' : selectedLevel.replace(/\s+/g, '_').toLowerCase();
        exportCashFlowToExcel(displayItems, summary, selectedLevel, isGabungan, `cashflow_${label}`, visibleColumns);
        showToast(`${displayItems.length} item cash flow berhasil diexport!`);
    };

    const handlePrint = () => {
        if (displayItems.length === 0) {
            showToast('Tidak ada data untuk diprint!', 'error');
            return;
        }
        const title = isGabungan ? 'Cash Flow — Gabungan Semua' : `Cash Flow — ${selectedLevel}`;
        printCashFlow(displayItems, summary, { title, isGabungan, visibleColumns });
    };

    // Build options for the CustomSelect including Gabungan
    const selectOptions = useMemo(() => {
        const active = levelOptions.filter(l => !isLevelArchived(levels[l]));
        const archived = levelOptions.filter(l => isLevelArchived(levels[l]));
        const opts = active.map(l => ({ value: l, label: l }));
        if (levelOptions.length > 1) {
            opts.unshift({ value: '__gabungan__', label: '🔗 Gabungan Semua' });
        }
        if (archived.length > 0) {
            archived.forEach(l => opts.push({ value: l, label: `📦 ${l} (Arsip)` }));
        }
        return opts;
    }, [levelOptions, levels]);

    const displayItems = isGabungan ? gabunganItemsWithSaldo : itemsWithSaldo;

    // === Load independent cashflows ===
    useEffect(() => {
        if (activeTab === 'mandiri') {
            (async () => {
                const cfs = await getIndependentCashFlows();
                setIndependentCFs(cfs);
            })();
        }
    }, [activeTab]);

    // === Load items when a cashflow is selected ===
    useEffect(() => {
        if (selectedCF) {
            (async () => {
                const items = await getIndependentCashFlowItems(selectedCF.id);
                setCfItems(items);
            })();
        } else {
            setCfItems([]);
        }
        setIsAddingCF(false);
        setEditingCFId(null);
    }, [selectedCF]);

    const handleCreateCF = async () => {
        if (!newCFName.trim()) { showToast('Nama cashflow harus diisi', 'error'); return; }
        const created = await addIndependentCashFlow(newCFName.trim());
        if (created) {
            setIndependentCFs(prev => [created, ...prev]);
            setNewCFName('');
            setShowCreateCF(false);
            showToast('Cashflow baru berhasil dibuat');
        }
    };

    const handleRenameCF = async () => {
        if (!renamingCF || !renamingCF.name.trim()) return;
        await renameIndependentCashFlow(renamingCF.id, renamingCF.name.trim());
        setIndependentCFs(prev => prev.map(cf => cf.id === renamingCF.id ? { ...cf, name: renamingCF.name.trim() } : cf));
        if (selectedCF?.id === renamingCF.id) setSelectedCF(prev => ({ ...prev, name: renamingCF.name.trim() }));
        setRenamingCF(null);
        showToast('Nama cashflow berhasil diubah');
    };

    const handleDeleteCF = async (id) => {
        await deleteIndependentCashFlow(id);
        setIndependentCFs(prev => prev.filter(cf => cf.id !== id));
        if (selectedCF?.id === id) setSelectedCF(null);
        setDeletingCF(null);
        showToast('Cashflow berhasil dihapus');
    };

    const handleSaveNewCFItem = async () => {
        if (!newCFItem.item.trim()) { showToast('Nama items harus diisi', 'error'); return; }
        const itemData = {
            tanggal: fmtDate(newCFItem.tanggal),
            item: newCFItem.item,
            debit: newCFItem.jenis === 'Keluar' ? (Number(newCFItem.nominal) || 0) : 0,
            kredit: newCFItem.jenis === 'Masuk' ? (Number(newCFItem.nominal) || 0) : 0,
            keterangan: newCFItem.keterangan || '',
        };
        const saved = await addIndependentCashFlowItem(selectedCF.id, itemData);
        if (saved) setCfItems(prev => [...prev, saved]);
        setIsAddingCF(false);
        setNewCFItem({ tanggal: new Date(), item: '', nominal: 0, jenis: 'Keluar', keterangan: '' });
        showToast('Item berhasil ditambahkan');
    };

    const startEditCFItem = (item) => {
        setEditingCFId(item.id);
        const tgl = item.tanggal ? new Date(item.tanggal) : new Date();
        const isMasuk = (item.kredit || 0) > 0;
        setEditCFData({
            tanggal: isNaN(tgl.getTime()) ? new Date() : tgl,
            item: item.item,
            nominal: isMasuk ? item.kredit : item.debit,
            jenis: isMasuk ? 'Masuk' : 'Keluar',
            keterangan: item.keterangan || '',
        });
    };

    const handleSaveEditCFItem = async () => {
        if (!editCFData.item.trim()) { showToast('Nama items harus diisi', 'error'); return; }
        const updatedFields = {
            tanggal: fmtDate(editCFData.tanggal),
            item: editCFData.item,
            debit: editCFData.jenis === 'Keluar' ? (Number(editCFData.nominal) || 0) : 0,
            kredit: editCFData.jenis === 'Masuk' ? (Number(editCFData.nominal) || 0) : 0,
            keterangan: editCFData.keterangan || '',
        };
        await updateIndependentCashFlowItem(selectedCF.id, editingCFId, updatedFields);
        setCfItems(prev => prev.map(i => i.id === editingCFId ? { ...i, ...updatedFields } : i));
        setEditingCFId(null);
        showToast('Item berhasil diupdate');
    };

    const handleDeleteCFItem = async (id) => {
        await deleteIndependentCashFlowItem(selectedCF.id, id);
        setCfItems(prev => prev.filter(i => i.id !== id));
        setDeleteCFItemConfirm(null);
        showToast('Item berhasil dihapus');
    };

    // CF items with running saldo
    const cfItemsWithSaldo = useMemo(() => {
        let saldo = 0;
        return cfItems.map(item => {
            const k = Number(item.kredit) || 0;
            const d = Number(item.debit) || 0;
            saldo += k - d;
            return { ...item, saldo };
        });
    }, [cfItems]);

    const cfSummary = useMemo(() => {
        const totalKredit = cfItems.reduce((s, i) => s + (Number(i.kredit) || 0), 0);
        const totalDebit = cfItems.reduce((s, i) => s + (Number(i.debit) || 0), 0);
        return { kredit: totalKredit, debit: totalDebit, saldo: totalKredit - totalDebit };
    }, [cfItems]);

    // Show empty only for Pelatihan tab when no levels
    if (activeTab === 'pelatihan' && levelOptions.length === 0) {
        return (
            <div className="animate-fade-in">
                {/* Tab Switcher */}
                <div style={{ display: 'flex', gap: '0', marginBottom: '24px', borderBottom: '2px solid var(--border-color)' }}>
                    <button onClick={() => setActiveTab('pelatihan')} style={{ padding: '12px 24px', fontWeight: 700, fontSize: '14px', border: 'none', cursor: 'pointer', background: 'none', borderBottom: activeTab === 'pelatihan' ? '3px solid var(--accent-blue)' : '3px solid transparent', color: activeTab === 'pelatihan' ? 'var(--accent-blue)' : 'var(--text-muted)', transition: 'all 0.2s' }}>💰 Pelatihan</button>
                    <button onClick={() => setActiveTab('mandiri')} style={{ padding: '12px 24px', fontWeight: 700, fontSize: '14px', border: 'none', cursor: 'pointer', background: 'none', borderBottom: activeTab === 'mandiri' ? '3px solid var(--accent-blue)' : '3px solid transparent', color: activeTab === 'mandiri' ? 'var(--accent-blue)' : 'var(--text-muted)', transition: 'all 0.2s' }}>📋 Mandiri</button>
                </div>
                <div className="card" style={{ padding: '64px 24px', textAlign: 'center' }}>
                    <Wallet style={{ width: '48px', height: '48px', color: 'var(--text-muted)', margin: '0 auto 16px' }} />
                    <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-secondary)' }}>Belum ada data pelatihan</p>
                    <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '6px' }}>Tambahkan kategori pelatihan terlebih dahulu di menu Pengaturan</p>
                </div>
            </div>
        );
    }

    // Level color map for gabungan badges
    const levelColors = ['badge-blue', 'badge-emerald', 'badge-amber', 'badge-rose', 'badge-ghost'];

    // === RENDER: Mandiri Tab - Item Modal ===
    const renderCFItemModal = () => {
        if (!isAddingCF && !editingCFId) return null;
        const isAdd = isAddingCF;
        return createPortal(
            <div className="modal-overlay" onClick={() => { setIsAddingCF(false); setEditingCFId(null); }}>
                <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--accent-blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-blue)' }}><Wallet /></div>
                            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>{isAdd ? 'Tambah Item' : 'Edit Item'}</h3>
                        </div>
                        <button onClick={() => { setIsAddingCF(false); setEditingCFId(null); }} className="btn btn-ghost" style={{ padding: '8px' }}><X style={{ width: '20px', height: '20px' }} /></button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label className="label">Tanggal</label>
                            <div className="custom-datepicker-wrapper">
                                <DatePicker selected={isAdd ? newCFItem.tanggal : editCFData.tanggal} onChange={(date) => isAdd ? setNewCFItem(p => ({ ...p, tanggal: date })) : setEditCFData(p => ({ ...p, tanggal: date }))} dateFormat="yyyy-MM-dd" className="input" />
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div>
                                <label className="label">Jenis</label>
                                <CustomSelect value={isAdd ? newCFItem.jenis : editCFData.jenis} onChange={(v) => isAdd ? setNewCFItem(p => ({ ...p, jenis: v })) : setEditCFData(p => ({ ...p, jenis: v }))} options={[{ value: 'Keluar', label: 'Keluar' }, { value: 'Masuk', label: 'Masuk' }]} />
                            </div>
                            <div>
                                <label className="label">Nominal (Rp)</label>
                                <input type="number" className="input" value={isAdd ? (newCFItem.nominal || '') : (editCFData.nominal || '')} onChange={(e) => isAdd ? setNewCFItem(p => ({ ...p, nominal: Number(e.target.value) })) : setEditCFData(p => ({ ...p, nominal: Number(e.target.value) }))} placeholder="0" min="0" />
                            </div>
                        </div>
                        <div>
                            <label className="label">Nama Item / Keperluan</label>
                            <input type="text" className="input" value={isAdd ? newCFItem.item : editCFData.item} onChange={(e) => isAdd ? setNewCFItem(p => ({ ...p, item: e.target.value })) : setEditCFData(p => ({ ...p, item: e.target.value }))} placeholder="Contoh: Biaya Ongkir" />
                        </div>
                        <div>
                            <label className="label">Keterangan Tambahan</label>
                            <textarea className="input" rows="2" value={isAdd ? newCFItem.keterangan : editCFData.keterangan} onChange={(e) => isAdd ? setNewCFItem(p => ({ ...p, keterangan: e.target.value })) : setEditCFData(p => ({ ...p, keterangan: e.target.value }))} placeholder="Opsional..." />
                        </div>
                    </div>
                    <div style={{ marginTop: '28px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                        <button onClick={() => { setIsAddingCF(false); setEditingCFId(null); }} className="btn btn-ghost">Batal</button>
                        <button onClick={isAdd ? handleSaveNewCFItem : handleSaveEditCFItem} className="btn btn-primary">{isAdd ? 'Tambah Item' : 'Simpan Perubahan'}</button>
                    </div>
                </div>
            </div>,
            document.body
        );
    };

    // === RENDER: Mandiri Tab ===
    const renderMandiriTab = () => {
        // Detail view of a selected cashflow
        if (selectedCF) {
            return (
                <>
                    {/* Back + Title */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <button onClick={() => setSelectedCF(null)} className="btn btn-ghost" style={{ padding: '8px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                            <ArrowLeft style={{ width: '18px', height: '18px' }} />
                        </button>
                        <div style={{ flex: 1 }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>{selectedCF.name}</h2>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Cashflow Mandiri</p>
                        </div>
                        <button className="btn btn-primary" onClick={() => setIsAddingCF(true)} disabled={isAddingCF}>
                            <Plus style={{ width: '16px', height: '16px' }} /> Tambah Item
                        </button>
                    </div>

                    {/* Summary Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                        <div className="card" style={{ padding: '18px', textAlign: 'center' }}>
                            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Total Masuk</p>
                            <p style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-emerald)' }}>{fmt(cfSummary.kredit)}</p>
                        </div>
                        <div className="card" style={{ padding: '18px', textAlign: 'center' }}>
                            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Total Keluar</p>
                            <p style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-rose)' }}>{fmt(cfSummary.debit)}</p>
                        </div>
                        <div className="card" style={{ padding: '18px', textAlign: 'center' }}>
                            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Saldo Akhir</p>
                            <p style={{ fontSize: '20px', fontWeight: 800, color: cfSummary.saldo < 0 ? 'var(--accent-rose)' : 'var(--text-primary)' }}>{fmt(cfSummary.saldo)}</p>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="card" style={{ overflow: 'hidden' }}>
                        <div className="table-wrap">
                            <table className="table" style={{ minWidth: '800px' }}>
                                <thead style={{ background: 'var(--accent-blue-light)' }}>
                                    <tr>
                                        <th style={{ width: '40px', textAlign: 'center', color: 'var(--accent-blue)' }}>No</th>
                                        <th style={{ width: '110px', color: 'var(--accent-blue)' }}>Tgl</th>
                                        <th style={{ width: '100px', color: 'var(--accent-blue)' }}>Jenis</th>
                                        <th style={{ color: 'var(--accent-blue)' }}>Items</th>
                                        <th style={{ width: '140px', textAlign: 'right', color: 'var(--accent-blue)' }}>Masuk</th>
                                        <th style={{ width: '140px', textAlign: 'right', color: 'var(--accent-blue)' }}>Keluar</th>
                                        <th style={{ width: '140px', textAlign: 'right', color: 'var(--accent-blue)' }}>Saldo</th>
                                        <th style={{ color: 'var(--accent-blue)' }}>Keterangan</th>
                                        <th style={{ width: '90px', textAlign: 'center', color: 'var(--accent-blue)' }}>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cfItemsWithSaldo.length === 0 && (
                                        <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Belum ada item. Klik "Tambah Item" untuk memulai.</td></tr>
                                    )}
                                    {cfItemsWithSaldo.map((item, i) => (
                                        <tr key={item.id}>
                                            <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{i + 1}</td>
                                            <td style={{ fontSize: '13px' }}>{item.tanggal || '-'}</td>
                                            <td>
                                                <span className={`badge ${item.kredit > 0 ? 'badge-emerald' : 'badge-rose'}`} style={{ fontSize: '10px' }}>
                                                    {item.kredit > 0 ? 'MASUK' : 'KELUAR'}
                                                </span>
                                            </td>
                                            <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{item.item}</td>
                                            <td style={{ textAlign: 'right', color: item.kredit > 0 ? 'var(--accent-emerald)' : 'var(--text-muted)', fontWeight: item.kredit > 0 ? 600 : 400 }}>{item.kredit > 0 ? fmt(item.kredit) : ''}</td>
                                            <td style={{ textAlign: 'right', color: item.debit > 0 ? 'var(--accent-rose)' : 'var(--text-muted)', fontWeight: item.debit > 0 ? 600 : 400 }}>{item.debit > 0 ? fmt(item.debit) : ''}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, color: item.saldo < 0 ? 'var(--accent-rose)' : 'var(--text-primary)' }}>{fmt(item.saldo)}</td>
                                            <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.keterangan}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                                    <button onClick={() => startEditCFItem(item)} className="icon-btn icon-btn-blue" title="Edit"><Edit3 style={{ width: '14px', height: '14px' }} /></button>
                                                    <button onClick={() => setDeleteCFItemConfirm(item.id)} className="icon-btn icon-btn-rose" title="Hapus"><Trash2 style={{ width: '14px', height: '14px' }} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {cfItemsWithSaldo.length > 0 && (
                                        <tr style={{ background: 'var(--accent-amber-light)' }}>
                                            <td></td><td></td>
                                            <td style={{ fontWeight: 700 }}>Anggaran Sisa</td>
                                            <td></td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent-emerald)' }}>{fmt(cfSummary.kredit)}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent-rose)' }}>{fmt(cfSummary.debit)}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 800, color: cfSummary.saldo < 0 ? 'var(--accent-rose)' : 'var(--text-primary)' }}>{fmt(cfSummary.saldo)}</td>
                                            <td style={{ fontWeight: 700 }}>Saldo Akhir</td>
                                            <td></td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {renderCFItemModal()}

                    {/* Delete CF Item Confirm */}
                    {deleteCFItemConfirm && createPortal(
                        <div className="modal-overlay" onClick={() => setDeleteCFItemConfirm(null)}>
                            <div className="modal-content" onClick={e => e.stopPropagation()}>
                                <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Konfirmasi Hapus</h3>
                                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>Apakah Anda yakin ingin menghapus item ini?</p>
                                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                    <button onClick={() => setDeleteCFItemConfirm(null)} className="btn btn-ghost" style={{ padding: '8px 18px' }}>Batal</button>
                                    <button onClick={() => handleDeleteCFItem(deleteCFItemConfirm)} className="btn btn-danger" style={{ padding: '8px 18px' }}>Ya, Hapus</button>
                                </div>
                            </div>
                        </div>,
                        document.body
                    )}
                </>
            );
        }

        // List of all independent cashflows
        return (
            <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <div>
                        <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>Daftar Cashflow Mandiri</h2>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Cashflow independen tanpa sinkron data pelatihan</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowCreateCF(true)}>
                        <FolderPlus style={{ width: '16px', height: '16px' }} /> Buat Cashflow Baru
                    </button>
                </div>

                {independentCFs.length === 0 ? (
                    <div className="card" style={{ padding: '64px 24px', textAlign: 'center' }}>
                        <Wallet style={{ width: '48px', height: '48px', color: 'var(--text-muted)', margin: '0 auto 16px' }} />
                        <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-secondary)' }}>Belum ada cashflow mandiri</p>
                        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '6px' }}>Buat cashflow baru untuk mulai mencatat pemasukan dan pengeluaran</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                        {independentCFs.map(cf => (
                            <div key={cf.id} className="card" style={{ padding: '20px', cursor: 'pointer', transition: 'all 0.2s', position: 'relative' }} onClick={() => setSelectedCF(cf)}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>📋 {cf.name}</p>
                                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Dibuat: {new Date(cf.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                    </div>
                                    <div style={{ position: 'relative' }}>
                                        <button onClick={(e) => { e.stopPropagation(); setCfMenuOpen(cfMenuOpen === cf.id ? null : cf.id); }} className="icon-btn" style={{ padding: '4px' }}>
                                            <MoreVertical style={{ width: '16px', height: '16px', color: 'var(--text-muted)' }} />
                                        </button>
                                        {cfMenuOpen === cf.id && (
                                            <div className="card" style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', zIndex: 100, padding: '6px', minWidth: '150px', boxShadow: 'var(--shadow-lg)' }} onClick={e => e.stopPropagation()}>
                                                <button onClick={() => { setRenamingCF({ id: cf.id, name: cf.name }); setCfMenuOpen(null); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '6px', fontSize: '13px', color: 'var(--text-primary)' }} onMouseEnter={e => e.target.style.background = 'var(--bg-secondary)'} onMouseLeave={e => e.target.style.background = 'none'}>
                                                    <PenLine style={{ width: '14px', height: '14px' }} /> Rename
                                                </button>
                                                <button onClick={() => { setDeletingCF(cf.id); setCfMenuOpen(null); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '6px', fontSize: '13px', color: 'var(--accent-rose)' }} onMouseEnter={e => e.target.style.background = 'var(--bg-secondary)'} onMouseLeave={e => e.target.style.background = 'none'}>
                                                    <Trash2 style={{ width: '14px', height: '14px' }} /> Hapus
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Create Cashflow Modal */}
                {showCreateCF && createPortal(
                    <div className="modal-overlay" onClick={() => setShowCreateCF(false)}>
                        <div className="modal-content" style={{ maxWidth: '450px' }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--accent-blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-blue)' }}><FolderPlus /></div>
                                    <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>Buat Cashflow Baru</h3>
                                </div>
                                <button onClick={() => setShowCreateCF(false)} className="btn btn-ghost" style={{ padding: '8px' }}><X style={{ width: '20px', height: '20px' }} /></button>
                            </div>
                            <div>
                                <label className="label">Nama Cashflow</label>
                                <input type="text" className="input" value={newCFName} onChange={e => setNewCFName(e.target.value)} placeholder="Contoh: Cashflow Anggaran Ongkir" autoFocus onKeyDown={e => e.key === 'Enter' && handleCreateCF()} />
                            </div>
                            <div style={{ marginTop: '28px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button onClick={() => setShowCreateCF(false)} className="btn btn-ghost">Batal</button>
                                <button onClick={handleCreateCF} className="btn btn-primary">Buat Cashflow</button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

                {/* Rename Modal */}
                {renamingCF && createPortal(
                    <div className="modal-overlay" onClick={() => setRenamingCF(null)}>
                        <div className="modal-content" style={{ maxWidth: '450px' }} onClick={e => e.stopPropagation()}>
                            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>Rename Cashflow</h3>
                            <input type="text" className="input" value={renamingCF.name} onChange={e => setRenamingCF({ ...renamingCF, name: e.target.value })} autoFocus onKeyDown={e => e.key === 'Enter' && handleRenameCF()} />
                            <div style={{ marginTop: '24px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button onClick={() => setRenamingCF(null)} className="btn btn-ghost">Batal</button>
                                <button onClick={handleRenameCF} className="btn btn-primary">Simpan</button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

                {/* Delete Cashflow Confirm */}
                {deletingCF && createPortal(
                    <div className="modal-overlay" onClick={() => setDeletingCF(null)}>
                        <div className="modal-content" onClick={e => e.stopPropagation()}>
                            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Hapus Cashflow</h3>
                            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>Apakah Anda yakin ingin menghapus cashflow ini beserta semua itemnya? Tindakan ini tidak dapat dibatalkan.</p>
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button onClick={() => setDeletingCF(null)} className="btn btn-ghost" style={{ padding: '8px 18px' }}>Batal</button>
                                <button onClick={() => handleDeleteCF(deletingCF)} className="btn btn-danger" style={{ padding: '8px 18px' }}>Ya, Hapus</button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
            </>
        );
    };

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '4px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
                        Cash Flow
                    </h1>
                    <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                        {activeTab === 'mandiri'
                            ? 'Kelola cashflow mandiri tanpa sinkron data pelatihan'
                            : isGabungan
                                ? 'Gabungan semua pelatihan'
                                : `Monitoring pemasukan dan pengeluaran — ${selectedLevel}`
                        }
                    </p>
                </div>
            </div>

            {/* Tab Switcher */}
            <div style={{ display: 'flex', gap: '0', marginBottom: '24px', borderBottom: '2px solid var(--border-color)' }}>
                <button onClick={() => { setActiveTab('pelatihan'); setSelectedCF(null); }} style={{ padding: '12px 24px', fontWeight: 700, fontSize: '14px', border: 'none', cursor: 'pointer', background: 'none', borderBottom: activeTab === 'pelatihan' ? '3px solid var(--accent-blue)' : '3px solid transparent', color: activeTab === 'pelatihan' ? 'var(--accent-blue)' : 'var(--text-muted)', transition: 'all 0.2s' }}>💰 Pelatihan</button>
                <button onClick={() => setActiveTab('mandiri')} style={{ padding: '12px 24px', fontWeight: 700, fontSize: '14px', border: 'none', cursor: 'pointer', background: 'none', borderBottom: activeTab === 'mandiri' ? '3px solid var(--accent-blue)' : '3px solid transparent', color: activeTab === 'mandiri' ? 'var(--accent-blue)' : 'var(--text-muted)', transition: 'all 0.2s' }}>📋 Mandiri</button>
            </div>

            {/* Tab Content */}
            {activeTab === 'mandiri' ? renderMandiriTab() : (
            <>

            {/* Level Filter */}
            <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                    <div style={{ flex: 1, minWidth: '220px' }}>
                        <CustomSelect
                            value={selectedLevel}
                            onChange={setSelectedLevel}
                            options={selectOptions}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative' }}>
                            <button
                                onClick={() => setShowColumnPicker(!showColumnPicker)}
                                className="btn btn-ghost"
                                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
                            >
                                <Layout style={{ width: '16px', height: '16px' }} />
                                Opsi Kolom
                            </button>
                            {showColumnPicker && (
                                <div className="card" style={{
                                    position: 'absolute', top: '100%', right: 0, marginTop: '8px', zIndex: 100,
                                    padding: '12px', minWidth: '180px', boxShadow: 'var(--shadow-lg)'
                                }}>
                                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Tampilkan Kolom</p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {[
                                            { key: 'no', label: 'No' },
                                            { key: 'tanggal', label: 'Tanggal' },
                                            ...(isGabungan ? [{ key: 'pelatihan', label: 'Pelatihan' }] : []),
                                            { key: 'jenis', label: 'Jenis' },
                                            { key: 'items', label: 'Items' },
                                            { key: 'masuk', label: 'Masuk (Kredit)' },
                                            { key: 'keluar', label: 'Keluar (Debit)' },
                                            { key: 'saldo', label: 'Saldo' },
                                            { key: 'keterangan', label: 'Keterangan' },
                                        ].map(col => (
                                            <label key={col.key} className="custom-control custom-control-bulat">
                                                <input
                                                    type="checkbox"
                                                    checked={visibleColumns[col.key]}
                                                    onChange={() => toggleColumn(col.key)}
                                                />
                                                <span className="control-bubble"></span>
                                                <span style={{ fontSize: '13px' }}>{col.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <button
                            className="btn btn-ghost"
                            onClick={handlePrint}
                            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
                        >
                            <Printer style={{ width: '16px', height: '16px' }} /> Print PDF
                        </button>
                        <button
                            className="btn btn-ghost"
                            onClick={handleExport}
                            style={{ gap: '6px' }}
                        >
                            <FileSpreadsheet style={{ width: '16px', height: '16px' }} /> Export Excel
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={() => {
                                if (isGabungan) {
                                    setNewItem(prev => ({ ...prev, level: levelOptions[0] || '' }));
                                }
                                setIsAdding(true);
                            }}
                            disabled={isAdding}
                        >
                            <Plus style={{ width: '16px', height: '16px' }} /> Tambah Item Baru
                        </button>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '18px', textAlign: 'center' }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Total Masuk</p>
                    <p style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-emerald)' }}>{fmt(summary.kredit)}</p>
                </div>
                <div className="card" style={{ padding: '18px', textAlign: 'center' }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Total Keluar</p>
                    <p style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-rose)' }}>{fmt(summary.debit)}</p>
                </div>
                <div className="card" style={{ padding: '18px', textAlign: 'center' }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Saldo Akhir</p>
                    <p style={{ fontSize: '20px', fontWeight: 800, color: summary.saldo < 0 ? 'var(--accent-rose)' : 'var(--text-primary)' }}>{fmt(summary.saldo)}</p>
                </div>
            </div>

            {/* Table */}
            <div className="card" style={{ overflow: 'hidden', marginBottom: '20px' }}>
                <div className="table-wrap">
                    <table className="table" style={{ minWidth: '1000px' }}>
                        <thead style={{ background: 'var(--accent-blue-light)' }}>
                            <tr>
                                {visibleColumns.no && <th style={{ width: '40px', textAlign: 'center', color: 'var(--accent-blue)' }}>No</th>}
                                {visibleColumns.tanggal && <th style={{ width: '110px', color: 'var(--accent-blue)' }}>Tgl</th>}
                                {isGabungan && visibleColumns.pelatihan && <th style={{ width: '120px', color: 'var(--accent-blue)' }}>Pelatihan</th>}
                                {visibleColumns.jenis && <th style={{ width: '100px', color: 'var(--accent-blue)' }}>Jenis</th>}
                                {visibleColumns.items && <th style={{ color: 'var(--accent-blue)' }}>Items</th>}
                                {visibleColumns.masuk && <th style={{ width: '140px', textAlign: 'right', color: 'var(--accent-blue)' }}>Masuk</th>}
                                {visibleColumns.keluar && <th style={{ width: '140px', textAlign: 'right', color: 'var(--accent-blue)' }}>Keluar</th>}
                                {visibleColumns.saldo && <th style={{ width: '140px', textAlign: 'right', color: 'var(--accent-blue)' }}>Saldo</th>}
                                {visibleColumns.keterangan && <th style={{ color: 'var(--accent-blue)' }}>Keterangan</th>}
                                {visibleColumns.aksi && <th style={{ width: '90px', textAlign: 'center', color: 'var(--accent-blue)' }}>Aksi</th>}
                            </tr>
                        </thead>
                        <tbody>

                            {displayItems.map((item, i) => {
                                const levelIdx = levelOptions.indexOf(item.level);
                                const badgeClass = levelColors[levelIdx % levelColors.length];

                                return (
                                    <tr key={item.id} style={{
                                        background: item.isAutoInsert ? 'var(--accent-blue-light)' : undefined,
                                        fontWeight: item.isAutoInsert ? 700 : 400
                                    }}>
                                        {visibleColumns.no && <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{i + 1}</td>}
                                        {visibleColumns.tanggal && <td style={{ fontSize: '13px' }}>{item.tanggal || '-'}</td>}
                                        {isGabungan && visibleColumns.pelatihan && (
                                            <td>
                                                <span className={`badge ${badgeClass}`} style={{ fontSize: '10px' }}>
                                                    {item.level}
                                                </span>
                                            </td>
                                        )}
                                        {visibleColumns.jenis && (
                                            <td>
                                                {item.isAutoInsert ? (
                                                    <span className="badge badge-blue" style={{ fontSize: '10px' }}>INSERT</span>
                                                ) : (
                                                    <span className={`badge ${item.kredit > 0 ? 'badge-emerald' : 'badge-rose'}`} style={{ fontSize: '10px' }}>
                                                        {item.kredit > 0 ? 'MASUK' : 'KELUAR'}
                                                    </span>
                                                )}
                                            </td>
                                        )}
                                        {visibleColumns.items && (
                                            <td style={{ fontWeight: item.isAutoInsert ? 800 : 500, textTransform: item.isAutoInsert ? 'uppercase' : 'none', color: item.isAutoInsert ? 'var(--accent-blue)' : 'var(--text-primary)' }}>
                                                {item.item}
                                            </td>
                                        )}
                                        {visibleColumns.masuk && (
                                            <td style={{ textAlign: 'right', color: item.kredit > 0 ? 'var(--accent-emerald)' : 'var(--text-muted)', fontWeight: item.kredit > 0 ? 600 : 400 }}>
                                                {item.kredit > 0 ? fmt(item.kredit) : ''}
                                            </td>
                                        )}
                                        {visibleColumns.keluar && (
                                            <td style={{ textAlign: 'right', color: item.debit > 0 ? 'var(--accent-rose)' : 'var(--text-muted)', fontWeight: item.debit > 0 ? 600 : 400 }}>
                                                {item.debit > 0 ? fmt(item.debit) : ''}
                                            </td>
                                        )}
                                        {visibleColumns.saldo && (
                                            <td style={{ textAlign: 'right', fontWeight: 700, color: item.saldo < 0 ? 'var(--accent-rose)' : 'var(--text-primary)' }}>
                                                {fmt(item.saldo)}
                                            </td>
                                        )}
                                        {visibleColumns.keterangan && <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.keterangan}</td>}
                                        {visibleColumns.aksi && (
                                            <td style={{ textAlign: 'center' }}>
                                                {!item.isAutoInsert && (
                                                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                                        <button onClick={() => startEdit(item)} className="icon-btn icon-btn-blue" title="Edit">
                                                            <Edit3 style={{ width: '14px', height: '14px' }} />
                                                        </button>
                                                        <button onClick={() => setDeleteConfirm(item.id)} className="icon-btn icon-btn-rose" title="Hapus">
                                                            <Trash2 style={{ width: '14px', height: '14px' }} />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}

                            {/* Footer totals */}
                            <tr style={{ background: 'var(--accent-amber-light)' }}>
                                {visibleColumns.no && <td></td>}
                                {visibleColumns.tanggal && <td></td>}
                                {isGabungan && visibleColumns.pelatihan && <td></td>}
                                {visibleColumns.jenis && <td style={{ fontWeight: 700 }}>Anggaran Sisa</td>}
                                {visibleColumns.items && <td></td>}
                                {visibleColumns.masuk && <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent-emerald)' }}>{fmt(summary.kredit)}</td>}
                                {visibleColumns.keluar && <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent-rose)' }}>{fmt(summary.debit)}</td>}
                                {visibleColumns.saldo && (
                                    <td style={{ textAlign: 'right', fontWeight: 800, color: summary.saldo < 0 ? 'var(--accent-rose)' : 'var(--text-primary)' }}>
                                        {fmt(summary.saldo)}
                                    </td>
                                )}
                                {visibleColumns.keterangan && <td style={{ fontWeight: 700 }}>Saldo Akhir</td>}
                                {visibleColumns.aksi && <td></td>}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add / Edit Item Modal */}
            {(isAdding || editingId) && createPortal(
                <div className="modal-overlay" onClick={() => { setIsAdding(false); setEditingId(null); }}>
                    <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--accent-blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-blue)' }}>
                                    <Wallet />
                                </div>
                                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                                    {isAdding ? 'Tambah Item Cash Flow' : 'Edit Item Cash Flow'}
                                </h3>
                            </div>
                            <button onClick={() => { setIsAdding(false); setEditingId(null); }} className="btn btn-ghost" style={{ padding: '8px' }}><X style={{ width: '20px', height: '20px' }} /></button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {isGabungan && isAdding && (
                                <div>
                                    <label className="label">Pilih Pelatihan</label>
                                    <CustomSelect
                                        value={newItem.level}
                                        onChange={(v) => setNewItem({ ...newItem, level: v })}
                                        options={levelOptions.map(l => ({ value: l, label: l }))}
                                    />
                                </div>
                            )}
                            <div>
                                <label className="label">Tanggal</label>
                                <div className="custom-datepicker-wrapper">
                                    <DatePicker
                                        selected={isAdding ? newItem.tanggal : editData.tanggal}
                                        onChange={(date) => isAdding ? setNewItem({ ...newItem, tanggal: date }) : setEditData({ ...editData, tanggal: date })}
                                        dateFormat="yyyy-MM-dd"
                                        className="input"
                                    />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label className="label">Jenis</label>
                                    <CustomSelect
                                        value={isAdding ? newItem.jenis : editData.jenis}
                                        onChange={(v) => isAdding ? setNewItem({ ...newItem, jenis: v }) : setEditData({ ...editData, jenis: v })}
                                        options={[
                                            { value: 'Keluar', label: 'Keluar' },
                                            { value: 'Masuk', label: 'Masuk' },
                                        ]}
                                    />
                                </div>
                                <div>
                                    <label className="label">Nominal (Rp)</label>
                                    <input
                                        type="number"
                                        className="input"
                                        value={isAdding ? (newItem.nominal || '') : (editData.nominal || '')}
                                        onChange={(e) => isAdding ? setNewItem({ ...newItem, nominal: Number(e.target.value) }) : setEditData({ ...editData, nominal: Number(e.target.value) })}
                                        placeholder="0"
                                        min="0"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="label">Nama Item / Keperluan</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={isAdding ? newItem.item : editData.item}
                                    onChange={(e) => isAdding ? setNewItem({ ...newItem, item: e.target.value }) : setEditData({ ...editData, item: e.target.value })}
                                    placeholder="Contoh: Beli Air Mineral"
                                />
                            </div>
                            <div>
                                <label className="label">Keterangan Tambahan</label>
                                <textarea
                                    className="input"
                                    rows="2"
                                    value={isAdding ? newItem.keterangan : editData.keterangan}
                                    onChange={(e) => isAdding ? setNewItem({ ...newItem, keterangan: e.target.value }) : setEditData({ ...editData, keterangan: e.target.value })}
                                    placeholder="Opsional..."
                                />
                            </div>
                        </div>

                        <div style={{ marginTop: '28px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button onClick={() => { setIsAdding(false); setEditingId(null); }} className="btn btn-ghost">Batal</button>
                            <button onClick={isAdding ? handleSaveNew : handleSaveEdit} className="btn btn-primary">
                                {isAdding ? 'Tambah Item' : 'Simpan Perubahan'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirm && createPortal(
                <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Konfirmasi Hapus</h3>
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                            Apakah Anda yakin ingin menghapus item cash flow ini? Tindakan ini tidak dapat dibatalkan.
                        </p>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setDeleteConfirm(null)} className="btn btn-ghost" style={{ padding: '8px 18px' }}>Batal</button>
                            <button onClick={() => confirmDelete(deleteConfirm)} className="btn btn-danger" style={{ padding: '8px 18px' }}>Ya, Hapus</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}


            </>
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
