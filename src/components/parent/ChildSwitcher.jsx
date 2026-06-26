"use client";

export default function ChildSwitcher({ childrenList = [], value = "", onChange }) {
  if (!childrenList.length) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        No linked children are available for this account.
      </div>
    );
  }

  return (
    <label className="block rounded-[1.5rem] border border-white/70 bg-white/90 p-4 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.28)]">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
        Viewing child
      </span>
      <select
        value={value || ""}
        onChange={(event) => onChange?.(event.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
      >
        <option value="" disabled>
          Select a child
        </option>
        {childrenList.map((child) => (
          <option key={child.id} value={child.id}>
            {child.full_name} {child.grade_level ? `- ${child.grade_level}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
