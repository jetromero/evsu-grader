'use client';

import { useState, useRef, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  label?: string;
  placeholder?: string;
  className?: string;
  error?: string;
  searchable?: boolean;
}

export default function Select({
  value, onChange, options, label, placeholder = 'Select...', className = '', error, searchable,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const uid = useId().replace(/:/g, '');

  useEffect(() => { setMounted(true); }, []);

  // Reset search query when dropdown closes
  useEffect(() => { if (!open) setQ(''); }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      const portal = document.getElementById(`xsp-${uid}`);
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !portal?.contains(e.target as Node)
      ) setOpen(false);
    };
    const handleScroll = (e: Event) => {
      const portal = document.getElementById(`xsp-${uid}`);
      if (portal?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [open, uid]);

  const handleToggle = () => {
    if (open) { setOpen(false); return; }
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setCoords({ top: r.bottom + 4, left: r.left, width: r.width });
    setOpen(true);
  };

  const selected = options.find(o => o.value === value);
  const filtered = searchable && q
    ? options.filter(o =>
        o.label.toLowerCase().includes(q.toLowerCase()) ||
        o.value.toLowerCase().includes(q.toLowerCase())
      )
    : options;

  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-semibold text-text-secondary mb-1.5 tracking-wide uppercase">
          {label}
        </label>
      )}
      <button
        type="button"
        ref={triggerRef}
        onClick={handleToggle}
        className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 border rounded-xl text-sm bg-surface-card transition-all focus:outline-none cursor-pointer ${
          error
            ? 'border-red-300'
            : open
            ? 'border-evsu-maroon ring-2 ring-evsu-maroon/15'
            : 'border-border hover:border-evsu-maroon/40'
        }`}
      >
        <span className={selected ? 'text-text-primary' : 'text-text-muted'}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          size={14}
          className={`text-text-muted flex-shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {open && mounted &&
        createPortal(
          <div
            id={`xsp-${uid}`}
            style={{ position: 'fixed', top: coords.top, left: coords.left, width: coords.width, zIndex: 9999 }}
            className="bg-white border border-border rounded-xl shadow-xl overflow-hidden"
          >
            {searchable && (
              <div className="px-2 pt-2 pb-1">
                <input
                  type="text"
                  autoFocus
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Search..."
                  className="w-full text-sm px-3 py-2 border border-border rounded-lg outline-none focus:border-evsu-maroon"
                  onMouseDown={e => e.stopPropagation()}
                />
              </div>
            )}
            <div className="py-1 max-h-60 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-3.5 py-2.5 text-sm text-text-muted">No results found.</p>
              ) : filtered.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onMouseDown={e => {
                    e.preventDefault();
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm text-left transition-colors cursor-pointer ${
                    opt.value === value
                      ? 'bg-evsu-maroon/5 text-evsu-maroon font-medium'
                      : 'text-text-primary hover:bg-surface'
                  }`}
                >
                  {opt.label}
                  {opt.value === value && <Check size={14} className="text-evsu-maroon flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
