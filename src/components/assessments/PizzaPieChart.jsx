"use client";

import React, { useMemo } from "react";

/**
 * getAreaChartData - Computes chart data for a learning area
 * based on percentage/scores of each skill in that area,
 * color-coded by observation status.
 */
export function getAreaChartData(skills = []) {
  if (!Array.isArray(skills) || skills.length === 0) {
    return { chartData: [], badge: "" };
  }

  const processedSkills = skills.map((s, idx) => {
    let scoreNum = Number(s.score);
    if (isNaN(scoreNum)) {
      scoreNum = 100;
    }
    // Convert legacy 0.0 - 1.0 to 0 - 100%
    if (scoreNum > 0 && scoreNum <= 1) {
      scoreNum = Math.round(scoreNum * 100);
    }

    const obs = String(s.observation || "").trim();
    const obsLower = obs.toLowerCase();

    // Assign color based on observation status
    let color = "#10B981"; // green default
    if (obsLower.includes("achieve")) {
      const greens = ["#10B981", "#059669", "#14B8A6", "#34D399"];
      color = greens[idx % greens.length];
    } else if (obsLower.includes("develop")) {
      const ambers = ["#F59E0B", "#D97706", "#EA580C", "#FBBF24"];
      color = ambers[idx % ambers.length];
    } else if (obsLower.includes("emerge")) {
      const blues = ["#3B82F6", "#6366F1", "#8B5CF6", "#0284C7"];
      color = blues[idx % blues.length];
    } else if (obsLower.includes("support") || obsLower.includes("need")) {
      color = "#EF4444";
    } else {
      const palette = ["#10B981", "#3B82F6", "#F59E0B", "#8B5CF6", "#EC4899", "#14B8A6"];
      color = palette[idx % palette.length];
    }

    return {
      label: s.skill_name || `Skill ${idx + 1}`,
      value: scoreNum,
      observation: obs,
      color,
    };
  });

  return {
    chartData: processedSkills,
    badge: "",
  };
}

/**
 * PizzaPieChart - Renders clean 2D solid circular pie charts
 * with slices representing skills of that area based on percentage.
 */
export default function PizzaPieChart({
  title,
  subtitle,
  badge,
  data = [], // [{ label: "Sound recognition", value: 60, color: "#10B981", observation: "Achieved" }, ...]
  size = 180,
  className = "",
}) {
  const total = useMemo(() => {
    return data.reduce((acc, item) => acc + (Number(item.value) || 0), 0);
  }, [data]);

  const slices = useMemo(() => {
    const validItems = data.filter((d) => Number(d.value) > 0);
    const result = [];
    let runningAngle = -Math.PI / 2; // Start from top (12 o'clock)

    for (const item of validItems) {
      const val = Number(item.value);
      const angle = total > 0 ? (val / total) * 2 * Math.PI : 0;
      const startAngle = runningAngle;
      const endAngle = runningAngle + angle;
      runningAngle = endAngle;

      const percentage = total > 0 ? Math.round((val / total) * 100) : 0;
      result.push({
        ...item,
        startAngle,
        endAngle,
        angle,
        percentage,
      });
    }

    return result;
  }, [data, total]);

  const cx = 100;
  const cy = 100;
  const radius = 80;

  function polarToCartesian(centerX, centerY, r, angleInRadians) {
    return {
      x: centerX + r * Math.cos(angleInRadians),
      y: centerY + r * Math.sin(angleInRadians),
    };
  }

  function describeArc(x, y, r, startAngle, endAngle) {
    const start = polarToCartesian(x, y, r, endAngle);
    const end = polarToCartesian(x, y, r, startAngle);
    const arcSweep = endAngle - startAngle <= Math.PI ? "0" : "1";

    return [
      "M", x, y,
      "L", end.x, end.y,
      "A", r, r, 0, arcSweep, 1, start.x, start.y,
      "Z",
    ].join(" ");
  }

  return (
    <div className={`flex flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-xs transition-all hover:shadow-md ${className}`}>
      {/* Header: Title */}
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-3">
        <div>
          <h4 className="text-base font-bold text-gray-900 tracking-tight">{title}</h4>
          {subtitle ? <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p> : null}
        </div>
        {badge ? (
          <span className="inline-flex items-center rounded-full bg-[#FAF7F0] border border-[#2D8A6A]/20 px-2.5 py-0.5 text-xs font-semibold text-[#0D5C48]">
            {badge}
          </span>
        ) : null}
      </div>

      {/* Legend Bars on top */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
        {data.map((item, idx) => (
          <div key={idx} className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
            <span
              className="inline-block h-2.5 w-6 rounded-sm shrink-0 shadow-2xs"
              style={{ backgroundColor: item.color }}
            />
            <span className="truncate max-w-[140px]" title={item.label}>
              {item.label}
            </span>
            <span className="text-gray-500 font-semibold">({item.value}%)</span>
            {item.observation && (
              <span className="text-[10px] text-gray-400 font-normal">[{item.observation}]</span>
            )}
          </div>
        ))}
      </div>

      {/* Center: Solid Pizza Pie Chart */}
      <div className="my-4 flex items-center justify-center">
        {total === 0 ? (
          <div
            className="flex items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-400"
            style={{ width: size, height: size }}
          >
            No data
          </div>
        ) : slices.length === 1 ? (
          // Single slice (100%) - full solid circle
          <svg
            viewBox="0 0 200 200"
            style={{ width: size, height: size }}
            className="transition-transform duration-200 hover:scale-[1.03]"
          >
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill={slices[0].color}
              stroke="#FFFFFF"
              strokeWidth="2.5"
            />
          </svg>
        ) : (
          // Multiple slices with crisp white separator cuts (Pizza style)
          <svg
            viewBox="0 0 200 200"
            style={{ width: size, height: size }}
            className="transition-transform duration-200 hover:scale-[1.03]"
          >
            {slices.map((slice, i) => {
              const d = describeArc(cx, cy, radius, slice.startAngle, slice.endAngle);
              return (
                <path
                  key={i}
                  d={d}
                  fill={slice.color}
                  stroke="#FFFFFF"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  className="transition-opacity duration-150 hover:opacity-90"
                >
                  <title>{`${slice.label}: ${slice.value}%${slice.observation ? ` (${slice.observation})` : ""}`}</title>
                </path>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}
