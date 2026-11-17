"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

type Box = { top: number; left: number; width: number; height: number };

function boxOf(element: Element): Box {
  const rect = element.getBoundingClientRect();
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

function place(element: HTMLElement, box: Box) {
  element.style.position = "fixed";
  element.style.top = `${box.top}px`;
  element.style.left = `${box.left}px`;
  element.style.width = `${box.width}px`;
  element.style.height = `${box.height}px`;
  element.style.margin = "0";
  element.style.maxWidth = "none";
  element.style.maxHeight = "none";
}

export function RateBoard({
  categories,
  previous,
}: {
  categories: Category[];
  previous?: Category[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [presentedId, setPresentedId] = useState<string | null>(null);
  const [motion, setMotion] = useState<"enter" | "show" | "exit">("enter");
  const [canPortal, setCanPortal] = useState(false);
  const earlier = useMemo(() => previousAmounts(previous), [previous]);
  const fromRef = useRef<Box | null>(null);
  const toRef = useRef<Box | null>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const closeRef = useRef<() => void>(() => {});

  const shownIndex = categories.findIndex((category) => category.id === presentedId);
  const shown = shownIndex >= 0 ? categories[shownIndex] : null;

  useEffect(() => {
    setCanPortal(true);
  }, []);

  useLayoutEffect(() => {
    if (!presentedId || motion !== "enter") return;
    const sheet = sheetRef.current;
    const from = fromRef.current;
    if (!sheet || !from) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setMotion("show");
      return;
    }
    const to = sheet.style.position === "fixed" && toRef.current ? toRef.current : boxOf(sheet);
    toRef.current = to;
    sheet.style.transition = "none";
    place(sheet, from);
    void sheet.offsetWidth;
    const frame = requestAnimationFrame(() => {
      sheet.style.transition = "";
      place(sheet, to);
      setMotion("show");
    });
    return () => cancelAnimationFrame(frame);
  }, [presentedId, motion]);

  useEffect(() => {
    if (!presentedId) return;
    const id = presentedId;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (motion === "show") document.getElementById(`${id}-close`)?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const root = document.getElementById(`${id}-dialog`);
      if (!root) return;
      const items = [...root.querySelectorAll<HTMLElement>("button, a, input, select, textarea")];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !root.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [presentedId, motion]);

  function openCategory(id: string) {
    if (presentedId) return;
    const card = document.getElementById(id);
    if (!card) return;
    fromRef.current = boxOf(card);
    toRef.current = null;
    setMotion("enter");
    setPresentedId(id);
    setOpenId(id);
  }

  function closeCategory() {
    const id = presentedId;
    const sheet = sheetRef.current;
    if (!id || motion === "exit") return;
    const source = document.getElementById(id);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !sheet || !source) {
      setPresentedId(null);
      setOpenId(null);
      requestAnimationFrame(() => document.getElementById(`${id}-open`)?.focus());
      return;
    }

    const from = boxOf(source);
    const current = boxOf(sheet);
    const parked =
      Math.abs(current.top - from.top) < 1 &&
      Math.abs(current.left - from.left) < 1 &&
      Math.abs(current.width - from.width) < 1 &&
      Math.abs(current.height - from.height) < 1;
    setOpenId(null);
    setMotion("exit");
    if (parked) {
      setPresentedId(null);
      requestAnimationFrame(() => document.getElementById(`${id}-open`)?.focus());
      return;
    }

    sheet.style.transition = "";
    place(sheet, from);
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      setPresentedId(null);
      requestAnimationFrame(() => document.getElementById(`${id}-open`)?.focus());
    };
    const timer = window.setTimeout(finish, 520);
    const onEnd = (event: TransitionEvent) => {
      if (event.target !== sheet || event.propertyName !== "height") return;
      window.clearTimeout(timer);
      sheet.removeEventListener("transitionend", onEnd);
      finish();
    };
    sheet.addEventListener("transitionend", onEnd);
  }

  closeRef.current = closeCategory;

  const sheet =
    canPortal && shown
      ? createPortal(
          <div
            className={motion === "show" ? "card-overlay is-shown" : "card-overlay"}
            onClick={closeCategory}
          >
            <div className="card-overlay-scrim" />
            <section
              className={motion === "show" ? "card card-sheet is-shown" : "card card-sheet"}
              id={`${shown.id}-dialog`}
              role="dialog"
              aria-modal="true"
              aria-labelledby={`${shown.id}-title`}
              ref={sheetRef}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="card-sheet-bar">
                <h2 className="card-sheet-title" id={`${shown.id}-title`}>
                  <span className="card-index">{String(shownIndex + 1).padStart(2, "0")}</span>
                  <span className="card-name">{shown.name}</span>
                </h2>
                <button
                  type="button"
                  id={`${shown.id}-close`}
                  className="card-close"
                  aria-label={`Close ${shown.name}`}
                  onClick={closeCategory}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
              <div className="card-sheet-body" id={`${shown.id}-items`}>
                <div className="card-head">
                  <span>Product / Brand</span>
                  <span>Rate</span>
                </div>
                <ul className="rows">
                  {shown.items.map((item) => {
                    const before = earlier.get(keyFor(shown.name, item.name, item.note));
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
              </div>
            </section>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div className="board" id="rates">
        {categories.map((category, index) => (
          <section className="card" id={category.id} key={category.id}>
            <h2 className="card-title">
              <button
                type="button"
                id={`${category.id}-open`}
                className="card-toggle"
                aria-expanded={openId === category.id}
                aria-haspopup="dialog"
                onClick={() => openCategory(category.id)}
              >
                <span className="card-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="card-name">{category.name}</span>
                <span className="card-more">click for more</span>
              </button>
            </h2>
          </section>
        ))}
      </div>
      {sheet}
    </>
  );
}
