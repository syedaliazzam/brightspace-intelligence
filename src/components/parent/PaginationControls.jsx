import Link from "next/link";

export default function PaginationControls({ page, pageSize, totalItems, onPageChange, hrefBase = "" }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).slice(
    Math.max(0, currentPage - 2),
    Math.max(0, currentPage - 2) + 5
  );

  const pageHref = (nextPage) => {
    if (!hrefBase) return "#";
    const params = new URLSearchParams();
    if (nextPage > 1) params.set("page", String(nextPage));
    return params.toString() ? `${hrefBase}?${params.toString()}` : hrefBase;
  };

  const navButton =
    "rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-600">
        Showing <span className="font-semibold text-slate-950">{start}-{end}</span> of{" "}
        <span className="font-semibold text-slate-950">{totalItems}</span>
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {hrefBase ? (
          <Link
            href={pageHref(currentPage - 1)}
            aria-disabled={currentPage <= 1}
            className={`${navButton} ${currentPage <= 1 ? "pointer-events-none" : "text-slate-700"}`}
          >
            Previous
          </Link>
        ) : (
          <button type="button" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1} className={navButton}>
            Previous
          </button>
        )}

        {pages.map((number) => {
          const buttonClass =
            number === currentPage
              ? "bg-slate-950 text-white"
              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100";
          return hrefBase ? (
            <Link key={number} href={pageHref(number)} className={`min-w-10 rounded-full px-4 py-2 text-sm font-semibold transition ${buttonClass}`}>
              {number}
            </Link>
          ) : (
            <button
              key={number}
              type="button"
              onClick={() => onPageChange(number)}
              className={`min-w-10 rounded-full px-4 py-2 text-sm font-semibold transition ${buttonClass}`}
            >
              {number}
            </button>
          );
        })}

        {hrefBase ? (
          <Link
            href={pageHref(currentPage + 1)}
            aria-disabled={currentPage >= totalPages}
            className={`${navButton} ${currentPage >= totalPages ? "pointer-events-none" : "text-slate-700"}`}
          >
            Next
          </Link>
        ) : (
          <button type="button" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages} className={navButton}>
            Next
          </button>
        )}
      </div>
    </div>
  );
}
