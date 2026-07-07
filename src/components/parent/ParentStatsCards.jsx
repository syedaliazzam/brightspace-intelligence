"use client";

import { motion } from "framer-motion";

export default function ParentStatsCards({ items = [] }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item, index) => (
        <motion.article
          key={item.key}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: index * 0.03 }}
          className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-4 px-6 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl"
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#0D5C48]">
            {item.label}
          </p>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-[#063F32]">
            {item.value}
          </p>
          {item.helper ? <p className="mt-2 text-sm text-[#245C4F]">{item.helper}</p> : null}
        </motion.article>
      ))}
    </section>
  );
}
