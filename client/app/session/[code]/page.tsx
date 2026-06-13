"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import {
  Mic, MicOff, Video, VideoOff, Phone, Send,
  Pencil, Square, Circle, Type, RotateCcw,
  Zap, Users, ChevronRight, Bot, Copy,
  CheckCircle, X, MessageSquare, ChevronDown,
  FlipHorizontal, Minus, Paperclip, SwitchCamera
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import Peer, { MediaConnection } from "peerjs";

type Message = { id: string; sender: string; message: string; created_at: string };
type Tool = "pen" | "arrow" | "rectangle" | "circle" | "text" | "laser" | null;

function SessionPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = params.code as string;
  const role = searchParams.get("role") || "customer";
  const name = searchParams.get("name") || (role === "agent" ? "Agent" : "Customer");

  // Media
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [mediaError, setMediaError] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState("");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [isMobile, setIsMobile] = useState(false);

  // WebRTC (PeerJS, inline)
  const peerRef = useRef<Peer | null>(null);
  const callRef = useRef<MediaConnection | null>(null);
  const [remoteConnected, setRemoteConnected] = useState(false);

  // Chat
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [sending, setSending] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [unread, setUnread] = useState(0);

  // Canvas (agent only)
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeTool, setActiveTool] = useState<Tool>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [toolColor, setToolColor] = useState("#FFB200");
  const [lineWeight, setLineWeight] = useState(3);
  const laserTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // UI
  const [tab, setTab] = useState<"chat" | "ai">("chat");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [participantCount, setParticipantCount] = useState(1);
  const [sessionReady, setSessionReady] = useState(false);

useEffect(() => {
  setIsMobile(/iPhone|iPad|Android/i.test(navigator.userAgent));
  initMedia().then(() => {
    initSession();
  });
  return () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    destroyWebRTC();
    if (laserTimeoutRef.current) clearTimeout(laserTimeoutRef.current);
  };
}, []);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Track unread when chat is closed
  useEffect(() => {
    if (!chatOpen && messages.length > 0) {
      setUnread(v => v + 1);
    }
  }, [messages.length]);

  useEffect(() => {
    if (chatOpen) setUnread(0);
  }, [chatOpen]);

  // ── Media ──────────────────────────────────────────────────────────────────

async function initMedia(deviceId?: string, facing?: "user" | "environment") {
  try {
    streamRef.current?.getTracks().forEach(t => t.stop());

    // Explicitly request audio permission first on mobile
    if (!deviceId && !facing) {
      try {
        const audioTest = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        audioTest.getTracks().forEach(t => t.stop());
      } catch (err) {
        console.warn("Audio permission denied:", err);
        setMediaError("Microphone permission denied — please allow mic access and refresh.");
        return null;
      }
    }

    let videoConstraint: MediaTrackConstraints | boolean = true;
    if (deviceId) {
      videoConstraint = { deviceId: { exact: deviceId } };
    } else if (facing) {
      videoConstraint = { facingMode: facing };
    }

    const s = await navigator.mediaDevices.getUserMedia({
      video: videoConstraint,
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    // Verify audio tracks came through
    if (s.getAudioTracks().length === 0) {
      setMediaError("No microphone detected — the other party won't hear you.");
    } else {
      s.getAudioTracks().forEach(t => { t.enabled = true; });
      console.log("[Media] audio tracks:", s.getAudioTracks().map(t => `${t.label} enabled:${t.enabled}`));
    }

    streamRef.current = s;
    if (localVideoRef.current) localVideoRef.current.srcObject = s;

    const all = await navigator.mediaDevices.enumerateDevices();
    const cams = all.filter(d => d.kind === "videoinput");
    setDevices(cams);
    if (!deviceId && !facing && cams[0]) setSelectedCamera(cams[0].deviceId);

    return s;
  } catch (err: any) {
    console.warn("Media error:", err.message);
    if (err.name === "NotAllowedError") {
      setMediaError("Camera/mic permission denied — please allow access and refresh.");
    } else if (err.name === "NotFoundError") {
      setMediaError("No camera or microphone found.");
    } else {
      setMediaError("Camera/mic unavailable — chat still works.");
    }
    return null;
  }
}

  async function switchCamera(deviceId: string) {
    setSelectedCamera(deviceId);
    const newStream = await initMedia(deviceId);
    if (!newStream) return;
    await replaceTracksOnCall(newStream);
  }

  async function flipCamera() {
    const next = facingMode === "user" ? "environment" : "user";
    setFacingMode(next);
    const newStream = await initMedia(undefined, next);
    if (!newStream) return;
    await replaceTracksOnCall(newStream);
  }

  // ── WebRTC (PeerJS) ────────────────────────────────────────────────────────

 async function waitForStream(timeoutMs = 15000): Promise<boolean> {
  if (streamRef.current?.getAudioTracks().length) return true;
  return new Promise<boolean>((resolve) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (streamRef.current?.getAudioTracks().length) {
        clearInterval(interval);
        resolve(true);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        resolve(false);
      }
    }, 100);
  });
}
  function handleStream(call: MediaConnection) {
    call.on("stream", (remoteStream) => {
      console.log("[PeerJS] got remote stream");
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      setRemoteConnected(true);
    });

    call.on("close", () => {
      console.log("[PeerJS] call closed");
      setRemoteConnected(false);
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    });

    call.on("error", (err) => {
      console.error("[PeerJS] call error:", err);
      setRemoteConnected(false);
    });

    callRef.current = call;
  }

  function initWebRTC(sessionCode: string, sessionRole: string) {
    const myId = sessionRole === "agent"
      ? `agent-${sessionCode}`
      : `cust-${sessionCode}-${Math.random().toString(36).slice(2, 9)}`;

    console.log("[PeerJS] my id:", myId, "| role:", sessionRole);

    const peer = new Peer(myId, {
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
        ],
      },
    });
    peerRef.current = peer;

 peer.on("open", async (id) => {
  console.log("[PeerJS] ✅ peer open, id:", id);

  if (sessionRole === "customer") {
    await waitForStream();

    if (!streamRef.current) {
      setMediaError("Camera/mic unavailable — cannot start call.");
      return;
    }

    // Ensure audio tracks are enabled
    streamRef.current.getAudioTracks().forEach(t => { t.enabled = true; });
    streamRef.current.getVideoTracks().forEach(t => { t.enabled = true; });

    console.log("[PeerJS] tracks —", streamRef.current.getTracks().map(t => `${t.kind}:${t.enabled}`));

    const call = peer.call(`agent-${sessionCode}`, streamRef.current);
    if (call) handleStream(call);
    else console.error("[PeerJS] call() returned null");
  }
});
    peer.on("call", async (call) => {
      console.log("[PeerJS] incoming call from:", call.peer);
      await waitForStream();
      if (!streamRef.current) {
        setMediaError("Camera/mic unavailable — cannot answer call.");
        return;
      }
      call.answer(streamRef.current);
      handleStream(call);
    });

    peer.on("disconnected", () => {
      console.warn("[PeerJS] disconnected, attempting reconnect...");
      peer.reconnect();
    });

    peer.on("error", (err) => {
      console.error("[PeerJS] ❌ error:", err.type, err);
      if (err.type === "peer-unavailable") {
        setMediaError("Waiting for the other person to join...");
      } else if (err.type === "unavailable-id") {
        setMediaError("Session ID conflict — try refreshing.");
      } else {
        setMediaError("Video connection error: " + err.type);
      }
    });

    peer.on("close", () => {
      console.log("[PeerJS] peer closed");
      setRemoteConnected(false);
    });
  }

  async function replaceTracksOnCall(newStream: MediaStream) {
    const call = callRef.current;
    if (!call || !call.peerConnection) return;

    const pc = call.peerConnection;
    for (const sender of pc.getSenders()) {
      if (sender.track?.kind === "video") {
        const t = newStream.getVideoTracks()[0];
        if (t) await sender.replaceTrack(t);
      }
      if (sender.track?.kind === "audio") {
        const t = newStream.getAudioTracks()[0];
        if (t) await sender.replaceTrack(t);
      }
    }
  }

  function destroyWebRTC() {
    callRef.current?.close();
    callRef.current = null;
    peerRef.current?.destroy();
    peerRef.current = null;
  }

  // ── Session ────────────────────────────────────────────────────────────────

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

    const { data: msgs } = await supabase
      .from("messages").select("*")
      .eq("session_id", sess.id)
      .order("created_at", { ascending: true });
    setMessages(msgs || []);

    const { data: parts } = await supabase
      .from("participants").select("id")
      .eq("session_id", sess.id).is("left_at", null);
    setParticipantCount(parts?.length || 1);

    supabase.channel(`messages-${sess.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public",
        table: "messages", filter: `session_id=eq.${sess.id}`,
      }, (payload) => {
        setMessages(prev =>
          prev.find(m => m.id === payload.new.id) ? prev : [...prev, payload.new as Message]
        );
      }).subscribe();

    supabase.channel(`participants-${sess.id}`)
      .on("postgres_changes", {
        event: "*", schema: "public",
        table: "participants", filter: `session_id=eq.${sess.id}`,
      }, async () => {
        const { data } = await supabase.from("participants").select("id")
          .eq("session_id", sess.id).is("left_at", null);
        setParticipantCount(data?.length || 1);
      }).subscribe();

    // Start WebRTC (PeerJS handles its own signaling)
    initWebRTC(code, role);
  }

  // ── Chat ───────────────────────────────────────────────────────────────────

  async function sendMessage() {
    if (!chatInput.trim() || !sessionId || sending) return;
    setSending(true);
    const msg = chatInput.trim();
    setChatInput("");
setSending(false);  }

  // ── Controls ───────────────────────────────────────────────────────────────

  function toggleMic() {
    const tracks = streamRef.current?.getAudioTracks();
    if (!tracks?.length) { setMediaError("Microphone not available."); return; }
    tracks.forEach(t => { t.enabled = !micOn; });
    setMicOn(v => !v);
  }

  function toggleCam() {
    streamRef.current?.getVideoTracks().forEach(t => { t.enabled = !camOn; });
    setCamOn(v => !v);
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
    streamRef.current?.getTracks().forEach(t => t.stop());
    destroyWebRTC();
    router.push(role === "agent" ? "/dashboard" : "/");
  }

  function copySessionLink() {
    navigator.clipboard.writeText(`${window.location.origin}/join?prefill=${code}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  // ── Canvas ─────────────────────────────────────────────────────────────────

  function getCanvasPos(e: React.MouseEvent<HTMLCanvasElement> | React.Touch, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const clientX = "clientX" in e ? e.clientX : (e as any).clientX;
    const clientY = "clientY" in e ? e.clientY : (e as any).clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function canvasMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!activeTool) return;
    setIsDrawing(true);
    setDrawStart(getCanvasPos(e, canvasRef.current!));
  }

  function canvasMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawing || !activeTool || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d")!;
    const pos = getCanvasPos(e, canvasRef.current);

    if (activeTool === "pen") {
      ctx.strokeStyle = toolColor;
      ctx.lineWidth = lineWeight;
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(drawStart.x, drawStart.y);
      ctx.lineTo(pos.x, pos.y); ctx.stroke();
      setDrawStart(pos);
    } else if (activeTool === "laser") {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 24);
      gradient.addColorStop(0, "rgba(255, 50, 50, 0.9)");
      gradient.addColorStop(0.3, "rgba(255, 50, 50, 0.4)");
      gradient.addColorStop(1, "rgba(255, 50, 50, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 24, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 4, 0, 2 * Math.PI);
      ctx.fill();

      if (laserTimeoutRef.current) clearTimeout(laserTimeoutRef.current);
      laserTimeoutRef.current = setTimeout(() => {
        ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
      }, 300);
    }
  }

  function canvasMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawing || !activeTool || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d")!;
    const pos = getCanvasPos(e, canvasRef.current);
    ctx.strokeStyle = toolColor; ctx.lineWidth = lineWeight; ctx.lineCap = "round";

    if (activeTool === "rectangle") {
      ctx.strokeRect(drawStart.x, drawStart.y, pos.x - drawStart.x, pos.y - drawStart.y);
    } else if (activeTool === "circle") {
      const r = Math.sqrt((pos.x - drawStart.x) ** 2 + (pos.y - drawStart.y) ** 2);
      ctx.beginPath(); ctx.arc(drawStart.x, drawStart.y, r, 0, 2 * Math.PI); ctx.stroke();
    } else if (activeTool === "arrow") {
      ctx.beginPath(); ctx.moveTo(drawStart.x, drawStart.y);
      ctx.lineTo(pos.x, pos.y); ctx.stroke();
      const angle = Math.atan2(pos.y - drawStart.y, pos.x - drawStart.x);
      ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(pos.x - 20 * Math.cos(angle - 0.4), pos.y - 20 * Math.sin(angle - 0.4));
      ctx.lineTo(pos.x - 20 * Math.cos(angle + 0.4), pos.y - 20 * Math.sin(angle + 0.4));
      ctx.closePath(); ctx.fillStyle = toolColor; ctx.fill();
    } else if (activeTool === "laser") {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    setIsDrawing(false);
  }

  function clearCanvas() {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && canvasRef.current)
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  }

  function stampNumber(n: number) {
    if (!canvasRef.current) return;
    setActiveTool(null);
    const canvas = canvasRef.current;
    function placeStamp(e: MouseEvent) {
      const ctx = canvas.getContext("2d")!;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (canvas.height / rect.height);
      ctx.beginPath(); ctx.arc(x, y, 18, 0, 2 * Math.PI);
      ctx.fillStyle = toolColor; ctx.fill();
      ctx.fillStyle = "#0A1628";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(String(n), x, y);
      canvas.removeEventListener("click", placeStamp);
    }
    canvas.addEventListener("click", placeStamp);
  }

  // ── AI ─────────────────────────────────────────────────────────────────────

  async function generateAISummary() {
    if (!messages.length) { setAiSummary("No messages yet."); return; }
    setAiLoading(true); setTab("ai");
    const chatHistory = messages.map(m => `${m.sender}: ${m.message}`).join("\n");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6", max_tokens: 1000,
          messages: [{ role: "user", content: `Summarize this support chat:\n\n${chatHistory}\n\nFormat:\n**Issue:** ...\n**Steps Taken:** ...\n**Resolution:** ...\n**Follow-up:** ...` }],
        }),
      });
      const data = await res.json();
      const summary = data.content?.[0]?.text || "Could not generate summary.";
      setAiSummary(summary);
      if (sessionId) await supabase.from("ai_summaries").insert({ session_id: sessionId, raw_summary: summary });
    } catch { setAiSummary("Error generating summary."); }
    setAiLoading(false);
  }

  const drawingTools: { id: Tool; icon: React.ReactNode; label: string }[] = [
    { id: "pen", icon: <Pencil className="w-4 h-4" />, label: "Pen" },
    { id: "arrow", icon: <ChevronRight className="w-4 h-4" />, label: "Arrow" },
    { id: "rectangle", icon: <Square className="w-4 h-4" />, label: "Rect" },
    { id: "circle", icon: <Circle className="w-4 h-4" />, label: "Circle" },
    { id: "text", icon: <Type className="w-4 h-4" />, label: "Text" },
    { id: "laser", icon: <Minus className="w-4 h-4" />, label: "Laser" },
  ];

  const colors = ["#FFB200", "#EF4444", "#22C55E", "#3B82F6", "#A855F7", "#FFFFFF"];
  const stampNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  // ── CUSTOMER VIEW ──────────────────────────────────────────────────────────

  if (role === "customer") {
    return (
      <div className="h-screen bg-black flex flex-col overflow-hidden relative">

        <video
          ref={remoteVideoRef}
          autoPlay playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />

        {!remoteConnected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-white/40" />
            </div>
            <p className="text-white/60 text-sm">Waiting for agent to join...</p>
            <p className="text-white/30 text-xs mt-1">Session #{code}</p>
          </div>
        )}

        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 pt-safe pt-3 pb-2"
          style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)" }}>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${remoteConnected ? "bg-green-400 animate-pulse" : "bg-amber-400"}`} />
            <span className="text-white text-sm font-medium">#{code}</span>
            {remoteConnected && <span className="text-green-400 text-xs">Live</span>}
          </div>
          <div className="flex items-center gap-1 text-white/50 text-xs">
            <Users className="w-3 h-3" /> {participantCount}
          </div>
        </div>

        <div className="absolute bottom-28 left-4 z-20 w-24 h-32 sm:w-32 sm:h-44 rounded-2xl overflow-hidden border-2 border-white/30 shadow-xl bg-zinc-900">
          <video ref={localVideoRef} autoPlay muted playsInline
            className="w-full h-full object-cover"
            style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
          />
          {!camOn && (
            <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center">
              <VideoOff className="w-5 h-5 text-white/30" />
            </div>
          )}
        </div>

        {chatOpen && (
          <div className="absolute bottom-24 left-0 right-0 z-30 mx-3"
            style={{ maxHeight: "45vh" }}>
            <div className="bg-black/80 backdrop-blur-md rounded-3xl border border-white/10 flex flex-col overflow-hidden"
              style={{ maxHeight: "45vh" }}>

              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 flex-shrink-0">
                <span className="text-white text-xs font-semibold">Chat</span>
                <button onClick={() => setChatOpen(false)}
                  className="text-white/40 hover:text-white transition-colors">
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {messages.length === 0 && (
                  <p className="text-white/30 text-xs text-center mt-4">No messages yet</p>
                )}
                {messages.map((m) => (
                  <div key={m.id} className={`flex flex-col gap-0.5 ${m.sender === name ? "items-end" : "items-start"}`}>
                    <span className="text-white/40 text-[10px] px-1">{m.sender}</span>
<div className={`max-w-[85%] px-3 py-1.5 rounded-2xl text-sm break-words
  ${m.sender === name
    ? "bg-brand-blue text-white rounded-br-sm"
    : "bg-white/15 text-white rounded-bl-sm"}`}>
  {m.message.includes("📎 ") && m.message.includes("||") ? (() => {
    const [label, fileUrl] = m.message.split("||");
    return (
      <a href={fileUrl} target="_blank" rel="noopener noreferrer" download
        className="flex items-center gap-1.5 underline underline-offset-2 break-all">
        <Paperclip className="w-3 h-3 flex-shrink-0" />
        {label.replace("📎 ", "")}
      </a>
    );
  })() : m.message}
</div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <div className="p-2.5 border-t border-white/10 flex-shrink-0">
                <div className="flex gap-2">
                  <input type="text" placeholder="Message..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    disabled={!sessionReady}
                    className="flex-1 bg-white/10 border border-white/20 rounded-2xl px-3 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-brand-blue/60 disabled:opacity-40"
                  />
                  <button onClick={sendMessage} disabled={!chatInput.trim() || !sessionReady || sending}
                    className="w-9 h-9 bg-brand-blue rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-40">
                    <Send className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 z-20 pb-safe pb-4 pt-3 px-4"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)" }}>
          <div className="flex items-center justify-center gap-3">

            <button onClick={toggleMic}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg
                ${micOn ? "bg-white/20 text-white" : "bg-red-500 text-white"}`}>
              {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>

            <button onClick={toggleCam}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg
                ${camOn ? "bg-white/20 text-white" : "bg-red-500 text-white"}`}>
              {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>

            <button onClick={endSession}
              className="w-16 h-12 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transition-all">
              <Phone className="w-5 h-5 rotate-[135deg]" />
            </button>

            {isMobile && (
              <button onClick={flipCamera}
                className="w-12 h-12 rounded-full bg-white/20 text-white flex items-center justify-center shadow-lg">
                <SwitchCamera className="w-5 h-5" />
              </button>
            )}

            {!isMobile && devices.length > 1 && (
              <select value={selectedCamera} onChange={(e) => switchCamera(e.target.value)}
                className="bg-white/20 text-white text-xs rounded-full px-3 py-2 border border-white/20 focus:outline-none max-w-[110px]">
                {devices.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId} className="bg-zinc-900 text-white">
                    {d.label || `Camera ${i + 1}`}
                  </option>
                ))}
              </select>
            )}

            <button onClick={() => setChatOpen(v => !v)}
              className="w-12 h-12 rounded-full bg-white/20 text-white flex items-center justify-center relative shadow-lg">
              <MessageSquare className="w-5 h-5" />
              {unread > 0 && !chatOpen && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
          </div>

          {mediaError && (
            <p className="text-amber-400 text-xs text-center mt-2">{mediaError}</p>
          )}
        </div>
      </div>
    );
  }

  // ── AGENT VIEW ─────────────────────────────────────────────────────────────

  return (
    <div className="h-screen bg-brand-navy flex flex-col overflow-hidden">

      <div className="h-14 bg-brand-navy-mid border-b border-white/10 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full animate-pulse ${remoteConnected ? "bg-green-400" : "bg-amber-400"}`} />
          <span className="text-white font-semibold text-sm">Session #{code}</span>
          <span className="text-white/40 text-xs hidden sm:block">|</span>
          <span className="text-white/60 text-xs capitalize hidden sm:block">{name}</span>
          {remoteConnected && <span className="text-green-400 text-xs">· Live</span>}
        </div>
        <div className="flex items-center gap-3">
          {mediaError && <span className="text-amber-400 text-xs hidden md:block">{mediaError}</span>}
          <div className="flex items-center gap-1 text-white/50 text-xs">
            <Users className="w-3 h-3" /> {participantCount}
          </div>
          <button onClick={copySessionLink}
            className="flex items-center gap-1 text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-full transition-colors">
            {copiedLink
              ? <><CheckCircle className="w-3 h-3 text-green-400" /> Copied</>
              : <><Copy className="w-3 h-3" /> Invite link</>}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        <div className="w-14 bg-brand-navy-mid border-r border-white/10 flex flex-col items-center py-3 gap-1.5 flex-shrink-0 overflow-y-auto">

          <p className="text-white/30 text-[8px] text-center uppercase tracking-widest leading-none mb-1">Tools</p>

          {drawingTools.map((t) => (
            <button key={t.id} title={t.label}
              onClick={() => setActiveTool(activeTool === t.id ? null : t.id)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all
                ${activeTool === t.id
                  ? "bg-brand-blue text-brand-navy shadow-md"
                  : "text-white/50 hover:text-white hover:bg-white/10"}`}>
              {t.icon}
            </button>
          ))}

          <div className="border-t border-white/10 w-7 my-1" />

          <p className="text-white/30 text-[8px] text-center leading-none">SIZE</p>
          {[2, 4, 7].map(w => (
            <button key={w} onClick={() => setLineWeight(w)}
              className={`w-9 h-7 rounded-lg flex items-center justify-center transition-all
                ${lineWeight === w ? "bg-brand-blue/30 ring-1 ring-brand-blue" : "hover:bg-white/10"}`}>
              <div className="rounded-full bg-white"
                style={{ width: w * 2.5, height: w * 2.5, opacity: lineWeight === w ? 1 : 0.4 }} />
            </button>
          ))}

          <div className="border-t border-white/10 w-7 my-1" />

          <p className="text-white/30 text-[8px] text-center leading-none">COLOR</p>
          {colors.map((c) => (
            <button key={c} onClick={() => setToolColor(c)} style={{ background: c }}
              className={`w-5 h-5 rounded-full transition-all hover:scale-110 flex-shrink-0
                ${toolColor === c ? "ring-2 ring-white ring-offset-1 ring-offset-brand-navy-mid scale-110" : ""}`} />
          ))}

          <div className="border-t border-white/10 w-7 my-1" />

          <p className="text-white/30 text-[8px] text-center leading-none">STAMP</p>
          {stampNumbers.map((n) => (
            <button key={n} onClick={() => stampNumber(n)}
              className="w-9 h-7 rounded-lg flex items-center justify-center text-xs font-bold
                         text-white/60 hover:text-white hover:bg-white/10 transition-all border border-white/10">
              {n}
            </button>
          ))}

          <div className="border-t border-white/10 w-7 my-1" />

          <button onClick={clearCanvas} title="Clear all"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-white/10">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />

          {!remoteConnected && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Users className="w-10 h-10 text-white/20" />
                </div>
                <p className="text-white/20 text-sm">Waiting for customer...</p>
              </div>
            </div>
          )}

          <canvas ref={canvasRef} width={1280} height={720}
            onMouseDown={canvasMouseDown} onMouseMove={canvasMouseMove}
            onMouseUp={canvasMouseUp} onMouseLeave={() => {
              setIsDrawing(false);
              if (activeTool === "laser") clearCanvas();
            }}
            className="absolute inset-0 w-full h-full"
            style={{ cursor: activeTool ? "crosshair" : "default" }} />

          <div className="absolute bottom-4 right-4 w-28 h-20 rounded-2xl overflow-hidden border-2 border-white/20 shadow-modal bg-brand-navy-mid">
            <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
            {!camOn && (
              <div className="absolute inset-0 bg-brand-navy-mid flex items-center justify-center">
                <VideoOff className="w-5 h-5 text-white/30" />
              </div>
            )}
          </div>

          <div className="absolute top-4 left-4 glass-dark rounded-2xl px-3 py-2">
            <p className="text-white/40 text-xs">Session</p>
            <p className="text-white font-mono font-bold text-lg leading-none">{code}</p>
          </div>

          {activeTool && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 glass-dark rounded-full px-4 py-2 text-white/80 text-xs capitalize flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: activeTool === "laser" ? "#ef4444" : toolColor }} />
              {activeTool} active
              <button onClick={() => setActiveTool(null)} className="ml-1 text-white/40 hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {chatOpen ? (
          <div className="w-72 bg-brand-navy-mid border-l border-white/10 flex flex-col flex-shrink-0">

            <div className="flex border-b border-white/10 flex-shrink-0 items-center">
              {[{ id: "chat", label: "Chat" }, { id: "ai", label: "AI Copilot" }].map((t) => (
                <button key={t.id} onClick={() => setTab(t.id as "chat" | "ai")}
                  className={`flex-1 py-3 text-xs font-semibold transition-colors
                    ${tab === t.id ? "text-brand-blue border-b-2 border-brand-blue" : "text-white/40 hover:text-white/70"}`}>
                  {t.label}
                  {t.id === "chat" && messages.length > 0 && (
                    <span className="ml-1.5 bg-brand-blue text-brand-navy text-xs rounded-full px-1.5 py-0.5">{messages.length}</span>
                  )}
                </button>
              ))}
              <button onClick={() => setChatOpen(false)} title="Hide panel"
                className="px-3 text-white/30 hover:text-white transition-colors flex-shrink-0">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {tab === "chat" && (
              <>
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {!sessionReady && (
                    <div className="text-center mt-8">
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin mx-auto mb-2" />
                      <p className="text-white/30 text-xs">Connecting...</p>
                    </div>
                  )}
                  {sessionReady && messages.length === 0 && (
                    <p className="text-white/30 text-xs text-center mt-8">No messages yet.</p>
                  )}
                  {messages.map((m) => (
                    <div key={m.id} className={`flex flex-col gap-1 ${m.sender === name ? "items-end" : "items-start"}`}>
                      <span className="text-white/40 text-xs px-1">{m.sender}</span>
   <div className={`max-w-[88%] px-3 py-2 rounded-2xl text-sm leading-relaxed break-words
  ${m.sender === name
    ? "bg-brand-blue text-brand-navy font-medium rounded-br-sm"
    : "bg-white/10 text-white rounded-bl-sm"}`}>
  {m.message.includes("📎 ") && m.message.includes("||") ? (() => {
    const [label, fileUrl] = m.message.split("||");
    return (
      <a href={fileUrl} target="_blank" rel="noopener noreferrer" download
        className="flex items-center gap-1.5 underline underline-offset-2 break-all">
        <Paperclip className="w-3 h-3 flex-shrink-0" />
        {label.replace("📎 ", "")}
      </a>
    );
  })() : m.message}
</div>
                      <span className="text-white/20 text-xs px-1">
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <div className="p-3 border-t border-white/10 flex-shrink-0">
                  <div className="flex gap-2">
                    <input type="text" placeholder="Type a message..." value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                      disabled={!sessionReady}
                      className="flex-1 bg-white/10 border border-white/20 rounded-2xl px-3 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-brand-blue/60 disabled:opacity-40" />
                    <button onClick={sendMessage} disabled={!chatInput.trim() || !sessionReady || sending}
                      className="w-9 h-9 bg-brand-blue rounded-xl flex items-center justify-center hover:bg-brand-blue-light transition-colors flex-shrink-0 disabled:opacity-40">
                      <Send className="w-4 h-4 text-brand-navy" />
                    </button>
                  </div>
                </div>
              </>
            )}

            {tab === "ai" && (
              <div className="flex-1 flex flex-col p-4 gap-3 overflow-y-auto">
                <div className="text-center">
                  <div className="w-12 h-12 bg-brand-blue/20 rounded-2xl flex items-center justify-center mx-auto mb-2">
                    <Bot className="w-6 h-6 text-brand-blue" />
                  </div>
                  <p className="text-white/60 text-xs">AI-powered session assistant</p>
                </div>
                <button onClick={generateAISummary} disabled={aiLoading}
                  className="btn-primary flex items-center justify-center gap-2 text-xs py-3">
                  {aiLoading
                    ? <div className="w-3 h-3 border-2 border-brand-navy/30 border-t-brand-navy rounded-full animate-spin" />
                    : <Zap className="w-3 h-3" />}
                  {aiLoading ? "Generating..." : "Generate AI Summary"}
                </button>
                {aiSummary && (
                  <div className="bg-white/5 rounded-2xl p-4 text-white/80 text-xs leading-relaxed whitespace-pre-wrap border border-white/10">
                    {aiSummary}
                  </div>
                )}
                {!aiSummary && !aiLoading && (
                  <div className="space-y-2">
                    <p className="text-white/40 text-xs font-medium uppercase tracking-wide mb-3">Quick suggestions</p>
                    {["Check battery / power connection", "Try restarting the device",
                      "Verify network connectivity", "Update firmware or drivers",
                      "Check for error codes on screen", "Take a screenshot of the issue"].map((s) => (
                      <button key={s} onClick={() => { setChatInput(s); setTab("chat"); }}
                        className="w-full text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 text-white/60 hover:text-white text-xs transition-all">
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <button onClick={() => setChatOpen(true)}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 bg-brand-navy-mid border border-white/20 rounded-xl flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all shadow-lg">
            <MessageSquare className="w-4 h-4" />
            {unread > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {unread}
              </span>
            )}
          </button>
        )}
      </div>

      <div className="h-20 bg-brand-navy-mid border-t border-white/10 flex items-center justify-center gap-3 flex-shrink-0 flex-wrap px-4">
        <button onClick={toggleMic}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all
            ${micOn ? "bg-white/10 text-white hover:bg-white/20" : "bg-red-500/20 text-red-400 hover:bg-red-500/30"}`}>
          {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>

        <button onClick={toggleCam}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all
            ${camOn ? "bg-white/10 text-white hover:bg-white/20" : "bg-red-500/20 text-red-400 hover:bg-red-500/30"}`}>
          {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        {devices.length > 1 && (
          <select value={selectedCamera} onChange={(e) => switchCamera(e.target.value)}
            className="bg-white/10 text-white text-xs rounded-xl px-2 py-2 border border-white/20 focus:outline-none max-w-[120px]">
            {devices.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId} className="bg-brand-navy text-white">
                {d.label || `Camera ${i + 1}`}
              </option>
            ))}
          </select>
        )}

        <button onClick={endSession}
          className="w-14 h-12 bg-red-500 hover:bg-red-600 text-white rounded-2xl flex items-center justify-center transition-all">
          <Phone className="w-5 h-5 rotate-[135deg]" />
        </button>

        <label className="w-12 h-12 bg-white/10 text-white rounded-2xl flex items-center justify-center cursor-pointer hover:bg-white/20 transition-all">
          <Paperclip className="w-5 h-5" />
  <input type="file" className="hidden" onChange={async (e) => {
  const uploadedFile = e.target.files?.[0];
  if (!uploadedFile || !sessionId) return;
  const path = `${sessionId}/${Date.now()}-${uploadedFile.name}`;
  const { error } = await supabase.storage.from("support-files").upload(path, uploadedFile);
  if (!error) {
    const { data: urlData } = supabase.storage.from("support-files").getPublicUrl(path);
    await supabase.from("files").insert({ session_id: sessionId, file_url: urlData.publicUrl, file_name: uploadedFile.name, file_size: uploadedFile.size, uploaded_by: name });
    await supabase.from("messages").insert({ session_id: sessionId, sender: name, message: `📎 ${uploadedFile.name}||${urlData.publicUrl}` });
  }
}} />
        </label>

        <button onClick={() => { setTab("ai"); generateAISummary(); }}
          className="w-12 h-12 bg-brand-blue/20 text-brand-blue rounded-2xl flex items-center justify-center hover:bg-brand-blue/30 transition-all">
          <Bot className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
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