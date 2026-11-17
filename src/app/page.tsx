import { Dateline } from "@/components/Dateline";
import { RateBoard } from "@/components/RateBoard";
import { SheetProblem } from "@/components/SheetProblem";
import { StickyDate } from "@/components/StickyDate";
import { formatReadTime, rateCount } from "@/lib/format";
import { getRateBook } from "@/lib/sheet";

export default async function HomePage() {
  let book;
  try {
    book = await getRateBook();
  } catch {
    return <SheetProblem />;
  }

  const today = book.days[0];
  const previous = book.days[1];
  const count = rateCount(today.categories);
  const meta = [today.weekday, `${count} rates`, `Sheet read ${formatReadTime(book.fetchedAt)}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="wrap">
      <Dateline
        eyebrow="Latest Rates"
        date={today.displayDate}
        meta={meta}
        action={{ href: "/history", label: "Previous Rates" }}
      />
      <StickyDate label={today.displayDate} />
      <RateBoard categories={today.categories} previous={previous?.categories} />
    </main>
  );
}
