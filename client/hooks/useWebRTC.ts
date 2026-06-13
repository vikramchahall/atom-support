import { useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    // Add a TURN server if peers are behind strict NAT (recommended for production)
    // { urls: "turn:your-turn-server.com", username: "user", credential: "pass" },
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

  // ─── Wait for local stream (with timeout) ────────────────────────────────
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
          console.warn("[WebRTC] waitForStream timed out — proceeding without local stream");
          resolve(false);
        }
      }, 100);
    });
  }

  // ─── Create / replace a PeerConnection ───────────────────────────────────
  function createPeerConnection(remoteSocketId: string): RTCPeerConnection {
    // Close any stale connection for this peer
    const existing = pcsRef.current.get(remoteSocketId);
    if (existing) {
      existing.close();
      pcsRef.current.delete(remoteSocketId);
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcsRef.current.set(remoteSocketId, pc);

    // Add local tracks NOW if stream is already available
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
      console.log(`[WebRTC] ${remoteSocketId} connectionState:`, state);
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

  // ─── Add local stream tracks to a PC ─────────────────────────────────────
  function addTracksToPC(pc: RTCPeerConnection) {
    if (!streamRef.current) return;
    const senders = pc.getSenders();
    streamRef.current.getTracks().forEach((track) => {
      // Don't add duplicate senders
      const alreadyAdded = senders.some((s) => s.track?.id === track.id);
      if (!alreadyAdded) {
        pc.addTrack(track, streamRef.current!);
        console.log("[WebRTC] added track:", track.kind);
      }
    });
  }

  // ─── Replace tracks on all existing PCs (e.g. camera switch) ─────────────
  async function replaceTracksOnAllPCs(newStream: MediaStream) {
    for (const pc of pcsRef.current.values()) {
      for (const sender of pc.getSenders()) {
        if (sender.track?.kind === "video") {
          const newTrack = newStream.getVideoTracks()[0];
          if (newTrack) await sender.replaceTrack(newTrack);
        }
        if (sender.track?.kind === "audio") {
          const newTrack = newStream.getAudioTracks()[0];
          if (newTrack) await sender.replaceTrack(newTrack);
        }
      }
    }
  }

  // ─── Main socket init ─────────────────────────────────────────────────────
  function initSocket(code: string, role: string, name: string) {
    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL;
    if (!serverUrl) {
      setMediaError("Server URL not configured.");
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
      console.log("[Socket] connected:", socket.id);
      socket.emit("join-session", { sessionCode: code, role, name });
    });

    // ── You joined late — existing peers already in the room ─────────────
    // YOU send offers to them (you are the "new" peer from their perspective)
    socket.on("existing-peers", async ({ peers }: { peers: string[] }) => {
      console.log("[Socket] existing peers:", peers);
      await waitForStream();

      for (const peerId of peers) {
        try {
          const pc = createPeerConnection(peerId);
          addTracksToPC(pc); // ensure tracks are added after stream wait
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          });
          await pc.setLocalDescription(offer);
          socket.emit("offer", { to: peerId, offer });
          console.log("[Socket] sent offer to existing peer:", peerId);
        } catch (err) {
          console.error("[Socket] failed to send offer to", peerId, err);
        }
      }
    });

    // ── A NEW peer just joined — YOU (already in the room) send them an offer
    // This is the critical fix: peer-joined MUST create and send an offer
    socket.on("peer-joined", async ({ socketId }: { socketId: string }) => {
      console.log("[Socket] new peer joined, sending offer to:", socketId);
      await waitForStream();

      try {
        const pc = createPeerConnection(socketId);
        addTracksToPC(pc); // ensure tracks are added after stream wait
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await pc.setLocalDescription(offer);
        socket.emit("offer", { to: socketId, offer });
        console.log("[Socket] sent offer to new peer:", socketId);
      } catch (err) {
        console.error("[Socket] failed to send offer to new peer", socketId, err);
      }
    });

    // ── Received an offer from a peer — send back an answer ──────────────
    socket.on("offer", async ({ from, offer }: any) => {
      console.log("[Socket] received offer from:", from);
      await waitForStream();

      try {
        const pc = createPeerConnection(from);
        addTracksToPC(pc); // ensure tracks added after stream wait
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("answer", { to: from, answer });
        console.log("[Socket] sent answer to:", from);
      } catch (err) {
        console.error("[Socket] failed to handle offer from", from, err);
      }
    });

    // ── Received an answer to our offer ──────────────────────────────────
    socket.on("answer", async ({ from, answer }: any) => {
      console.log("[Socket] received answer from:", from);
      const pc = pcsRef.current.get(from);
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
          console.error("[Socket] failed to set remote answer from", from, err);
        }
      }
    });

    // ── ICE candidates ────────────────────────────────────────────────────
    socket.on("ice-candidate", async ({ from, candidate }: any) => {
      const pc = pcsRef.current.get(from);
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn("[ICE] failed to add candidate:", e);
        }
      }
    });

    // ── Peer left ─────────────────────────────────────────────────────────
    socket.on("peer-left", ({ socketId }: any) => {
      console.log("[Socket] peer left:", socketId);
      const pc = pcsRef.current.get(socketId);
      if (pc) {
        pc.close();
        pcsRef.current.delete(socketId);
      }
      setRemoteConnected(false);
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    });

    socket.on("connect_error", (err) => {
      console.error("[Socket] connect error:", err.message);
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