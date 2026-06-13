"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Video, Eye, EyeOff, ArrowRight, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError("Please enter email and password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      console.log("Login data:", data);
      console.log("Login error:", error);

      if (error) {
        if (error.message.includes("Email not confirmed")) {
          setError("Email not confirmed. Go to Supabase → Auth → Providers → Email → turn OFF 'Confirm email', then try again.");
        } else if (error.message.includes("Invalid login credentials")) {
          setError("Wrong email or password.");
        } else {
          setError(error.message);
        }
        setLoading(false);
        return;
      }

      if (data?.user) {
        router.push("/dashboard");
      }
    } catch (err: any) {
      console.error("Login exception:", err);
      setError(err.message || "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-white to-yellow-50" />
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-brand-blue/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-56 h-56 bg-amber-300/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-blue rounded-3xl shadow-soft mb-4">
            <Video className="w-7 h-7 text-brand-navy" />
          </div>
          <h1 className="text-2xl font-bold text-brand-navy">Welcome back</h1>
          <p className="text-sm text-brand-gray-text mt-1">Sign in to your agent account</p>
        </div>

        <div className="card-modal">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-brand-navy uppercase tracking-wide mb-2 block">
                Email address
              </label>
              <input
                type="email"
                className="input-field"
                placeholder="agent@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-brand-navy uppercase tracking-wide mb-2 block">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  className="input-field pr-12"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-gray-text hover:text-brand-navy transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-2xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-4 text-base"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-brand-navy/30 border-t-brand-navy rounded-full animate-spin" />
              ) : (
                <>Sign in <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-brand-gray-mid text-center">
            <p className="text-sm text-brand-gray-text">
              Don't have an account?{" "}
              <Link href="/signup" className="text-brand-blue font-semibold hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-brand-gray-text">
            Are you a customer?{" "}
            <Link href="/join" className="text-brand-blue font-medium hover:underline">
              Join a session instead →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}