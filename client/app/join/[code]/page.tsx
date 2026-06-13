"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function JoinCodePage() {
  const { code } = useParams();
  const router = useRouter();

  useEffect(() => {
    // Pre-fill code and redirect to join page
    router.push(`/join?prefill=${code}`);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-500 to-amber-400 flex items-center justify-center">
      <div className="text-white text-center">
        <div className="w-8 h-8 border-2 border-white/40 border-t-white rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm">Loading session...</p>
      </div>
    </div>
  );
}