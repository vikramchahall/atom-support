import { useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

export function useWebRTC(
  streamRef: React.MutableRefObject<MediaStream | null>,
  setMediaError: (msg: string) => void
) {
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const [remoteConnected, setRemoteConnected] = useState(false);

  async function waitForStream(timeoutMs = 15000): Promise<boolean> {
    if (streamRef.current) return true;
    return new Promise<boolean>((resolve) => {
      const start = Date.now();
      const interval = setInterval(() => {
        if (streamRef.current) {
          clearInterval(interval);
          resolve(true);
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(interval);
          console.warn("[WebRTC] waitForStream timed out");
          resolve(false);
        }
      }, 100);
    });
  }

  function addTracksToPC(pc: RTCPeerConnection) {
    if (!streamRef.current) return;
    const senders = pc.getSenders();
    streamRef.current.getTracks().forEach((track) => {
      const alreadyAdded = senders.some((s) => s.track?.id === track.id);
      if (!alreadyAdded) {
        pc.addTrack(track, streamRef.current!);
        console.log("[WebRTC] added track:", track.kind);
      }
    });
  }

  function createPeerConnection(remoteSocketId: string): RTCPeerConnection {
    const existing = pcsRef.current.get(remoteSocketId);
    if (existing) {
      existing.close();
      pcsRef.current.delete(remoteSocketId);
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcsRef.current.set(remoteSocketId, pc);
    addTracksToPC(pc);

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socketRef.current?.emit("ice-candidate", { to: remoteSocketId, candidate });
      }
    };

    pc.ontrack = ({ streams }) => {
      console.log("[WebRTC] got remote track from", remoteSocketId);
      if (streams[0] && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = streams[0];
        setRemoteConnected(true);
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log(`[WebRTC] ${remoteSocketId} state:`, state);
      if (state === "connected") setRemoteConnected(true);
      if (state === "disconnected" || state === "failed") {
        setRemoteConnected(false);
        pcsRef.current.delete(remoteSocketId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[ICE] ${remoteSocketId}:`, pc.iceConnectionState);
    };

    return pc;
  }

  async function replaceTracksOnAllPCs(newStream: MediaStream) {
    for (const pc of pcsRef.current.values()) {
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
  }

  function initSocket(code: string, role: string, name: string) {
    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL;

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("[Socket] NEXT_PUBLIC_SERVER_URL =", serverUrl);
    console.log("[Socket] connecting as:", name, "| role:", role, "| session:", code);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    if (!serverUrl) {
      console.error("[Socket] ❌ NEXT_PUBLIC_SERVER_URL is undefined! Check Vercel env vars.");
      setMediaError("Server URL not configured — check Vercel environment variables.");
      return;
    }

    const socket = io(serverUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[Socket] ✅ connected! id:", socket.id);
      socket.emit("join-session", { sessionCode: code, role, name });
    });

    socket.on("existing-peers", async ({ peers }: { peers: string[] }) => {
      console.log("[Socket] existing peers:", peers);
      await waitForStream();
      for (const peerId of peers) {
        try {
          const pc = createPeerConnection(peerId);
          addTracksToPC(pc);
          const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
          await pc.setLocalDescription(offer);
          socket.emit("offer", { to: peerId, offer });
          console.log("[Socket] sent offer to existing peer:", peerId);
        } catch (err) {
          console.error("[Socket] offer to existing peer failed:", peerId, err);
        }
      }
    });

    socket.on("peer-joined", async ({ socketId }: { socketId: string }) => {
      console.log("[Socket] new peer joined, sending offer:", socketId);
      await waitForStream();
      try {
        const pc = createPeerConnection(socketId);
        addTracksToPC(pc);
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
        await pc.setLocalDescription(offer);
        socket.emit("offer", { to: socketId, offer });
        console.log("[Socket] sent offer to new peer:", socketId);
      } catch (err) {
        console.error("[Socket] offer to new peer failed:", socketId, err);
      }
    });

    socket.on("offer", async ({ from, offer }: any) => {
      console.log("[Socket] received offer from:", from);
      await waitForStream();
      try {
        const pc = createPeerConnection(from);
        addTracksToPC(pc);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("answer", { to: from, answer });
        console.log("[Socket] sent answer to:", from);
      } catch (err) {
        console.error("[Socket] handling offer failed:", err);
      }
    });

    socket.on("answer", async ({ from, answer }: any) => {
      console.log("[Socket] received answer from:", from);
      const pc = pcsRef.current.get(from);
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
          console.error("[Socket] setting answer failed:", err);
        }
      }
    });

    socket.on("ice-candidate", async ({ from, candidate }: any) => {
      const pc = pcsRef.current.get(from);
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn("[ICE] failed:", e);
        }
      }
    });

    socket.on("peer-left", ({ socketId }: any) => {
      console.log("[Socket] peer left:", socketId);
      const pc = pcsRef.current.get(socketId);
      if (pc) { pc.close(); pcsRef.current.delete(socketId); }
      setRemoteConnected(false);
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    });

    socket.on("connect_error", (err) => {
      console.error("[Socket] ❌ connect_error:", err.message, err);
      setMediaError("Video server unreachable — chat still works.");
    });

    socket.on("disconnect", (reason) => {
      console.warn("[Socket] disconnected:", reason);
    });
  }

  function destroyWebRTC() {
    pcsRef.current.forEach((pc) => pc.close());
    pcsRef.current.clear();
    socketRef.current?.disconnect();
    socketRef.current = null;
  }

  return {
    remoteVideoRef,
    socketRef,
    pcsRef,
    remoteConnected,
    initSocket,
    destroyWebRTC,
    replaceTracksOnAllPCs,
  };
}