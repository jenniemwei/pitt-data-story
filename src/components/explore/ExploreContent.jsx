"use client";

import { useEffect, useRef, useState } from "react";
import CoverageMap from "../coverage-map/CoverageMap";
import RadialNetworkMapView from "../route-web/RadialNetworkMapView";
import styles from "./ExploreDashboard.module.css";

export default function ExploreContent() {
  const [activePanel, setActivePanel] = useState(0);
  const wrapRef = useRef(null);
  const panelRefs = useRef([]);

  useEffect(() => {
    const panels = panelRefs.current.filter(Boolean);
    if (!panels.length) return undefined;
    let raf = 0;
    const updateActiveFromViewport = () => {
      const viewportMid = window.innerHeight / 2;
      let bestIdx = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let i = 0; i < panels.length; i += 1) {
        const rect = panels[i].getBoundingClientRect();
        const panelMid = rect.top + rect.height / 2;
        const distance = Math.abs(panelMid - viewportMid);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIdx = i;
        }
      }
      setActivePanel(bestIdx);
      raf = 0;
    };
    const onScrollOrResize = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(updateActiveFromViewport);
    };
    updateActiveFromViewport();
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    const wrap = wrapRef.current;
    wrap?.addEventListener("scroll", onScrollOrResize, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      wrap?.removeEventListener("scroll", onScrollOrResize);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  const jumpToPanel = (index) => {
    const panel = panelRefs.current[index];
    if (!panel) return;
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section ref={wrapRef} className={styles.wrap} aria-label="Explore transit equity dashboard">
      <nav className={styles.progressNav} aria-label="Explore section progress">
        {[0, 1].map((idx) => (
          <button
            key={idx}
            type="button"
            aria-label={`Jump to explore section ${idx + 1}`}
            aria-current={activePanel === idx ? "true" : undefined}
            className={`${styles.progressDot} ${activePanel === idx ? styles.progressDotActive : ""}`}
            onClick={() => jumpToPanel(idx)}
          />
        ))}
      </nav>
      <div
        className={styles.panel}
        data-panel-index="0"
        ref={(el) => {
          panelRefs.current[0] = el;
        }}
      >
        <div className={styles.panelInner}>
          <header className={styles.panelHeader}>
            <h2 className={`${styles.panelTitle} type-h2-sans text-ink-default`}>
              PRT coverage lost after FY26 plan
            </h2>
          </header>
          <div className={styles.coverageSlot}>
            <CoverageMap mode="explore" />
          </div>
        </div>
      </div>

      <div
        className={styles.panel}
        data-panel-index="1"
        ref={(el) => {
          panelRefs.current[1] = el;
        }}
      >
        <div className={styles.panelInner}>
          <header className={styles.panelHeader}>
            <h2 className={`${styles.panelTitle} type-h2-sans text-ink-default`}>
              Bus frequency to Downtown per neighborhood
            </h2>
          </header>
          <div className={styles.routeSlot}>
            <RadialNetworkMapView />
          </div>
        </div>
      </div>
    </section>
  );
}
