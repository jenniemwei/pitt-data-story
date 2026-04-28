"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Nav.module.css";

export default function Nav() {
  const pathname = usePathname();
  const onExplore = pathname?.startsWith("/explore");

  return (
    <nav className={styles.wrap} aria-label="Story mode navigation">
      <div className={styles.pill}>
        <Link
          href="/"
          className={`${styles.item} ${!onExplore ? styles.itemActive : ""} type-body`}
          aria-current={!onExplore ? "page" : undefined}
        >
          Guided
        </Link>
        <Link
          href="/explore"
          className={`${styles.item} ${onExplore ? styles.itemActive : ""} type-body`}
          aria-current={onExplore ? "page" : undefined}
        >
          Explore
        </Link>
      </div>
    </nav>
  );
}
