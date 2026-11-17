"use client";

import { useMemo, useState } from "react";
import { formatInr } from "@/lib/format";
import type { Category } from "@/lib/types";

function keyFor(category: string, name: string, note: string) {
  return `${category}\n${name}\n${note}`.toLowerCase();
}

function previousAmounts(categories: Category[] | undefined) {
  const amounts = new Map<string, number>();
  for (const category of categories ?? []) {
    for (const item of category.items) {
      if (item.amount == null) continue;
      amounts.set(keyFor(category.name, item.name, item.note), item.amount);
    }
  }
  return amounts;
}

export function RateBoard({
  categories,
  previous,
}: {
  categories: Category[];
  previous?: Category[];
}) {
  const [query, setQuery] = useState("");
  const earlier = useMemo(() => previousAmounts(previous), [previous]);
  const needle = query.trim().toLowerCase();

  const visible = categories
    .map((category) => ({
      ...category,
      items: category.items.filter((item) => {
        if (!needle) return true;
        return (
          category.name.toLowerCase().includes(needle) ||
          item.name.toLowerCase().includes(needle) ||
          item.note.toLowerCase().includes(needle)
        );
      }),
    }))
    .filter((category) => category.items.length > 0);

  return (
    <>
      <div className="finder">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search product or brand"
          aria-label="Search product or brand"
        />
        <nav className="jump" aria-label="Products">
          {categories.map((category) => (
            <a key={category.id} href={`#${category.id}`}>
              {category.name}
            </a>
          ))}
        </nav>
      </div>

      {visible.length === 0 ? (
        <p className="empty">Nothing on this list matches.</p>
      ) : (
        <div className="board" id="rates">
          {visible.map((category, index) => (
            <section className="card" id={category.id} key={category.id}>
              <h2 className="card-title">
                <span className="card-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="card-name">{category.name}</span>
              </h2>
              <div className="card-head">
                <span>Product / Brand</span>
                <span>Rate</span>
              </div>
              <ul className="rows">
                {category.items.map((item) => {
                  const before = earlier.get(keyFor(category.name, item.name, item.note));
                  const delta =
                    item.amount != null && before != null ? item.amount - before : null;
                  return (
                    <li className="row" key={`${item.name}-${item.note}`}>
                      <div>
                        <span className="variety">{item.name}</span>
                        {item.note ? <span className="note">{item.note}</span> : null}
                      </div>
                      <span className="rate">
                        {item.amount != null ? (
                          <span className="rate-value">
                            <span className="rate-cur">₹</span>
                            {formatInr(item.amount)}
                          </span>
                        ) : (
                          <span className="rate-na">{item.extra || "—"}</span>
                        )}
                        {item.amount != null && item.extra ? (
                          <span className="rate-extra">{item.extra}</span>
                        ) : null}
                        {delta != null && delta !== 0 ? (
                          <span className={delta > 0 ? "delta delta-up" : "delta delta-down"}>
                            {delta > 0 ? "▲" : "▼"} {formatInr(Math.abs(delta))}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
