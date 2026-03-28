/**
 * Print / Export PDF utility
 * Opens a styled HTML print preview in a new window
 */

const fmt = (n) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

const baseStyles = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: A4 landscape; margin: 12mm 10mm; }
    body {
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        color: #1e293b;
        background: #fff;
        padding: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }
    .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        margin-bottom: 20px;
        padding-bottom: 16px;
        border-bottom: 3px solid #2563eb;
    }
    .header h1 {
        font-size: 22px;
        font-weight: 800;
        color: #1e293b;
        letter-spacing: -0.5px;
    }
    .header .subtitle {
        font-size: 12px;
        color: #64748b;
        margin-top: 4px;
    }
    .header .date {
        font-size: 11px;
        color: #94a3b8;
        text-align: right;
    }
    .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 12px;
        margin-bottom: 20px;
    }
    .summary-card {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 14px 16px;
        text-align: center;
    }
    .summary-card .label {
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: #94a3b8;
        margin-bottom: 4px;
    }
    .summary-card .value {
        font-size: 18px;
        font-weight: 800;
    }
    .summary-card .value.green { color: #10b981; }
    .summary-card .value.amber { color: #f59e0b; }
    .summary-card .value.rose { color: #f43f5e; }
    .summary-card .value.blue { color: #2563eb; }
    table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
    }
    thead th {
        background: #2563eb;
        color: #fff;
        padding: 10px 8px;
        text-align: left;
        font-weight: 700;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        white-space: nowrap;
    }
    thead th:first-child { border-radius: 8px 0 0 0; }
    thead th:last-child { border-radius: 0 8px 0 0; }
    tbody td {
        padding: 8px;
        border-bottom: 1px solid #e2e8f0;
        vertical-align: middle;
    }
    tbody tr:nth-child(even) { background: #f0f7ff; }
    tbody tr:hover { background: #e0efff; }
    .badge {
        display: inline-block;
        padding: 3px 10px;
        border-radius: 20px;
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.3px;
    }
    .badge-green { background: #d1fae5; color: #059669; }
    .badge-amber { background: #fef3c7; color: #d97706; }
    .badge-rose { background: #ffe4e6; color: #e11d48; }
    .badge-blue { background: #dbeafe; color: #2563eb; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-bold { font-weight: 700; }
    .font-mono { font-family: inherit; }
    .text-muted { color: #94a3b8; }
    .footer {
        margin-top: 24px;
        padding-top: 12px;
        border-top: 1px solid #e2e8f0;
        font-size: 10px;
        color: #94a3b8;
        display: flex;
        justify-content: space-between;
    }
    @media print {
        .no-print { display: none !important; }
        .summary-card { break-inside: avoid; }
        table { page-break-inside: auto; }
        tr { page-break-inside: avoid; }
    }
`;

function openPrintWindow(html) {
    const win = window.open('', '_blank', 'width=1100,height=700');
    if (!win) return;
    // Inject Google Fonts link for Inter
    const fontLink = '<link rel="preconnect" href="https://fonts.googleapis.com">' +
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
        '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">';
    const injectedHtml = html.replace('</head>', fontLink + '</head>');
    win.document.write(injectedHtml);
    win.document.close();
    // Wait a bit longer for fonts to load
    setTimeout(() => win.print(), 800);
}

// ====== DAFTAR PESERTA PDF ======
export function printDaftarPeserta(data, { title = 'Daftar Peserta', visibleColumns = {} } = {}) {
    if (!data || data.length === 0) return;

    const now = new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });

    const statusBadge = (s) => {
        if (s === 'Lunas') return '<span class="badge badge-green">Lunas</span>';
        if (s === 'DP') return '<span class="badge badge-amber">DP</span>';
        return '<span class="badge badge-rose">Belum Bayar</span>';
    };

    const kepBadge = (s) => {
        if (s === 'Terdaftar') return '<span class="badge badge-green">Terdaftar</span>';
        if (s === 'Batal') return '<span class="badge badge-rose">Batal</span>';
        return '<span class="badge badge-amber">Konfirmasi</span>';
    };

    const columnDefs = [
        { key: 'no', label: 'No', style: 'text-center', width: '35px' },
        { key: 'nama', label: 'Nama Lengkap' },
        { key: 'provinsi', label: 'Provinsi' },
        { key: 'alamat', label: 'Alamat' },
        { key: 'wa', label: 'No. WA' },
        { key: 'info', label: 'Cabang Olahraga' },
        { key: 'sizeBaju', label: 'Size', style: 'text-center' },
        { key: 'lahir', label: 'Tempat, Tanggal Lahir' },
        { key: 'sertifikatLv1', label: 'No Sertifikat Lv. 1' },
        { key: 'level', label: 'Pelatihan' },
        { key: 'status', label: 'Status Pembayaran', style: 'text-center' },
        { key: 'kepesertaan', label: 'Kepesertaan', style: 'text-center' },
    ];

    const activeCols = columnDefs.filter(col => visibleColumns[col.key]);

    const headerCols = activeCols.map(col =>
        `<th class="${col.style || ''}" style="${col.width ? `width:${col.width}` : ''}">${col.label}</th>`
    ).join('');

    const rows = data.map((p, i) => {
        const cells = activeCols.map(col => {
            let val = '';
            switch (col.key) {
                case 'no': val = i + 1; break;
                case 'nama': val = `<span class="font-bold">${p.nama || '-'}</span>`; break;
                case 'provinsi': val = p.provinsi || '-'; break;
                case 'alamat': val = p.alamat || '-'; break;
                case 'wa': val = p.wa || '-'; break;
                case 'info': val = p.cabor || '-'; break;
                case 'sizeBaju': val = p.ukuranBaju || '-'; break;
                case 'level': val = p.level || '-'; break;
                case 'lahir': val = p.ttl || '-'; break;
                case 'sertifikatLv1': val = p.level?.includes('2') ? (p.nomerSertifikatLevel1 || '-') : '-'; break;
                case 'status': val = statusBadge(p.statusBayar); break;
                case 'kepesertaan': val = kepBadge(p.kepesertaan || 'Konfirmasi'); break;
                default: val = p[col.key] || '-';
            }
            return `<td class="${col.style || ''} ${col.key === 'no' ? 'text-muted' : ''}">${val}</td>`;
        }).join('');
        return `<tr>${cells}</tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${baseStyles}</style></head><body>
        <div class="header">
            <div>
                <h1>${title}</h1>
                <p class="subtitle">${data.length} peserta</p>
            </div>
            <div class="date">Dicetak: ${now}</div>
        </div>
        <table>
            <thead>
                <tr>${headerCols}</tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
        <div class="footer">
            <span>Total: ${data.length} peserta</span>
            <span>Database Pelatihan</span>
        </div>
    </body></html>`;

    openPrintWindow(html);
}

// ====== DAFTAR PEMBAYARAN PDF ======
export function printDaftarPembayaran(data, levels, { title = 'Daftar Pembayaran', summary = {}, visibleColumns = null } = {}) {
    if (!data || data.length === 0) return;

    const now = new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });

    const statusBadge = (s) => {
        if (s === 'Lunas') return '<span class="badge badge-green">Lunas</span>';
        if (s === 'DP') return '<span class="badge badge-amber">DP</span>';
        return '<span class="badge badge-rose">Belum Bayar</span>';
    };

    const columnDefs = [
        { key: 'no', label: 'No', style: 'text-center', width: '35px' },
        { key: 'nama', label: 'Nama' },
        { key: 'wa', label: 'No. WA' },
        { key: 'level', label: 'Pelatihan' },
        { key: 'kategori', label: 'Kategori', style: 'text-center' },
        { key: 'status', label: 'Status', style: 'text-center' },
        { key: 'totalBiaya', label: 'Total Biaya', style: 'text-right' },
        { key: 'nominal', label: 'Nominal DP', style: 'text-right' },
        { key: 'sisa', label: 'Sisa', style: 'text-right' },
    ];

    const activeCols = columnDefs.filter(col => {
        if (!visibleColumns) return true;
        if (visibleColumns[col.key] !== undefined) return visibleColumns[col.key];
        return true; // columns not in visibleColumns map (totalBiaya) always shown
    });

    const headerCols = activeCols.map(col =>
        `<th class="${col.style || ''}" style="${col.width ? `width:${col.width}` : ''}">${col.label}</th>`
    ).join('');

    const rows = data.map((p, i) => {
        const ld = levels[p.level] || {};
        let biaya = ld.biayaNormal || ld.biaya || 0;
        if (p.jenisBiaya === 'Early Bird' && ld.biayaEarly) biaya = ld.biayaEarly;
        else if (p.jenisBiaya === 'Khusus' && ld.biayaKhusus) biaya = ld.biayaKhusus;
        const sisa = p.statusBayar === 'Lunas' ? 0 : p.statusBayar === 'DP' ? biaya - (p.nominalDP || 0) : biaya;

        const cells = activeCols.map(col => {
            let val = '';
            switch (col.key) {
                case 'no': val = i + 1; break;
                case 'nama': val = `<span class="font-bold">${p.nama || '-'}</span>`; break;
                case 'wa': val = p.wa || '-'; break;
                case 'level': val = p.level || '-'; break;
                case 'kategori': val = p.jenisBiaya || 'Normal'; break;
                case 'status': val = statusBadge(p.statusBayar); break;
                case 'totalBiaya': val = `<span class="font-mono">${fmt(biaya)}</span>`; break;
                case 'nominal': val = `<span class="font-mono">${p.statusBayar === 'DP' ? fmt(p.nominalDP || 0) : '-'}</span>`; break;
                case 'sisa': val = `<span class="font-mono" style="color:${sisa > 0 ? '#e11d48' : '#059669'}">${fmt(sisa)}</span>`; break;
                default: val = '-';
            }
            return `<td class="${col.style || ''} ${col.key === 'no' ? 'text-muted' : ''}">${val}</td>`;
        }).join('');
        return `<tr>${cells}</tr>`;
    }).join('');

    const summaryHtml = summary.totalMasuk !== undefined ? `
        <div class="summary-grid">
            <div class="summary-card"><div class="label">Total Pemasukan</div><div class="value green">${fmt(summary.totalMasuk)}</div></div>
            <div class="summary-card"><div class="label">Lunas</div><div class="value green">${summary.lunas || 0}</div></div>
            <div class="summary-card"><div class="label">DP</div><div class="value amber">${summary.dp || 0}</div></div>
            <div class="summary-card"><div class="label">Belum Bayar</div><div class="value rose">${summary.belum || 0}</div></div>
        </div>
    ` : '';

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${baseStyles}</style></head><body>
        <div class="header">
            <div>
                <h1>${title}</h1>
                <p class="subtitle">${data.length} peserta</p>
            </div>
            <div class="date">Dicetak: ${now}</div>
        </div>
        ${summaryHtml}
        <table>
            <thead>
                <tr>${headerCols}</tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
        <div class="footer">
            <span>Total: ${data.length} peserta</span>
            <span>Database Pelatihan</span>
        </div>
    </body></html>`;

    openPrintWindow(html);
}

// ====== CASH FLOW PDF ======
export function printCashFlow(displayItems, summary, { title = 'Cash Flow', isGabungan = false, visibleColumns = {} } = {}) {
    if (!displayItems || displayItems.length === 0) return;

    const now = new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });

    const allColumnDefs = [
        { key: 'no', label: 'No', style: 'text-center', width: '35px' },
        { key: 'tanggal', label: 'Tanggal' },
        ...(isGabungan ? [{ key: 'pelatihan', label: 'Pelatihan' }] : []),
        { key: 'jenis', label: 'Jenis', style: 'text-center' },
        { key: 'items', label: 'Items' },
        { key: 'masuk', label: 'Masuk (Kredit)', style: 'text-right' },
        { key: 'keluar', label: 'Keluar (Debit)', style: 'text-right' },
        { key: 'saldo', label: 'Saldo', style: 'text-right' },
        { key: 'keterangan', label: 'Keterangan' },
    ];

    const activeCols = allColumnDefs.filter(col => {
        if (visibleColumns[col.key] !== undefined) return visibleColumns[col.key];
        return true;
    });

    const headerCols = activeCols.map(col =>
        `<th class="${col.style || ''}" style="${col.width ? `width:${col.width}` : ''}">${col.label}</th>`
    ).join('');

    const rows = displayItems.map((item, i) => {
        const isInsert = item.isAutoInsert;
        const rowStyle = isInsert ? 'background:#dbeafe;font-weight:700;' : '';

        const cells = activeCols.map(col => {
            let val = '';
            const tdStyle = col.style || '';
            switch (col.key) {
                case 'no': val = i + 1; break;
                case 'tanggal': val = item.tanggal || '-'; break;
                case 'pelatihan': val = `<span class="badge badge-blue">${item.level || ''}</span>`; break;
                case 'jenis':
                    if (isInsert) val = '<span class="badge badge-blue">INSERT</span>';
                    else val = item.kredit > 0 ? '<span class="badge badge-green">MASUK</span>' : '<span class="badge badge-rose">KELUAR</span>';
                    break;
                case 'items': val = isInsert ? `<span style="color:#2563eb;text-transform:uppercase">${item.item}</span>` : (item.item || ''); break;
                case 'masuk': val = item.kredit > 0 ? `<span class="font-mono" style="color:#059669">${fmt(item.kredit)}</span>` : ''; break;
                case 'keluar': val = item.debit > 0 ? `<span class="font-mono" style="color:#e11d48">${fmt(item.debit)}</span>` : ''; break;
                case 'saldo': val = `<span class="font-mono font-bold" style="color:${item.saldo < 0 ? '#e11d48' : '#1e293b'}">${fmt(item.saldo)}</span>`; break;
                case 'keterangan': val = item.keterangan || ''; break;
                default: val = '-';
            }
            return `<td class="${tdStyle}" style="${col.key === 'no' ? 'color:#94a3b8;' : ''}">${val}</td>`;
        }).join('');

        return `<tr style="${rowStyle}">${cells}</tr>`;
    }).join('');

    // Footer totals row
    const footerCells = activeCols.map(col => {
        switch (col.key) {
            case 'jenis': return '<td class="font-bold">TOTAL</td>';
            case 'masuk': return `<td class="text-right font-bold" style="color:#059669">${fmt(summary.kredit)}</td>`;
            case 'keluar': return `<td class="text-right font-bold" style="color:#e11d48">${fmt(summary.debit)}</td>`;
            case 'saldo': return `<td class="text-right font-bold" style="color:${summary.saldo < 0 ? '#e11d48' : '#1e293b'}">${fmt(summary.saldo)}</td>`;
            case 'keterangan': return '<td class="font-bold">Saldo Akhir</td>';
            default: return '<td></td>';
        }
    }).join('');

    const summaryHtml = `
        <div class="summary-grid">
            <div class="summary-card"><div class="label">Total Masuk</div><div class="value green">${fmt(summary.kredit)}</div></div>
            <div class="summary-card"><div class="label">Total Keluar</div><div class="value rose">${fmt(summary.debit)}</div></div>
            <div class="summary-card"><div class="label">Saldo Akhir</div><div class="value ${summary.saldo < 0 ? 'rose' : 'blue'}">${fmt(summary.saldo)}</div></div>
        </div>
    `;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${baseStyles}
        .totals-row td { background: #fef3c7; border-top: 2px solid #f59e0b; border-bottom: 2px solid #f59e0b; }
    </style></head><body>
        <div class="header">
            <div>
                <h1>${title}</h1>
                <p class="subtitle">${displayItems.length} item</p>
            </div>
            <div class="date">Dicetak: ${now}</div>
        </div>
        ${summaryHtml}
        <table>
            <thead>
                <tr>${headerCols}</tr>
            </thead>
            <tbody>${rows}
                <tr class="totals-row">${footerCells}</tr>
            </tbody>
        </table>
        <div class="footer">
            <span>Total: ${displayItems.length} item</span>
            <span>Database Pelatihan</span>
        </div>
    </body></html>`;

    openPrintWindow(html);
}
