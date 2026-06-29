"use client";

export default function ActiveHeadlinesBanner({ items = [] }) {
  if (!items.length) {
    return null;
  }

  const featured = items[0];
  const secondary = items.slice(1);

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-sky-100 bg-[linear-gradient(135deg,rgba(8,47,73,0.98),rgba(14,116,144,0.96),rgba(240,249,255,0.94))] p-6 text-white shadow-[0_24px_80px_-36px_rgba(8,47,73,0.55)] sm:p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.28),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(186,230,253,0.22),transparent_32%)]" />

      <div className="relative">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-sky-100">
            Important Headlines
          </span>
        </div>

        <div className="mt-4 grid gap-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.9fr)]">
          <article className="rounded-[1.75rem] border border-white/14 bg-white/10 p-3 backdrop-blur-md">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-100/80">Featured Announcement</p>
            <h2 className="mt-1 text-2xl font-semibold leading-tight tracking-tight text-white sm:text-3xl">
              {featured.headline}
            </h2>
          </article>

          {secondary.length ? (
            <div className="space-y-3">
              {secondary.map((item, index) => (
                <article
                  key={item.id}
                  className="rounded-[1.5rem] border border-white/14 bg-slate-950/16 p-4 backdrop-blur-md"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-100/75">
                    Update {index + 2}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-white/92">{item.headline}</p>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
