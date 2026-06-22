"use client";

export default function SubjectFilter({ value = "", subjects = [], onChange }) {
  return (
    <select value={value} onChange={(event) => onChange?.(event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-sky-400">
      <option value="">All subjects</option>
      {subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
  );
}
