"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Mic, MapPin, HardDrive, ArrowRight, Shield, CheckCircle } from "lucide-react";

type Step = "code" | "terms" | "privacy" | "permissions" | "joining";

export default function JoinPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("code");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleCodeInput(i: number, val: string) {
    if (!/^\d*$/.test(val)) return;
    const next = [...code];
    next[i] = val.slice(-1);
    setCode(next);
    if (val && i < 5) {
      document.getElementById(`code-${i + 1}`)?.focus();
    }
  }

  function handleCodeKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !code[i] && i > 0) {
      document.getElementById(`code-${i - 1}`)?.focus();
    }
  }

  function proceedFromCode() {
    if (code.join("").length < 6 || !name.trim()) {
      setError("Enter your name and the full 6-digit code.");
      return;
    }
    setError("");
    setStep("terms");
  }

  async function handleJoin() {
    setLoading(true);
    setStep("joining");
    const sessionCode = code.join("");
    setTimeout(() => {
      router.push(`/session/${sessionCode}?role=customer&name=${encodeURIComponent(name)}`);
    }, 1500);
  }

  const permissions = [
    { icon: <Camera className="w-5 h-5" />, color: "bg-blue-500", label: "Camera", desc: "Required for video support" },
    { icon: <Mic className="w-5 h-5" />, color: "bg-sky-400", label: "Microphone", desc: "Required for voice calls" },
    { icon: <MapPin className="w-5 h-5" />, color: "bg-slate-500", label: "Location", desc: "Optional for regional support" },
    { icon: <HardDrive className="w-5 h-5" />, color: "bg-indigo-400", label: "Storage", desc: "Required for file sharing" },
  ];

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-500 to-sky-400" />
      <div className="absolute inset-0 bg-[url('/hero-bg.jpg')] bg-cover bg-center opacity-20" />
      <div className="absolute top-20 left-10 w-48 h-48 bg-white/10 rounded-full blur-2xl" />
      <div className="absolute bottom-20 right-10 w-64 h-64 bg-white/10 rounded-full blur-2xl" />

      <div className="relative w-full max-w-sm animate-fade-in-up">

        {/* STEP: Enter Code */}
        {step === "code" && (
          <div className="glass rounded-4xl p-8 shadow-modal">
            <div className="text-center mb-8">
              <div className="w-14 h-14 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <Shield className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-1">Join Session</h1>
              <p className="text-white/70 text-sm">Enter your name and session code</p>
            </div>

            <div className="space-y-4">
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white/20 border border-white/30 rounded-2xl px-4 py-3
                           text-white placeholder:text-white/50 text-sm
                           focus:outline-none focus:ring-2 focus:ring-white/40"
              />

              <div>
                <p className="text-white/70 text-xs text-center mb-3">6-digit session code</p>
                <div className="flex justify-center gap-2">
                  {code.map((digit, i) => (
                    <input
                      key={i}
                      id={`code-${i}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleCodeInput(i, e.target.value)}
                      onKeyDown={(e) => handleCodeKeyDown(i, e)}
                      className="w-11 h-12 text-center text-white font-bold text-lg
                                 bg-white/20 border border-white/30 rounded-xl
                                 focus:outline-none focus:ring-2 focus:ring-white/60
                                 focus:bg-white/30 transition-all"
                    />
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-red-200 text-xs text-center">{error}</p>
              )}

              <button
                onClick={proceedFromCode}
                className="w-full bg-white text-brand-blue font-semibold rounded-full py-4
                           flex items-center justify-center gap-2 hover:bg-white/90 transition-colors"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP: Terms */}
        {step === "terms" && (
          <div className="glass rounded-4xl p-8 shadow-modal">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-white mb-1">Terms & Conditions</h2>
              <p className="text-white/60 text-xs">Please read and accept to continue</p>
            </div>
            <div className="bg-white/10 rounded-2xl p-4 mb-6 max-h-48 overflow-y-auto text-white/80 text-xs leading-relaxed space-y-2">
              <p>By joining this remote support session, you agree to allow the support agent to view your device camera and provide assistance.</p>
              <p>This session may be recorded for quality assurance purposes. You will be notified if recording begins.</p>
              <p>Do not share sensitive personal information such as passwords, financial details, or government ID numbers during this session.</p>
              <p>RemoteCall is a platform connecting customers with authorized support agents only. If you have concerns, end the session immediately.</p>
              <p>Your session data is encrypted in transit and stored securely per our Privacy Policy.</p>
            </div>
            <button
              onClick={() => setStep("privacy")}
              className="w-full bg-white text-brand-blue font-semibold rounded-full py-4
                         flex items-center justify-center gap-2 hover:bg-white/90 transition-colors"
            >
              I Accept & Continue <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP: Privacy */}
        {step === "privacy" && (
          <div className="glass rounded-4xl p-8 shadow-modal">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-white mb-1">Privacy Policy</h2>
              <p className="text-white/60 text-xs">How we handle your data</p>
            </div>
            <div className="bg-white/10 rounded-2xl p-4 mb-6 max-h-48 overflow-y-auto text-white/80 text-xs leading-relaxed space-y-2">
              <p><strong className="text-white">Data collected:</strong> Name, camera/audio stream, chat messages, and files shared during the session.</p>
              <p><strong className="text-white">Storage:</strong> Session data is stored for 30 days then permanently deleted. Recordings are stored for 7 days unless downloaded.</p>
              <p><strong className="text-white">Third parties:</strong> We do not sell your data. Session data may be accessed by the support organization that initiated the session.</p>
              <p><strong className="text-white">Your rights:</strong> You may request deletion of your session data at any time by contacting the support organization.</p>
            </div>
            <button
              onClick={() => setStep("permissions")}
              className="w-full bg-white text-brand-blue font-semibold rounded-full py-4
                         flex items-center justify-center gap-2 hover:bg-white/90 transition-colors"
            >
              I Understand <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP: Permissions */}
        {step === "permissions" && (
          <div className="glass rounded-4xl p-8 shadow-modal">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-white mb-1">Allow Permissions</h2>
              <p className="text-white/60 text-xs">Required for a seamless support session</p>
            </div>
            <div className="space-y-3 mb-6">
              {permissions.map((p) => (
                <div key={p.label} className="flex items-center gap-3 bg-white/10 rounded-2xl px-4 py-3">
                  <div className={`w-10 h-10 ${p.color} rounded-2xl flex items-center justify-center text-white flex-shrink-0`}>
                    {p.icon}
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">{p.label}</p>
                    <p className="text-white/60 text-xs">{p.desc}</p>
                  </div>
                  <CheckCircle className="w-4 h-4 text-green-300 ml-auto flex-shrink-0" />
                </div>
              ))}
            </div>
            <button
              onClick={handleJoin}
              className="w-full bg-white text-brand-blue font-semibold rounded-full py-4
                         flex items-center justify-center gap-2 hover:bg-white/90 transition-colors"
            >
              Allow & Join Session <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP: Joining */}
        {step === "joining" && (
          <div className="glass rounded-4xl p-8 shadow-modal text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="w-8 h-8 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Connecting...</h2>
            <p className="text-white/60 text-sm">Joining session {code.join("")}</p>
          </div>
        )}
      </div>
    </div>
  );
}