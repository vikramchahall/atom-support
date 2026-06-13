"use client";

import { useState } from "react";
import Link from "next/link";
import { Video, ArrowRight, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSignup() {
    if (!name.trim()) { setError("Enter your name."); return; }
    if (!email.trim()) { setError("Enter your email."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }

    setLoading(true);
    setError("");

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { name: name.trim(), role: "agent" },
        },
      });

      if (error) {
        setLoading(false);
        setError(error.message);
        return;
      }

      if (data?.user?.identities?.length === 0) {
        setLoading(false);
        setError("This email is already registered. Please sign in.");
        return;
      }

      if (data?.user) {
        setDone(true);
      } else {
        setLoading(false);
        setError("Signup failed. Please try again.");
      }
    } catch (err: any) {
      setLoading(false);
      setError(err.message || "Something went wrong.");
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-amber-50 to-white">
        <div className="card-modal max-w-sm w-full text-center animate-fade-in-up">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-brand-navy mb-2">Account created!</h2>
          <p className="text-sm text-brand-gray-text mb-6">
            Signed up as <strong>{email}</strong>. You can sign in now.
          </p>
          <Link href="/login" className="btn-primary w-full flex items-center justify-center gap-2">
            Go to sign in <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-white to-yellow-50" />
      <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-brand-blue/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-blue rounded-3xl shadow-soft mb-4">
            <Video className="w-7 h-7 text-brand-navy" />
          </div>
          <h1 className="text-2xl font-bold text-brand-navy">Create your account</h1>
          <p className="text-sm text-brand-gray-text mt-1">Start supporting customers in minutes</p>
        </div>

        <div className="card-modal">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-brand-navy uppercase tracking-wide mb-2 block">
                Full name
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSignup()}
                autoComplete="name"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-brand-navy uppercase tracking-wide mb-2 block">
                Work email
              </label>
              <input
                type="email"
                className="input-field"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSignup()}
                autoComplete="email"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-brand-navy uppercase tracking-wide mb-2 block">
                Password
              </label>
              <input
                type="password"
                className="input-field"
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSignup()}
                autoComplete="new-password"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-2xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleSignup}
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-4 text-base"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-brand-navy/30 border-t-brand-navy rounded-full animate-spin" />
              ) : (
                <>Create account <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-brand-gray-mid text-center">
            <p className="text-sm text-brand-gray-text">
              Already have an account?{" "}
              <Link href="/login" className="text-brand-blue font-semibold hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}