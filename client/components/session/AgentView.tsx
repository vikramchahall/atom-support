"use client";

import { useState } from "react";
import {
  Mic, MicOff, Video, VideoOff, Phone, Send,
  Pencil, Square, Circle, Type, RotateCcw,
  Zap, Users, ChevronRight, Bot, Copy,
  CheckCircle, X, MessageSquare, Minus, Paperclip
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Tool } from "@/hooks/useCanvas";

type Props = {
  code: string;
  name: string;
  sessionId: string | null;
  sessionReady: boolean;
  participantCount: number;
  chatOpen: boolean;
  setChatOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  media: any;
  webrtc: any;
  chat: any;
  canvas: any;
  tab: "chat" | "ai";
  setTab: (t: "chat" | "ai") => void;
  endSession: () => void;
};

const COLORS = ["#FFB200", "#EF4444", "#22C55E", "#3B82F6", "#A855F7", "#FFFFFF"];
const STAMP_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const DRAWING_TOOLS: { id: Tool; icon: React.ReactNode; label: string }[] = [
  { id: "pen",       icon: <Pencil className="w-4 h-4" />,      label: "Pen" },
  { id: "arrow",     icon: <ChevronRight className="w-4 h-4" />, label: "Arrow" },
  { id: "rectangle", icon: <Square className="w-4 h-4" />,       label: "Rect" },
  { id: "circle",    icon: <Circle className="w-4 h-4" />,       label: "Circle" },
  { id: "text",      icon: <Type className="w-4 h-4" />,         label: "Text" },
  { id: "laser",     icon: <Minus className="w-4 h-4" />,        label: "Laser" },
];

export default function AgentView({
  code, name, sessionId, sessionReady, participantCount,
  chatOpen, setChatOpen,
  media, webrtc, chat, canvas,
  tab, setTab, endSession,
}: Props) {
  const { localVideoRef, micOn, camOn, mediaError, devices, selectedCamera,
    toggleMic, toggleCam, switchCamera } = media;
  const { remoteVideoRef, remoteConnected, pcsRef } = webrtc;
  const { messages, chatInput, setChatInput, sending, unread, chatEndRef, sendMessage } = chat;
  const {
    canvasRef, activeTool, setActiveTool, toolColor, setToolColor,
    lineWeight, setLineWeight,
    canvasMouseDown, canvasMouseMove, canvasMouseUp, clearCanvas, stampNumber,
  } = canvas;

  const [aiSummary, setAiSummary] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  function copySessionLink() {
    navigator.clipboard.writeText(`${window.location.origin}/join?prefill=${code}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  async function generateAISummary() {
    if (!messages.length) { setAiSummary("No messages yet."); return; }
    setAiLoading(true);
    setTab("ai");
    const chatHistory = messages.map((m: any) => `${m.sender}: ${m.message}`).join("\n");
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
      if (sessionId) {
        await supabase.from("ai_summaries").insert({ session_id: sessionId, raw_summary: summary });
      }
    } catch {
      setAiSummary("Error generating summary.");
    }
    setAiLoading(false);
  }

  return (
    <div className="h-screen bg-brand-navy flex flex-col overflow-hidden">

      {/* TOP BAR */}
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
          <button
            onClick={copySessionLink}
            className="flex items-center gap-1 text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-full transition-colors"
          >
            {copiedLink
              ? <><CheckCircle className="w-3 h-3 text-green-400" /> Copied</>
              : <><Copy className="w-3 h-3" /> Invite link</>}
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT TOOLBAR */}
        <div className="w-14 bg-brand-navy-mid border-r border-white/10 flex flex-col items-center py-3 gap-1.5 flex-shrink-0 overflow-y-auto">
          <p className="text-white/30 text-[8px] text-center uppercase tracking-widest leading-none mb-1">Tools</p>

          {DRAWING_TOOLS.map((t) => (
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
          {COLORS.map((c) => (
            <button key={c} onClick={() => setToolColor(c)} style={{ background: c }}
              className={`w-5 h-5 rounded-full transition-all hover:scale-110 flex-shrink-0
                ${toolColor === c ? "ring-2 ring-white ring-offset-1 ring-offset-brand-navy-mid scale-110" : ""}`} />
          ))}

          <div className="border-t border-white/10 w-7 my-1" />

          <p className="text-white/30 text-[8px] text-center leading-none">STAMP</p>
          {STAMP_NUMBERS.map((n) => (
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

        {/* CENTER VIDEO */}
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

          {/* Annotation canvas */}
          <canvas
            ref={canvasRef} width={1280} height={720}
            onMouseDown={canvasMouseDown}
            onMouseMove={canvasMouseMove}
            onMouseUp={canvasMouseUp}
            onMouseLeave={() => {
              if (activeTool === "laser") clearCanvas();
            }}
            className="absolute inset-0 w-full h-full"
            style={{ cursor: activeTool ? "crosshair" : "default" }}
          />

          {/* Agent PiP */}
          <div className="absolute bottom-4 right-4 w-28 h-20 rounded-2xl overflow-hidden border-2 border-white/20 shadow-modal bg-brand-navy-mid">
            <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
            {!camOn && (
              <div className="absolute inset-0 bg-brand-navy-mid flex items-center justify-center">
                <VideoOff className="w-5 h-5 text-white/30" />
              </div>
            )}
          </div>

          {/* Session badge */}
          <div className="absolute top-4 left-4 glass-dark rounded-2xl px-3 py-2">
            <p className="text-white/40 text-xs">Session</p>
            <p className="text-white font-mono font-bold text-lg leading-none">{code}</p>
          </div>

          {/* Active tool badge */}
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

        {/* RIGHT PANEL */}
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
                  {messages.map((m: any) => (
                    <div key={m.id} className={`flex flex-col gap-1 ${m.sender === name ? "items-end" : "items-start"}`}>
                      <span className="text-white/40 text-xs px-1">{m.sender}</span>
                      <div className={`max-w-[88%] px-3 py-2 rounded-2xl text-sm leading-relaxed break-words
                        ${m.sender === name
                          ? "bg-brand-blue text-brand-navy font-medium rounded-br-sm"
                          : "bg-white/10 text-white rounded-bl-sm"}`}>
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
                    <input
                      type="text" placeholder="Type a message..." value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                      disabled={!sessionReady}
                      className="flex-1 bg-white/10 border border-white/20 rounded-2xl px-3 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-brand-blue/60 disabled:opacity-40"
                    />
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
          <select value={selectedCamera} onChange={(e) => switchCamera(e.target.value, pcsRef)}
            className="bg-white/10 text-white text-xs rounded-xl px-2 py-2 border border-white/20 focus:outline-none max-w-[120px]">
            {devices.map((d: MediaDeviceInfo, i: number) => (
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
      </div>
    </div>
  );
}