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
          className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.22)]"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
            {item.label}
          </p>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
            {item.value}
          </p>
          {item.helper ? <p className="mt-2 text-sm text-slate-500">{item.helper}</p> : null}
        </motion.article>
      ))}
    </section>
  );
}
