"use client";

import { useEffect, useMemo, useState } from "react";

function PaginationControls({ page, pageSize, totalItems, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).slice(
    Math.max(0, currentPage - 2),
    Math.max(0, currentPage - 2) + 5
  );

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-600">
        Showing <span className="font-semibold text-slate-950">{start}-{end}</span> of{" "}
        <span className="font-semibold text-slate-950">{totalItems}</span>
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>

        {pages.map((number) => (
          <button
            key={number}
            type="button"
            onClick={() => onPageChange(number)}
            className={`min-w-10 rounded-full px-4 py-2 text-sm font-semibold transition ${
              number === currentPage
                ? "bg-slate-950 text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            {number}
          </button>
        ))}

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

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
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [items, initialCount]);

  const visibleItems = useMemo(() => {
    const startIndex = (page - 1) * initialCount;
    return items.slice(startIndex, startIndex + initialCount);
  }, [items, page, initialCount]);

  const totalPages = Math.max(1, Math.ceil(items.length / initialCount));

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
          {items.length > initialCount ? (
            <PaginationControls
              page={page}
              pageSize={initialCount}
              totalItems={items.length}
              onPageChange={(nextPage) => setPage(Math.min(Math.max(1, nextPage), totalPages))}
            />
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
