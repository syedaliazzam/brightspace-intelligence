"use client";

export default function StudentTable({ items = [], onRefresh }) {
  async function updateStudent(item) {
    const fullName = window.prompt("Student name", item.full_name || "");
    if (!fullName) return;
    const email = window.prompt("Student email", item.email || "");
    const phone = window.prompt("Student phone", item.phone || "");
    const admissionNo = window.prompt("Admission / roll no", item.admission_no || "");
    const age = window.prompt("Age", item.age ?? "");
    const gradeLevel = window.prompt("Class", item.grade_level || "");
    const status = window.prompt("Status: active, suspended, archived", item.status || "active");

    const response = await fetch("/api/coordinator/students", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: item.id,
        full_name: fullName,
        email,
        phone,
        admission_no: admissionNo,
        age,
        grade_level: gradeLevel,
        status,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "Unable to update student.");
    onRefresh?.();
  }

  async function archiveStudent(item) {
    if (!window.confirm(`Archive ${item.full_name}?`)) return;
    const response = await fetch(`/api/coordinator/students?id=${item.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "Unable to archive student.");
    onRefresh?.();
  }

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/90 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
      <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr_1fr_150px] gap-4 border-b border-slate-200 px-5 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 lg:grid">
        <span>Student</span>
        <span>Class</span>
        <span>Class Placement</span>
        <span>Parent</span>
        <span>Status</span>
        <span className="text-right">Actions</span>
      </div>
      <div className="divide-y divide-slate-200">
        {items.length ? (
          items.map((item) => (
            <div key={item.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_150px] lg:items-center lg:gap-4">
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
              <div className="flex gap-2 lg:justify-end">
                <button type="button" onClick={() => updateStudent(item).catch((error) => window.alert(error.message))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                  Edit
                </button>
                <button type="button" onClick={() => archiveStudent(item).catch((error) => window.alert(error.message))} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                  Delete
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="px-5 py-10 text-sm text-slate-500">No student records available.</div>
        )}
      </div>
    </div>
  );
}
