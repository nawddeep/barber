"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button, Flower, Input, Label, Logo } from "@/components/ui";
import { supabase } from "@/src/supabaseClient";

type Values = { email: string; password: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignUpForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (v: Values) => {
    setError(null);
    try {
      const email = v.email.trim();
      const { error: sbError } = await supabase.auth.signUp({
        email,
        password: v.password,
      });

      if (sbError) {
        setError(sbError.message);
        return;
      }

      // Do NOT auto-login or redirect to a dashboard/home page immediately after signup.
      // Redirect to the Sign In page with email passed along in query params.
      await supabase.auth.signOut();
      router.push(`/admin/login?email=${encodeURIComponent(email)}&registered=true`);
    } catch {
      setError("Could not sign up. Please try again.");
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
            <h1 className="font-display text-3xl text-green">Sign up</h1>
            <span className="rounded-full bg-yellow px-3 py-1 text-xs font-bold uppercase tracking-wider text-green-dark">New Account</span>
          </div>

          <p className="mt-2 text-sm text-ink/75">
            Create an account to access the salon management panel.
          </p>

          <form noValidate onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4" aria-label="Sign up">
            <div>
              <Label htmlFor="signup-email">Email</Label>
              <Input
                id="signup-email"
                type="email"
                autoComplete="username"
                invalid={!!errors.email}
                aria-describedby="signup-email-err"
                {...register("email", {
                  required: "Enter your email",
                  validate: (v) => EMAIL.test(v.trim()) || "Enter a valid email",
                })}
              />
              {errors.email && (
                <p id="signup-email-err" role="alert" className="mt-1 text-sm font-medium text-orange-ink">
                  {errors.email.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="signup-password">Password</Label>
              <Input
                id="signup-password"
                type="password"
                autoComplete="new-password"
                invalid={!!errors.password}
                aria-describedby="signup-pw-err"
                {...register("password", {
                  required: "Enter your password",
                  minLength: { value: 6, message: "Password must be at least 6 characters" },
                })}
              />
              {errors.password && (
                <p id="signup-pw-err" role="alert" className="mt-1 text-sm font-medium text-orange-ink">
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
              {isSubmitting ? "Creating account…" : "Create account"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-ink/80">
            <span>Already have an account? </span>
            <Link href="/admin/login" className="font-bold text-green underline hover:text-green-dark">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
