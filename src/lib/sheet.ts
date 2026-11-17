import { inflateRawSync } from "node:zlib";
import type { Category, RateBook, RateDay, RateItem } from "./types";

const SHEET_ID = "1Q7O9beVKWP3-_c9dECVgaOyewhzs2n6NqSyO_jIvQKo";

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
  /** True when the product cell is bold, false when it is not, omitted when unknown. */
  bold?: boolean;
};

export type SheetCell = {
  value: string;
  bold?: boolean;
};

type DateParts = { year: number; month: number; day: number };

export class SheetReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SheetReadError";
  }
}

export async function getRateBook(): Promise<RateBook> {
  const stamp = Date.now();
  // The workbook keeps a word typed into a rate column. A chart CSV blanks that
  // word, and the row then disappears.
  const xlsxUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx&t=${stamp}`;
  const response = await fetch(xlsxUrl, { cache: "no-store" });

  if (!response.ok) {
    throw new SheetReadError(`The rate sheet responded with ${response.status}.`);
  }

  const data = Buffer.from(await response.arrayBuffer());
  if (data.subarray(0, 2).toString() !== "PK") {
    throw new SheetReadError("The rate sheet is not publicly readable.");
  }

  const book = parseWorkbook(data, new Date().toISOString());
  if (book.days.length === 0) {
    throw new SheetReadError("The rate sheet has no dated rates yet.");
  }
  return book;
}

/**
 * Sheet layout:
 * - Header row includes "Product", "Brand", then one column per day.
 * - A bold row with an empty rate is a heading. It is never listed as a product.
 * - A row that is not bold is a product of the heading above it.
 * - A row with an empty rate and pack sizes under it groups those sizes under that product.
 * - A rate cell may be a number or a word. A word is shown as written.
 * - The rightmost column that contains a number or a word is the latest day.
 * Add each new day as a column to the right of the previous one.
 */
export function parseRateBook(csv: string, fetchedAt: string): RateBook {
  const table = parseCsv(csv).map((row) => row.map((value) => ({ value })));
  return parseRateTable(table, fetchedAt);
}

export function parseWorkbook(data: Buffer, fetchedAt: string): RateBook {
  const files = unzip(data);
  const styles = files.get("xl/styles.xml")?.toString("utf8") ?? "";
  const boldStyles = boldStyleIndexes(styles);
  const strings = sharedStrings(files.get("xl/sharedStrings.xml")?.toString("utf8") ?? "");

  const sheets = [...files.entries()]
    .filter(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));

  for (const [, xml] of sheets) {
    const table = parseSheetGrid(xml.toString("utf8"), strings, boldStyles);
    const book = parseRateTable(table, fetchedAt);
    if (book.days.length > 0) return book;
  }

  return { days: [], fetchedAt };
}

export function parseRateTable(table: SheetCell[][], fetchedAt: string): RateBook {
  let headerIndex = table.findIndex((row) => row.some((cell) => isProductHeader(cell.value)));
  if (headerIndex < 0) {
    headerIndex = table.findIndex((row) => row.some((cell) => parseDateParts(cell.value) != null));
  }
  if (headerIndex < 0) return { days: [], fetchedAt };

  const header = table[headerIndex].map((cell) => cell.value.trim());
  const foundProduct = header.findIndex((cell) => isProductHeader(cell));
  const productCol = foundProduct >= 0 ? foundProduct : 0;
  const foundBrand = header.findIndex((cell) => isBrandHeader(cell));
  const resolvedBrandCol = foundBrand >= 0 ? foundBrand : productCol + 1;
  const openingSection = sectionNameFromProductHeader(header[productCol] ?? "");

  const body = table.slice(headerIndex + 1);
  const dateColumns: number[] = [];

  header.forEach((label, index) => {
    if (index === productCol || index === resolvedBrandCol || !label) return;
    const hasRate = body.some((row) => (row[index]?.value ?? "").trim());
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
  body: SheetCell[][],
  productCol: number,
  brandCol: number,
  usedIds: Set<string>,
  openingSection: string,
): RateDay {
  const rows: RawRow[] = body.map((row) => ({
    product: (row[productCol]?.value ?? "").trim(),
    brand: (row[brandCol]?.value ?? "").trim(),
    rates: [row[column]?.value ?? ""],
    bold: row[productCol]?.bold,
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

    if (isHeadingRow(row, rows, index)) {
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
      const next = rows[index + 1];
      if (next && isPackSize(next.product)) {
        const category = ensure();
        let childIndex = index + 1;
        let consumed = 0;
        while (childIndex < rows.length) {
          const child = rows[childIndex];
          if (isHeadingRow(child, rows, childIndex)) break;
          const childRate = (child.rates[0] ?? "").trim();
          if (!child.product && !child.brand && !childRate) {
            childIndex += 1;
            continue;
          }
          if (!isPackSize(child.product) || !childRate) break;
          category.items.push(
            makeItem(row.product, joinNote([child.product, child.brand || row.brand]), childRate),
          );
          consumed += 1;
          childIndex += 1;
        }
        if (consumed > 0) {
          index = childIndex - 1;
          continue;
        }
      }

      const category = ensure();
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
    if (isHeadingRow(row, rows, index)) break;
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

function isHeadingRow(row: RawRow, rows: RawRow[], index: number) {
  const rate = (row.rates[0] ?? "").trim();
  if (!row.product || rate) return false;

  // Bold is how a heading is marked in the sheet. A bold label is a heading
  // even when the next lines are pack sizes, and that label is not also a product.
  // A cell that is not bold is a product of the heading above it.
  if (row.bold === true) return true;
  if (row.bold === false) return false;

  const letters = row.product.replace(/[^A-Za-z]/g, "");
  const allCaps = letters.length > 0 && letters === letters.toUpperCase();
  if (allCaps && !row.brand) return true;
  if (row.brand) return false;
  const next = rows[index + 1];
  if (next && isPackSize(next.product)) return false;
  return true;
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

function unzip(data: Buffer) {
  const eocdSig = 0x06054b50;
  let eocd = data.length - 22;
  const min = Math.max(0, data.length - 22 - 65535);
  while (eocd >= min && data.readUInt32LE(eocd) !== eocdSig) eocd -= 1;
  if (eocd < min) throw new SheetReadError("The rate sheet could not be read.");

  const count = data.readUInt16LE(eocd + 10);
  let offset = data.readUInt32LE(eocd + 16);
  const files = new Map<string, Buffer>();

  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > data.length || data.readUInt32LE(offset) !== 0x02014b50) {
      throw new SheetReadError("The rate sheet could not be read.");
    }
    const method = data.readUInt16LE(offset + 10);
    const compSize = data.readUInt32LE(offset + 20);
    const nameLen = data.readUInt16LE(offset + 28);
    const extraLen = data.readUInt16LE(offset + 30);
    const commentLen = data.readUInt16LE(offset + 32);
    const localOffset = data.readUInt32LE(offset + 42);
    const name = data.toString("utf8", offset + 46, offset + 46 + nameLen);
    const localNameLen = data.readUInt16LE(localOffset + 26);
    const localExtraLen = data.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLen + localExtraLen;
    const compressed = data.subarray(start, start + compSize);
    const content = method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed);
    files.set(name, content);
    offset += 46 + nameLen + extraLen + commentLen;
  }

  return files;
}

function boldStyleIndexes(stylesXml: string) {
  const boldFonts = new Set<number>();
  const fonts = stylesXml.match(/<fonts\b[^>]*>([\s\S]*?)<\/fonts>/)?.[1] ?? "";
  for (const [index, font] of (fonts.match(/<font\b[^>]*(?:\/>|>[\s\S]*?<\/font>)/g) ?? []).entries()) {
    const tag = font.match(/<b\b([^>]*)\/?>/);
    if (!tag) continue;
    const value = tag[1].match(/\bval="([^"]*)"/)?.[1];
    if (value !== "0" && value !== "false") boldFonts.add(index);
  }

  const boldStyles = new Set<number>();
  const cellXfs = stylesXml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? "";
  for (const [index, xf] of (cellXfs.match(/<xf\b[^>]*(?:\/>|>[\s\S]*?<\/xf>)/g) ?? []).entries()) {
    const fontId = Number(xf.match(/\bfontId="(\d+)"/)?.[1] ?? -1);
    if (boldFonts.has(fontId)) boldStyles.add(index);
  }
  return boldStyles;
}

function sharedStrings(xml: string) {
  const strings: string[] = [];
  for (const item of xml.match(/<si\b[^>]*>[\s\S]*?<\/si>/g) ?? []) {
    const text = [...item.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((match) => match[1]).join("");
    strings.push(decodeXml(text));
  }
  return strings;
}

function parseSheetGrid(sheetXml: string, strings: string[], boldStyles: Set<number>): SheetCell[][] {
  const table: SheetCell[][] = [];
  for (const rowXml of sheetXml.match(/<row\b[^>]*>[\s\S]*?<\/row>/g) ?? []) {
    const cells = new Map<number, SheetCell>();
    for (const match of rowXml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = match[1];
      const inner = match[2] ?? "";
      const letters = attrs.match(/\br="([A-Z]+)\d+"/)?.[1];
      if (!letters) continue;
      const style = Number(attrs.match(/\bs="(\d+)"/)?.[1] ?? 0);
      const type = attrs.match(/\bt="([^"]+)"/)?.[1] ?? "";
      let value = "";
      if (type === "s") {
        const index = Number(inner.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "");
        value = strings[index] ?? "";
      } else if (type === "inlineStr") {
        value = decodeXml([...inner.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((part) => part[1]).join(""));
      } else {
        value = decodeXml(inner.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "");
      }
      cells.set(columnIndex(letters), { value: value.trim(), bold: boldStyles.has(style) });
    }
    if (cells.size === 0) continue;
    const width = Math.max(...cells.keys()) + 1;
    const row: SheetCell[] = [];
    for (let index = 0; index < width; index += 1) {
      row.push(cells.get(index) ?? { value: "", bold: false });
    }
    table.push(row);
  }
  return table;
}

function columnIndex(letters: string) {
  let index = 0;
  for (const char of letters) index = index * 26 + (char.charCodeAt(0) - 64);
  return index - 1;
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&");
}
