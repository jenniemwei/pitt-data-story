"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dev", label: "Hub" },
  { href: "/dev/equity-map", label: "Equity map" },
  { href: "/dev/car-ownership", label: "Car ownership chart" },
  { href: "/dev/persona-day", label: "Persona day" },
  { href: "/dev/trip-purpose-proxy", label: "Trip purpose proxy" },
  { href: "/dev/scroll-demographics", label: "Scroll demographics" },
];

export function DevLabNav() {
  const pathname = usePathname() || "";

  return (
    <nav className="dev-lab-nav" aria-label="Dev playground">
      <Link href="/">← App home</Link>
      <span className="dev-lab-nav-sep" aria-hidden>
        |
      </span>
      {LINKS.map(({ href, label }) => {
        const active =
          href === "/dev" ? pathname === "/dev" : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} data-active={active ? "true" : "false"}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
