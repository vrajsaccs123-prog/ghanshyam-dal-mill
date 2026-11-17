import { Dateline } from "@/components/Dateline";
import { RateBoard } from "@/components/RateBoard";
import { SheetProblem } from "@/components/SheetProblem";
import { StickyDate } from "@/components/StickyDate";
import { formatReadTime } from "@/lib/format";
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
  const meta = [today.weekday, `Sheet read ${formatReadTime(book.fetchedAt)}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="wrap">
      <Dateline
        eyebrow="Latest Rates"
        date={today.displayDate}
        meta={meta}
        note={
          <>
            For more details contact - Ankush Bansal:{" "}
            <a href="tel:+919926778127">+91 9926778127</a>
          </>
        }
      />
      <StickyDate label={today.displayDate} />
      <RateBoard categories={today.categories} previous={previous?.categories} />
    </main>
  );
}
