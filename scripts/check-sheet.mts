import { parseRate, parseRateBook, parseRateTable, parseWorkbook, type SheetCell } from "../src/lib/sheet.ts";

const url =
  "https://docs.google.com/spreadsheets/d/1Q7O9beVKWP3-_c9dECVgaOyewhzs2n6NqSyO_jIvQKo/export?format=csv";

const wordBook = parseRateBook(
  `Product,Brand,17th November 2026
CHANA DAL,,,
Bold (Dry),Double Sher,Sold
Medium (Dry),Sunflower Yellow,9400
MATAR,,,
Matar Khada,Double Hathi,
50kg,,NA
30kg,,5900
Chana Churi,,,
1st Quality (50kg),Double Hathoda Orange,Out of stock
2nd Quality (50kg),Double Hathoda Yellow,3000
`,
  "now",
);
const wordDay = wordBook.days[0];
const wordItems = wordDay?.categories.flatMap((category) => category.items) ?? [];
const sold = wordItems.find((item) => item.name === "Bold (Dry)");
const unavailable = wordItems.find((item) => item.note.startsWith("50kg"));
const called = wordItems.find((item) => item.name.startsWith("1st Quality"));
const stillPriced = wordItems.find((item) => item.note.startsWith("30kg"));
if (
  wordBook.days.length !== 1 ||
  sold?.extra !== "Sold" ||
  sold.amount != null ||
  unavailable?.extra !== "NA" ||
  called?.extra !== "Out of stock" ||
  stillPriced?.amount !== 5900 ||
  wordItems.length !== 6
) {
  throw new Error(`Word rates were skipped: ${JSON.stringify(wordDay)}`);
}

const gst = parseRate("10050/- (+5% GST)");
if (gst.amount !== 10050 || gst.extra !== "+5% GST") {
  throw new Error(`GST parse failed: ${JSON.stringify(gst)}`);
}

const plain = parseRate("6950 /-");
if (plain.amount !== 6950 || plain.extra !== "") {
  throw new Error(`Plain parse failed: ${JSON.stringify(plain)}`);
}

const xlsxUrl =
  "https://docs.google.com/spreadsheets/d/1Q7O9beVKWP3-_c9dECVgaOyewhzs2n6NqSyO_jIvQKo/export?format=xlsx";
const response = await fetch(xlsxUrl);
if (!response.ok) throw new Error(`Sheet fetch failed: ${response.status}`);
const book = parseWorkbook(Buffer.from(await response.arrayBuffer()), new Date().toISOString());

if (book.days.length < 1) {
  throw new Error(`Expected at least 1 day, got ${book.days.length}`);
}

const day = book.days[0];
console.log(day.displayDate, day.weekday, day.id);

const summary = day.categories.map((category) => {
  console.log(`\n${category.name}`);
  for (const item of category.items) {
    console.log(`  ${item.name} | ${item.note} | ${item.amount} | ${item.extra}`);
  }
  return `${category.name}:${category.items.length}`;
});

console.log("\n" + summary.join(", "));

const expected = [
  "Chana Dal:4",
  "Masoor:2",
  "Moong:4",
  "Matar:6",
  "Chana Besan:5",
  "Matar Besan:3",
  "Daliya / Upma:3",
  "Chana Churi:2",
];

if (summary.join(",") !== expected.join(",")) {
  throw new Error(`Unexpected shape.\nGot: ${summary.join(", ")}\nWant: ${expected.join(", ")}`);
}

const matar = day.categories.find((category) => category.name === "Matar");
const khada = matar?.items[0];
if (khada?.name !== "Matar Khada" || khada.note !== "50kg · Double Hathi" || khada.amount !== 5850) {
  throw new Error(`Matar Khada parsed wrong: ${JSON.stringify(khada)}`);
}

const dry = matar?.items[2];
if (dry?.name !== "Matar Dal (Dry)" || dry.note !== "50kg · Blue Diamond" || dry.amount !== 5900) {
  throw new Error(`Matar Dal (Dry) parsed wrong: ${JSON.stringify(dry)}`);
}

const moti = matar?.items[4];
if (moti?.name !== "Matar Dal Moti (Peti Polish)" || moti.note !== "Golden Hathoda Blue" || moti.amount !== 5960) {
  throw new Error(`Matar Dal Moti parsed wrong: ${JSON.stringify(moti)}`);
}

const besan = day.categories.find((category) => category.name === "Chana Besan");
const tenKg = besan?.items.find((item) => item.note.startsWith("10kg"));
if (tenKg?.amount !== 10050 || tenKg.name !== "Super Fine & Mota (1.25) 1st Quality") {
  throw new Error(`10kg besan parsed wrong: ${JSON.stringify(tenKg)}`);
}

const daliya = day.categories.find((category) => category.name === "Daliya / Upma");
if (daliya?.items.some((item) => item.name.toLowerCase().includes("churi") || item.note.toLowerCase().includes("churi"))) {
  throw new Error(`Chana Churi is still inside Daliya / Upma: ${JSON.stringify(daliya)}`);
}

const churiSection = day.categories.find((category) => category.name === "Chana Churi");
const churi = churiSection?.items.find((item) => item.name.startsWith("1st Quality"));
if (!churi || churi.amount !== 3350 || churi.note !== "Double Hathoda Orange") {
  throw new Error(`Chana Churi parsed wrong: ${JSON.stringify(churiSection)}`);
}

if (day.displayDate !== "17 November 2026" || day.weekday !== "Tuesday") {
  throw new Error(`Date parsed wrong: ${day.displayDate} ${day.weekday}`);
}

const csvResponse = await fetch(url);
if (!csvResponse.ok) throw new Error(`CSV fetch failed: ${csvResponse.status}`);
const csvBook = parseRateBook(await csvResponse.text(), new Date().toISOString());
const csvSummary = csvBook.days[0]?.categories.map((category) => `${category.name}:${category.items.length}`);
if (csvSummary?.join(",") !== expected.join(",")) {
  throw new Error(`CSV shape drifted.\nGot: ${csvSummary?.join(", ")}`);
}

function cell(value: string, bold = false): SheetCell {
  return { value, bold };
}

function shape(table: SheetCell[][]) {
  const parsed = parseRateTable(table, "now");
  const day = parsed.days[0];
  if (!day) throw new Error("Synthetic sheet produced no day");
  return day.categories.map((category) => ({
    name: category.name,
    items: category.items.map((item) => item.name),
  }));
}

const addedProduct = shape([
  [cell("Product"), cell("Brand"), cell("17th November 2026")],
  [cell("MOONG", true), cell(""), cell("")],
  [cell("Moong Dal"), cell("Golden Coin"), cell("9700")],
  [cell("Moong New"), cell("Rajwadi"), cell("10000")],
]);
if (
  addedProduct.length !== 1 ||
  addedProduct[0].name !== "Moong" ||
  addedProduct[0].items.join("|") !== "Moong Dal|Moong New"
) {
  throw new Error(`New product left its heading: ${JSON.stringify(addedProduct)}`);
}

const addedHeading = shape([
  [cell("Product"), cell("Brand"), cell("17th November 2026")],
  [cell("DALIYA / UPMA", true), cell(""), cell("")],
  [cell("Daliya"), cell("Golden Hathoda Yellow"), cell("")],
  [cell("50kg"), cell(""), cell("3950")],
  [cell("Urad Dal", true), cell(""), cell("")],
  [cell("50kg"), cell("Festival"), cell("8200")],
  [cell("1st Quality"), cell("Festival"), cell("8300")],
]);
const urad = addedHeading.find((category) => category.name === "Urad Dal");
const daliyaHeading = addedHeading.find((category) => category.name === "Daliya / Upma");
if (!urad || urad.items.join("|") !== "50kg|1st Quality") {
  throw new Error(`New heading was filed as a product: ${JSON.stringify(addedHeading)}`);
}
if (daliyaHeading?.items.some((name) => name === "Urad Dal")) {
  throw new Error(`Heading name was also listed as a product: ${JSON.stringify(daliyaHeading)}`);
}

const plainProduct = shape([
  [cell("Product"), cell("Brand"), cell("17th November 2026")],
  [cell("CHANA BESAN", true), cell(""), cell("")],
  [cell("Super Fine 3rd Quality"), cell(""), cell("")],
  [cell("50kg"), cell("Sunflower"), cell("8000")],
]);
if (plainProduct.length !== 1 || plainProduct[0].name !== "Chana Besan" || plainProduct[0].items[0] !== "Super Fine 3rd Quality") {
  throw new Error(`Unbolded row became a heading: ${JSON.stringify(plainProduct)}`);
}

console.log("\nSheet parse OK");
