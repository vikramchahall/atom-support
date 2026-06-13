"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Mic,
  MapPin,
  HardDrive,
  ArrowRight,
  Shield,
  CheckCircle,
} from "lucide-react";

type Step = "code" | "terms" | "privacy" | "permissions" | "joining";

export default function JoinPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("code");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [name, setName] = useState("");
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
    if (!name.trim() || code.join("").length < 6) {
      setError("Enter your name and full 6-digit code");
      return;
    }

    setError("");
    setStep("terms");
  }

  async function handleJoin() {
    const sessionCode = code.join("");

    setStep("joining");

    setTimeout(() => {
      router.push(
        `/session/${sessionCode}?role=customer&name=${encodeURIComponent(
          name
        )}`
      );
    }, 1500);
  }

  const permissions = [
    {
      icon: <Camera className="w-5 h-5" />,
      color: "bg-amber-500",
      label: "Camera",
      desc: "Required for video support",
    },
    {
      icon: <Mic className="w-5 h-5" />,
      color: "bg-yellow-600",
      label: "Microphone",
      desc: "Required for voice calls",
    },
    {
      icon: <MapPin className="w-5 h-5" />,
      color: "bg-stone-500",
      label: "Location",
      desc: "Optional for regional support",
    },
    {
      icon: <HardDrive className="w-5 h-5" />,
      color: "bg-amber-700",
      label: "Storage",
      desc: "Required for file sharing",
    },
  ];

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-yellow-50 via-white to-amber-100" />

      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-brand-blue/15 rounded-full blur-3xl pointer-events-none" />

      <div className="absolute bottom-1/4 right-1/4 w-56 h-56 bg-amber-300/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md animate-fade-in-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-blue rounded-3xl shadow-soft mb-4">
            <Shield className="w-7 h-7 text-white" />
          </div>

          <h1 className="text-2xl font-bold text-brand-navy">
            Join Session
          </h1>

          <p className="text-sm text-brand-gray-text mt-1">
            Connect with support instantly
          </p>
        </div>

        {/* STEP 1 */}
        {step === "code" && (
          <div className="card-modal">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-brand-navy uppercase tracking-wide mb-2 block">
                  Your Name
                </label>

                <input
                  type="text"
                  className="input-field"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-brand-navy uppercase tracking-wide mb-3 block text-center">
                  Session Code
                </label>

                <div className="flex justify-center gap-2">
                  {code.map((digit, i) => (
                    <input
                      key={i}
                      id={`code-${i}`}
                      type="text"
                      maxLength={1}
                      inputMode="numeric"
                      value={digit}
                      onChange={(e) =>
                        handleCodeInput(i, e.target.value)
                      }
                      onKeyDown={(e) =>
                        handleCodeKeyDown(i, e)
                      }
                      className="w-12 h-12 rounded-xl border border-brand-gray-mid bg-brand-blue-pale text-center font-bold text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
                    />
                  ))}
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-2xl">
                  {error}
                </div>
              )}

              <button
                onClick={proceedFromCode}
                className="btn-primary w-full flex items-center justify-center gap-2 py-4"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* TERMS */}
        {step === "terms" && (
          <div className="card-modal">
            <h2 className="text-xl font-bold text-brand-navy text-center mb-2">
              Terms & Conditions
            </h2>

            <p className="text-brand-gray-text text-center text-sm mb-6">
              Please read and accept
            </p>

            <div className="bg-brand-blue-pale rounded-2xl p-4 max-h-56 overflow-y-auto text-sm text-brand-navy space-y-3 mb-6">
              <p>
                By joining this support session you agree to allow
                the support representative to assist you remotely.
              </p>

              <p>
                Sessions may be recorded for quality assurance.
              </p>

              <p>
                Do not share passwords, banking details, or
                confidential information.
              </p>

              <p>
                You may leave the session at any time.
              </p>
            </div>

            <button
              onClick={() => setStep("privacy")}
              className="btn-primary w-full flex items-center justify-center gap-2 py-4"
            >
              I Accept
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* PRIVACY */}
        {step === "privacy" && (
          <div className="card-modal">
            <h2 className="text-xl font-bold text-brand-navy text-center mb-2">
              Privacy Policy
            </h2>

            <p className="text-brand-gray-text text-center text-sm mb-6">
              How we handle your data
            </p>

            <div className="bg-brand-blue-pale rounded-2xl p-4 max-h-56 overflow-y-auto text-sm text-brand-navy space-y-3 mb-6">
              <p>
                We collect your name, chat messages, media streams,
                and files shared during the session.
              </p>

              <p>
                Session data is securely stored and automatically
                deleted after the retention period.
              </p>

              <p>
                Your information is never sold to third parties.
              </p>

              <p>
                You may request deletion of your data.
              </p>
            </div>

            <button
              onClick={() => setStep("permissions")}
              className="btn-primary w-full flex items-center justify-center gap-2 py-4"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* PERMISSIONS */}
        {step === "permissions" && (
          <div className="card-modal">
            <h2 className="text-xl font-bold text-brand-navy text-center mb-2">
              Permissions
            </h2>

            <p className="text-brand-gray-text text-center text-sm mb-6">
              Required for support session
            </p>

            <div className="space-y-3 mb-6">
              {permissions.map((p) => (
                <div
                  key={p.label}
                  className="flex items-center gap-3 bg-brand-blue-pale rounded-2xl px-4 py-3"
                >
                  <div
                    className={`w-10 h-10 ${p.color} rounded-2xl flex items-center justify-center text-white`}
                  >
                    {p.icon}
                  </div>

                  <div>
                    <p className="font-medium text-brand-navy text-sm">
                      {p.label}
                    </p>

                    <p className="text-brand-gray-text text-xs">
                      {p.desc}
                    </p>
                  </div>

                  <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />
                </div>
              ))}
            </div>

            <button
              onClick={handleJoin}
              className="btn-primary w-full flex items-center justify-center gap-2 py-4"
            >
              Join Session
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* JOINING */}
        {step === "joining" && (
          <div className="card-modal text-center">
            <div className="w-16 h-16 bg-brand-blue-pale rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="w-8 h-8 border-2 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
            </div>

            <h2 className="text-xl font-bold text-brand-navy mb-2">
              Connecting...
            </h2>

            <p className="text-brand-gray-text">
              Joining session {code.join("")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}