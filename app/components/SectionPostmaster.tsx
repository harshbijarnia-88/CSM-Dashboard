"use client";

import { useEffect } from "react";

// Lives inside the iframe. Measures every `[data-section]` element on the page
// and posts their absolute offsetTop + height to the parent window, plus the
// full document height. The parent (revenue-os BookOfBusinessFrame) uses this
// to:
//   1. resize the iframe to its content height (no internal scroll), and
//   2. light up the correct chip in its scroll-tracking navigator.
export function SectionPostmaster() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    function snapshot() {
      const els = Array.from(
        document.querySelectorAll<HTMLElement>("[data-section]"),
      );
      const sections = els.map((el) => ({
        id: el.dataset.section ?? "",
        top: el.offsetTop,
        height: el.offsetHeight,
      }));
      const totalHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
      );
      try {
        window.parent?.postMessage(
          { type: "csm-bob:layout", sections, totalHeight },
          "*",
        );
      } catch {
        /* parent isn't ours / cross-origin denied — silently ignore */
      }
    }
    // Initial + on next frame (covers content paint).
    snapshot();
    const r = requestAnimationFrame(snapshot);
    // Re-measure when content reflows.
    const ro = new ResizeObserver(snapshot);
    ro.observe(document.body);
    window.addEventListener("resize", snapshot);
    // Periodic safety net for client-driven content changes (filter toggles,
    // sort, etc.) that don't trigger a body resize.
    const interval = window.setInterval(snapshot, 1500);
    return () => {
      cancelAnimationFrame(r);
      ro.disconnect();
      window.removeEventListener("resize", snapshot);
      window.clearInterval(interval);
    };
  }, []);
  return null;
}
