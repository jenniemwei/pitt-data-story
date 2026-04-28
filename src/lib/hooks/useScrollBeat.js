"use client";

import { useCallback, useState } from "react";
import useScrollama from "../scrollama/useScrollama";

/**
 * Tracks which story beat is active using scrollama.
 *
 * @param {React.RefObject} storyContainerRef  Ref to the element that
 *   wraps all beat sections. Every direct child section must carry the
 *   `data-story-beat` attribute so scrollama can find it.
 *
 * @returns {{ activeBeat: number, beatProgress: number }}
 *   activeBeat  — zero-based index of the beat currently crossing the
 *                 trigger line (default: 0).
 *   beatProgress — intersection ratio of the active beat (0–1); only
 *                  populated when scrollama reports it.
 */
export default function useScrollBeat(storyContainerRef) {
  const [activeBeat, setActiveBeat] = useState(0);
  const [beatProgress, setBeatProgress] = useState(0);

  const onStepEnter = useCallback(({ index, progress }) => {
    setActiveBeat(index);
    if (progress != null) setBeatProgress(progress);
  }, []);

  useScrollama({
    parentRef: storyContainerRef,
    stepSelector: "[data-story-beat]",
    onStepEnter,
    offset: 0.4,
  });

  return { activeBeat, beatProgress };
}
