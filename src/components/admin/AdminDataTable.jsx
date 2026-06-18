"use client";

import { motion } from "framer-motion";

function renderValue(column, row) {
  if (typeof column.render === "function") {
    return column.render(row);
  }

  const value = row?.[column.key];
  return value ?? "-";
}

export default function AdminDataTable({
  columns = [],
  rows = [],
  keyField = "id",
  emptyMessage = "No records found.",
  actions,
}) {
  if (!rows.length) {
    return (
      <section className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white/85 p-10 text-center text-sm text-slate-500 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.18)]">
        {emptyMessage}
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="hidden overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/90 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)] lg:block">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/80">
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {columns.map((column) => (
                  <th key={column.key} className="px-6 py-4">
                    {column.label}
                  </th>
                ))}
                {actions ? <th className="px-6 py-4">Actions</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, index) => (
                <motion.tr
                  key={row[keyField] || index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: index * 0.02 }}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-6 py-5 align-top text-sm text-slate-700 ${column.cellClassName || ""}`}
                    >
                      {renderValue(column, row)}
                    </td>
                  ))}
                  {actions ? (
                    <td className="px-6 py-5 align-top">
                      <div className="flex flex-wrap gap-2">{actions(row)}</div>
                    </td>
                  ) : null}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 lg:hidden">
        {rows.map((row, index) => (
          <motion.article
            key={row[keyField] || index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, delay: index * 0.02 }}
            className="rounded-[1.5rem] border border-white/70 bg-white/90 p-5 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.22)]"
          >
            <div className="space-y-3">
              {columns.map((column) => (
                <div key={column.key}>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {column.label}
                  </p>
                  <div className="mt-1 text-sm text-slate-800">
                    {renderValue(column, row)}
                  </div>
                </div>
              ))}
            </div>

            {actions ? (
              <div className="mt-4 flex flex-wrap gap-2">{actions(row)}</div>
            ) : null}
          </motion.article>
        ))}
      </div>
    </section>
  );
}
