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
  const [isMobile] = useState(() => /iPhone|iPad|Android/i.test(navigator.userAgent));

  async function initMedia(deviceId?: string, facing?: "user" | "environment") {
    try {
      streamRef.current?.getTracks().forEach(t => t.stop());

      let videoConstraint: MediaTrackConstraints | boolean = true;
      if (deviceId) videoConstraint = { deviceId: { exact: deviceId } };
      else if (facing) videoConstraint = { facingMode: facing };

      const s = await navigator.mediaDevices.getUserMedia({
        video: videoConstraint,
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });

      streamRef.current = s;
      if (localVideoRef.current) localVideoRef.current.srcObject = s;

      const all = await navigator.mediaDevices.enumerateDevices();
      const cams = all.filter(d => d.kind === "videoinput");
      setDevices(cams);
      if (!deviceId && !facing && cams[0]) setSelectedCamera(cams[0].deviceId);

      return s;
    } catch (err: any) {
      console.warn("Media error:", err.message);
      setMediaError("Camera/mic unavailable — chat still works.");
      return null;
    }
  }

  async function switchCamera(deviceId: string, pcsRef: React.MutableRefObject<Map<string, RTCPeerConnection>>) {
    setSelectedCamera(deviceId);
    const newStream = await initMedia(deviceId);
    if (!newStream) return;
    replaceVideoTrack(newStream, pcsRef);
  }

  async function flipCamera(pcsRef: React.MutableRefObject<Map<string, RTCPeerConnection>>) {
    const next = facingMode === "user" ? "environment" : "user";
    setFacingMode(next);
    const newStream = await initMedia(undefined, next);
    if (!newStream) return;
    replaceVideoTrack(newStream, pcsRef);
  }

  function replaceVideoTrack(newStream: MediaStream, pcsRef: React.MutableRefObject<Map<string, RTCPeerConnection>>) {
    const videoTrack = newStream.getVideoTracks()[0];
    pcsRef.current.forEach(pc => {
      const sender = pc.getSenders().find(s => s.track?.kind === "video");
      if (sender && videoTrack) sender.replaceTrack(videoTrack);
    });
  }

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

  return {
    localVideoRef, streamRef,
    micOn, camOn, mediaError, devices, selectedCamera, facingMode, isMobile,
    initMedia, switchCamera, flipCamera, toggleMic, toggleCam,
  };
}