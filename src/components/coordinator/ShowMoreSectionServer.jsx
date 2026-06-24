import Link from "next/link";

function PaginationControls({ page, pageSize, totalItems, hrefBase }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).slice(
    Math.max(0, currentPage - 2),
    Math.max(0, currentPage - 2) + 5
  );

  function hrefFor(nextPage) {
    const params = new URLSearchParams();
    if (nextPage > 1) {
      params.set("page", String(nextPage));
    }
    return params.toString() ? `${hrefBase}?${params.toString()}` : hrefBase;
  }

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-600">
        Showing <span className="font-semibold text-slate-950">{start}-{end}</span> of{" "}
        <span className="font-semibold text-slate-950">{totalItems}</span>
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={hrefFor(currentPage - 1)}
          aria-disabled={currentPage <= 1}
          className={`rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold transition ${
            currentPage <= 1
              ? "pointer-events-none cursor-not-allowed opacity-50"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          Previous
        </Link>

        {pages.map((number) => (
          <Link
            key={number}
            href={hrefFor(number)}
            className={`min-w-10 rounded-full px-4 py-2 text-sm font-semibold transition ${
              number === currentPage
                ? "bg-slate-950 text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            {number}
          </Link>
        ))}

        <Link
          href={hrefFor(currentPage + 1)}
          aria-disabled={currentPage >= totalPages}
          className={`rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold transition ${
            currentPage >= totalPages
              ? "pointer-events-none cursor-not-allowed opacity-50"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          Next
        </Link>
      </div>
    </div>
  );
}

export default function ShowMoreSectionServer({
  items = [],
  page = 1,
  pageSize = 5,
  renderItems,
  emptyMessage = "No records available.",
  hrefBase = "",
}) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const visibleItems = items.slice(startIndex, startIndex + pageSize);

  return (
    <section className="space-y-4">
      {items.length ? (
        <>
          {renderItems(visibleItems)}
          {items.length > pageSize ? (
            <PaginationControls
              page={currentPage}
              pageSize={pageSize}
              totalItems={items.length}
              hrefBase={hrefBase}
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
