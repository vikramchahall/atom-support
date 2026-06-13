import { useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
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

  function createPeerConnection(remoteSocketId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcsRef.current.set(remoteSocketId, pc);

    streamRef.current?.getTracks().forEach(track => {
      pc.addTrack(track, streamRef.current!);
    });

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) socketRef.current?.emit("ice-candidate", { to: remoteSocketId, candidate });
    };

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

  function initSocket(code: string, role: string, name: string) {
    const socket = io(process.env.NEXT_PUBLIC_SERVER_URL!, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join-session", { sessionCode: code, role, name });
    });

    socket.on("existing-peers", async ({ peers }: { peers: string[] }) => {
      for (const peerId of peers) {
        const pc = createPeerConnection(peerId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("offer", { to: peerId, offer });
      }
    });

    socket.on("peer-joined", ({ socketId }: { socketId: string }) => {
      createPeerConnection(socketId);
    });

    socket.on("offer", async ({ from, offer }: any) => {
      let pc = pcsRef.current.get(from);
      if (!pc) pc = createPeerConnection(from);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("answer", { to: from, answer });
    });

    socket.on("answer", async ({ from, answer }: any) => {
      const pc = pcsRef.current.get(from);
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
    });

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
      setMediaError("Video server unreachable — chat still works.");
    });
  }

  function destroyWebRTC() {
    pcsRef.current.forEach(pc => pc.close());
    socketRef.current?.disconnect();
  }

  return { remoteVideoRef, socketRef, pcsRef, remoteConnected, initSocket, destroyWebRTC };
}