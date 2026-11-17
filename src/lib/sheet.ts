import type { Category, RateBook, RateDay, RateItem } from "./types";

const SHEET_ID = "1Q7O9beVKWP3-_c9dECVgaOyewhzs2n6NqSyO_jIvQKo";
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`;

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

type RawRow = {
  product: string;
  brand: string;
  rates: string[];
};

type DateParts = { year: number; month: number; day: number };

export class SheetReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SheetReadError";
  }
}

export async function getRateBook(): Promise<RateBook> {
  const response = await fetch(`${SHEET_URL}&t=${Date.now()}`, {
    cache: "no-store",
    headers: { Accept: "text/csv" },
  });

  if (!response.ok) {
    throw new SheetReadError(`The rate sheet responded with ${response.status}.`);
  }

  const csv = await response.text();
  if (csv.trimStart().startsWith("<")) {
    throw new SheetReadError("The rate sheet is not publicly readable.");
  }

  const book = parseRateBook(csv, new Date().toISOString());
  if (book.days.length === 0) {
    throw new SheetReadError("The rate sheet has no dated rates yet.");
  }
  return book;
}

/**
 * Sheet layout:
 * - Header row includes "Product", "Brand", then one column per day.
 * - A CAPITALISED row with an empty brand and rate starts a section.
 * - A row with an empty rate groups the lines under it (pack sizes, or named lines).
 * - The rightmost column that contains rates is the latest day.
 * Add each new day as a column to the right of the previous one.
 */
export function parseRateBook(csv: string, fetchedAt: string): RateBook {
  const table = parseCsv(csv);
  let headerIndex = table.findIndex((row) => row.some((cell) => isProductHeader(cell)));
  if (headerIndex < 0) {
    headerIndex = table.findIndex((row) => row.some((cell) => parseDateParts(cell) != null));
  }
  if (headerIndex < 0) return { days: [], fetchedAt };

  const header = table[headerIndex].map((cell) => cell.trim());
  const foundProduct = header.findIndex((cell) => isProductHeader(cell));
  const productCol = foundProduct >= 0 ? foundProduct : 0;
  const foundBrand = header.findIndex((cell) => isBrandHeader(cell));
  const resolvedBrandCol = foundBrand >= 0 ? foundBrand : productCol + 1;
  const openingSection = sectionNameFromProductHeader(header[productCol] ?? "");

  const body = table.slice(headerIndex + 1);
  const dateColumns: number[] = [];

  header.forEach((label, index) => {
    if (index === productCol || index === resolvedBrandCol || !label) return;
    const hasRate = body.some((row) => parseRate(row[index] ?? "").amount != null);
    if (hasRate) dateColumns.push(index);
  });

  const usedIds = new Set<string>();
  const days = dateColumns
    .map((column) =>
      buildDay(
        header[column],
        column,
        body,
        productCol,
        resolvedBrandCol,
        usedIds,
        openingSection,
      ),
    )
    .reverse();

  return { days, fetchedAt };
}

function buildDay(
  label: string,
  column: number,
  body: string[][],
  productCol: number,
  brandCol: number,
  usedIds: Set<string>,
  openingSection: string,
): RateDay {
  const rows: RawRow[] = body.map((row) => ({
    product: (row[productCol] ?? "").trim(),
    brand: (row[brandCol] ?? "").trim(),
    rates: [row[column] ?? ""],
  }));

  const parts = parseDateParts(label);
  return {
    id: uniqueId(slugify(label) || `day-${column}`, usedIds),
    displayDate: parts ? formatDate(parts) : label.trim(),
    weekday: parts ? weekday(parts) : "",
    categories: buildCategories(rows, openingSection),
  };
}

function isProductHeader(cell: string) {
  return /^product\b/i.test(cell.trim());
}

function isBrandHeader(cell: string) {
  return /^brand\b/i.test(cell.trim());
}

function sectionNameFromProductHeader(label: string) {
  return label.replace(/^product\b/i, "").replace(/^[:\-–]+/, "").trim();
}

function buildCategories(rows: RawRow[], openingSection = ""): Category[] {
  const categories: Category[] = [];
  const usedIds = new Set<string>();
  let current: Category | null = null;

  if (openingSection) {
    current = {
      id: uniqueId(slugify(openingSection) || "section", usedIds),
      name: titleCase(openingSection),
      items: [],
    };
    categories.push(current);
  }

  const ensure = () => {
    if (!current) {
      current = { id: uniqueId("rates", usedIds), name: "Rates", items: [] };
      categories.push(current);
    }
    return current;
  };

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rateRaw = (row.rates[0] ?? "").trim();

    if (isSectionHeader(row)) {
      current = {
        id: uniqueId(slugify(row.product) || "section", usedIds),
        name: titleCase(row.product),
        items: [],
      };
      categories.push(current);
      continue;
    }

    if (!row.product && !row.brand && !rateRaw) continue;

    if (!rateRaw && row.product) {
      const category = ensure();
      const next = rows[index + 1];
      if (next && isPackSize(next.product)) {
        let childIndex = index + 1;
        while (childIndex < rows.length) {
          const child = rows[childIndex];
          const childRate = (child.rates[0] ?? "").trim();
          if (!child.product && !child.brand && !childRate) {
            childIndex += 1;
            continue;
          }
          if (!isPackSize(child.product) || !childRate) break;
          category.items.push(
            makeItem(row.product, joinNote([child.product, child.brand || row.brand]), childRate),
          );
          childIndex += 1;
        }
        index = childIndex - 1;
        continue;
      }

      const end = findGroupEnd(rows, index);
      const children = rows.slice(index + 1, end).filter((child) => (child.rates[0] ?? "").trim());
      for (const child of children) {
        category.items.push(
          makeItem(child.product, joinNote([row.product, child.brand || row.brand]), child.rates[0]),
        );
      }
      if (children.length > 0) index = end - 1;
      continue;
    }

    ensure().items.push(makeItem(row.product, row.brand, rateRaw));
  }

  return categories.filter((category) => category.items.length > 0);
}

function findGroupEnd(rows: RawRow[], start: number) {
  let index = start + 1;
  while (index < rows.length) {
    const row = rows[index];
    const rate = (row.rates[0] ?? "").trim();
    if (isSectionHeader(row)) break;
    if (row.product && !rate && !isPackSize(row.product)) break;
    index += 1;
  }
  return index;
}

function makeItem(name: string, note: string, raw: string): RateItem {
  const parsed = parseRate(raw);
  return {
    name,
    note,
    amount: parsed.amount,
    extra: parsed.extra,
  };
}

function isSectionHeader(row: RawRow) {
  const rate = (row.rates[0] ?? "").trim();
  if (!row.product || row.brand || rate) return false;
  const letters = row.product.replace(/[^A-Za-z]/g, "");
  return letters.length > 0 && letters === letters.toUpperCase();
}

function isPackSize(value: string) {
  return /^\d+(\.\d+)?\s*(kg|gm|gms|g)\b/i.test(value.trim());
}

export function parseRate(raw: string): { amount: number | null; extra: string } {
  const text = raw.trim();
  if (!text) return { amount: null, extra: "" };

  const match = text.match(/^([\d][\d,]*(?:\.\d+)?)(?:\s*\/-)?\s*(.*)$/);
  if (!match) return { amount: null, extra: text };

  const amount = Number(match[1].replace(/,/g, ""));
  let extra = match[2].trim().replace(/^\/-\s*/, "");
  if (extra.startsWith("(") && extra.endsWith(")")) extra = extra.slice(1, -1).trim();
  return { amount: Number.isFinite(amount) ? amount : null, extra };
}

function parseDateParts(label: string): DateParts | null {
  const cleaned = label
    .replace(/(\d+)(st|nd|rd|th)/gi, "$1")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  let match = cleaned.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (match) {
    const month = MONTHS.indexOf(match[2].toLowerCase());
    if (month >= 0) return { day: Number(match[1]), month, year: Number(match[3]) };
  }

  match = cleaned.match(/^([A-Za-z]+)\s+(\d{1,2})\s+(\d{4})$/);
  if (match) {
    const month = MONTHS.indexOf(match[1].toLowerCase());
    if (month >= 0) return { day: Number(match[2]), month, year: Number(match[3]) };
  }

  match = cleaned.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (match) {
    return { day: Number(match[1]), month: Number(match[2]) - 1, year: Number(match[3]) };
  }

  return null;
}

function formatDate(parts: DateParts) {
  const month = MONTHS[parts.month];
  return `${parts.day} ${month.charAt(0).toUpperCase()}${month.slice(1)} ${parts.year}`;
}

function weekday(parts: DateParts) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(parts.year, parts.month, parts.day)));
}

function titleCase(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[a-z]+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

function joinNote(parts: string[]) {
  return parts.map((part) => part.trim()).filter(Boolean).join(" · ");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function uniqueId(base: string, used: Set<string>) {
  let id = base;
  let count = 2;
  while (used.has(id)) {
    id = `${base}-${count}`;
    count += 1;
  }
  used.add(id);
  return id;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const source = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}
