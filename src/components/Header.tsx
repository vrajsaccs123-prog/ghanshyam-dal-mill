"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Today's Rates" },
  { href: "/history", label: "Rate History" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="masthead">
      <div className="wrap masthead-inner">
        <h1 className="wordmark">Ghanshyam Dal Mill</h1>
        <div className="wordmark-rule" />
      </div>
      <div className="masthead-bar">
        <div className="wrap">
          <nav className="masthead-nav" aria-label="Sections">
            {LINKS.map((link) => {
              const on =
                link.href === "/"
                  ? pathname === "/"
                  : pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={on ? "nav-link is-on" : "nav-link"}
                  aria-current={on ? "page" : undefined}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
