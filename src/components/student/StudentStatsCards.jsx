"use client";

import { motion } from "framer-motion";

export default function StudentStatsCards({ items = [] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item, index) => (
        <motion.article key={item.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, delay: index * 0.025 }} className="rounded-[1.5rem] border border-white/70 bg-white/90 p-5 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.24)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">{item.label}</p>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">{item.value}</p>
        </motion.article>
      ))}
    </div>
  );
}
