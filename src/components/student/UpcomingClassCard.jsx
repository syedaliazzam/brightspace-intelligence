"use client";

import { canShowJoinMeet, getLectureDisplayStatus } from "@/lib/lectureStatus";

export default function UpcomingClassCard({ item }) {
  const canJoin = item ? canShowJoinMeet(item) : false;
  const displayStatus = item?.display_status || getLectureDisplayStatus(item);

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-slate-950 p-5 text-white shadow-[0_24px_80px_-36px_rgba(15,23,42,0.45)]">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-200">Next lecture</p>
      {item ? (
        <div className="mt-4">
          <h2 className="text-2xl font-semibold">{item.title}</h2>
          <p className="mt-2 text-sm text-slate-300">{item.subject_name} with {item.teacher_name}</p>
          {item.google_meet_link && canJoin ? (
            <>
              <a href={item.google_meet_link} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950">Join Google Meet</a>
            </>
          ) : (
            <span className="mt-4 inline-flex rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-slate-200">{displayStatus}</span>
          )}
        </div>
      ) : <p className="mt-4 text-sm text-slate-300">No upcoming lectures scheduled.</p>}
    </section>
  );
}
