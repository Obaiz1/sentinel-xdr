"use client";

import { useEffect, useRef, useState } from "react";

export interface DropdownOption {
  value: string;
  label: string;
  /** Full text shown on hover (e.g. the raw interface name) */
  title?: string;
}

interface DropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Fully dark-themed, cyberpunk dropdown / listbox.
 * Replaces the native <select> so the options menu never renders white.
 * - Keyboard accessible (Enter/Space toggle, Esc closes)
 * - Closes on outside click
 * - Long values truncate with ellipsis; full text via title attribute
 */
export default function Dropdown({
  options,
  value,
  onChange,
  placeholder = "Select…",
  disabled = false,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="sx-dropdown" data-open={open}>
      <button
        type="button"
        className="sx-dropdown__trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={selected?.title || selected?.label}
        onClick={() => !disabled && setOpen((o) => !o)}
      >
        <span className="sx-dropdown__value">
          {selected ? selected.label : placeholder}
        </span>
        <span className="sx-dropdown__caret">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <ul className="sx-dropdown__menu" role="listbox">
          {options.length === 0 && (
            <li className="sx-dropdown__empty">No interfaces found</li>
          )}
          {options.map((opt) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              title={opt.title || opt.label}
              className={
                "sx-dropdown__option" +
                (opt.value === value ? " is-active" : "")
              }
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
