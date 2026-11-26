import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
export default function Popover({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false),
    [pos, setPos] = useState({ left: 0, top: 0 });
  const trigger = useRef<HTMLButtonElement>(null),
    panel = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const r = trigger.current!.getBoundingClientRect();
      const h = panel.current?.offsetHeight ?? 280;
      setPos({
        left: Math.max(12, Math.min(r.right - 280, window.innerWidth - 292)),
        top: r.bottom + h + 12 < window.innerHeight ? r.bottom + 8 : Math.max(12, r.top - h - 8),
      });
    }
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>("button,input,select")?.focus();
    function close(e: PointerEvent) {
      if (
        !panel.current?.contains(e.target as Node) &&
        !trigger.current?.contains(e.target as Node)
      )
        setOpen(false);
    }
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
      if (e.key === "Tab" && panel.current) {
        const nodes = Array.from(
          panel.current.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input,select,[tabindex="0"]',
          ),
        );
        const first = nodes[0],
          last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <>
      <button
        ref={trigger}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <span aria-hidden="true">⌄</span>
      </button>
      {open &&
        createPortal(
          <div
            className="workspace-popover"
            role="dialog"
            aria-label={label}
            ref={panel}
            style={pos}
          >
            {children}
            <button
              className="popover-close"
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              Close
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
