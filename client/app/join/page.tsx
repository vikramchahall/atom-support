"use client";

import { useEffect, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { Shield } from "lucide-react";

function JoinCodeInner() {
  const { code } = useParams();
  const router = useRouter();

  useEffect(() => {
    if (code) {
      setTimeout(() => router.replace(`/join?prefill=${code}`), 1200);
    }
  }, [code, router]);

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-yellow-500 via-amber-400 to-yellow-300" />
      <div className="absolute top-20 left-10 w-48 h-48 bg-white/10 rounded-full blur-2xl" />
      <div className="absolute bottom-20 right-10 w-64 h-64 bg-white/10 rounded-full blur-2xl" />

      <div className="relative w-full max-w-sm animate-fade-in-up">
        <div className="glass rounded-4xl p-8 shadow-modal text-center">
          <div className="w-14 h-14 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Join Session</h1>
          <p className="text-white/70 text-sm mb-8">Loading your session...</p>

          <div className="flex justify-center gap-2 mb-6">
            {String(code).split("").map((digit, i) => (
              <div
                key={i}
                className="w-11 h-12 flex items-center justify-center text-white font-bold text-lg
                           bg-white/20 border border-white/30 rounded-xl"
              >
                {digit}
              </div>
            ))}
          </div>

          <div className="w-8 h-8 border-2 border-white/40 border-t-white rounded-full animate-spin mx-auto" />
        </div>
      </div>
    </div>
  );
}

export default function JoinCodePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen relative flex items-center justify-center px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500 via-amber-400 to-yellow-300" />
        <div className="w-8 h-8 border-2 border-white/40 border-t-white rounded-full animate-spin relative" />
      </div>
    }>
      <JoinCodeInner />
    </Suspense>
  );
}