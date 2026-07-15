"use client";

import { useEffect, useMemo, useState } from "react";
import ClientPortal from "@/components/shared/ClientPortal";
import { Search } from "lucide-react";
import { OpenBookLoader } from "@/components/shared/AshShajrahLoaders";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function textOrDash(value) {
  const text = String(value || "").trim();
  return text || "-";
}

function truncate(value, maxLength = 72) {
  const text = String(value || "").trim();
  if (!text) return "-";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

function prettyLabel(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatResponseValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "object" && item !== null ? JSON.stringify(item) : String(item)))
      .join(", ");
  }
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function formatFlatObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return formatResponseValue(value);
  }

  const entries = Object.entries(value).filter(
    ([, nestedValue]) => nestedValue !== null && nestedValue !== undefined && String(nestedValue).trim() !== ""
  );

  if (!entries.length) {
    return "-";
  }

  if (entries.length === 1) {
    const [onlyKey, onlyValue] = entries[0];
    if (["answer", "value", "response"].includes(String(onlyKey).toLowerCase())) {
      return formatResponseValue(onlyValue);
    }
  }

  return entries
    .map(([nestedKey, nestedValue]) => {
      const key = String(nestedKey || "").toLowerCase();
      if (["answer", "value", "response"].includes(key)) {
        return formatResponseValue(nestedValue);
      }
      return `${prettyLabel(nestedKey)}: ${formatResponseValue(nestedValue)}`;
    })
    .filter(Boolean)
    .join(" | ");
}

export default function ParentInterviewFormsPanel() {
  const [state, setState] = useState({ loading: true, error: "", items: [] });
  const [search, setSearch] = useState("");
  const [selectedResponse, setSelectedResponse] = useState(null);
  const responseSummary = useMemo(() => {
    const responses = selectedResponse?.responses;
    if (!responses || typeof responses !== "object") {
      return { pairs: [], version: selectedResponse?.form_version || "-" };
    }

    const questionsSource =
      responses.Questions ||
      responses.questions ||
      responses.question ||
      responses.FormQuestions ||
      {};
    const answersSource =
      responses.Answers ||
      responses.answers ||
      responses.answer ||
      responses.FormAnswers ||
      responses;

    const questionMap = questionsSource && typeof questionsSource === "object" ? questionsSource : {};
    const answerMap = answersSource && typeof answersSource === "object" ? answersSource : {};

    const answerKeys = Object.keys(answerMap).filter(
      (key) => !["questions", "answers", "formversion", "form_version"].includes(String(key).toLowerCase())
    );

    const questionOrder = answerKeys.length ? answerKeys : Object.keys(questionMap);

    const pairs = questionOrder.map((key) => {
      const questionMeta = questionMap[key] || {};
      const questionLabelValue =
        questionMeta.Label ||
        questionMeta.label ||
        questionMeta.question ||
        questionMeta.text ||
        questionMap[key] ||
        key;
      const answerValue = answerMap[key];
      return {
        key,
        questionNumber: String(key).replace(/^q/i, "").replace(/^question/i, "").trim(),
        question: prettyLabel(questionLabelValue),
        answer: answerValue,
      };
    });

    return { pairs, version: selectedResponse?.form_version || responses.FormVersion || responses.form_version || "-" };
  }, [selectedResponse]);

  useEffect(() => {
    let active = true;

    async function load() {
      setState((current) => ({ ...current, loading: true, error: "" }));
      try {
        const response = await fetch("/api/admin/parent-interview-forms", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.message || "Unable to load parent interview forms.");
        }
        if (active) {
          setState({ loading: false, error: "", items: Array.isArray(data.items) ? data.items : [] });
        }
      } catch (error) {
        if (active) {
          setState({
            loading: false,
            error: error instanceof Error ? error.message : "Unable to load parent interview forms.",
            items: [],
          });
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    const submittedItems = state.items.filter((item) => {
      const response = item.responses;
      if (response === null || response === undefined || response === "") return false;
      if (typeof response === "object") {
        if (Array.isArray(response)) return response.length > 0;
        return Object.keys(response).length > 0;
      }
      return String(response).trim().length > 0;
    });

    if (!query) return submittedItems;
    return submittedItems.filter((item) =>
      [
        item.parent_name,
        item.parent_email,
        item.child_name,
        item.child_age,
        item.interested_programme,
        item.status,
        item.registration_id,
        item.responses ? JSON.stringify(item.responses) : "",
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [search, state.items]);

  if (state.loading) {
    return (
      <section className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-6 shadow-[0_18px_60px_-36px_rgba(13,59,46,0.18)]">
        <OpenBookLoader title="Loading parent interview forms" subtitle="Fetching interview form records..." />
      </section>
    );
  }

  if (state.error) {
    return (
      <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {state.error}
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <label className="flex items-center gap-3 rounded-2xl border border-[#2D8A6A]/15 bg-white px-4 py-3 shadow-sm">
        <Search className="h-4 w-4 text-[#0D5C48]" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by parent name, email, child, programme, or status"
          className="w-full bg-transparent text-sm text-[#063F32] outline-none placeholder:text-[#7A938B]"
        />
      </label>

      <div className="overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#F1EADC]">
            <thead className="bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)]">
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">
                <th className="px-6 py-4">#</th>
                <th className="px-6 py-4">Parent Name</th>
                <th className="px-6 py-4">Parent Email</th>
                <th className="px-6 py-4">Child Name</th>
                <th className="px-6 py-4">Child Age</th>
                <th className="px-6 py-4">Interested Programme</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Submitted At</th>
                <th className="px-6 py-4">See Answers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1EADC]">
              {filteredItems.map((item, index) => (
                <tr key={item.id} className="align-top">
                  <td className="px-5 py-5 text-sm font-semibold text-[#0D5C48]">
                    {String(index + 1).padStart(2, "0")}
                  </td>
                  <td className="px-5 py-5 text-[#063F32]">{textOrDash(item.parent_name)}</td>
                  <td className="px-5 py-5 text-[#245C4F]">{textOrDash(item.parent_email)}</td>
                  <td className="px-5 py-5 font-semibold text-[#063F32]">{textOrDash(item.child_name)}</td>
                  <td className="px-5 py-5 text-[#245C4F]">{textOrDash(item.child_age)}</td>
                  <td className="px-5 py-5 text-[#245C4F]">{textOrDash(item.interested_programme)}</td>
                  <td className="px-5 py-5 text-[#245C4F]">{textOrDash(item.status)}</td>
                  <td className="px-5 py-5 text-[#245C4F]">{formatDate(item.submitted_at || item.created_at)}</td>
                  <td className="px-5 py-5 text-[#245C4F]">
                    <button
                      type="button"
                      onClick={() => setSelectedResponse((current) => (current?.id === item.id ? null : item))}
                      className="max-w-[14rem] truncate rounded-full border border-[#2D8A6A]/20 bg-[#EAF6EF] px-4 py-2 text-left text-xs font-semibold text-[#0D5C48] transition hover:bg-[#DFF2E7]"
                    >
                      See Answers
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filteredItems.length ? (
          <div className="px-6 py-10 text-center text-sm text-[#245C4F]">No parent interview forms found.</div>
        ) : null}
      </div>

      {selectedResponse ? (
        <ClientPortal targetId="admin-page-portal-root">
          <div className="fixed inset-0 z-[10000] flex justify-center bg-[#063F32]/45 px-4 py-9">
            <div className="flex max-h-[75vh] w-full max-w-4xl flex-col rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-5 shadow-[0_16px_50px_-36px_rgba(13,59,46,0.18)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#C9A227]">
                    Full questions/answer detials
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[#063F32]">
                    {textOrDash(selectedResponse.parent_name)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedResponse(null)}
                  className="rounded-xl border border-[#2D8A6A]/20 bg-white px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                  >
                  Close
                </button>
              </div>
              <div className="mt-4 min-h-0 flex-1 overflow-y-auto rounded-[1.25rem] border border-[#2D8A6A]/10 bg-white p-3">
                  <div className="mt-3 space-y-3">
                    {responseSummary.pairs.map((item, index) => (
                      <div
                        key={`${item.key}-${index}`}
                        className="rounded-2xl border border-white bg-[#FAF7F0] p-4 shadow-[0_8px_20px_-18px_rgba(13,59,46,0.16)]"
                      >
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]">
                          Question #{item.questionNumber || index + 1}: {item.question}
                        </p>
                        <div className="mt-2 rounded-2xl border border-[#F1EADC] bg-[#FAF7F0] px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">
                            Answer:
                          </p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-[#245C4F]">
                            {formatFlatObject(item.answer)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
              </div>
            </div>
          </div>
        </ClientPortal>
      ) : null}
    </section>
  );
}
