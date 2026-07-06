"use client";

import { useState } from "react";
import { LeafSpinnerInline } from "@/components/shared/AshShajrahLoaders";

export default function AttendanceForm({ lecture, onSaved }) {
  const [status, setStatus] = useState("present");
  const [pending, setPending] = useState(false);

  async function readJson(response) {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error(await response.text());
    }
    return response.json();
  }

  async function submit(event) {
    event.preventDefault();
    if (!lecture?.id) {
      window.alert("Please select a class first.");
      return;
    }

    setPending(true);
    try {
      const response = await fetch(`/api/teacher/lectures/${lecture.id}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data?.message || "Unable to save attendance.");
      onSaved?.();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to save attendance.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
      <select value={status} onChange={(event) => setStatus(event.target.value)} className="flex-1 rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#2D8A6A]/20">
        <option value="present">Present</option>
        <option value="absent">Absent</option>
        <option value="late">Late</option>
        <option value="partial">Partial</option>
      </select>
      <button disabled={pending} className="rounded-2xl bg-[#0D5C48] px-4 py-3 text-sm font-semibold text-[#FAF7F0]">
        {pending ? (
          <span className="inline-flex items-center gap-2">
            <LeafSpinnerInline />
            Saving...
          </span>
        ) : (
          "Save attendance"
        )}
      </button>
    </form>
  );
}
