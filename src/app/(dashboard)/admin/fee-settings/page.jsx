"use client";

import { useEffect, useMemo, useState } from "react";
import AdminDashboardCards from "@/components/admin/AdminDashboardCards";

const TABS = [
  { key: "regular", label: "Regular Fees" },
  { key: "other", label: "Other Fees" },
  { key: "payment", label: "Payment Methods" },
  { key: "global", label: "Global Settings" },
];

const EMPTY_FORM = {
  regular: { class_level: "", name: "", amount: "", status: "active" },
  other: {
    name: "",
    fee_type: "admission_fee",
    class_level: "",
    amount: "",
    description: "",
    status: "active",
  },
  payment: {
    name: "",
    method_key: "",
    account_title: "",
    account_number: "",
    iban: "",
    bank_name: "",
    branch_code: "",
    instructions: "",
    status: "active",
  },
  settings: {},
};

function money(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
}

function rowKey(item, index) {
  return item?.id || `${index}`;
}

function TabButton({ active, children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
        active
          ? "bg-slate-950 text-white"
          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

export default function AdminFeeSettingsPage() {
  const [activeTab, setActiveTab] = useState("regular");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [finance, setFinance] = useState({
    totalSettings: 0,
    voucherCreated: 0,
    vouchersSubmitted: 0,
    paymentsVerified: 0,
  });
  const [regularFees, setRegularFees] = useState([]);
  const [otherFees, setOtherFees] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [classLevels, setClassLevels] = useState([]);
  const [settings, setSettings] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [forms, setForms] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState({
    regular: "",
    other: "",
    payment: "",
    setting: "",
  });

  const cards = useMemo(
    () => [
      {
        key: "voucherCreated",
        label: "Vouchers created",
        value: !loading ? finance.voucherCreated : 0,
        tone: "bg-sky-50 text-sky-800",
      },
      {
        key: "submitted",
        label: "Vouchers submitted",
        value: !loading ? finance.vouchersSubmitted : 0,
        tone: "bg-amber-50 text-amber-800",
      },
      {
        key: "verified",
        label: "Payments verified",
        value: !loading ? finance.paymentsVerified : 0,
        tone: "bg-emerald-50 text-emerald-800",
      },
    ],
    [finance, loading]
  );

  async function loadAll() {
    setLoading(true);
    setError("");

    try {
      const [feeSettingsRes, regularRes, otherRes, paymentRes, classLevelsRes] = await Promise.all([
        fetch("/api/admin/fee-settings", { cache: "no-store" }),
        fetch("/api/admin/regular-fees", { cache: "no-store" }),
        fetch("/api/admin/other-fees", { cache: "no-store" }),
        fetch("/api/admin/payment-methods", { cache: "no-store" }),
        fetch("/api/admin/class-levels", { cache: "no-store" }),
      ]);

      const [feeSettingsData, regularData, otherData, paymentData, classLevelsData] = await Promise.all([
        feeSettingsRes.json(),
        regularRes.json(),
        otherRes.json(),
        paymentRes.json(),
        classLevelsRes.json(),
      ]);

      if (!feeSettingsRes.ok) throw new Error(feeSettingsData?.message || "Unable to load fee settings.");
      if (!regularRes.ok) throw new Error(regularData?.message || "Unable to load regular fees.");
      if (!otherRes.ok) throw new Error(otherData?.message || "Unable to load other fees.");
      if (!paymentRes.ok) throw new Error(paymentData?.message || "Unable to load payment methods.");

      setFinance(
        feeSettingsData.finance || {
          totalSettings: 0,
          voucherCreated: 0,
          vouchersSubmitted: 0,
          paymentsVerified: 0,
        }
      );
      const allowedSettingKeys = new Set([
        "coordinator_max_discount_percent",
        "payment_support_email",
        "payment_support_phone",
        "default_voucher_due_days",
      ]);
      const nextSettings = (feeSettingsData.settings || []).filter((item) =>
        allowedSettingKeys.has(item.key)
      );
      setSettings(nextSettings);
      setDrafts(
        nextSettings.reduce((accumulator, item) => {
          accumulator[item.id] = {
            value: item.value || "",
            description: item.description || "",
            status: item.status || "active",
          };
          return accumulator;
        }, {})
      );
      setRegularFees(regularData.items || []);
      setOtherFees(otherData.items || []);
      setPaymentMethods(paymentData.items || []);
      setClassLevels((classLevelsData.items || []).filter((item) => item.class_level));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load fee management data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAll();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function updateForm(section, name, value) {
    setForms((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [name]: value,
      },
    }));
  }

  function startEdit(section, item) {
    if (section === "regular") {
      setForms((current) => ({
        ...current,
        regular: {
          class_level: item.class_level || "",
          name: item.name || item.title || "",
          amount: item.amount ?? "",
          status: item.status || "active",
        },
      }));
    }

    if (section === "other") {
      setForms((current) => ({
        ...current,
        other: {
          name: item.name || item.title || "",
          fee_type: item.fee_type || "admission_fee",
          class_level: item.class_level || "",
          amount: item.amount ?? "",
          description: item.description || "",
          status: item.status || "active",
        },
      }));
    }

    if (section === "payment") {
      setForms((current) => ({
        ...current,
        payment: {
          name: item.name || "",
          method_key: item.method_key || "",
          account_title: item.account_title || "",
          account_number: item.account_number || "",
          iban: item.iban || "",
          bank_name: item.bank_name || "",
          branch_code: item.branch_code || "",
          instructions: item.instructions || "",
          status: item.status || "active",
        },
      }));
    }

    setEditing((current) => ({ ...current, [section]: item.id }));
    setActiveTab(section);
  }

  async function submitEntity(section) {
    setSaving(true);
    setError("");

    try {
      const endpointMap = {
        regular: "/api/admin/regular-fees",
        other: "/api/admin/other-fees",
        payment: "/api/admin/payment-methods",
      };
      const isEditing = Boolean(editing[section]);
      const payload = forms[section];

      const response = await fetch(endpointMap[section], {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing[section] || undefined,
          ...payload,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to save record.");

      setForms((current) => ({ ...current, [section]: EMPTY_FORM[section] }));
      setEditing((current) => ({ ...current, [section]: "" }));
      await loadAll();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save record.");
    } finally {
      setSaving(false);
    }
  }

  async function saveSetting(id) {
    try {
      const draft = drafts[id];
      const response = await fetch("/api/admin/fee-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          value: draft?.value || "",
          description: draft?.description || "",
          status: draft?.status || "active",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to update setting.");
      setEditing((current) => ({ ...current, setting: "" }));
      await loadAll();
    } catch (settingError) {
      setError(settingError instanceof Error ? settingError.message : "Unable to update setting.");
    }
  }

  const sectionContent = {
    regular: (
      <div className="space-y-6">
        <form
          className="grid gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submitEntity("regular");
          }}
        >
          {classLevels.length ? (
            <select
              className="rounded-2xl border border-slate-200 px-4 py-3"
              value={forms.regular.class_level}
              onChange={(event) => updateForm("regular", "class_level", event.target.value)}
            >
              <option value="">Select class level</option>
              {classLevels.map((level) => (
                <option key={level.id} value={level.class_level}>
                  {level.title ? `${level.title} - ${level.class_level}` : level.class_level}
                </option>
              ))}
            </select>
          ) : (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 md:col-span-4">
              No active class levels found. Please add courses first.
            </p>
          )}
          <input className="rounded-2xl border border-slate-200 px-4 py-3" placeholder="Fee name" value={forms.regular.name} onChange={(event) => updateForm("regular", "name", event.target.value)} />
          <input type="number" min="0" step="0.01" className="rounded-2xl border border-slate-200 px-4 py-3" placeholder="Amount" value={forms.regular.amount} onChange={(event) => updateForm("regular", "amount", event.target.value)} />
          <select className="rounded-2xl border border-slate-200 px-4 py-3" value={forms.regular.status} onChange={(event) => updateForm("regular", "status", event.target.value)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <div className="flex gap-3 md:col-span-4">
            <button disabled={saving || !forms.regular.class_level} className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
              {editing.regular ? "Save regular fee" : "Add regular fee"}
            </button>
            {editing.regular ? (
              <button type="button" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold" onClick={() => { setEditing((current) => ({ ...current, regular: "" })); setForms((current) => ({ ...current, regular: EMPTY_FORM.regular })); }}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full table-fixed">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {regularFees.map((item, index) => (
                <tr key={rowKey(item, index)} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-sm">{item.class_level || "—"}</td>
                  <td className="px-4 py-3 text-sm">{item.name || item.title || "—"}</td>
                  <td className="px-4 py-3 text-sm">PKR {money(item.amount)}</td>
                  <td className="px-4 py-3 text-sm">{item.status || "active"}</td>
                  <td className="px-4 py-3 text-sm">
                    <button type="button" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold" onClick={() => startEdit("regular", item)}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ),
    other: (
      <div className="space-y-6">
        <form
          className="grid gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submitEntity("other");
          }}
        >
          <input className="rounded-2xl border border-slate-200 px-4 py-3" placeholder="Fee title" value={forms.other.name} onChange={(event) => updateForm("other", "name", event.target.value)} />
          <input className="rounded-2xl border border-slate-200 px-4 py-3" placeholder="Fee type" value={forms.other.fee_type} onChange={(event) => updateForm("other", "fee_type", event.target.value)} />
          <input className="rounded-2xl border border-slate-200 px-4 py-3" placeholder="Class level (optional)" value={forms.other.class_level} onChange={(event) => updateForm("other", "class_level", event.target.value)} />
          <input type="number" min="0" step="0.01" className="rounded-2xl border border-slate-200 px-4 py-3" placeholder="Amount" value={forms.other.amount} onChange={(event) => updateForm("other", "amount", event.target.value)} />
          <textarea rows={3} className="rounded-2xl border border-slate-200 px-4 py-3 md:col-span-4" placeholder="Description" value={forms.other.description} onChange={(event) => updateForm("other", "description", event.target.value)} />
          <select className="rounded-2xl border border-slate-200 px-4 py-3 md:col-span-1" value={forms.other.status} onChange={(event) => updateForm("other", "status", event.target.value)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <div className="flex gap-3 md:col-span-3 md:justify-end">
            <button disabled={saving} className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
              {editing.other ? "Save other fee" : "Add other fee"}
            </button>
            {editing.other ? (
              <button type="button" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold" onClick={() => { setEditing((current) => ({ ...current, other: "" })); setForms((current) => ({ ...current, other: EMPTY_FORM.other })); }}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full table-fixed">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {otherFees.map((item, index) => (
                <tr key={rowKey(item, index)} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-sm">{item.name || item.title || "—"}</td>
                  <td className="px-4 py-3 text-sm">{item.fee_type || "—"}</td>
                  <td className="px-4 py-3 text-sm">{item.class_level || "—"}</td>
                  <td className="px-4 py-3 text-sm">PKR {money(item.amount)}</td>
                  <td className="px-4 py-3 text-sm">{item.status || "active"}</td>
                  <td className="px-4 py-3 text-sm">
                    <button type="button" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold" onClick={() => startEdit("other", item)}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ),
    payment: (
      <div className="space-y-6">
        <form
          className="grid gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submitEntity("payment");
          }}
        >
          <input className="rounded-2xl border border-slate-200 px-4 py-3" placeholder="Method name" value={forms.payment.name} onChange={(event) => updateForm("payment", "name", event.target.value)} />
          <input className="rounded-2xl border border-slate-200 px-4 py-3" placeholder="Method key" value={forms.payment.method_key} onChange={(event) => updateForm("payment", "method_key", event.target.value)} />
          <input className="rounded-2xl border border-slate-200 px-4 py-3" placeholder="Account title" value={forms.payment.account_title} onChange={(event) => updateForm("payment", "account_title", event.target.value)} />
          <input className="rounded-2xl border border-slate-200 px-4 py-3" placeholder="Account number" value={forms.payment.account_number} onChange={(event) => updateForm("payment", "account_number", event.target.value)} />
          <input className="rounded-2xl border border-slate-200 px-4 py-3" placeholder="IBAN" value={forms.payment.iban} onChange={(event) => updateForm("payment", "iban", event.target.value)} />
          <input className="rounded-2xl border border-slate-200 px-4 py-3" placeholder="Bank name" value={forms.payment.bank_name} onChange={(event) => updateForm("payment", "bank_name", event.target.value)} />
          <input className="rounded-2xl border border-slate-200 px-4 py-3" placeholder="Branch code" value={forms.payment.branch_code} onChange={(event) => updateForm("payment", "branch_code", event.target.value)} />
          <textarea rows={3} className="rounded-2xl border border-slate-200 px-4 py-3 md:col-span-4" placeholder="Instructions" value={forms.payment.instructions} onChange={(event) => updateForm("payment", "instructions", event.target.value)} />
          <select className="rounded-2xl border border-slate-200 px-4 py-3 md:col-span-1" value={forms.payment.status} onChange={(event) => updateForm("payment", "status", event.target.value)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <div className="flex gap-3 md:col-span-3 md:justify-end">
            <button disabled={saving} className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
              {editing.payment ? "Save payment method" : "Add payment method"}
            </button>
            {editing.payment ? (
              <button type="button" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold" onClick={() => { setEditing((current) => ({ ...current, payment: "" })); setForms((current) => ({ ...current, payment: EMPTY_FORM.payment })); }}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full table-fixed">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Method key</th>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paymentMethods.map((item, index) => (
                <tr key={rowKey(item, index)} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-sm">{item.name || "—"}</td>
                  <td className="px-4 py-3 text-sm">{item.method_key || "—"}</td>
                  <td className="px-4 py-3 text-sm">{item.account_number || item.account_title || "—"}</td>
                  <td className="px-4 py-3 text-sm">{item.status || "active"}</td>
                  <td className="px-4 py-3 text-sm">
                    <button type="button" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold" onClick={() => startEdit("payment", item)}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ),
    global: (
      <div className="space-y-6">
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            {settings.map((setting) => {
              const draft = drafts[setting.id] || {};
              const isEditing = editing.setting === setting.id;
              return (
                <article key={setting.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">{setting.name}</p>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{setting.key}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditing((current) => ({ ...current, setting: isEditing ? "" : setting.id }))}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold"
                    >
                      {isEditing ? "Close" : "Edit"}
                    </button>
                  </div>
                  <div className="mt-4 space-y-3">
                      {setting.key === "coordinator_max_discount_percent" ||
                      setting.key === "payment_support_email" ||
                      setting.key === "payment_support_phone" ||
                      setting.key === "default_voucher_due_days" ? (
                        <input
                          disabled={!isEditing}
                          value={draft.value || ""}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [setting.id]: { ...current[setting.id], value: event.target.value },
                            }))
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm disabled:bg-slate-100"
                        />
                      ) : (
                        <p className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-500">
                          Locked in fee management
                        </p>
                      )}
                    <textarea
                      rows={3}
                      disabled={!isEditing}
                      value={draft.description || ""}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [setting.id]: { ...current[setting.id], description: event.target.value },
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm disabled:bg-slate-100"
                    />
                    <select
                      disabled={!isEditing}
                      value={draft.status || "active"}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [setting.id]: { ...current[setting.id], status: event.target.value },
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm disabled:bg-slate-100"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                    {isEditing ? (
                      <button
                        type="button"
                        onClick={() => void saveSetting(setting.id)}
                        className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
                      >
                        Save setting
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    ),
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(241,248,255,0.92))] p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <div className="max-w-3xl">
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Admin fee management and payment setup
          </h1>
          <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
            Manage class fees, extra charges, payment methods, and global voucher settings from one place.
          </p>
        </div>
      </section>

      <AdminDashboardCards items={cards} />

      {error ? (
        <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          {error}
        </section>
      ) : null}

      <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
        <div className="flex flex-wrap gap-3">
          {TABS.map((tab) => (
            <TabButton key={tab.key} active={activeTab === tab.key} onClick={() => setActiveTab(tab.key)}>
              {tab.label}
            </TabButton>
          ))}
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
              Loading fee management data...
            </div>
          ) : (
            sectionContent[activeTab]
          )}
        </div>
      </section>
    </div>
  );
}
