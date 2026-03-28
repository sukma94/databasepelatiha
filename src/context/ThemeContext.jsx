import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
    const [dark, setDark] = useState(() => {
        const saved = localStorage.getItem('theme');
        if (saved) return saved === 'dark';
        return false; // default: light mode
    });

    const [textFormat, setTextFormat] = useState(() => {
        return localStorage.getItem('textFormat') || 'none';
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
        localStorage.setItem('theme', dark ? 'dark' : 'light');
    }, [dark]);

    useEffect(() => {
        localStorage.setItem('textFormat', textFormat);
    }, [textFormat]);

    const toggle = () => setDark((d) => !d);

    return (
        <ThemeContext.Provider value={{ dark, toggle, textFormat, setTextFormat }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}
