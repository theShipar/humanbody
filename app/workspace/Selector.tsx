import { useId, useRef, useState, useLayoutEffect, useEffect, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
export default function Selector<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  searchable = false,
}: {
  label: string;
  value: T;
  options: readonly { id: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(0),
    [query, setQuery] = useState(""),
    [pos, setPos] = useState({ left: 0, top: 0 });
  const trigger = useRef<HTMLButtonElement>(null),
    panel = useRef<HTMLDivElement>(null),
    list = useRef<HTMLDivElement>(null),
    search = useRef<HTMLInputElement>(null),
    id = useId();
  const matches = options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()));
  function dismiss() {
    setOpen(false);
    trigger.current?.focus();
  }
  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const r = trigger.current!.getBoundingClientRect();
      const h = panel.current?.offsetHeight ?? 180;
      setPos({
        left: Math.max(12, Math.min(r.left, innerWidth - 252)),
        top: r.bottom + h + 8 < innerHeight ? r.bottom + 6 : Math.max(12, r.top - h - 6),
      });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, query]);
  useEffect(() => {
    if (open) (searchable ? search.current : list.current)?.focus();
  }, [open, searchable]);
  useEffect(() => {
    if (!open) return;
    function outside(e: PointerEvent) {
      if (
        !panel.current?.contains(e.target as Node) &&
        !trigger.current?.contains(e.target as Node)
      )
        setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active, open]);
  function key(e: KeyboardEvent) {
    if (e.key === "Escape" || e.key === "Tab") {
      if (e.key === "Escape") e.preventDefault();
      dismiss();
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key) && matches.length) {
      e.preventDefault();
      setActive((n) =>
        e.key === "Home"
          ? 0
          : e.key === "End"
            ? matches.length - 1
            : (n + (e.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length,
      );
    } else if ((e.key === "Enter" || (!searchable && e.key === " ")) && matches[active]) {
      e.preventDefault();
      onChange(matches[active].id);
      dismiss();
    } else if (!searchable && e.key.length === 1) {
      const n = matches.findIndex((o) => o.label.toLowerCase().startsWith(e.key.toLowerCase()));
      if (n >= 0) setActive(n);
    }
  }
  return (
    <>
      <button
        ref={trigger}
        className="selector-trigger"
        disabled={disabled}
        aria-label={`${label}: ${options.find((o) => o.id === value)?.label ?? "Choose"}`}
        aria-haspopup={searchable ? "dialog" : "listbox"}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => {
          setQuery("");
          setActive(
            Math.max(
              0,
              options.findIndex((o) => o.id === value),
            ),
          );
          setOpen(!open);
        }}
      >
        {options.find((o) => o.id === value)?.label ?? "Choose"}
        <ChevronDown size={15} />
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            className="selector-options"
            role={searchable ? "dialog" : undefined}
            aria-label={searchable ? label : undefined}
            style={pos}
            onKeyDown={key}
          >
            {searchable && (
              <input
                ref={search}
                type="search"
                role="combobox"
                aria-label={`Search ${label.toLowerCase()}`}
                aria-expanded={true}
                aria-controls={id}
                aria-activedescendant={matches[active] ? `${id}-${active}` : undefined}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                placeholder="Type to filter…"
              />
            )}
            <div
              ref={list}
              id={id}
              role="listbox"
              aria-label={label}
              tabIndex={searchable ? -1 : 0}
              aria-activedescendant={matches[active] ? `${id}-${active}` : undefined}
            >
              {matches.map((o, i) => (
                <div
                  id={`${id}-${i}`}
                  key={o.id}
                  role="option"
                  aria-selected={value === o.id}
                  className={i === active ? "active" : ""}
                  onPointerMove={() => setActive(i)}
                  onClick={() => {
                    onChange(o.id);
                    dismiss();
                  }}
                >
                  {o.label}
                  {value === o.id && <Check size={16} />}
                </div>
              ))}
            </div>
            {!matches.length && <p>No matching options.</p>}
          </div>,
          document.body,
        )}
    </>
  );
}
