"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { signIn } from "next-auth/react";

const initialErrors = {
  identifier: "",
  password: "",
  form: "",
};

const container = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: "easeOut", staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState(initialErrors);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = { ...initialErrors };
    if (!identifier.trim()) {
      nextErrors.identifier = "Email or phone is required.";
    }
    if (!password.trim()) {
      nextErrors.password = "Password is required.";
    }

    if (nextErrors.identifier || nextErrors.password) {
      setErrors(nextErrors);
      return;
    }

    setPending(true);
    setErrors(initialErrors);

    try {
      await signIn("credentials", {
        identifier,
        password,
        redirectTo: "/parent/dashboard",
      });
    } catch {
      setErrors((current) => ({
        ...current,
        form: "Sign in failed. Please try again.",
      }));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f5f7fb] text-slate-900">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.18),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.14),_transparent_30%),linear-gradient(180deg,_#f8fbff_0%,_#eef4ff_100%)]" />
      <div className="absolute left-[-6rem] top-24 h-56 w-56 rounded-full bg-sky-400/20 blur-3xl" />
      <div className="absolute bottom-10 right-0 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <motion.div
          className="grid w-full items-stretch gap-8 lg:grid-cols-[1.1fr_0.9fr]"
          variants={container}
          initial="hidden"
          animate="show"
        >
          <motion.section
            variants={item}
            className="flex flex-col justify-between rounded-[2rem] border border-white/60 bg-white/80 p-8 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.28)] backdrop-blur-xl sm:p-10 lg:p-12"
          >
            <div className="max-w-xl">
              <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
                Learning platform access
              </span>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Sign in to continue your teaching and learning workflow.
              </h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-slate-600 sm:text-lg">
                A focused login experience for admins, coordinators, teachers, parents, and students.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                "Role-aware access",
                "Secure JWT sessions",
                "Responsive workspace",
              ].map((label) => (
                <div
                  key={label}
                  className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-4 text-sm font-medium text-slate-700"
                >
                  {label}
                </div>
              ))}
            </div>

            <div className="mt-10 rounded-3xl bg-slate-950 px-6 py-6 text-white shadow-lg">
              <p className="text-sm uppercase tracking-[0.24em] text-sky-200">Built for clarity</p>
              <p className="mt-3 max-w-md text-sm leading-6 text-slate-300">
                Clean inputs, immediate validation, and automatic redirection to the correct dashboard after authentication.
              </p>
            </div>
          </motion.section>

          <motion.section
            variants={item}
            className="rounded-[2rem] border border-slate-200/80 bg-white p-6 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.22)] sm:p-8 lg:p-10"
          >
            <div className="mb-8">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
                Welcome back
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                Sign in to your account
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Use your email or phone number with your password.
              </p>
            </div>

            {errors.form ? (
              <div
                className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                aria-live="polite"
              >
                {errors.form}
              </div>
            ) : null}

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label
                  htmlFor="identifier"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Email or phone
                </label>
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  className={`w-full rounded-2xl border px-4 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:ring-4 ${
                    errors.identifier
                      ? "border-rose-300 bg-rose-50 focus:border-rose-400 focus:ring-rose-100"
                      : "border-slate-200 bg-slate-50 focus:border-sky-400 focus:ring-sky-100"
                  }`}
                  placeholder="name@example.com or +92..."
                />
                {errors.identifier ? (
                  <p className="mt-2 text-sm text-rose-600">{errors.identifier}</p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={`w-full rounded-2xl border px-4 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:ring-4 ${
                    errors.password
                      ? "border-rose-300 bg-rose-50 focus:border-rose-400 focus:ring-rose-100"
                      : "border-slate-200 bg-slate-50 focus:border-sky-400 focus:ring-sky-100"
                  }`}
                  placeholder="Enter your password"
                />
                {errors.password ? (
                  <p className="mt-2 text-sm text-rose-600">{errors.password}</p>
                ) : null}
              </div>

              <motion.button
                type="submit"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.99 }}
                disabled={pending}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {pending ? "Signing in..." : "Sign in"}
              </motion.button>
            </form>
          </motion.section>
        </motion.div>
      </div>
    </main>
  );
}
