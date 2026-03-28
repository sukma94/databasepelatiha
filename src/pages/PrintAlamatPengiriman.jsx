import React from 'react';
import './PrintAlamatPengiriman.css';
import { Package, User, MapPin } from 'lucide-react';

export default function PrintAlamatPengiriman({ alamatList }) {
    if (!alamatList || alamatList.length === 0) return null;

    // Create a sorted copy: A-Z by namaPeserta
    const sortedAlamatList = [...alamatList].sort((a, b) => 
        (a.namaPeserta || '').localeCompare(b.namaPeserta || '', 'id', { sensitivity: 'base' })
    );

    return (
        <div className="print-label-wrapper" id="printable-area">
            {sortedAlamatList.map((item, index) => {
                // Jika nama daerah tidak mengandung kata Kota, otomatis ditambahkan prefix KAB.
                const formatKabupatenKota = (kab) => {
                    if (!kab) return '';
                    if (!kab.toLowerCase().includes('kota')) {
                        const cleanKab = kab.replace(/^Kabupaten\s+/i, '').replace(/^Kab\.?\s+/i, '');
                        return `KAB. ${cleanKab.toUpperCase()}`;
                    }
                    // Jika mengandung kata Kota
                    return `KOTA ${kab.replace(/^Kota\s+/i, '').toUpperCase()}`;
                };

                const regionalString = [
                    item.kelurahan ? `KEL. ${item.kelurahan.toUpperCase()}` : '', 
                    item.kecamatan ? `KEC. ${item.kecamatan.toUpperCase()}` : '', 
                    formatKabupatenKota(item.kabupaten)
                ].filter(Boolean).join(', ');
                return (
                    <div className="shipping-label-card" key={item.id || index}>
                        <div className="sl-inner-wrapper">
                            
                            {/* Header */}
                            <div className="sl-header">
                                <div className="sl-brand-info">
                                    <div style={{ fontSize: '11px', fontWeight: 'bold', fontStyle: 'italic', color: '#EA580C', marginBottom: '2px' }}>
                                        {index + 1}. {item.namaPeserta || item.namaPenerima || '-'}
                                    </div>
                                    <h1 className="sl-brand-title">LABEL PENGIRIMAN</h1>
                                </div>
                                <img src="/logo/sportunys 2 Hitam.png" alt="Sportunys Logo" className="sl-logo" />
                            </div>



                            {/* Main Body Grid */}
                            <div className="sl-body">
                                
                                {/* Left Column: Penerima */}
                                <div className="sl-left-col">
                                    <div className="sl-info-block">
                                        <h2 className="sl-label-accent" style={{ color: '#EA580C', fontSize: '14px', gap: '6px' }}>
                                            <Package size={16} /> KEPADA (PENERIMA)
                                        </h2>
                                        <h3 className="sl-text-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span>{item.namaPenerima || '-'}</span>
                                            <span>&bull;</span>
                                            <span>{item.nomorHP || '-'}</span>
                                        </h3>
                                    </div>

                                    <div className="sl-info-block" style={{ marginTop: '8px' }}>
                                        <p className="sl-label-small" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', color: '#EA580C', fontWeight: 'bold', fontSize: '14px' }}>
                                            <MapPin size={16} /> ALAMAT PENGIRIMAN
                                        </p>
                                        <p className="sl-text-body" style={{ fontWeight: 500, color: '#333' }}>
                                            {item.alamatDetail || '-'}
                                        </p>
                                        <p className="sl-text-body" style={{ color: '#333', marginTop: '2px' }}>
                                            <strong>{regionalString}</strong>
                                        </p>
                                        <p className="sl-text-body" style={{ marginTop: '6px', color: '#333' }}>
                                            <strong>{item.provinsi ? `PROVINSI ${item.provinsi.replace(/^Provinsi\s+/i, '').toUpperCase()}` : '-'}</strong> &nbsp;&bull;&nbsp; KODE POS: <strong>{item.kodePos || '-'}</strong>
                                        </p>
                                    </div>
                                </div>
                            </div>
                            
                            {/* PENGIRIM & SOCIAL MEDIA (Moved to bottom) */}
                            <div className="sl-sender-strip" style={{ marginTop: 'auto' }}>
                                <div><strong>PENGIRIM:</strong> SPORTUNYS &nbsp;&bull;&nbsp; +62 895-3921-23575</div>

                                <div className="sl-social">
                                    <div className="sl-social-item">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
                                        </svg>
                                        sportunys
                                    </div>
                                    <div className="sl-social-item">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                                            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                                            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                                        </svg>
                                        sportunys
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
