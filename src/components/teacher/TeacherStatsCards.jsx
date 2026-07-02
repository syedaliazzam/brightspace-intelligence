"use client";

import { motion } from "framer-motion";

export default function TeacherStatsCards({ items = [] }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item, index) => (
        <motion.article
          key={item.key}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: index * 0.03 }}
          className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(250,247,240,0.96))] p-5 shadow-[0_18px_60px_-36px_rgba(13,59,46,0.18)]"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0D5C48]">{item.label}</p>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-[#063F32]">{item.value}</p>
        </motion.article>
      ))}
    </section>
  );
}
