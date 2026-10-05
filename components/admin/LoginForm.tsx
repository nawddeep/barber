"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button, Flower, Input, Label, Logo } from "@/components/ui";
import { DEMO_LOGINS } from "@/lib/api";
import { setSession, useSession } from "@/lib/auth-session";
import { supabase } from "@/src/supabaseClient";

type Values = { email: string; password: string };

// Plain checks (no validation library) keep the first screen the owner sees small and fast.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { session } = useSession();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<Values>({
    defaultValues: { email: "", password: "" },
  });

  const next = (() => {
    const n = params.get("next");
    return n && n.startsWith("/admin") && !n.startsWith("//") ? n : "/admin";
  })();

  const registeredEmail = params.get("email");
  const isRegistered = params.get("registered") === "true";

  // Pre-fill email if redirected from Sign Up
  useEffect(() => {
    if (registeredEmail) {
      setValue("email", registeredEmail);
    }
  }, [registeredEmail, setValue]);

  // Already signed in: go straight to the panel.
  useEffect(() => {
    if (session) router.replace(next);
  }, [session, next, router]);

  const onSubmit = async (v: Values) => {
    setError(null);
    try {
      const { data, error: sbError } = await supabase.auth.signInWithPassword({
        email: v.email.trim(),
        password: v.password,
      });

      if (sbError) {
        setError(sbError.message);
        return;
      }

      if (data.session) {
        const user = data.user;
        const role =
          (user.user_metadata?.role as "OWNER" | "STAFF") ||
          (user.email?.includes("staff") ? "STAFF" : "OWNER");
        const name =
          user.user_metadata?.name ||
          (role === "OWNER" ? "Salon owner" : "Front desk");

        setSession({
          email: user.email || v.email,
          name,
          role,
        });
        router.replace(next);
      }
    } catch {
      setError("Could not sign in. Please try again.");
    }
  };

  return (
    <main id="main" className="on-dark relative grid min-h-screen place-items-center overflow-hidden bg-green px-4 py-10">
      <Flower size={420} tint="bg-green-soft" className="absolute -left-32 -top-32" aria-hidden="true" />
      <Flower size={360} tint="bg-green-soft" className="absolute -bottom-28 -right-24" aria-hidden="true" />
      <div className="relative w-full max-w-md">
        <div className="mb-6 text-center">
          <Logo tone="light" href="/" className="text-5xl" />
          <p className="mt-1 text-white/80">Owner panel</p>
        </div>
        <div className="on-light rounded-[40px] bg-cream p-7 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.5)] sm:p-9">
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-display text-3xl text-green">Sign in</h1>
            <span className="rounded-full bg-yellow px-3 py-1 text-xs font-bold uppercase tracking-wider text-green-dark">Supabase Auth</span>
          </div>

          {/* Success banner when redirected from Sign Up */}
          {isRegistered && (
            <div className="mt-4 rounded-2xl bg-butter p-3.5 text-sm font-medium text-ink shadow-sm" role="status">
              Your account has been created. You can now sign in.
            </div>
          )}

          <div className="mt-4 rounded-3xl bg-butter/60 p-4 text-sm text-ink">
            <p className="font-bold">Demo logins</p>
            <ul className="mt-2 space-y-2">
              {DEMO_LOGINS.map((d) => (
                <li key={d.email} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <b>{d.role === "OWNER" ? "Owner" : "Staff"}:</b> {d.email} / {d.password}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setValue("email", d.email); setValue("password", d.password); setError(null); }}
                    className="min-h-11 rounded-full bg-white px-4 font-bold text-green"
                  >
                    Fill in
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <form noValidate onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4" aria-label="Sign in">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                invalid={!!errors.email}
                aria-describedby="email-err"
                {...register("email", {
                  required: "Enter your email",
                  validate: (v) => EMAIL.test(v.trim()) || "Enter a valid email",
                })}
              />
              {errors.email && (
                <p id="email-err" role="alert" className="mt-1 text-sm font-medium text-orange-ink">
                  {errors.email.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                invalid={!!errors.password}
                aria-describedby="pw-err"
                {...register("password", { required: "Enter your password" })}
              />
              {errors.password && (
                <p id="pw-err" role="alert" className="mt-1 text-sm font-medium text-orange-ink">
                  {errors.password.message}
                </p>
              )}
            </div>
            {error && (
              <p role="alert" className="rounded-2xl bg-status-cancelled p-3 text-sm font-bold text-status-cancelled-ink">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-ink/80">
            <span>Don&apos;t have an account? </span>
            <Link href="/signup" className="font-bold text-green underline hover:text-green-dark">
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
