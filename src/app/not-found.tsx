import Link from "next/link";

export default function NotFound() {
  return (
    <main className="wrap">
      <div className="dateline">
        <span className="eyebrow">Missing</span>
        <span className="dateline-date">That rate list is not on the sheet</span>
        <div className="dateline-actions">
          <Link className="textlink" href="/">
            Today&apos;s Rates
          </Link>
        </div>
      </div>
    </main>
  );
}
