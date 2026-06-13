"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import {
  Mic, MicOff, Video, VideoOff, Phone, Send,
  Paperclip, Pencil, Square, Circle, Type,
  Minus, RotateCcw, Zap, Users, ChevronRight,
  Bot, Copy, CheckCircle, X
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { io, Socket } from "socket.io-client";

type Message = { id: string; sender: string; message: string; created_at: string };
type Tool = "pen" | "arrow" | "rectangle" | "circle" | "text" | "laser" | null;

// Google STUN servers — free, no config needed
const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

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
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [mediaError, setMediaError] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState("");

  // WebRTC
  const socketRef = useRef<Socket | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const [remoteConnected, setRemoteConnected] = useState(false);

  // Chat
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [sending, setSending] = useState(false);

  // Canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeTool, setActiveTool] = useState<Tool>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [toolColor, setToolColor] = useState("#FFB200");

  // UI
  const [tab, setTab] = useState<"chat" | "ai">("chat");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [participantCount, setParticipantCount] = useState(1);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    initMedia().then(() => initSession());
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      pcsRef.current.forEach(pc => pc.close());
      socketRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Media ──────────────────────────────────────────────────────────────────

  async function initMedia(deviceId?: string) {
    try {
      streamRef.current?.getTracks().forEach(t => t.stop());
      const s = await navigator.mediaDevices.getUserMedia({
        video: deviceId ? { deviceId: { exact: deviceId } } : true,
        audio: true,
      });
      streamRef.current = s;
      setStream(s);
      if (localVideoRef.current) localVideoRef.current.srcObject = s;

      const all = await navigator.mediaDevices.enumerateDevices();
      const cams = all.filter(d => d.kind === "videoinput");
      setDevices(cams);
      if (!deviceId && cams[0]) setSelectedCamera(cams[0].deviceId);
      return s;
    } catch (err: any) {
      setMediaError("Camera/mic unavailable. Chat still works.");
      return null;
    }
  }

  async function switchCamera(deviceId: string) {
    setSelectedCamera(deviceId);
    const newStream = await initMedia(deviceId);
    if (!newStream) return;
    const videoTrack = newStream.getVideoTracks()[0];
    // Replace track in all active peer connections
    pcsRef.current.forEach(pc => {
      const sender = pc.getSenders().find(s => s.track?.kind === "video");
      if (sender && videoTrack) sender.replaceTrack(videoTrack);
    });
  }

  // ── WebRTC helpers ─────────────────────────────────────────────────────────

  function createPeerConnection(remoteSocketId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcsRef.current.set(remoteSocketId, pc);

    // Add local tracks
    streamRef.current?.getTracks().forEach(track => {
      pc.addTrack(track, streamRef.current!);
    });

    // Send ICE candidates to the remote peer via server
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socketRef.current?.emit("ice-candidate", { to: remoteSocketId, candidate });
      }
    };

    // When remote track arrives, show it
    pc.ontrack = ({ streams }) => {
      if (remoteVideoRef.current && streams[0]) {
        remoteVideoRef.current.srcObject = streams[0];
        setRemoteConnected(true);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        setRemoteConnected(false);
        pcsRef.current.delete(remoteSocketId);
      }
    };

    return pc;
  }

  // ── Session + signaling ────────────────────────────────────────────────────

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

    // ── Socket.IO signaling ──
    const socket = io(process.env.NEXT_PUBLIC_SERVER_URL!, {
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join-session", { sessionCode: code, role, name });
    });

    // Someone already in the room — WE initiate the offer
    socket.on("existing-peers", async ({ peers }: { peers: string[] }) => {
      for (const peerId of peers) {
        const pc = createPeerConnection(peerId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("offer", { to: peerId, offer });
      }
    });

    // New peer joined AFTER us — THEY will send us an offer
    socket.on("peer-joined", ({ socketId }: { socketId: string }) => {
      // Just create the PC ready to receive their offer
      createPeerConnection(socketId);
    });

    // Received an offer — send back answer
    socket.on("offer", async ({ from, offer }: any) => {
      let pc = pcsRef.current.get(from);
      if (!pc) pc = createPeerConnection(from);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("answer", { to: from, answer });
    });

    // Received answer to our offer
    socket.on("answer", async ({ from, answer }: any) => {
      const pc = pcsRef.current.get(from);
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
    });

    // ICE candidate from remote
    socket.on("ice-candidate", async ({ from, candidate }: any) => {
      const pc = pcsRef.current.get(from);
      if (pc && candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on("peer-left", ({ socketId }: any) => {
      const pc = pcsRef.current.get(socketId);
      if (pc) { pc.close(); pcsRef.current.delete(socketId); }
      setRemoteConnected(false);
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    });

    socket.on("connect_error", () => {
      setMediaError("Video server unreachable. Chat still works.");
    });
  }

  // ── Chat ───────────────────────────────────────────────────────────────────

  async function sendMessage() {
    if (!chatInput.trim() || !sessionId || sending) return;
    setSending(true);
    const msg = chatInput.trim();
    setChatInput("");
    await supabase.from("messages").insert({ session_id: sessionId, sender: name, message: msg });
    setSending(false);
  }

  // ── Controls ───────────────────────────────────────────────────────────────

  function toggleMic() {
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !micOn; });
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
    pcsRef.current.forEach(pc => pc.close());
    socketRef.current?.disconnect();
    router.push(role === "agent" ? "/dashboard" : "/");
  }

  function copySessionLink() {
    navigator.clipboard.writeText(`${window.location.origin}/join?prefill=${code}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  // ── Canvas ─────────────────────────────────────────────────────────────────

  function getCanvasPos(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvasRef.current!.width / rect.width),
      y: (e.clientY - rect.top) * (canvasRef.current!.height / rect.height),
    };
  }

  function canvasMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!activeTool) return;
    setIsDrawing(true);
    setDrawStart(getCanvasPos(e));
  }

  function canvasMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawing || !activeTool || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d")!;
    const pos = getCanvasPos(e);
    if (activeTool === "pen" || activeTool === "laser") {
      ctx.strokeStyle = activeTool === "laser" ? "rgba(255,50,50,0.8)" : toolColor;
      ctx.lineWidth = activeTool === "laser" ? 4 : 2.5;
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(drawStart.x, drawStart.y);
      ctx.lineTo(pos.x, pos.y); ctx.stroke();
      setDrawStart(pos);
    }
  }

  function canvasMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawing || !activeTool || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d")!;
    const pos = getCanvasPos(e);
    ctx.strokeStyle = toolColor; ctx.lineWidth = 2.5; ctx.lineCap = "round";
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
      ctx.lineTo(pos.x - 16 * Math.cos(angle - 0.4), pos.y - 16 * Math.sin(angle - 0.4));
      ctx.lineTo(pos.x - 16 * Math.cos(angle + 0.4), pos.y - 16 * Math.sin(angle + 0.4));
      ctx.closePath(); ctx.fillStyle = toolColor; ctx.fill();
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

  const drawingTools = [
    { id: "pen", icon: <Pencil className="w-4 h-4" />, label: "Pen" },
    { id: "arrow", icon: <ChevronRight className="w-4 h-4" />, label: "Arrow" },
    { id: "rectangle", icon: <Square className="w-4 h-4" />, label: "Rect" },
    { id: "circle", icon: <Circle className="w-4 h-4" />, label: "Circle" },
    { id: "text", icon: <Type className="w-4 h-4" />, label: "Text" },
    { id: "laser", icon: <Minus className="w-4 h-4" />, label: "Laser" },
  ];
  const colors = ["#FFB200", "#EF4444", "#22C55E", "#3B82F6", "#A855F7", "#FFFFFF"];
  const stampNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  return (
    <div className="h-screen bg-brand-navy flex flex-col overflow-hidden">
      {/* TOP BAR */}
      <div className="h-14 bg-brand-navy-mid border-b border-white/10 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full animate-pulse ${remoteConnected ? "bg-green-400" : "bg-amber-400"}`} />
          <span className="text-white font-semibold text-sm">Session #{code}</span>
          <span className="text-white/40 text-xs hidden sm:block">|</span>
          <span className="text-white/60 text-xs capitalize hidden sm:block">{role} · {name}</span>
          {remoteConnected && <span className="text-green-400 text-xs">· Live</span>}
        </div>
        <div className="flex items-center gap-3">
          {mediaError && <span className="text-amber-400 text-xs hidden md:block">{mediaError}</span>}
          <div className="flex items-center gap-1 text-white/50 text-xs">
            <Users className="w-3 h-3" /> {participantCount}
          </div>
          {role === "agent" && (
            <button onClick={copySessionLink}
              className="flex items-center gap-1 text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-full transition-colors">
              {copiedLink
                ? <><CheckCircle className="w-3 h-3 text-green-400" /> Copied</>
                : <><Copy className="w-3 h-3" /> Copy invite link</>}
            </button>
          )}
        </div>
      </div>

      {/* MAIN */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT TOOLBAR */}
        {role === "agent" && (
          <div className="w-14 bg-brand-navy-mid border-r border-white/10 flex flex-col items-center py-3 gap-1.5 flex-shrink-0 overflow-y-auto">
            {drawingTools.map((t) => (
              <button key={t.id} title={t.label}
                onClick={() => setActiveTool(activeTool === t.id as Tool ? null : t.id as Tool)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all
                  ${activeTool === t.id ? "bg-brand-blue text-brand-navy" : "text-white/50 hover:text-white hover:bg-white/10"}`}>
                {t.icon}
              </button>
            ))}
            <div className="border-t border-white/10 w-7 my-1" />
            {colors.map((c) => (
              <button key={c} onClick={() => setToolColor(c)} style={{ background: c }}
                className={`w-5 h-5 rounded-full transition-all hover:scale-110 flex-shrink-0
                  ${toolColor === c ? "ring-2 ring-white ring-offset-1 ring-offset-brand-navy-mid scale-110" : ""}`} />
            ))}
            <div className="border-t border-white/10 w-7 my-1" />
            <p className="text-white/30 text-[9px] text-center leading-none">STAMP</p>
            {stampNumbers.map((n) => (
              <button key={n} onClick={() => stampNumber(n)}
                className="w-9 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white/60 hover:text-white hover:bg-white/10 transition-all border border-white/10">
                {n}
              </button>
            ))}
            <div className="border-t border-white/10 w-7 my-1" />
            <button onClick={clearCanvas}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-white/10">
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* CENTER VIDEO */}
        <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />

          {!remoteConnected && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Users className="w-10 h-10 text-white/20" />
                </div>
                <p className="text-white/20 text-sm">Waiting for other participant...</p>
              </div>
            </div>
          )}

          {role === "agent" && (
            <canvas ref={canvasRef} width={1280} height={720}
              onMouseDown={canvasMouseDown} onMouseMove={canvasMouseMove}
              onMouseUp={canvasMouseUp} onMouseLeave={() => setIsDrawing(false)}
              className="absolute inset-0 w-full h-full"
              style={{ cursor: activeTool ? "crosshair" : "default" }} />
          )}

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

          {activeTool && role === "agent" && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 glass-dark rounded-full px-4 py-2 text-white/80 text-xs capitalize flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: toolColor }} />
              {activeTool} tool active
              <button onClick={() => setActiveTool(null)} className="ml-1 text-white/40 hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* RIGHT PANEL */}
        <div className="w-72 bg-brand-navy-mid border-l border-white/10 flex flex-col flex-shrink-0">
          <div className="flex border-b border-white/10 flex-shrink-0">
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
                  <p className="text-white/30 text-xs text-center mt-8">No messages yet. Say hello!</p>
                )}
                {messages.map((m) => (
                  <div key={m.id} className={`flex flex-col gap-1 ${m.sender === name ? "items-end" : "items-start"}`}>
                    <span className="text-white/40 text-xs px-1">{m.sender}</span>
                    <div className={`max-w-[88%] px-3 py-2 rounded-2xl text-sm leading-relaxed break-words
                      ${m.sender === name ? "bg-brand-blue text-brand-navy font-medium rounded-br-sm" : "bg-white/10 text-white rounded-bl-sm"}`}>
                      {m.message}
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
              {role === "agent" && (
                <button onClick={generateAISummary} disabled={aiLoading}
                  className="btn-primary flex items-center justify-center gap-2 text-xs py-3">
                  {aiLoading
                    ? <div className="w-3 h-3 border-2 border-brand-navy/30 border-t-brand-navy rounded-full animate-spin" />
                    : <Zap className="w-3 h-3" />}
                  {aiLoading ? "Generating..." : "Generate AI Summary"}
                </button>
              )}
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
      </div>

      {/* BOTTOM CONTROLS */}
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

        {role === "agent" && (
          <>
            <label className="w-12 h-12 bg-white/10 text-white rounded-2xl flex items-center justify-center cursor-pointer hover:bg-white/20 transition-all">
              <Paperclip className="w-5 h-5" />
              <input type="file" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !sessionId) return;
                const path = `${sessionId}/${Date.now()}-${file.name}`;
                const { error } = await supabase.storage.from("support-files").upload(path, file);
                if (!error) {
                  const { data: url } = supabase.storage.from("support-files").getPublicUrl(path);
                  await supabase.from("files").insert({ session_id: sessionId, file_url: url.publicUrl, file_name: file.name, file_size: file.size, uploaded_by: name });
                  await supabase.from("messages").insert({ session_id: sessionId, sender: name, message: `📎 Shared file: ${file.name}` });
                }
              }} />
            </label>
            <button onClick={() => { setTab("ai"); generateAISummary(); }}
              className="w-12 h-12 bg-brand-blue/20 text-brand-blue rounded-2xl flex items-center justify-center hover:bg-brand-blue/30 transition-all">
              <Bot className="w-5 h-5" />
            </button>
          </>
        )}
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