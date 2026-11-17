import type { Metadata } from "next";
import { Dateline } from "@/components/Dateline";

export const metadata: Metadata = { title: "The Mill" };

export default function AboutPage() {
  return (
    <main className="wrap">
      <Dateline
        eyebrow="Ghanshyam Dal Mill"
        date="Daily rates, from the sheet"
        meta="Chana dal, masoor, moong, matar, besan, and daliya."
      />
      <div className="prose">
        <h2>How this list is kept</h2>
        <p>
          Selling rates are taken from the mill’s daily sheet. When the sheet is updated, this
          page follows, usually within a minute.
        </p>
        <p>
          Each line shows the product, brand, and pack size as they are written on the sheet.
          If a rate includes GST, that note is shown under the figure. Older dates stay under
          Rate History.
        </p>
      </div>
    </main>
  );
}
