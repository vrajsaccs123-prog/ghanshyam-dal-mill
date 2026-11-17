export function formatInr(amount: number) {
  return amount.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export function formatReadTime(iso: string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function rateCount(categories: { items: unknown[] }[]) {
  return categories.reduce((sum, category) => sum + category.items.length, 0);
}
