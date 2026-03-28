import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getPeserta, getLevels, getAppSettings } from '../utils/storage';

const DataContext = createContext(null);

export function DataProvider({ children }) {
    const [peserta, setPeserta] = useState([]);
    const [levels, setLevels] = useState({});
    const [appSettings, setAppSettings] = useState(null);
    const [loading, setLoading] = useState(true);

    // Initial load — called once on mount
    const loadAll = useCallback(async () => {
        setLoading(true);
        const [p, l, s] = await Promise.all([
            getPeserta(),
            getLevels(),
            getAppSettings(),
        ]);
        setPeserta(p);
        setLevels(l);
        setAppSettings(s);
        setLoading(false);
    }, []);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    // ===== Refresh functions (only when truly needed) =====
    const refreshPeserta = useCallback(async () => {
        const p = await getPeserta();
        setPeserta(p);
    }, []);

    const refreshLevels = useCallback(async () => {
        const l = await getLevels();
        setLevels(l);
    }, []);

    const refreshAppSettings = useCallback(async () => {
        const s = await getAppSettings();
        setAppSettings(s);
    }, []);

    // ===== Optimistic local updates (0 reads) =====

    // After addPeserta returns the new item
    const addPesertaLocal = useCallback((newItem) => {
        if (!newItem) return;
        setPeserta(prev => [newItem, ...prev]);
    }, []);

    // After batchAddPeserta returns new items
    const batchAddPesertaLocal = useCallback((newItems) => {
        if (!newItems || newItems.length === 0) return;
        setPeserta(prev => [...newItems, ...prev]);
    }, []);

    // After updatePeserta succeeds
    const updatePesertaLocal = useCallback((id, updates) => {
        setPeserta(prev =>
            prev.map(p => p.id === id ? { ...p, ...updates } : p)
        );
    }, []);

    // After deletePeserta succeeds
    const deletePesertaLocal = useCallback((id) => {
        setPeserta(prev => prev.filter(p => p.id !== id));
    }, []);

    // After saveLevels succeeds
    const setLevelsLocal = useCallback((newLevels) => {
        setLevels(newLevels);
    }, []);

    // After saveAppSettings succeeds
    const setAppSettingsLocal = useCallback((newSettings) => {
        setAppSettings(newSettings);
    }, []);

    const value = {
        // Data
        peserta,
        levels,
        appSettings,
        loading,

        // Full refresh (use sparingly)
        refreshPeserta,
        refreshLevels,
        refreshAppSettings,
        loadAll,

        // Optimistic local updates (preferred)
        addPesertaLocal,
        batchAddPesertaLocal,
        updatePesertaLocal,
        deletePesertaLocal,
        setLevelsLocal,
        setAppSettingsLocal,
    };

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    );
}

export function useData() {
    const ctx = useContext(DataContext);
    if (!ctx) {
        throw new Error('useData must be used within a DataProvider');
    }
    return ctx;
}
