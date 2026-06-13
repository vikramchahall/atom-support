"use client";

import { useEffect, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";

function JoinCodeInner() {
  const { code } = useParams();
  const router = useRouter();

  useEffect(() => {
    if (code) {
      router.replace(`/join?prefill=${code}`);
    }
  }, [code, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-500 to-amber-400 flex items-center justify-center">
      <div className="text-white text-center">
        <div className="w-8 h-8 border-2 border-white/40 border-t-white rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm font-medium">Loading session...</p>
      </div>
    </div>
  );
}

export default function JoinCodePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-yellow-500 to-amber-400 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/40 border-t-white rounded-full animate-spin" />
      </div>
    }>
      <JoinCodeInner />
    </Suspense>
  );
}