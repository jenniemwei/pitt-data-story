"use client";

import { useRef } from "react";
import useScrollama from "../../../lib/scrollama/useScrollama";

export default function ScrollScene({ steps = [], onStepEnter, onStepExit, children }) {
  const containerRef = useRef(null);
  const stepSelector = ".scroll-step";

  useScrollama({
    containerRef,
    stepSelector,
    onStepEnter,
    onStepExit,
    offset: 0.6,
  });

  return (
    <section ref={containerRef}>
      {steps.map((step, i) => (
        <div className="scroll-step" data-step-index={i} key={`${step.id || "step"}-${i}`}>
          {step.content}
        </div>
      ))}
      {children}
    </section>
  );
}
