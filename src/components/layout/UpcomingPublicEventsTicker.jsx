"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { formatEventDate, formatEventLifecycleLabel, formatEventLifecycleStatus } from "@/lib/publicEvents";

function normalizePublicEventWebsiteBase(value) {
  const raw = String(value || "").trim();
  if (!raw) return "https://ashshajrah.com";

  const normalized = raw.replace(/\s+/g, "").replace(/\/+$/, "");
  if (/^https?:\/\//i.test(normalized)) {
    return normalized.replace(/\/+$/, "");
  }

  const implicitHostMatch = normalized.match(/^([a-z]+):(\d+)(.*)$/i);
  if (implicitHostMatch) {
    const scheme = implicitHostMatch[1].toLowerCase();
    const port = implicitHostMatch[2];
    const rest = implicitHostMatch[3] || "";
    return `${scheme}://localhost:${port}${rest}`.replace(/\/+$/, "");
  }

  if (/^[a-z]+:[^/].*$/i.test(normalized)) {
    return normalized.replace(/^([a-z]+):/, "$1://").replace(/\/+$/, "");
  }

  return `https://${normalized.replace(/\/+$/, "")}`;
}

function slugifyEventTitle(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeEventPathSegment(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^[a-z0-9-]+$/i.test(raw)) return raw.toLowerCase();
  return slugifyEventTitle(raw);
}

function getEventSlug(item) {
  const slug = normalizeEventPathSegment(
    item?.slug ||
    item?.event_slug ||
    item?.public_slug ||
    item?.eventSlug ||
    item?.publicSlug ||
    item?.event_slug ||
    item?.public_slug ||
    ""
  );
  if (slug) return slug;
  return slugifyEventTitle(item?.title || item?.name || "");
}

function getEventHref(item) {
  const slug = getEventSlug(item);
  const id = String(item?.id || item?.eventId || "").trim();
  const base = normalizePublicEventWebsiteBase(process.env.NEXT_PUBLIC_PUBLIC_EVENT_WEBSITE_URL || "https://ashshajrah.com");
  const eventPath = slug || id;
  if (!eventPath) return base;
  return `${base}/${encodeURIComponent(eventPath)}`;
}

function getStatusBadge(item) {
  const lifecycle = formatEventLifecycleStatus(item?.start_at, item?.end_at);
  const label = formatEventLifecycleLabel(lifecycle);
  const tone = lifecycle === "current"
    ? "bg-[#EAF6EF] text-[#0D5C48]"
    : lifecycle === "past"
      ? "bg-[#F1EADC] text-[#7A5E2B]"
      : "bg-[#EEF4FF] text-[#1D4ED8]";
  return { lifecycle, label, tone };
}

export default function UpcomingPublicEventsTicker() {
  const [events, setEvents] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch("/api/public-events", { cache: "no-store" });
        const data = await response.json();
        if (!active) return;

        const upcoming = Array.isArray(data?.currentUpcoming) ? data.currentUpcoming : [];
        setEvents(upcoming.slice(0, 8));
      } catch {
        if (active) setEvents([]);
      } finally {
        if (active) setLoaded(true);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (events.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % events.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [events.length]);

  const activeEvent = useMemo(() => events[activeIndex] || null, [activeIndex, events]);
  const { label, tone } = activeEvent ? getStatusBadge(activeEvent) : { label: "Upcoming", tone: "bg-[#EEF4FF] text-[#1D4ED8]" };

  if (!activeEvent) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(250,247,240,0.97))] px-4 py-3 shadow-[0_12px_40px_-24px_rgba(13,59,46,0.22)]">
        <div className="flex items-center gap-3">
          <span className="shrink-0 rounded-full bg-[#FFF5D6] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#0D5C48]">
            Public events
          </span>
          <div className="min-w-0 flex-1 overflow-hidden">
            {activeEvent ? (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeEvent.id}
                  initial={{ x: "100%", opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: "-100%", opacity: 0 }}
                  transition={{ duration: 0.55, ease: "easeInOut" }}
                  className="flex flex-wrap items-center gap-2 text-sm text-[#245C4F]"
                >
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>
                    {label}
                  </span>
                  <span className="truncate font-semibold text-[#063F32]">{activeEvent.title}</span>
                  <span className="truncate text-[#245C4F]">{formatEventDate(activeEvent.start_at)}</span>
                  <span className="truncate text-[#245C4F]">{activeEvent.start_at ? new Date(activeEvent.start_at).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Karachi" }) : ""}</span>
                  <a
                    href={getEventHref(activeEvent)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-full bg-[linear-gradient(135deg,#0D3B2E,#0D5C48)] px-3 py-1.5 text-[11px] font-semibold text-[#FFF5D6] transition hover:opacity-90"
                  >
                    Go to event
                  </a>
                </motion.div>
              </AnimatePresence>
            ) : (
              <div className="text-sm text-[#245C4F]">
                {loaded ? "No upcoming public events at the moment." : "Loading upcoming events..."}
              </div>
            )}
          </div>
        </div>
      </div>
  );
}
