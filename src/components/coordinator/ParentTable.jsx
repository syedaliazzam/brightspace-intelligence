"use client";

export default function ParentTable({ items = [], onRefresh }) {
  async function updateParent(item) {
    const fullName = window.prompt("Parent name", item.full_name || "");
    if (!fullName) return;
    const email = window.prompt("Parent email", item.email || "");
    const phone = window.prompt("Parent phone", item.phone || "");
    const relation = window.prompt("Relation", item.relation || "parent");
    const status = window.prompt("Status: active, suspended, archived", item.status || "active");

    const response = await fetch("/api/coordinator/parents", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: item.id,
        full_name: fullName,
        email,
        phone,
        relation,
        status,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "Unable to update parent.");
    onRefresh?.();
  }

  async function archiveParent(item) {
    if (!window.confirm(`Archive ${item.full_name}?`)) return;
    const response = await fetch(`/api/coordinator/parents?id=${item.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "Unable to archive parent.");
    onRefresh?.();
  }

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/90 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
      <div className="hidden grid-cols-[1.4fr_1fr_1.2fr_0.8fr_150px] gap-4 border-b border-slate-200 px-5 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 lg:grid">
        <span>Parent</span>
        <span>Relation</span>
        <span>Students</span>
        <span>Status</span>
        <span className="text-right">Actions</span>
      </div>
      <div className="divide-y divide-slate-200">
        {items.length ? (
          items.map((item) => (
            <div key={item.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[1.4fr_1fr_1.2fr_0.8fr_150px] lg:items-center lg:gap-4">
              <div>
                <p className="font-semibold text-slate-950">{item.full_name}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {item.email || item.phone || "No contact"}
                </p>
              </div>
              <p className="text-sm text-slate-600">{item.relation || "-"}</p>
              <p className="text-sm text-slate-600">{item.student_names || "-"}</p>
              <p className="text-sm font-medium text-slate-700">{item.status || "-"}</p>
              <div className="flex gap-2 lg:justify-end">
                <button type="button" onClick={() => updateParent(item).catch((error) => window.alert(error.message))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                  Edit
                </button>
                <button type="button" onClick={() => archiveParent(item).catch((error) => window.alert(error.message))} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                  Delete
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="px-5 py-10 text-sm text-slate-500">No parent records available.</div>
        )}
      </div>
    </div>
  );
}
