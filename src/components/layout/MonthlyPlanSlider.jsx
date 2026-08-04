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
      setCurrentIdx((prev) => {
        if (!plan?.image_urls?.length) return prev;
        return (prev + 1) % plan.image_urls.length;
      });
    }, 4000);
  }, [plan]);

  useEffect(() => {
    if (!plan?.image_urls?.length || loading) return;
    startAutoSlide();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [plan, loading, startAutoSlide]);

  if (loading || !plan?.image_urls?.length) return null;

  const images = plan.image_urls;
  const monthName = new Date(plan.start_date).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const handlePrev = () => {
    setCurrentIdx((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    startAutoSlide();
  };

  const handleNext = () => {
    setCurrentIdx((prev) => (prev + 1) % images.length);
    startAutoSlide();
  };

  return (
    <section className="rounded-3xl border border-emerald/12 bg-white p-6 sm:p-8 shadow-[0_20px_50px_rgba(13,59,46,0.14)] transition-all duration-500">
      <div className="mb-6">
        <span className="inline-flex rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-deep">Monthly Plan</span>
        <h3 className="mt-4 text-2xl sm:text-3xl font-bold text-emerald-deep">Plan for {monthName}</h3>
        <p className="mt-2 text-sm text-emerald-deep/70">Browse our planned activities and initiatives</p>
      </div>

      <div className="relative group">
        <div className="w-full overflow-hidden">
          <div className="flex gap-4 sm:gap-6 transition-transform duration-700 ease-in-out" style={{
            transform: `translateX(calc(-${currentIdx} * (calc(100% / 3) + 1.5rem)))`,
          }}>
            {images.map((img, idx) => (
              <button
                key={`${img}-${idx}`}
                onClick={() => setPreviewImage(img)}
                className="group/card flex-shrink-0 w-full md:w-1/3 overflow-hidden rounded-3xl border border-emerald/12 bg-white shadow-[0_20px_50px_rgba(13,59,46,0.14)] transition-all duration-500 hover:border-gold/35 hover:shadow-[0_28px_60px_rgba(13,59,46,0.18)] cursor-pointer"
              >
                <div className="relative h-56 w-full overflow-hidden bg-gradient-to-br from-emerald-50 to-gold/5">
                  <img
                    src={img}
                    alt={`plan-image-${idx}`}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover/card:scale-[1.05]"
                  />
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
              className="absolute -left-4 top-1/2 -translate-y-1/2 rounded-full border border-emerald/20 bg-emerald p-3 text-cream shadow-[0_12px_30px_rgba(13,59,46,0.2)] transition-all duration-300 hover:border-gold/40 hover:bg-emerald-light hover:shadow-[0_16px_40px_rgba(13,59,46,0.25)] z-20 md:opacity-0 group-hover:opacity-100"
              aria-label="Previous"
            >
              <ChevronLeft size={24} strokeWidth={2.5} />
            </button>
            <button
              onClick={handleNext}
              className="absolute -right-4 top-1/2 -translate-y-1/2 rounded-full border border-emerald/20 bg-emerald p-3 text-cream shadow-[0_12px_30px_rgba(13,59,46,0.2)] transition-all duration-300 hover:border-gold/40 hover:bg-emerald-light hover:shadow-[0_16px_40px_rgba(13,59,46,0.25)] z-20 md:opacity-0 group-hover:opacity-100"
              aria-label="Next"
            >
              <ChevronRight size={24} strokeWidth={2.5} />
            </button>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          {images.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIdx(idx)}
              className={`rounded-full transition-all duration-300 ${
                idx === currentIdx
                  ? "h-3 w-8 bg-emerald shadow-[0_4px_12px_rgba(13,59,46,0.2)]"
                  : "h-2.5 w-2.5 bg-emerald/25 hover:bg-emerald/50"
              }`}
              aria-label={`Go to image ${idx + 1}`}
            />
          ))}
        </div>
      )}

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
              <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-50 to-gold/5">
                <img src={previewImage} alt="preview" className="w-full h-auto max-h-[75vh] object-contain" />
              </div>
            </div>
          </div>
        </ClientPortal>
      )}
    </section>
  );
}
