"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useMedia } from "@/hooks/useMedia";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useChat } from "@/hooks/useChat";
import { useCanvas } from "@/hooks/useCanvas";
import CustomerView from "@/components/session/CustomerView";
import AgentView from "@/components/session/AgentView";

function SessionPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = params.code as string;
  const role = searchParams.get("role") || "customer";
  const name = searchParams.get("name") || (role === "agent" ? "Agent" : "Customer");

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [participantCount, setParticipantCount] = useState(1);
  const [chatOpen, setChatOpen] = useState(true);
  const [tab, setTab] = useState<"chat" | "ai">("chat");

  const media = useMedia();
  const webrtc = useWebRTC(media.streamRef, () => {});
  const chat = useChat(sessionId, name, chatOpen);
  const canvas = useCanvas();

  useEffect(() => {
    (async () => {
  await media.initMedia();
  await initSession();
})();
    return () => {
      media.streamRef.current?.getTracks().forEach((t: MediaStreamTrack) => t.stop());
      webrtc.destroyWebRTC();
      if (canvas.laserTimeoutRef.current) clearTimeout(canvas.laserTimeoutRef.current);
    };
  }, []);

  async function initSession() {
    const { data: sess } = await supabase
      .from("sessions").select("id, status")
      .eq("session_code", code).single();

    if (!sess) {
      alert(`Session ${code} not found.`);
      router.push(role === "agent" ? "/dashboard" : "/join");
      return;
    }

    setSessionId(sess.id);
    setSessionReady(true);

    await supabase.from("participants").insert({
      session_id: sess.id, role, name,
      joined_at: new Date().toISOString(),
    });

    await chat.loadMessages(sess.id);
    chat.subscribeToMessages(sess.id);

    const { data: parts } = await supabase
      .from("participants").select("id")
      .eq("session_id", sess.id).is("left_at", null);
    setParticipantCount(parts?.length || 1);

    supabase.channel(`participants-${sess.id}`)
      .on("postgres_changes", {
        event: "*", schema: "public",
        table: "participants", filter: `session_id=eq.${sess.id}`,
      }, async () => {
        const { data } = await supabase.from("participants").select("id")
          .eq("session_id", sess.id).is("left_at", null);
        setParticipantCount(data?.length || 1);
      }).subscribe();

    webrtc.initSocket(code, role, name);
  }

  async function endSession() {
    if (sessionId) {
      if (role === "agent") {
        await supabase.from("sessions").update({
          status: "ended", ended_at: new Date().toISOString(),
        }).eq("id", sessionId);
      }
      await supabase.from("participants")
        .update({ left_at: new Date().toISOString() })
        .eq("session_id", sessionId).eq("name", name);
    }
    media.streamRef.current?.getTracks().forEach((t: MediaStreamTrack) => t.stop());
    webrtc.destroyWebRTC();
    router.push(role === "agent" ? "/dashboard" : "/");
  }

  const sharedProps = {
    code, name, role, sessionId, sessionReady,
    participantCount, chatOpen, setChatOpen,
    media, webrtc, chat, endSession,
  };

  if (role === "customer") return <CustomerView {...sharedProps} />;
  return <AgentView {...sharedProps} canvas={canvas} tab={tab} setTab={setTab} />;
}

export default function SessionPage() {
  return (
    <Suspense fallback={
      <div className="h-screen bg-brand-navy flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    }>
      <SessionPageInner />
    </Suspense>
  );
}