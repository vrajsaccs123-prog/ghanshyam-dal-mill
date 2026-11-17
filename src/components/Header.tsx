"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/", label: "Today's Rates" },
  { href: "/history", label: "Rate History" },
];

export function Header() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

  useEffect(() => {
    const stored = document.documentElement.getAttribute("data-theme");
    if (stored === "light" || stored === "dark") setTheme(stored);
  }, []);

  function toggleTheme() {
    const current =
      theme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : theme;
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    setTheme(next);
  }

  return (
    <header className="masthead">
      <button
        type="button"
        className="theme-toggle"
        aria-label="Switch between light and dark mode"
        onClick={toggleTheme}
      >
        <svg className="theme-moon" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M21 14.5A8.5 8.5 0 0 1 9.5 3a7 7 0 1 0 11.5 11.5z"
          />
        </svg>
        <svg className="theme-sun" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4" fill="currentColor" />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.1 5.1l1.6 1.6M17.3 17.3l1.6 1.6M18.9 5.1l-1.6 1.6M6.7 17.3l-1.6 1.6"
          />
        </svg>
      </button>
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
