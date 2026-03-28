import React, { useMemo } from 'react';
import './CustomSelect.css';

export default function CustomSelect({
    value,
    onChange,
    options = [],
    placeholder = "Pilih...",
    disabled = false,
    className = "",
    id,
    style,
}) {
    // Normalize: accept both string arrays and {value, label} objects
    const normalizedOptions = useMemo(() => {
        const result = [];
        options.forEach(opt => {
            if (typeof opt === 'string') {
                result.push({ value: opt, label: opt });
            } else if (opt.group && Array.isArray(opt.items)) {
                // Grouped options
                opt.items.forEach(item => {
                    const normalized = typeof item === 'string'
                        ? { value: item, label: item, group: opt.group }
                        : { ...item, group: opt.group };
                    result.push(normalized);
                });
            } else {
                result.push(opt);
            }
        });
        return result;
    }, [options]);

    // Group detection for optgroup rendering
    const hasGroups = useMemo(() => {
        return normalizedOptions.some(opt => opt.group);
    }, [normalizedOptions]);

    const groupedOptions = useMemo(() => {
        if (!hasGroups) return null;
        const groups = {};
        const ungrouped = [];
        normalizedOptions.forEach(opt => {
            if (opt.group) {
                if (!groups[opt.group]) groups[opt.group] = [];
                groups[opt.group].push(opt);
            } else {
                ungrouped.push(opt);
            }
        });
        return { ungrouped, groups };
    }, [normalizedOptions, hasGroups]);

    const handleChange = (e) => {
        if (onChange) onChange(e.target.value);
    };

    const selectedOption = normalizedOptions.find(opt => String(opt.value) === String(value));
    const hasValue = selectedOption !== undefined;

    return (
        <div className={`modern-select-wrapper ${disabled ? 'disabled' : ''} ${className}`} id={id} style={style}>
            <select
                className={`modern-select ${hasValue ? 'has-value' : ''}`}
                value={value ?? ''}
                onChange={handleChange}
                disabled={disabled}
            >
                {!hasValue && (
                    <option value="" disabled hidden>{placeholder}</option>
                )}
                {hasGroups && groupedOptions ? (
                    <>
                        {groupedOptions.ungrouped.map((opt, i) => (
                            <option key={`ug-${opt.value}-${i}`} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                        {Object.entries(groupedOptions.groups).map(([groupName, items]) => (
                            <optgroup key={groupName} label={groupName}>
                                {items.map((item, i) => (
                                    <option key={`${groupName}-${item.value}-${i}`} value={item.value}>
                                        {item.label}
                                    </option>
                                ))}
                            </optgroup>
                        ))}
                    </>
                ) : (
                    normalizedOptions.map((opt, i) => (
                        <option key={`${opt.value}-${i}`} value={opt.value}>
                            {opt.label}
                        </option>
                    ))
                )}
            </select>
            <div className="modern-select-chevron">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </div>
        </div>
    );
}
