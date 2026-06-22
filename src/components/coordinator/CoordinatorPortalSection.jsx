"use client";

export default function CoordinatorPortalSection({
  id,
  title,
  description,
  children,
  className = "",
  showBrand = true,
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-28 rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)] sm:p-6 ${className}`}
    >
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            {showBrand ? (
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">
                Coordinator Portal
              </p>
            ) : null}
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              {title}
            </h2>
            {description ? (
              <p className="mt-2 text-sm leading-7 text-slate-600">
                {description}
              </p>
            ) : null}
          </div>
        </header>

        <div>{children}</div>
      </div>
    </section>
  );
}
