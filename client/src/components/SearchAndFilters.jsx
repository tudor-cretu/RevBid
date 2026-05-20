import { useState, useMemo, useRef, useCallback } from 'react';

/* ─── Constante ─────────────────────────────────────────────────────── */
export const CATEGORIES = [
  'IT', 'Constructii', 'Transport', 'Servicii', 'Produse',
  'Auto', 'Electronice', 'Mobilier', 'Alimentar', 'Altele',
];

const DEADLINE_OPTIONS = [
  { value: 'all',    label: 'Toate' },
  { value: 'today',  label: 'Azi' },
  { value: '7days',  label: 'Urm. 7 zile' },
  { value: '30days', label: 'Urm. 30 zile' },
  { value: 'expired',label: 'Expirate' },
];

const SORT_OPTIONS = [
  { value: 'newest',       label: 'Cele mai noi' },
  { value: 'deadline_asc', label: 'Deadline (aproape)' },
  { value: 'price_asc',    label: 'Preț crescător' },
  { value: 'price_desc',   label: 'Preț descrescător' },
];

/* ─── Hook ──────────────────────────────────────────────────────────── */
export function useAuctionFilters(auctions = []) {
  const [searchRaw,           setSearchRaw]           = useState('');
  const [debouncedSearch,     setDebouncedSearch]     = useState('');
  const [selectedCategories,  setSelectedCategories]  = useState([]);
  const [minPrice,            setMinPrice]             = useState('');
  const [maxPrice,            setMaxPrice]             = useState('');
  const [locationQ,           setLocationQ]            = useState('');
  const [deadline,            setDeadline]             = useState('all');
  const [sortBy,              setSortBy]               = useState('newest');
  const [mobileOpen,          setMobileOpen]           = useState(false);
  const debounceRef = useRef(null);

  /* Debounce search */
  const setSearch = useCallback((val) => {
    setSearchRaw(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(val), 300);
  }, []);

  /* Toggle categorie */
  const toggleCategory = useCallback((cat) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  }, []);

  /* Filtrare + sortare */
  const filtered = useMemo(() => {
    let result = [...auctions];

    /* text search */
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(a =>
        a.title?.toLowerCase().includes(q) ||
        a.description?.toLowerCase().includes(q) ||
        a.category?.toLowerCase().includes(q) ||
        a.tags?.some(t => t.toLowerCase().includes(q)) ||
        a.location?.city?.toLowerCase().includes(q) ||
        a.location?.address?.toLowerCase().includes(q) ||
        a.buyer?.companyName?.toLowerCase().includes(q) ||
        a.buyer?.firstName?.toLowerCase().includes(q)
      );
    }

    /* categorie */
    if (selectedCategories.length > 0) {
      result = result.filter(a => selectedCategories.includes(a.category));
    }

    /* preț */
    if (minPrice !== '') {
      const min = parseFloat(minPrice);
      if (!isNaN(min)) result = result.filter(a => (a.currentPrice ?? a.startPrice) >= min);
    }
    if (maxPrice !== '') {
      const max = parseFloat(maxPrice);
      if (!isNaN(max)) result = result.filter(a => (a.currentPrice ?? a.startPrice) <= max);
    }

    /* locație */
    if (locationQ.trim()) {
      const loc = locationQ.toLowerCase();
      result = result.filter(a =>
        a.location?.city?.toLowerCase().includes(loc) ||
        a.location?.address?.toLowerCase().includes(loc)
      );
    }

    /* deadline */
    const now = new Date();
    if (deadline === 'today') {
      const endDay = new Date(now); endDay.setHours(23, 59, 59, 999);
      result = result.filter(a => a.deadline && new Date(a.deadline) > now && new Date(a.deadline) <= endDay);
    } else if (deadline === '7days') {
      const in7 = new Date(now); in7.setDate(in7.getDate() + 7);
      result = result.filter(a => a.deadline && new Date(a.deadline) > now && new Date(a.deadline) <= in7);
    } else if (deadline === '30days') {
      const in30 = new Date(now); in30.setDate(in30.getDate() + 30);
      result = result.filter(a => a.deadline && new Date(a.deadline) > now && new Date(a.deadline) <= in30);
    } else if (deadline === 'expired') {
      result = result.filter(a => a.deadline && new Date(a.deadline) <= now);
    }

    /* sortare */
    result.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortBy === 'deadline_asc') {
        if (!a.deadline) return 1; if (!b.deadline) return -1;
        return new Date(a.deadline) - new Date(b.deadline);
      }
      if (sortBy === 'price_asc')  return (a.currentPrice ?? a.startPrice) - (b.currentPrice ?? b.startPrice);
      if (sortBy === 'price_desc') return (b.currentPrice ?? b.startPrice) - (a.currentPrice ?? a.startPrice);
      return 0;
    });

    return result;
  }, [auctions, debouncedSearch, selectedCategories, minPrice, maxPrice, locationQ, deadline, sortBy]);

  /* Filtre active */
  const activeChips = useMemo(() => {
    const chips = [];
    if (debouncedSearch.trim()) chips.push({ key: 'search',   label: `"${debouncedSearch.trim()}"`, onRemove: () => setSearch('') });
    selectedCategories.forEach(cat =>
      chips.push({ key: `cat-${cat}`, label: cat, onRemove: () => toggleCategory(cat) })
    );
    if (minPrice !== '' && maxPrice !== '') chips.push({ key: 'price', label: `${fmt(minPrice)} – ${fmt(maxPrice)} RON`, onRemove: () => { setMinPrice(''); setMaxPrice(''); } });
    else if (minPrice !== '') chips.push({ key: 'minPrice', label: `Min ${fmt(minPrice)} RON`, onRemove: () => setMinPrice('') });
    else if (maxPrice !== '') chips.push({ key: 'maxPrice', label: `Max ${fmt(maxPrice)} RON`, onRemove: () => setMaxPrice('') });
    if (locationQ.trim()) chips.push({ key: 'loc',  label: `📍 ${locationQ}`, onRemove: () => setLocationQ('') });
    if (deadline !== 'all') chips.push({ key: 'dl', label: DEADLINE_OPTIONS.find(o => o.value === deadline)?.label, onRemove: () => setDeadline('all') });
    return chips;
  }, [debouncedSearch, selectedCategories, minPrice, maxPrice, locationQ, deadline]);

  const clearAll = useCallback(() => {
    setSearch(''); setDebouncedSearch('');
    setSelectedCategories([]); setMinPrice(''); setMaxPrice('');
    setLocationQ(''); setDeadline('all'); setSortBy('newest');
  }, [setSearch]);

  return {
    searchRaw, setSearch,
    selectedCategories, toggleCategory,
    minPrice, setMinPrice,
    maxPrice, setMaxPrice,
    locationQ, setLocationQ,
    deadline, setDeadline,
    sortBy, setSortBy,
    mobileOpen, setMobileOpen,
    filtered, activeChips, clearAll,
  };
}

/* ─── Helpers ───────────────────────────────────────────────────────── */
function fmt(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return val;
  return n.toLocaleString('ro-RO');
}

/* ─── Componenta FilterBar ──────────────────────────────────────────── */
export default function FilterBar({ filters, total, availableCategories }) {
  const {
    searchRaw, setSearch,
    selectedCategories, toggleCategory,
    minPrice, setMinPrice,
    maxPrice, setMaxPrice,
    locationQ, setLocationQ,
    deadline, setDeadline,
    sortBy, setSortBy,
    filtered, activeChips, clearAll,
  } = filters;

  const cats = availableCategories?.length ? availableCategories : CATEGORIES;
  const [priceError, setPriceError] = useState('');
  const [open, setOpen]             = useState(false);

  /* Validare min/max */
  const handleMinPrice = (v) => {
    setMinPrice(v);
    if (v !== '' && maxPrice !== '' && parseFloat(v) > parseFloat(maxPrice))
      setPriceError('Suma minimă nu poate depăși suma maximă');
    else setPriceError('');
  };
  const handleMaxPrice = (v) => {
    setMaxPrice(v);
    if (minPrice !== '' && v !== '' && parseFloat(minPrice) > parseFloat(v))
      setPriceError('Suma minimă nu poate depăși suma maximă');
    else setPriceError('');
  };

  const handleReset = () => { clearAll(); setPriceError(''); };

  return (
    <div className="sf-bar">

      {/* ── Toolbar ── */}
      <div className="sf-toolbar">
        <div className="sf-search-wrap">
          <svg className="sf-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            className="sf-search-input"
            type="text"
            placeholder="Caută după titlu, descriere, categorie, locație..."
            value={searchRaw}
            onChange={e => setSearch(e.target.value)}
            aria-label="Caută licitații"
          />
          {searchRaw && (
            <button className="sf-search-clear" onClick={() => setSearch('')} aria-label="Șterge căutarea">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>

        {/* Toggle panel filtre */}
        <button className={`sf-filter-toggle ${open ? 'active' : ''}`} onClick={() => setOpen(o => !o)} aria-expanded={open}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/>
            <line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/>
            <line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>
            <line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>
          </svg>
          <span>Filtre</span>
          {activeChips.length > 0 && <span className="sf-toggle-badge">{activeChips.length}</span>}
          <svg className={`sf-chevron ${open ? 'up' : ''}`} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {/* Sort */}
        <div className="sf-sort-wrap">
          <span className="sf-sort-label">Sortează</span>
          <select className="sf-select" value={sortBy} onChange={e => setSortBy(e.target.value)} aria-label="Sortare">
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* ── Panel colapsabil ── */}
      {open && (
        <div className="sf-panel">
          {/* Categorie */}
          <div className="sf-filter-group">
            <span className="sf-filter-label">Categorie</span>
            <div className="sf-cat-chips">
              {cats.map(cat => (
                <button
                  key={cat}
                  className={`sf-cat-chip ${selectedCategories.includes(cat) ? 'active' : ''}`}
                  onClick={() => toggleCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="sf-panel-row">
            {/* Preț */}
            <div className="sf-filter-group">
              <span className="sf-filter-label">Preț (RON)</span>
              <div className="sf-price-inputs">
                <input
                  className={`sf-input sf-price-input ${priceError ? 'error' : ''}`}
                  type="number" min="0" placeholder="Min"
                  value={minPrice} onChange={e => handleMinPrice(e.target.value)}
                />
                <span className="sf-price-sep">—</span>
                <input
                  className={`sf-input sf-price-input ${priceError ? 'error' : ''}`}
                  type="number" min="0" placeholder="Max"
                  value={maxPrice} onChange={e => handleMaxPrice(e.target.value)}
                />
                {(minPrice || maxPrice) && (
                  <button className="sf-clear-btn" onClick={() => { setMinPrice(''); setMaxPrice(''); setPriceError(''); }} title="Resetează preț">✕</button>
                )}
              </div>
              {priceError && <span className="sf-price-error">{priceError}</span>}
            </div>

            {/* Locație */}
            <div className="sf-filter-group">
              <span className="sf-filter-label">Locație</span>
              <div className="sf-input-wrap">
                <input
                  className="sf-input"
                  type="text" placeholder="Oraș, județ..."
                  value={locationQ} onChange={e => setLocationQ(e.target.value)}
                />
                {locationQ && (
                  <button className="sf-clear-btn" onClick={() => setLocationQ('')} title="Resetează locație">✕</button>
                )}
              </div>
            </div>

            {/* Deadline */}
            <div className="sf-filter-group">
              <span className="sf-filter-label">Deadline</span>
              <div className="sf-deadline-pills">
                {DEADLINE_OPTIONS.map(o => (
                  <button
                    key={o.value}
                    className={`sf-deadline-pill ${deadline === o.value ? 'active' : ''}`}
                    onClick={() => setDeadline(o.value)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Summary: chips active + count ── */}
      {(activeChips.length > 0 || total !== undefined) && (
        <div className="sf-summary">
          {activeChips.length > 0 ? (
            <div className="sf-chips">
              {activeChips.map(chip => (
                <span key={chip.key} className="sf-active-chip">
                  {chip.label}
                  <button className="sf-chip-remove" onClick={chip.onRemove} aria-label={`Elimină filtrul ${chip.label}`}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12"/></svg>
                  </button>
                </span>
              ))}
              <button className="sf-reset" onClick={handleReset}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                </svg>
                Resetează filtrele
              </button>
            </div>
          ) : (
            <span className="sf-no-filters">Niciun filtru activ</span>
          )}
          {total !== undefined && (
            <span className="sf-count">
              {filtered.length === total
                ? <><strong>{total}</strong> licitații</>
                : <><strong>{filtered.length}</strong> din {total} licitații</>}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
