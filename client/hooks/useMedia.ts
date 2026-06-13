import { useRef, useState } from "react";

export function useMedia() {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [mediaError, setMediaError] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState("");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [isMobile] = useState(() =>
    typeof navigator !== "undefined" && /iPhone|iPad|Android/i.test(navigator.userAgent)
  );

  async function initMedia(deviceId?: string, facing?: "user" | "environment"): Promise<MediaStream | null> {
    try {
      // Stop existing tracks first
      streamRef.current?.getTracks().forEach((t) => t.stop());

      let videoConstraint: MediaTrackConstraints | boolean = true;
      if (deviceId) {
        videoConstraint = { deviceId: { exact: deviceId } };
      } else if (facing) {
        videoConstraint = { facingMode: facing };
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraint,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Set streamRef BEFORE returning so useWebRTC's waitForStream resolves immediately
      streamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Enumerate cameras
      const all = await navigator.mediaDevices.enumerateDevices();
      const cams = all.filter((d) => d.kind === "videoinput");
      setDevices(cams);
      if (!deviceId && !facing && cams[0]) {
        setSelectedCamera(cams[0].deviceId);
      }

      return stream;
    } catch (err: any) {
      console.warn("[Media] error:", err.message);
      setMediaError("Camera/mic unavailable — chat still works.");
      return null;
    }
  }

  async function switchCamera(
    deviceId: string,
    pcsRef: React.MutableRefObject<Map<string, RTCPeerConnection>>
  ) {
    setSelectedCamera(deviceId);
    const newStream = await initMedia(deviceId);
    if (!newStream) return;
    const videoTrack = newStream.getVideoTracks()[0];
    if (!videoTrack) return;
    pcsRef.current.forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender) sender.replaceTrack(videoTrack);
    });
  }

  async function flipCamera(
    pcsRef: React.MutableRefObject<Map<string, RTCPeerConnection>>
  ) {
    const next = facingMode === "user" ? "environment" : "user";
    setFacingMode(next);
    const newStream = await initMedia(undefined, next);
    if (!newStream) return;
    const videoTrack = newStream.getVideoTracks()[0];
    if (!videoTrack) return;
    pcsRef.current.forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender) sender.replaceTrack(videoTrack);
    });
  }

  function toggleMic() {
    const tracks = streamRef.current?.getAudioTracks();
    if (!tracks?.length) {
      setMediaError("Microphone not available.");
      return;
    }
    const next = !micOn;
    tracks.forEach((t) => { t.enabled = next; });
    setMicOn(next);
  }

  function toggleCam() {
    const tracks = streamRef.current?.getVideoTracks();
    if (!tracks?.length) return;
    const next = !camOn;
    tracks.forEach((t) => { t.enabled = next; });
    setCamOn(next);
  }

  function stopMedia() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  return {
    localVideoRef,
    streamRef,
    micOn,
    camOn,
    mediaError,
    setMediaError,
    devices,
    selectedCamera,
    facingMode,
    isMobile,
    initMedia,
    switchCamera,
    flipCamera,
    toggleMic,
    toggleCam,
    stopMedia,
  };
}