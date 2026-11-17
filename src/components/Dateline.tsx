import Link from "next/link";

export function Dateline({
  eyebrow,
  date,
  meta,
  action,
}: {
  eyebrow: string;
  date: string;
  meta?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="dateline">
      <span className="eyebrow">{eyebrow}</span>
      <span className="dateline-date">{date}</span>
      {meta ? <span className="dateline-meta">{meta}</span> : null}
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
