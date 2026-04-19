"use client";

import { useLayoutEffect, useState } from "react";

/**
 * Maps vertical scroll through a tall pin wrapper to 0–1 progress.
 * Progress is 0 when the pin block top aligns with the viewport top, and 1 after
 * scrolling (pinOuter.offsetHeight - window.innerHeight) pixels.
 * @param {{ current: HTMLElement | null }} pinOuterRef
 */
export function useVerticalPinScrub(pinOuterRef) {
  const [progress, setProgress] = useState(0);

  useLayoutEffect(() => {
    const tick = () => {
      const el = pinOuterRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const st = window.scrollY || document.documentElement.scrollTop;
      const pinTopDoc = rect.top + st;
      const vh = window.innerHeight;
      const denom = Math.max(1, el.offsetHeight - vh);
      const p = (st - pinTopDoc) / denom;
      setProgress(Math.min(1, Math.max(0, p)));
    };

    tick();
    window.addEventListener("scroll", tick, { passive: true });
    window.addEventListener("resize", tick);
    const el = pinOuterRef.current;
    const ro = el ? new ResizeObserver(tick) : null;
    if (el && ro) ro.observe(el);
    return () => {
      window.removeEventListener("scroll", tick);
      window.removeEventListener("resize", tick);
      ro?.disconnect();
    };
  }, [pinOuterRef]);

  return progress;
}
