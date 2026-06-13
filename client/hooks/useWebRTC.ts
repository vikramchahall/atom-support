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

  async function waitForStream() {
    if (streamRef.current) return;
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (streamRef.current) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
  }

  function createPeerConnection(remoteSocketId: string): RTCPeerConnection {
    // Close existing connection if any
    const existing = pcsRef.current.get(remoteSocketId);
    if (existing) {
      existing.close();
      pcsRef.current.delete(remoteSocketId);
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcsRef.current.set(remoteSocketId, pc);

    // Add all local tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, streamRef.current!);
      });
    }

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socketRef.current?.emit("ice-candidate", { to: remoteSocketId, candidate });
      }
    };

    pc.ontrack = ({ streams }) => {
      if (streams[0] && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = streams[0];
        setRemoteConnected(true);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] ${remoteSocketId} state:`, pc.connectionState);
      if (pc.connectionState === "connected") {
        setRemoteConnected(true);
      }
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        setRemoteConnected(false);
        pcsRef.current.delete(remoteSocketId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[ICE] ${remoteSocketId}:`, pc.iceConnectionState);
    };

    return pc;
  }

  function initSocket(code: string, role: string, name: string) {
    const socket = io(process.env.NEXT_PUBLIC_SERVER_URL!, {
      transports: ["websocket"],
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[Socket] connected:", socket.id);
      socket.emit("join-session", { sessionCode: code, role, name });
    });

    // You are the late joiner — send offers to everyone already in the room
    socket.on("existing-peers", async ({ peers }: { peers: string[] }) => {
      console.log("[Socket] existing peers:", peers);
      await waitForStream();

      for (const peerId of peers) {
        const pc = createPeerConnection(peerId);
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await pc.setLocalDescription(offer);
        socket.emit("offer", { to: peerId, offer });
      }
    });

    // Someone new joined — they will send us an offer, just prepare
    socket.on("peer-joined", ({ socketId }: { socketId: string }) => {
      console.log("[Socket] peer joined:", socketId);
      // Don't create offer here — wait for their offer event
    });

    // We received an offer — create answer
    socket.on("offer", async ({ from, offer }: any) => {
      console.log("[Socket] received offer from:", from);
      await waitForStream();

      const pc = createPeerConnection(from);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("answer", { to: from, answer });
    });

    // We received an answer to our offer
    socket.on("answer", async ({ from, answer }: any) => {
      console.log("[Socket] received answer from:", from);
      const pc = pcsRef.current.get(from);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

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
      console.error("[Socket] connect error:", err);
      setMediaError("Video server unreachable — chat still works.");
    });
  }

  function destroyWebRTC() {
    pcsRef.current.forEach(pc => pc.close());
    pcsRef.current.clear();
    socketRef.current?.disconnect();
  }

  return { remoteVideoRef, socketRef, pcsRef, remoteConnected, initSocket, destroyWebRTC };
}