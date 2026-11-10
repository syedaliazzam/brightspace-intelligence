"use client";

import React, { useState } from "react";
import EcceAssessmentsPage from "@/components/ecce/EcceAssessmentsPage";
import TermAssessmentsView from "@/components/assessments/TermAssessmentsView";
import { ChevronDown } from "lucide-react";

export default function AssessmentPortalWrapper({
  portal = "parent",
  defaultTab = "term",
  title = "Assessment Reports",
  description = "View published assessment reports and learning outcomes.",
}) {
  const [activeTab, setActiveTab] = useState(defaultTab); // "ecce" or "term"
  const portalLabel = portal === "parent" ? "Parent Portal" : "Student Portal";

  return (
    <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-[1500px] flex-col space-y-6 px-4 py-6 pb-16 sm:px-6 lg:px-8">
      {/* 1. Page Header Section (At the very top) */}
      <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,#0F4C3A_0%,#0B3D30_100%)] p-8 text-white shadow-[0_24px_70px_-35px_rgba(15,76,58,.8)]">
        <p className="text-xs font-black uppercase tracking-[0.35em] text-[#E4C766]">
          {portalLabel}
        </p>
        <h1 className="mt-3 text-3xl font-black">{title}</h1>
        <p className="mt-3 max-w-3xl text-sm font-semibold text-white/85">
          {description}
        </p>
      </section>

      {/* 2. Content based on active tab */}
      {activeTab === "ecce" ? (
        <div className="space-y-6">
          {/* Assessment Type Filter Bar */}
          <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(250,247,240,0.98))] p-6 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)]">
            <div className="max-w-xs">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">
                  Assessment Type
                </span>
                <div className="relative">
                  <select
                    value={activeTab}
                    onChange={(e) => setActiveTab(e.target.value)}
                    className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-11 text-sm font-semibold text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#2D8A6A]/10 cursor-pointer shadow-2xs"
                  >
                    <option value="term">Term Assessment</option>
                    <option value="ecce">ECCE Assessment</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48]" />
                </div>
              </label>
            </div>
          </section>

          <EcceAssessmentsPage
            portal={portal}
            title={title}
            description={description}
            hideHero={true}
          />
        </div>
      ) : (
        <TermAssessmentsView
          portal={portal}
          hideHero={true}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
      )}
    </div>
  );
}
