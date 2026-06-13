"use client";

import { useState } from "react";
import {
  Mic, MicOff, Video, VideoOff, Phone,
  Users, MessageSquare, ChevronDown, Send, SwitchCamera
} from "lucide-react";

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
  endSession: () => void;
};

export default function CustomerView({
  code, name, sessionReady, participantCount,
  chatOpen, setChatOpen,
  media, webrtc, chat, endSession,
}: Props) {
  const { localVideoRef, micOn, camOn, facingMode, isMobile, mediaError,
    devices, selectedCamera, toggleMic, toggleCam, switchCamera, flipCamera } = media;
  const { remoteVideoRef, remoteConnected, pcsRef } = webrtc;
  const { messages, chatInput, setChatInput, sending, unread, chatEndRef, sendMessage } = chat;

  return (
    <div className="h-screen bg-black flex flex-col overflow-hidden relative">

      {/* Full-screen remote video */}
      <video
        ref={remoteVideoRef}
        autoPlay playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Waiting overlay */}
      {!remoteConnected && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
          <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-white/40" />
          </div>
          <p className="text-white/60 text-sm">Waiting for agent to join...</p>
          <p className="text-white/30 text-xs mt-1">Session #{code}</p>
        </div>
      )}

      {/* Top bar */}
      <div
        className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 pt-safe pt-3 pb-2"
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)" }}
      >
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${remoteConnected ? "bg-green-400 animate-pulse" : "bg-amber-400"}`} />
          <span className="text-white text-sm font-medium">#{code}</span>
          {remoteConnected && <span className="text-green-400 text-xs">Live</span>}
        </div>
        <div className="flex items-center gap-1 text-white/50 text-xs">
          <Users className="w-3 h-3" /> {participantCount}
        </div>
      </div>

      {/* Local video PiP */}
      <div className="absolute bottom-28 left-4 z-20 w-24 h-32 sm:w-32 sm:h-44 rounded-2xl overflow-hidden border-2 border-white/30 shadow-xl bg-zinc-900">
        <video
          ref={localVideoRef}
          autoPlay muted playsInline
          className="w-full h-full object-cover"
          style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
        />
        {!camOn && (
          <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center">
            <VideoOff className="w-5 h-5 text-white/30" />
          </div>
        )}
      </div>

      {/* Chat panel */}
      {chatOpen && (
        <div className="absolute bottom-24 left-0 right-0 z-30 mx-3" style={{ maxHeight: "45vh" }}>
          <div
            className="bg-black/80 backdrop-blur-md rounded-3xl border border-white/10 flex flex-col overflow-hidden"
            style={{ maxHeight: "45vh" }}
          >
            {/* Chat header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 flex-shrink-0">
              <span className="text-white text-xs font-semibold">Chat</span>
              <button onClick={() => setChatOpen(false)} className="text-white/40 hover:text-white transition-colors">
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {messages.length === 0 && (
                <p className="text-white/30 text-xs text-center mt-4">No messages yet</p>
              )}
              {messages.map((m: any) => (
                <div key={m.id} className={`flex flex-col gap-0.5 ${m.sender === name ? "items-end" : "items-start"}`}>
                  <span className="text-white/40 text-[10px] px-1">{m.sender}</span>
                  <div className={`max-w-[85%] px-3 py-1.5 rounded-2xl text-sm break-words
                    ${m.sender === name
                      ? "bg-brand-blue text-white rounded-br-sm"
                      : "bg-white/15 text-white rounded-bl-sm"}`}>
                    {m.message}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="p-2.5 border-t border-white/10 flex-shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Message..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  disabled={!sessionReady}
                  className="flex-1 bg-white/10 border border-white/20 rounded-2xl px-3 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-brand-blue/60 disabled:opacity-40"
                />
                <button
                  onClick={sendMessage}
                  disabled={!chatInput.trim() || !sessionReady || sending}
                  className="w-9 h-9 bg-brand-blue rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-40"
                >
                  <Send className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom controls */}
      <div
        className="absolute bottom-0 left-0 right-0 z-20 pb-safe pb-4 pt-3 px-4"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)" }}
      >
        <div className="flex items-center justify-center gap-3">

          <button
            onClick={toggleMic}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg
              ${micOn ? "bg-white/20 text-white" : "bg-red-500 text-white"}`}
          >
            {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>

          <button
            onClick={toggleCam}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg
              ${camOn ? "bg-white/20 text-white" : "bg-red-500 text-white"}`}
          >
            {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>

          <button
            onClick={endSession}
            className="w-16 h-12 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transition-all"
          >
            <Phone className="w-5 h-5 rotate-[135deg]" />
          </button>

          {isMobile && (
            <button
              onClick={() => flipCamera(pcsRef)}
              className="w-12 h-12 rounded-full bg-white/20 text-white flex items-center justify-center shadow-lg"
            >
              <SwitchCamera className="w-5 h-5" />
            </button>
          )}

          {!isMobile && devices.length > 1 && (
            <select
              value={selectedCamera}
              onChange={(e) => switchCamera(e.target.value, pcsRef)}
              className="bg-white/20 text-white text-xs rounded-full px-3 py-2 border border-white/20 focus:outline-none max-w-[110px]"
            >
              {devices.map((d: MediaDeviceInfo, i: number) => (
                <option key={d.deviceId} value={d.deviceId} className="bg-zinc-900 text-white">
                  {d.label || `Camera ${i + 1}`}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => setChatOpen((v: boolean) => !v)}
            className="w-12 h-12 rounded-full bg-white/20 text-white flex items-center justify-center relative shadow-lg"
          >
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