"use client";

import { useEffect, useRef } from "react";
import scrollama from "scrollama";

/**
 * Scrollama finds steps with `step` inside `parent` (defaults to document).
 * Use for step-index / in-view narrative triggers — not for pinning a column
 * (use position fixed/sticky for that).
 */
export default function useScrollama({
  parentRef,
  stepSelector = "[data-step]",
  onStepEnter,
  onStepExit,
  offset = 0.5,
  /** If set, scroll is read from this element; otherwise the window. */
  scrollContainerRef = null,
}) {
  const enterRef = useRef(onStepEnter);
  const exitRef = useRef(onStepExit);
  enterRef.current = onStepEnter;
  exitRef.current = onStepExit;

  useEffect(() => {
    const el = parentRef?.current;
    if (!el) return;

    const scroller = scrollama();
    scroller
      .setup({
        step: stepSelector,
        parent: el,
        offset,
        container: scrollContainerRef?.current ?? undefined,
      })
      .onStepEnter((response) => {
        enterRef.current?.(response);
      })
      .onStepExit((response) => {
        exitRef.current?.(response);
      });

    const onResize = () => scroller.resize();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      scroller.destroy();
    };
  }, [parentRef, stepSelector, offset, scrollContainerRef]);
}
