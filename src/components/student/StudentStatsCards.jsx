"use client";

import { motion } from "framer-motion";

export default function StudentStatsCards({ items = [] }) {
  const gridClass =
    items.length >= 6
      ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
      : items.length === 5
        ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
        : items.length === 4
          ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          : "grid gap-4 sm:grid-cols-2 xl:grid-cols-3";

  return (
    <div className={gridClass}>
      {items.map((item, index) => (
        <motion.article
          key={item.key}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: index * 0.025 }}
          className="rounded-[1.5rem] border border-[#2D8A6A]/15 bg-white/90 p-5 shadow-[0_18px_60px_-36px_rgba(13,59,46,0.16)]"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0D5C48]">{item.label}</p>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-[#063F32]">{item.value}</p>
        </motion.article>
      ))}
    </div>
  );
}
