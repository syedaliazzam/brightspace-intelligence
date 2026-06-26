"use client";

import { useEffect, useMemo, useState } from "react";

function groupLectureOptions(lectures) {
  const map = new Map();
  for (const item of lectures || []) {
    const classLevel = String(item.class_level || item.course_title || "").trim();
    const subjectId = String(item.subject_id || "").trim();
    const subjectName = String(item.subject_name || "").trim();
    if (!classLevel || !subjectId) continue;
    const key = `${classLevel}::${subjectId}`;
    if (!map.has(key)) map.set(key, { classLevel, subjectId, subjectName });
  }
  return Array.from(map.values());
}

function MessageBubble({ message }) {
  const mine = ["teacher", "admin"].includes(String(message.sender_role || "").toLowerCase());
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm shadow-sm ${mine ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-800"}`}>
        <div className="mb-1 flex items-center gap-2 text-xs opacity-80">
          <span className="font-semibold">{message.full_name || message.username || message.sender_role || "User"}</span>
          <span>·</span>
          <span>{message.sender_role || "-"}</span>
        </div>
        <p className="whitespace-pre-line leading-6">{message.message}</p>
      </div>
    </div>
  );
}

function Modal({ title, subtitle, onClose, children, actions, showTopClose = true }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-950/45 px-4 pt-24 pb-8">
      <div className="w-full max-w-3xl rounded-[2rem] border border-white/70 bg-white shadow-[0_24px_80px_-36px_rgba(15,23,42,0.32)]">
        <div className="border-b border-slate-100 px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">{title}</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{subtitle}</h3>
            </div>
            {showTopClose ? (
              <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Close</button>
            ) : null}
          </div>
        </div>
        <div className="space-y-4 p-6">{children}</div>
        {actions ? <div className="border-t border-slate-100 px-6 py-4">{actions}</div> : null}
      </div>
    </div>
  );
}

export default function NoteThreadsBoard({ mode = "viewer", lectures = [] }) {
  const canReply = mode === "teacher" || mode === "admin" || mode === "parent";
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState("");
  const [replyPending, setReplyPending] = useState(false);
  const [compose, setCompose] = useState({ classLevel: "", subjectId: "", visibility: "parent", message: "" });
  const [editingThread, setEditingThread] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [deletingThread, setDeletingThread] = useState(null);

  const lectureOptions = useMemo(() => groupLectureOptions(lectures), [lectures]);
  const subjectOptions = useMemo(() => lectureOptions.filter((item) => item.classLevel === String(compose.classLevel || "").trim()), [lectureOptions, compose.classLevel]);

  async function loadThreads() {
    setLoading(true);
    try {
      const response = await fetch("/api/notes/threads", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to load notes.");
      setThreads(data.items || []);
    } finally {
      setLoading(false);
    }
  }

  async function openThread(thread) {
    setSelected(thread);
    setReplyText("");
    const response = await fetch(`/api/notes/threads/${thread.id}/messages`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "Unable to load messages.");
    setMessages(data.items || []);
  }

  async function sendReply() {
    if (!selected || !replyText.trim()) return;
    setReplyPending(true);
    try {
      const response = await fetch(`/api/notes/threads/${selected.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyText }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to send reply.");
      setReplyText("");
      await openThread(selected);
      await loadThreads();
    } finally {
      setReplyPending(false);
    }
  }

  async function submitCompose(event) {
    event.preventDefault();
    const response = await fetch("/api/notes/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classLevel: compose.classLevel,
        subjectId: compose.subjectId,
        visibility: compose.visibility,
        message: compose.message,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "Unable to add note.");
    setCompose({ classLevel: "", subjectId: "", visibility: "parent", message: "" });
    await loadThreads();
  }

  async function saveEdit() {
    const response = await fetch(`/api/notes/threads/${editingThread.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: editingText }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "Unable to update note.");
    setEditingThread(null);
    setEditingText("");
    await loadThreads();
    if (selected?.id === editingThread.id) await openThread(selected);
  }

  async function deleteThread() {
    const response = await fetch(`/api/notes/threads/${deletingThread.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "Unable to delete note.");
    setDeletingThread(null);
    if (selected?.id === deletingThread.id) setSelected(null);
    await loadThreads();
  }

  useEffect(() => {
    loadThreads().catch((err) => setError(err.message));
  }, []);

  return (
    <div className="grid gap-5">
      {mode === "teacher" ? (
        <form onSubmit={submitCompose} className="grid gap-4 rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
          <div className="grid gap-3 md:grid-cols-3">
            <select value={compose.classLevel} onChange={(e) => setCompose((c) => ({ ...c, classLevel: e.target.value, subjectId: "" }))} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" required>
              <option value="">Select class</option>
              {Array.from(new Map(lectureOptions.map((item) => [item.classLevel, item])).values()).map((item) => <option key={item.classLevel} value={item.classLevel}>{item.classLevel}</option>)}
            </select>
            <select value={compose.subjectId} onChange={(e) => setCompose((c) => ({ ...c, subjectId: e.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" required disabled={!compose.classLevel}>
              <option value="">Select subject</option>
              {subjectOptions.map((item) => <option key={item.subjectId} value={item.subjectId}>{item.subjectName}</option>)}
            </select>
            <select value={compose.visibility} onChange={(e) => setCompose((c) => ({ ...c, visibility: e.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <option value="parent">Parent</option>
              <option value="student">Student</option>
              <option value="admin_only">Admin only</option>
            </select>
          </div>
          <textarea value={compose.message} onChange={(e) => setCompose((c) => ({ ...c, message: e.target.value }))} placeholder="Add note or message" className="min-h-[120px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" required />
          <div className="flex items-center justify-between gap-3">
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-600">Select class and subject first, then write the note.</div>
            <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Add note</button>
          </div>
        </form>
      ) : null}

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

      <section className="overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/90 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Last Message</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">Loading notes...</td></tr>
              ) : threads.length ? threads.map((thread) => (
                <tr key={thread.id}>
                  <td className="px-4 py-4 font-semibold text-slate-950">{thread.class_level || thread.course_title || "-"}</td>
                  <td className="px-4 py-4 text-slate-600">{thread.subject_name || "-"}</td>
                  <td className="px-4 py-4 text-slate-700">{thread.last_message || "-"}</td>
                  <td className="px-4 py-4 text-slate-600">{thread.last_message_at ? new Date(thread.last_message_at).toLocaleString("en-PK", { timeZone: "Asia/Karachi" }) : "-"}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => openThread(thread).catch((err) => setError(err.message))} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">View</button>
                      {mode === "teacher" ? (
                        <>
                          <button type="button" onClick={() => { setEditingThread(thread); setEditingText(thread.last_message || ""); }} className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100">Edit</button>
                          <button type="button" onClick={() => setDeletingThread(thread)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100">Delete</button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">No notes yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected ? (
        <Modal
          title="Thread"
          subtitle={`${selected.class_level || selected.course_title || "-"} · ${selected.subject_name || "-"}`}
          onClose={() => setSelected(null)}
          actions={
            canReply && String(selected?.visibility || "").toLowerCase() === "parent" ? (
              <div className="space-y-3">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={4}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
                  placeholder="Write a reply..."
                />
                <div className="flex items-center justify-end gap-3">
                  <button type="button" onClick={() => setSelected(null)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">Close</button>
                  <button type="button" onClick={() => sendReply().catch((err) => setError(err.message))} disabled={replyPending} className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{replyPending ? "Sending..." : "Reply"}</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-end gap-3">
                <button type="button" onClick={() => setSelected(null)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">Close</button>
              </div>
            )
          }
          showTopClose={false}
        >
          <div className="max-h-[52vh] space-y-3 overflow-y-auto pr-1">
            {messages.map((message) => <MessageBubble key={message.id} message={message} />)}
          </div>
        </Modal>
      ) : null}

      {editingThread ? (
        <Modal
          title="Edit note"
          subtitle={`${editingThread.class_level || editingThread.course_title || "-"} · ${editingThread.subject_name || "-"}`}
          onClose={() => { setEditingThread(null); setEditingText(""); }}
          actions={
            <div className="flex items-center justify-end gap-3">
              <button type="button" onClick={() => { setEditingThread(null); setEditingText(""); }} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">Cancel</button>
              <button type="button" onClick={() => saveEdit().catch((err) => setError(err.message))} className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Save</button>
            </div>
          }
        >
          <textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} rows={6} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none" />
        </Modal>
      ) : null}

      {deletingThread ? (
        <Modal
          title="Delete note"
          subtitle={`${deletingThread.class_level || deletingThread.course_title || "-"} · ${deletingThread.subject_name || "-"}`}
          onClose={() => setDeletingThread(null)}
          actions={
            <div className="flex items-center justify-end gap-3">
              <button type="button" onClick={() => setDeletingThread(null)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">Cancel</button>
              <button type="button" onClick={() => deleteThread().catch((err) => setError(err.message))} className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-700">Delete</button>
            </div>
          }
        >
          <p className="text-sm text-slate-600">This removes the thread and all replies.</p>
        </Modal>
      ) : null}
    </div>
  );
}
