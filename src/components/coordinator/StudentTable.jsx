"use client";

export default function StudentTable({ items = [] }) {
  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/90 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
      <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr_1fr] gap-4 border-b border-slate-200 px-5 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 lg:grid">
        <span>Student</span>
        <span>Grade</span>
        <span>Course</span>
        <span>Parent</span>
        <span>Status</span>
      </div>
      <div className="divide-y divide-slate-200">
        {items.length ? (
          items.map((item) => (
            <div key={item.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr] lg:items-center lg:gap-4">
              <div>
                <p className="font-semibold text-slate-950">{item.full_name}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {item.email || item.phone || item.admission_no || "No contact"}
                </p>
              </div>
              <p className="text-sm text-slate-600">{item.grade_level || "-"}</p>
              <p className="text-sm text-slate-600">{item.course_title || "-"}</p>
              <div className="text-sm text-slate-600">
                <p>{item.parent_name || "-"}</p>
                <p className="mt-1 text-xs text-slate-500">{item.parent_phone || item.parent_email || ""}</p>
              </div>
              <p className="text-sm font-medium text-slate-700">{item.status}</p>
            </div>
          ))
        ) : (
          <div className="px-5 py-10 text-sm text-slate-500">No student records available.</div>
        )}
      </div>
    </div>
  );
}

