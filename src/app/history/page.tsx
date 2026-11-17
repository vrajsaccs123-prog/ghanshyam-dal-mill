import type { Metadata } from "next";
import Link from "next/link";
import { Dateline } from "@/components/Dateline";
import { SheetProblem } from "@/components/SheetProblem";
import { rateCount } from "@/lib/format";
import { getRateBook } from "@/lib/sheet";

export const metadata: Metadata = { title: "Rate History" };

export default async function HistoryPage() {
  let book;
  try {
    book = await getRateBook();
  } catch {
    return <SheetProblem />;
  }

  return (
    <main className="wrap">
      <Dateline
        eyebrow="Rate History"
        date="Previous lists"
        meta="Each date column on the mill sheet stays available here."
      />
      <ul className="daylist">
        {book.days.map((day, index) => (
          <li key={day.id}>
            <Link href={index === 0 ? "/" : `/history/${day.id}`}>
              <span className="daylist-date">{day.displayDate}</span>
              <span className="daylist-meta">
                {[day.weekday, index === 0 ? "Current" : `${rateCount(day.categories)} rates`]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <span className="daylist-go" aria-hidden="true">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {book.days.length < 2 ? (
        <p className="lede">Earlier dates appear here when the next rate column is added.</p>
      ) : null}
    </main>
  );
}
