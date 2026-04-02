"use client";

import { useEffect } from "react";
import scrollama from "scrollama";

export default function useScrollama({
  containerRef,
  stepSelector,
  onStepEnter,
  onStepExit,
  offset = 0.6,
}) {
  useEffect(() => {
    if (!containerRef?.current) return;

    const scroller = scrollama();
    scroller
      .setup({
        step: `${stepSelector}`,
        container: containerRef.current,
        offset,
      })
      .onStepEnter((response) => {
        onStepEnter?.(response);
      })
      .onStepExit((response) => {
        onStepExit?.(response);
      });

    const onResize = () => scroller.resize();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      scroller.destroy();
    };
  }, [containerRef, stepSelector, onStepEnter, onStepExit, offset]);
}
