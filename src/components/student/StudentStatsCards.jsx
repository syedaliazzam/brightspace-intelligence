"use client";

import { motion } from "framer-motion";

export default function StudentStatsCards({ items = [] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
      {items.map((item, index) => (
        <motion.article
          key={item.key}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: index * 0.025 }}
          className="min-w-0 rounded-[1.25rem] border border-[#2D8A6A]/15 bg-white/90 p-3 shadow-[0_18px_60px_-36px_rgba(13,59,46,0.16)]"
        >
          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0D5C48]">
            {item.label}
          </p>

          <p className="mt-3 truncate text-xl font-semibold tracking-tight text-[#063F32]">
            {item.value}
          </p>
        </motion.article>
      ))}
    </div>
  );
}