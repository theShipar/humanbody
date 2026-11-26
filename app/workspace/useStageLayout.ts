import { useLayoutEffect, useState, type RefObject } from "react";
export interface StageLayout {
  insets: { left: number; right: number; top: number; bottom: number };
  exclusions: { x: number; y: number; width: number; height: number }[];
}
export function useStageLayout(root: RefObject<HTMLDivElement | null>) {
  const [layout, setLayout] = useState<StageLayout>({
    insets: { left: 24, right: 24, top: 128, bottom: 100 },
    exclusions: [],
  });
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    let raf = 0;
    const observed = new Set<Element>();
    const resize = new ResizeObserver(schedule);
    const mutation = new MutationObserver(schedule);
    function schedule() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    }
    function measure() {
      const scene = el!.querySelector(".scene")?.getBoundingClientRect();
      if (!scene) return;
      const small = window.innerWidth < 900 || window.innerHeight <= 600;
      const nodes = el!.querySelectorAll(
        "[data-layout],.learning-panel,.context-inspector,.clinical-panel,.scenario-player,.viewer-dock-wrap",
      );
      const exclusions: StageLayout["exclusions"] = [];
      let top = small ? 20 : 24,
        left = 24,
        right = 24,
        bottom = small ? 82 : 90;
      nodes.forEach((n) => {
        if (!observed.has(n)) {
          resize.observe(n);
          observed.add(n);
        }
        const style = getComputedStyle(n),
          r = n.getBoundingClientRect();
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          !r.width ||
          !r.height ||
          r.bottom < scene.top ||
          r.top > scene.bottom
        )
          return;
        const box = {
          x: r.left - scene.left,
          y: r.top - scene.top,
          width: r.width,
          height: r.height,
        };
        exclusions.push(box);
        if (
          !small &&
          n.matches('[data-layout="header"],[data-layout="context"],[data-layout="notice"]')
        )
          top = Math.max(top, r.bottom - scene.top + 20);
        if (!small && n.matches(".learning-panel,.context-inspector,.clinical-panel")) {
          if (r.left < scene.left + scene.width / 3)
            left = Math.max(left, r.right - scene.left + 24);
          else right = Math.max(right, scene.right - r.left + 24);
        }
        if (n.matches(".viewer-dock-wrap"))
          el!.style.setProperty("--dock-height", `${r.height + 12}px`);
        if (n.matches(".scenario-player,.viewer-dock-wrap")) {
          if (r.top < scene.top + scene.height / 2 && !small)
            top = Math.max(top, r.bottom - scene.top + 16);
          else bottom = Math.max(bottom, scene.bottom - r.top + 16);
        }
      });
      const next = {
        insets: { left: small ? 16 : left, right: small ? 16 : right, top, bottom },
        exclusions,
      };
      setLayout((old) => (JSON.stringify(old) === JSON.stringify(next) ? old : next));
    }
    resize.observe(el);
    mutation.observe(el, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "hidden", "open"],
    });
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      cancelAnimationFrame(raf);
      resize.disconnect();
      mutation.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [root]);
  return layout;
}
