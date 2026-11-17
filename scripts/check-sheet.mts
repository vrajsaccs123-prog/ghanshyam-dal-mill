import { parseRate, parseRateBook } from "../src/lib/sheet.ts";

const url =
  "https://docs.google.com/spreadsheets/d/1Q7O9beVKWP3-_c9dECVgaOyewhzs2n6NqSyO_jIvQKo/gviz/tq?tqx=out:csv";

const gst = parseRate("10050/- (+5% GST)");
if (gst.amount !== 10050 || gst.extra !== "+5% GST") {
  throw new Error(`GST parse failed: ${JSON.stringify(gst)}`);
}

const plain = parseRate("6950 /-");
if (plain.amount !== 6950 || plain.extra !== "") {
  throw new Error(`Plain parse failed: ${JSON.stringify(plain)}`);
}

const response = await fetch(url);
if (!response.ok) throw new Error(`Sheet fetch failed: ${response.status}`);
const book = parseRateBook(await response.text(), new Date().toISOString());

if (book.days.length !== 1) {
  throw new Error(`Expected 1 day, got ${book.days.length}`);
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
  "Daliya / Upma:5",
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
if (tenKg?.amount !== 10050 || tenKg.extra !== "+5% GST" || tenKg.name !== "Super Fine & Mota (1.25) 1st Quality") {
  throw new Error(`10kg besan parsed wrong: ${JSON.stringify(tenKg)}`);
}

const daliya = day.categories.find((category) => category.name === "Daliya / Upma");
const churi = daliya?.items.find((item) => item.note.startsWith("Chana Churi"));
if (!churi || churi.amount !== 3350) {
  throw new Error(`Chana Churi parsed wrong: ${JSON.stringify(churi)}`);
}

if (day.displayDate !== "16 November 2026" || day.weekday !== "Monday") {
  throw new Error(`Date parsed wrong: ${day.displayDate} ${day.weekday}`);
}

console.log("\nSheet parse OK");
