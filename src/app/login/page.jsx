"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { signIn } from "next-auth/react";
import { Eye, EyeOff } from "lucide-react";

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
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState(initialErrors);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = { ...initialErrors };
    if (!identifier.trim()) {
      nextErrors.identifier = "Email is required.";
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
      const result = await signIn("credentials", {
        identifier,
        password,
        redirect: false,
      });

      if (!result || result.error) {
        throw new Error("Invalid credentials.");
      }

      const sessionResponse = await fetch("/api/auth/session", { cache: "no-store" });
      const session = await sessionResponse.json();
      const role = String(session?.user?.role || "").toLowerCase();
      const target =
        role === "admin"
          ? "/admin/dashboard"
          : role === "coordinator"
            ? "/coordinator/dashboard"
            : role === "teacher"
              ? "/teacher/dashboard"
              : role === "parent"
                ? "/parent/dashboard"
                : "/student/dashboard";

      router.replace(target);
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
    <main className="relative min-h-screen overflow-hidden bg-[#FAF7F0] text-[#063F32]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(45,138,106,0.16),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(201,162,39,0.12),_transparent_30%),radial-gradient(circle_at_center,_rgba(101,184,145,0.08),_transparent_42%)]" />
      <div className="absolute left-[-6rem] top-20 h-72 w-72 rounded-full bg-[#2D8A6A]/10 blur-3xl" />
      <div className="absolute bottom-[-5rem] right-[-4rem] h-80 w-80 rounded-full bg-[#C9A227]/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <motion.section
          variants={container}
          initial="hidden"
          animate="show"
          className="w-full max-w-[460px]"
        >
          <motion.div
            variants={item}
            className="relative overflow-hidden rounded-[2rem] border border-[rgba(13,59,46,0.12)] bg-white/85 p-6 shadow-[0_18px_48px_rgba(13,59,46,0.12)] backdrop-blur-xl sm:p-8"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#C9A227] via-[#E4C766] to-[#2D8A6A]" />

            <div className="mb-8">
              <p className="text-xs font-bold uppercase tracking-[0.26em] text-[#0D5C48]">
                Ash-Shajrah Learning Hub
              </p>
              <h1 className="mt-3 font-serif text-[2rem] font-semibold leading-tight text-[#063F32] sm:text-[2.2rem]">
                Sign in to your account
              </h1>
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
                  className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]"
                >
                  Email or Phone Number
                </label>
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  className={`w-full rounded-[14px] border bg-[#FAF7F0] px-4 py-3 text-[#063F32] outline-none transition placeholder:text-[#245C4F]/60 focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#2D8A6A]/10 ${
                    errors.identifier
                      ? "border-rose-300 bg-rose-50 focus:ring-rose-100"
                      : "border-[rgba(13,59,46,0.12)]"
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
                  className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className={`w-full rounded-[14px] border bg-[#FAF7F0] px-4 py-3 pr-12 text-[#063F32] outline-none transition placeholder:text-[#245C4F]/60 focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#2D8A6A]/10 ${
                      errors.password
                        ? "border-rose-300 bg-rose-50 focus:ring-rose-100"
                        : "border-[rgba(13,59,46,0.12)]"
                    }`}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute inset-y-0 right-3 flex items-center text-[#245C4F] transition hover:text-[#063F32]"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.password ? (
                  <p className="mt-2 text-sm text-rose-600">{errors.password}</p>
                ) : null}
              </div>

              <motion.button
                type="submit"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.99 }}
                disabled={pending}
                className="inline-flex w-full items-center justify-center rounded-full bg-[#2D8A6A] px-4 py-3.5 text-sm font-semibold text-[#FAF7F0] shadow-[0_12px_28px_rgba(45,138,106,0.25)] transition hover:bg-[#65B891] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {pending ? "Signing in..." : "Sign in"}
              </motion.button>
            </form>
          </motion.div>
        </motion.section>
      </div>
    </main>
  );
}
