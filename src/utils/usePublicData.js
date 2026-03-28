import { useState, useEffect } from 'react';
import { getPeserta, getLevels, getAppSettings, getAllPublicSettings, getPublicSettingsBySlug } from './storage';
import { useTheme } from '../context/ThemeContext';

/**
 * Shared hook for public pages to load common data.
 * Uses the cached storage functions so navigating between
 * PublicLanding → PublicPeserta → FormulirLanding → FormulirUpdatePeserta
 * only fetches each collection once (cache hits after first page).
 *
 * @param {Object} options
 * @param {string} [options.levelSlug] - If provided, also fetches public settings for this slug
 * @param {boolean} [options.fetchAll] - If true, fetches allPublicSettings (for landing pages)
 * @param {boolean} [options.settingsOnly] - If true, only fetches appSettings (for Login page)
 */
export function usePublicData({ levelSlug = null, fetchAll = false, settingsOnly = false } = {}) {
    const [peserta, setPeserta] = useState([]);
    const [levels, setLevels] = useState({});
    const [settings, setSettings] = useState(null);
    const [allPublicSettings, setAllPublicSettings] = useState(null);
    const [publicSettings, setPublicSettings] = useState(null);
    const [notFound, setNotFound] = useState(false);
    const [loading, setLoading] = useState(true);

    const { dark } = useTheme();

    useEffect(() => {
        const load = async () => {
            setLoading(true);

            if (settingsOnly) {
                const s = await getAppSettings();
                setSettings(s);
                setLoading(false);
                return;
            }

            const promises = [getPeserta(), getLevels(), getAppSettings()];

            if (fetchAll) {
                promises.push(getAllPublicSettings());
            } else if (levelSlug) {
                promises.push(getPublicSettingsBySlug(levelSlug));
            }

            const results = await Promise.all(promises);
            setPeserta(results[0]);
            setLevels(results[1]);
            setSettings(results[2]);

            if (fetchAll) {
                setAllPublicSettings(results[3]);
            } else if (levelSlug) {
                const ps = results[3];
                if (!ps || !ps.isPublished) {
                    setNotFound(true);
                    setPublicSettings(null);
                } else {
                    setPublicSettings(ps);
                    setNotFound(false);
                }
            }

            setLoading(false);
        };
        load();
    }, [levelSlug, fetchAll, settingsOnly]);

    useEffect(() => {
        if (settings) {
            document.title = settings.appTitle || 'Database Pelatihan';
            if (settings.fontFamily) {
                document.body.style.fontFamily = settings.fontFamily;
            }
            
            let link = document.querySelector("link[rel~='icon']");
            if (!link) {
                link = document.createElement('link');
                link.rel = 'icon';
                document.head.appendChild(link);
            }
            
            const faviconUrl = (dark ? settings.logoDark : settings.logoLight) || '/logo/sportunys 2 Hitam.png';
            link.href = faviconUrl;
        }
    }, [settings, dark]);

    return {
        peserta, levels, settings,
        allPublicSettings, publicSettings,
        notFound, loading,
    };
}
