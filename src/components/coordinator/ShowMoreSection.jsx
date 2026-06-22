"use client";

import { useEffect, useMemo, useState } from "react";

export default function ShowMoreSection({
  title,
  description,
  items = [],
  initialCount = 5,
  step = 5,
  renderItems,
  emptyMessage = "No records available.",
  wrapperClassName = "",
}) {
  const [visibleCount, setVisibleCount] = useState(initialCount);

  useEffect(() => {
    setVisibleCount(initialCount);
  }, [items, initialCount]);

  const visibleItems = useMemo(
    () => items.slice(0, visibleCount),
    [items, visibleCount]
  );

  const canPaginate = items.length > initialCount;
  const hasMore = visibleCount < items.length;

  function handleToggle() {
    setVisibleCount((current) => {
      if (current >= items.length) {
        return initialCount;
      }

      return Math.min(current + step, items.length);
    });
  }

  return (
    <section className={`space-y-4 ${wrapperClassName}`}>
      {(title || description) && (
        <div className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
          {title ? (
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">
              {title}
            </p>
          ) : null}
          {description ? (
            <p className="mt-2 text-sm leading-7 text-slate-600">{description}</p>
          ) : null}
        </div>
      )}

      {items.length ? (
        <>
          {renderItems(visibleItems)}
          {canPaginate ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleToggle}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
              >
                {hasMore ? "Show more" : "Show less"}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <section className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white/85 p-10 text-center text-sm text-slate-500 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.18)]">
          {emptyMessage}
        </section>
      )}
    </section>
  );
}
