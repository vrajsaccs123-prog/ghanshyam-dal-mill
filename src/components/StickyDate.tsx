"use client";

import { useEffect, useState } from "react";

export function StickyDate({ label }: { label: string }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const dateline = document.querySelector(".dateline");
    if (!dateline) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = !entry.isIntersecting;
        setShown(visible);
        const bar = document.querySelector(".stickybar");
        const height = bar ? Math.ceil(bar.getBoundingClientRect().height) : 38;
        document.documentElement.style.setProperty("--stick", visible ? `${height}px` : "0px");
      },
      { threshold: 0 },
    );
    observer.observe(dateline);
    return () => {
      observer.disconnect();
      document.documentElement.style.setProperty("--stick", "0px");
    };
  }, []);

  return (
    <div className={shown ? "stickybar is-shown" : "stickybar"} aria-hidden={!shown}>
      <span>{label}</span>
    </div>
  );
}
