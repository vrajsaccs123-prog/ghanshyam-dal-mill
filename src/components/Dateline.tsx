import Link from "next/link";
import type { ReactNode } from "react";

export function Dateline({
  eyebrow,
  date,
  meta,
  note,
  action,
}: {
  eyebrow: string;
  date: string;
  meta?: string;
  note?: ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <div className="dateline">
      <span className="eyebrow">{eyebrow}</span>
      <span className="dateline-date">{date}</span>
      {meta ? <span className="dateline-meta">{meta}</span> : null}
      {note ? <p className="dateline-note">{note}</p> : null}
      {action ? (
        <div className="dateline-actions">
          <Link className="textlink" href={action.href}>
            {action.label}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
