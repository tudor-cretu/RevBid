import { useState, useMemo, useRef, useCallback, useEffect } from 'react';

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
    mobileOpen, setMobileOpen,
    filtered, activeChips, clearAll,
  } = filters;

  const cats = availableCategories?.length ? availableCategories : CATEGORIES;
  const [priceError, setPriceError] = useState('');

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

  return (
    <>
      {/* ── Bara principală ── */}
      <div className="sf-bar">

        {/* Rând 1: search + buton filtre mobile + sort */}
        <div className="sf-top-row">
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

          {/* Buton filtre — mobil */}
          <button className="sf-mobile-btn" onClick={() => setMobileOpen(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>
            </svg>
            Filtre
            {activeChips.length > 0 && (
              <span className="sf-mobile-badge">{activeChips.length}</span>
            )}
          </button>

          {/* Sort — mereu vizibil */}
          <select
            className="sf-select sf-sort"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            aria-label="Sortare"
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Rând 2: filtre desktop ── */}
        <div className="sf-filters-row">

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

          {/* Preț */}
          <div className="sf-filter-group sf-price-group">
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

        {/* Rând 3: chips filtre active + rezultate */}
        {(activeChips.length > 0 || total !== undefined) && (
          <div className="sf-bottom-row">
            {activeChips.length > 0 && (
              <div className="sf-active-chips">
                {activeChips.map(chip => (
                  <span key={chip.key} className="sf-active-chip">
                    {chip.label}
                    <button className="sf-chip-remove" onClick={chip.onRemove} aria-label={`Elimină filtrul ${chip.label}`}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12"/></svg>
                    </button>
                  </span>
                ))}
                <button className="sf-clear-all" onClick={clearAll}>Șterge tot</button>
              </div>
            )}
            {total !== undefined && (
              <span className="sf-results-count">
                {filtered.length === total
                  ? `${total} licitații`
                  : `${filtered.length} din ${total} licitații`}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Drawer mobil ── */}
      {mobileOpen && (
        <MobileDrawer
          filters={filters}
          cats={cats}
          priceError={priceError}
          handleMinPrice={handleMinPrice}
          handleMaxPrice={handleMaxPrice}
          setPriceError={setPriceError}
          onClose={() => setMobileOpen(false)}
        />
      )}
    </>
  );
}

/* ─── Drawer mobil ──────────────────────────────────────────────────── */
function MobileDrawer({ filters, cats, priceError, handleMinPrice, handleMaxPrice, setPriceError, onClose }) {
  const {
    selectedCategories, toggleCategory,
    minPrice, setMinPrice,
    maxPrice, setMaxPrice,
    locationQ, setLocationQ,
    deadline, setDeadline,
    sortBy, setSortBy,
    clearAll,
  } = filters;

  /* Blocăm scroll-ul body când drawer-ul e deschis */
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleClearAll = () => { clearAll(); setPriceError(''); };

  return (
    <div className="sf-drawer-overlay" onClick={onClose}>
      <div className="sf-drawer" onClick={e => e.stopPropagation()}>
        <div className="sf-drawer-header">
          <h3 className="sf-drawer-title">Filtre</h3>
          <button className="sf-drawer-close" onClick={onClose} aria-label="Închide">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="sf-drawer-body">

          {/* Sort */}
          <DrawerSection title="Sortare">
            <select className="sf-select sf-select-full" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </DrawerSection>

          {/* Categorie */}
          <DrawerSection title="Categorie">
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
          </DrawerSection>

          {/* Preț */}
          <DrawerSection title="Preț (RON)">
            <div className="sf-price-inputs">
              <input className={`sf-input sf-price-input ${priceError ? 'error' : ''}`} type="number" min="0" placeholder="Min" value={minPrice} onChange={e => handleMinPrice(e.target.value)} />
              <span className="sf-price-sep">—</span>
              <input className={`sf-input sf-price-input ${priceError ? 'error' : ''}`} type="number" min="0" placeholder="Max" value={maxPrice} onChange={e => handleMaxPrice(e.target.value)} />
            </div>
            {priceError && <span className="sf-price-error">{priceError}</span>}
            {(minPrice || maxPrice) && (
              <button className="sf-text-btn" onClick={() => { setMinPrice(''); setMaxPrice(''); setPriceError(''); }}>Resetează preț</button>
            )}
          </DrawerSection>

          {/* Locație */}
          <DrawerSection title="Locație">
            <div className="sf-input-wrap">
              <input className="sf-input" type="text" placeholder="Oraș, județ, regiune..." value={locationQ} onChange={e => setLocationQ(e.target.value)} />
              {locationQ && <button className="sf-clear-btn" onClick={() => setLocationQ('')}>✕</button>}
            </div>
          </DrawerSection>

          {/* Deadline */}
          <DrawerSection title="Deadline">
            <div className="sf-deadline-pills sf-deadline-pills-wrap">
              {DEADLINE_OPTIONS.map(o => (
                <button key={o.value} className={`sf-deadline-pill ${deadline === o.value ? 'active' : ''}`} onClick={() => setDeadline(o.value)}>
                  {o.label}
                </button>
              ))}
            </div>
          </DrawerSection>
        </div>

        <div className="sf-drawer-footer">
          <button className="btn btn-outline" onClick={handleClearAll}>Șterge tot</button>
          <button className="btn btn-primary" onClick={onClose}>Aplică filtrele</button>
        </div>
      </div>
    </div>
  );
}

function DrawerSection({ title, children }) {
  return (
    <div className="sf-drawer-section">
      <p className="sf-drawer-section-title">{title}</p>
      {children}
    </div>
  );
}
