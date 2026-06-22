"use client";

import { formatDateTimeRange } from "@/lib/dateTime";
import { canShowJoinMeet, canShowMarkConducted, getLectureDisplayStatus } from "@/lib/lectureStatus";

export default function TodayClassesCard({ items = [], onOpen }) {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">Today classes</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Live teaching schedule</h2>
      <div className="mt-5 space-y-3">
        {items.length ? items.map((item) => (
          <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold text-slate-950">{item.title}</p>
                <p className="mt-1 text-sm text-slate-600">{item.student_name} - {item.subject_name}</p>
                <p className="mt-1 text-sm text-slate-500">{formatDateTimeRange(item.scheduled_start, item.scheduled_end)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const canShowMeet = canShowJoinMeet(item);
                  const displayStatus = item.display_status || getLectureDisplayStatus(item);
                  return canShowMeet ? (
                    <>
                      <a href={item.google_meet_link} target="_blank" rel="noreferrer" className="rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Join Meet</a>
                    </>
                  ) : (
                    <span className="rounded-xl bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-600">{displayStatus}</span>
                  );
                })()}
                {(() => {
                  const canMark = canShowMarkConducted(item);
                  return <button onClick={() => onOpen?.(item)} disabled={!canMark} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">Actions</button>;
                })()}
              </div>
            </div>
          </article>
        )) : <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">No lectures scheduled today.</p>}
      </div>
    </section>
  );
}
