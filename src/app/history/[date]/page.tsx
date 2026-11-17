import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Dateline } from "@/components/Dateline";
import { RateBoard } from "@/components/RateBoard";
import { SheetProblem } from "@/components/SheetProblem";
import { StickyDate } from "@/components/StickyDate";
import { rateCount } from "@/lib/format";
import { getRateBook } from "@/lib/sheet";

type PageProps = {
  params: Promise<{ date: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { date } = await params;
  try {
    const book = await getRateBook();
    const day = book.days.find((entry) => entry.id === date);
    return { title: day ? day.displayDate : "Rate History" };
  } catch {
    return { title: "Rate History" };
  }
}

export default async function HistoryDayPage({ params }: PageProps) {
  const { date } = await params;
  let book;
  try {
    book = await getRateBook();
  } catch {
    return <SheetProblem />;
  }

  const index = book.days.findIndex((entry) => entry.id === date);
  const day = book.days[index];
  if (!day) notFound();

  const previous = book.days[index + 1];
  const meta = [day.weekday, `${rateCount(day.categories)} rates`].filter(Boolean).join(" · ");

  return (
    <main className="wrap">
      <Dateline
        eyebrow="Previous Rates"
        date={day.displayDate}
        meta={meta}
        action={{ href: "/history", label: "All Dates" }}
      />
      <StickyDate label={day.displayDate} />
      <RateBoard categories={day.categories} previous={previous?.categories} />
    </main>
  );
}
