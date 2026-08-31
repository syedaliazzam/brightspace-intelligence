"use client";

export default function PaginationControls({ page, pageSize, totalItems, onPageChange, tone = "light" }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).slice(
    Math.max(0, currentPage - 2),
    Math.max(0, currentPage - 2) + 5
  );

  return (
    <div className="flex flex-col gap-3 border-t border-[#F1EADC] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className={`text-sm ${tone === "dark" ? "text-[#F1EADC]" : "text-[#245C4F]"}`}>
        Showing{" "}
        <span className={`font-semibold ${tone === "dark" ? "text-[#FFF5D6]" : "text-[#063F32]"}`}>
          {start}-{end}
        </span>{" "}
        of <span className={`font-semibold ${tone === "dark" ? "text-[#FFF5D6]" : "text-[#063F32]"}`}>{totalItems}</span>
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className={`rounded-full border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
            tone === "dark"
              ? "border-[#E4C766]/30 bg-white/10 text-[#FFF5D6] hover:bg-white/15"
              : "border-[#2D8A6A]/20 bg-[#FAF7F0] text-[#063F32] hover:bg-[#F1EADC]"
          }`}
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
                ? "bg-[linear-gradient(135deg,#C9A227,#E4C766)] text-[#063F32] shadow-[0_10px_28px_-18px_rgba(13,59,46,0.45)]"
                : tone === "dark"
                  ? "border border-[#E4C766]/25 bg-white/10 text-[#FFF5D6] hover:bg-white/15"
                  : "border border-[#2D8A6A]/20 bg-[#FAF7F0] text-[#063F32] hover:bg-[#F1EADC]"
            }`}
          >
            {number}
          </button>
        ))}

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className={`rounded-full border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
            tone === "dark"
              ? "border-[#E4C766]/30 bg-white/10 text-[#FFF5D6] hover:bg-white/15"
              : "border-[#2D8A6A]/20 bg-[#FAF7F0] text-[#063F32] hover:bg-[#F1EADC]"
          }`}
        >
          Next
        </button>
      </div>
    </div>
  );
}
