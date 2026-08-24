"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import ClientPortal from "@/components/shared/ClientPortal";

export default function MonthlyPlanSlider() {
  const [plan, setPlan] = useState(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState(null);
  const timerRef = useRef(null);
  const scrollerRef = useRef(null);
  const isAutoScrollingRef = useRef(false);
  const isVideoPlayingRef = useRef(false);

  useEffect(() => {
    async function loadPlan() {
      try {
        const res = await fetch("/api/monthly-plans", { cache: "no-store" });
        const data = await res.json();

        // Filter to only show plan for current month (between start and end date)
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const currentMonthPlan = data.items?.find((item) => {
          const startDate = new Date(item.start_date);
          const endDate = new Date(item.end_date);

          // Check if start date month/year OR end date month/year matches current month
          const startInCurrentMonth =
            startDate.getMonth() === currentMonth && startDate.getFullYear() === currentYear;
          const endInCurrentMonth =
            endDate.getMonth() === currentMonth && endDate.getFullYear() === currentYear;
          const spansCurrentMonth =
            startDate <= now && endDate >= now;

          return startInCurrentMonth || endInCurrentMonth || spansCurrentMonth;
        });

        setPlan(currentMonthPlan || null);
      } catch (error) {
        console.error("Error loading plan:", error);
      } finally {
        setLoading(false);
      }
    }

    loadPlan();
  }, []);

  const startAutoSlide = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      if (isAutoScrollingRef.current || isVideoPlayingRef.current) return;
      isAutoScrollingRef.current = true;
      if (!plan?.image_urls?.length) return;

      const nextIndex = (currentIdx + 1) % plan.image_urls.length;
      scrollToIndex(nextIndex);
      window.setTimeout(() => {
        isAutoScrollingRef.current = false;
      }, 900);
    }, 6500);
  }, [plan, currentIdx]);

  useEffect(() => {
    if (!plan?.image_urls?.length || loading) return;
    startAutoSlide();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [plan, loading, startAutoSlide]);

  const images = Array.isArray(plan?.image_urls) ? [...plan.image_urls].reverse() : [];
  const isVideoSource = (value = "") => /^data:video\//i.test(String(value || "")) || /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(String(value || ""));
  const buildPreviewUrl = (value) => {
    const text = String(value || "").trim();
    if (!text) return "";
    if (/^https?:\/\//i.test(text) || text.startsWith("blob:") || text.startsWith("data:")) return text;
    return `/api/file-preview?path=${encodeURIComponent(text)}`;
  };
  const monthName = plan?.start_date
    ? new Date(plan.start_date).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "";

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    let rafId = 0;
    let scrollEndTimer = 0;

    const syncCurrentIndex = () => {
      const cards = scroller.querySelectorAll("[data-plan-card]");
      if (!cards.length) return;

      const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
      if (scroller.scrollLeft <= 24) {
        setCurrentIdx(0);
        return;
      }

      if (scroller.scrollLeft >= maxScrollLeft - 24) {
        setCurrentIdx(cards.length - 1);
        return;
      }

      const scrollerRect = scroller.getBoundingClientRect();
      let closestIndex = 0;
      let closestDistance = Number.POSITIVE_INFINITY;

      cards.forEach((card, index) => {
        const rect = card.getBoundingClientRect();
        const cardLeftDistance = Math.abs(rect.left - scrollerRect.left);
        const cardRightDistance = Math.abs(rect.right - scrollerRect.right);
        const distance = Math.min(cardLeftDistance, cardRightDistance);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });

      setCurrentIdx(closestIndex);
    };

    const onScroll = () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (scrollEndTimer) window.clearTimeout(scrollEndTimer);
      rafId = requestAnimationFrame(syncCurrentIndex);
      scrollEndTimer = window.setTimeout(syncCurrentIndex, 120);
    };

    scroller.addEventListener("scroll", onScroll, { passive: true });
    syncCurrentIndex();

    return () => {
      scroller.removeEventListener("scroll", onScroll);
      if (rafId) cancelAnimationFrame(rafId);
      if (scrollEndTimer) window.clearTimeout(scrollEndTimer);
    };
  }, [images.length]);

  const scrollToIndex = (index) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const card = scroller.querySelectorAll("[data-plan-card]")[index];
    if (!card) return;

    const targetLeft = card.offsetLeft - scroller.offsetLeft;

    scroller.scrollTo({
      left: Math.max(targetLeft - 2, 0),
      behavior: "smooth",
    });
    setCurrentIdx(index);
  };

  const handlePrev = () => {
    const nextIndex = currentIdx === 0 ? images.length - 1 : currentIdx - 1;
    scrollToIndex(nextIndex);
    startAutoSlide();
  };

  const handleNext = () => {
    const nextIndex = (currentIdx + 1) % images.length;
    scrollToIndex(nextIndex);
    startAutoSlide();
  };

  const handleCardClick = (img, event) => {
    if (event?.defaultPrevented) return;
    setPreviewImage(img);
  };

  if (loading || !images.length) return null;

  return (
    <section className="rounded-3xl bg-transparent p-4 sm:p-6 transition-all duration-500 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(250,247,240,0.97))] shadow-[0_12px_40px_-24px_rgba(13,59,46,0.22)]">
      <div className="mb-4 sm:mb-5">
        <span className="inline-flex rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-deep">Monthly Plan</span>
        <h3 className="mt-4 text-2xl sm:text-3xl font-bold text-emerald-deep">Plan for {monthName}</h3>
        <p className="mt-2 text-sm text-emerald-deep/70">Browse our planned activities and initiatives</p>
      </div>

      <div className="relative group">
        <div
          ref={scrollerRef}
          className="no-scrollbar overflow-x-auto rounded-[2rem] bg-transparent p-0 scroll-smooth pb-0 snap-x snap-mandatory touch-pan-x"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="grid grid-flow-col auto-cols-[calc(100vw-2rem)] gap-3 bg-transparent transition-none md:auto-cols-[calc((100%-1.5rem)/2)] md:gap-6">
            {images.map((img, idx) => (
              <button
                key={`${img}-${idx}`}
                data-plan-card
                onClick={(event) => handleCardClick(img, event)}
                className="group/card block w-full snap-start snap-always overflow-hidden rounded-3xl border border-emerald/10 bg-transparent shadow-[0_20px_50px_rgba(13,59,46,0.10)] transition-all duration-500 hover:border-gold/30 hover:shadow-[0_28px_60px_rgba(13,59,46,0.14)] cursor-pointer"
              >
                <div className="relative flex h-[300px] w-full items-center justify-center overflow-hidden sm:h-[360px] lg:h-[420px]">
                  {isVideoSource(img) ? (
                    <video
                      src={buildPreviewUrl(img)}
                      className="max-h-full max-w-full h-auto w-auto object-contain transition-transform duration-500 group-hover/card:scale-[1.02]"
                      controls
                      playsInline
                      onPlay={() => {
                        isVideoPlayingRef.current = true;
                      }}
                      onPause={() => {
                        isVideoPlayingRef.current = false;
                      }}
                      onEnded={() => {
                        isVideoPlayingRef.current = false;
                      }}
                      onClick={(event) => event.stopPropagation()}
                    />
                  ) : (
                    <img
                      src={buildPreviewUrl(img)}
                      alt={`plan-image-${idx}`}
                      className="max-h-full max-w-full h-auto w-auto object-contain transition-transform duration-500 group-hover/card:scale-[1.02]"
                    />
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-emerald-deep/10 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover/card:opacity-100" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {images.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute -left-4 top-1/2 -translate-y-1/2 rounded-full border border-emerald/15 bg-white/85 p-3 text-emerald-deep shadow-[0_12px_30px_rgba(13,59,46,0.14)] backdrop-blur-md transition-all duration-300 hover:border-gold/40 hover:bg-white hover:shadow-[0_16px_40px_rgba(13,59,46,0.18)] z-20 md:opacity-0 group-hover:opacity-100"
              aria-label="Previous"
            >
              <ChevronLeft size={24} strokeWidth={2.5} />
            </button>
            <button
              onClick={handleNext}
              className="absolute -right-4 top-1/2 -translate-y-1/2 rounded-full border border-emerald/15 bg-white/85 p-3 text-emerald-deep shadow-[0_12px_30px_rgba(13,59,46,0.14)] backdrop-blur-md transition-all duration-300 hover:border-gold/40 hover:bg-white hover:shadow-[0_16px_40px_rgba(13,59,46,0.18)] z-20 md:opacity-0 group-hover:opacity-100"
              aria-label="Next"
            >
              <ChevronRight size={24} strokeWidth={2.5} />
            </button>
          </>
        )}
      </div>

      {previewImage && (
        <ClientPortal>
          <div
            onClick={() => setPreviewImage(null)}
            className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-emerald-deep/80 px-4 py-6 backdrop-blur-sm"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="mx-auto w-full max-w-4xl rounded-3xl border border-emerald/12 bg-white p-4 shadow-[0_28px_60px_rgba(13,59,46,0.25)] sm:p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-semibold text-emerald-deep">Plan Image</h3>
                <button
                  onClick={() => setPreviewImage(null)}
                  className="rounded-full text-emerald/70 hover:text-emerald-deep transition-colors"
                  aria-label="Close"
                >
                  <X size={28} />
                </button>
              </div>
            <div className="rounded-2xl overflow-hidden">
                {isVideoSource(previewImage) ? (
                  <video
                    src={buildPreviewUrl(previewImage)}
                    className="w-full h-auto max-h-[75vh] object-contain"
                    controls
                    autoPlay
                    playsInline
                    onPlay={() => {
                      isVideoPlayingRef.current = true;
                    }}
                    onPause={() => {
                      isVideoPlayingRef.current = false;
                    }}
                    onEnded={() => {
                      isVideoPlayingRef.current = false;
                    }}
                  />
                ) : (
                  <img src={buildPreviewUrl(previewImage)} alt="preview" className="w-full h-auto max-h-[75vh] object-contain" />
                )}
              </div>
            </div>
          </div>
        </ClientPortal>
      )}

      <style jsx global>{`
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </section>
  );
}
