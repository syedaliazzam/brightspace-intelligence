"use client";

import { motion } from "framer-motion";

export default function CoordinatorStatsCards({ items = [] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item, index) => (
        <motion.article
          key={item.key}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: index * 0.03 }}
          className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-white/90 p-5 shadow-[0_18px_60px_-36px_rgba(13,59,46,0.18)]"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#245C4F]">
            {item.label}
          </p>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-[#063F32]">
            {item.value}
          </p>
        </motion.article>
      ))}
    </div>
  );
}
