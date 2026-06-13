"use client";

import { useEffect, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { Video } from "lucide-react";

function JoinCodeInner() {
  const { code } = useParams();
  const router = useRouter();

  useEffect(() => {
    if (code) {
      router.replace(`/join?prefill=${code}`);
    }
  }, [code, router]);

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-white to-yellow-50" />
      <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-brand-blue/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-blue rounded-3xl shadow-soft mb-4">
            <Video className="w-7 h-7 text-brand-navy" />
          </div>
          <h1 className="text-2xl font-bold text-brand-navy">Joining session</h1>
          <p className="text-sm text-brand-gray-text mt-1">Getting your session ready...</p>
        </div>

        <div className="card-modal text-center py-8">
          <div className="w-10 h-10 border-2 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-brand-gray-text">
            Loading session <span className="font-semibold text-brand-navy">#{code}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function JoinCodePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen relative flex items-center justify-center px-4">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-white to-yellow-50" />
        <div className="relative w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-blue rounded-3xl shadow-soft mb-4">
              <Video className="w-7 h-7 text-brand-navy" />
            </div>
            <h1 className="text-2xl font-bold text-brand-navy">Joining session</h1>
            <p className="text-sm text-brand-gray-text mt-1">Getting your session ready...</p>
          </div>
          <div className="card-modal text-center py-8">
            <div className="w-10 h-10 border-2 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin mx-auto" />
          </div>
        </div>
      </div>
    }>
      <JoinCodeInner />
    </Suspense>
  );
}