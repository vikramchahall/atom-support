import Link from "next/link";
import {
  Monitor,
  Smartphone,
  Video,
  Shield,
  Zap,
  Users,
  ArrowRight,
  CheckCircle,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white overflow-hidden">
      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-brand-gray-mid/50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-blue rounded-xl flex items-center justify-center">
              <Video className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-brand-navy text-lg tracking-tight">
              AtomSupport
            </span>
          </div>
          <div className="hidden md:flex items-center gap-1">
            <a href="#features" className="btn-ghost">Features</a>
            <a href="#how" className="btn-ghost">How it works</a>
            <a href="#pricing" className="btn-ghost">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="btn-ghost">Sign in</Link>
            <Link href="/signup" className="btn-primary">Get started</Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative pt-32 pb-24 px-6">
        {/* Background blur blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-brand-blue/10 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-1/4 w-80 h-80 bg-amber-300/15 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-brand-blue-pale text-brand-blue text-xs font-semibold px-4 py-2 rounded-full mb-6 border border-brand-blue/20">
            <Zap className="w-3 h-3" />
            Real-time remote support platform
          </div>

          <h1 className="text-5xl md:text-6xl font-bold text-brand-navy leading-tight tracking-tight mb-6">
            Support your customers
            <span className="text-brand-blue block">face to face, instantly</span>
          </h1>

          <p className="text-lg text-brand-gray-text max-w-2xl mx-auto mb-10 leading-relaxed">
            No installs. No confusion. One link gets your customer on a live
            video call with full camera, annotation, and AI-powered assistance.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup" className="btn-primary text-base px-8 py-4 flex items-center gap-2">
              Start for free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/join" className="btn-secondary text-base px-8 py-4">
              Join a session
            </Link>
          </div>

          {/* Stats row */}
          <div className="mt-16 grid grid-cols-3 gap-6 max-w-lg mx-auto">
            {[
              { val: "< 3s", label: "Session start time" },
              { val: "99.9%", label: "Uptime SLA" },
              { val: "AI", label: "Powered copilot" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-2xl font-bold text-brand-navy">{s.val}</div>
                <div className="text-xs text-brand-gray-text mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MOCK DASHBOARD PREVIEW */}
      <section className="px-6 pb-24">
        <div className="max-w-5xl mx-auto">
          <div className="card p-0 overflow-hidden border-brand-gray-mid">
            {/* Fake browser bar */}
            <div className="bg-brand-gray px-4 py-3 flex items-center gap-2 border-b border-brand-gray-mid">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 bg-white rounded-lg px-3 py-1 text-xs text-brand-gray-text ml-2">
                app.remotecall.io/dashboard
              </div>
            </div>
            {/* Mini dashboard preview */}
            <div className="bg-brand-navy-mid p-6 grid grid-cols-4 gap-4 min-h-48">
              <div className="col-span-1 space-y-2">
                {["Draw", "Arrow", "Text", "Circle"].map((t) => (
                  <div key={t} className="glass-dark rounded-xl px-3 py-2 text-xs text-white/70 text-center">
                    {t}
                  </div>
                ))}
              </div>
              <div className="col-span-2 glass-dark rounded-2xl flex items-center justify-center">
                <div className="text-white/40 text-sm">Live Video Feed</div>
              </div>
              <div className="col-span-1 space-y-2">
                {["Session ID", "Participants", "Duration", "Status"].map((t) => (
                  <div key={t} className="glass-dark rounded-xl px-3 py-2 text-xs text-white/50">
                    {t}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="px-6 py-24 bg-brand-gray">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-brand-navy mb-4">
              Everything in one session
            </h2>
            <p className="text-brand-gray-text">
              No plugins, no downloads — works instantly in any browser.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <Video className="w-5 h-5" />,
                title: "HD Video Calling",
                desc: "Crystal-clear SFU-powered video routed through our servers. No P2P limitations.",
              },
              {
                icon: <Monitor className="w-5 h-5" />,
                title: "Live Annotations",
                desc: "Draw arrows, circles, text, and highlights directly on the customer's camera feed.",
              },
              {
                icon: <Smartphone className="w-5 h-5" />,
                title: "Mobile First",
                desc: "Customers join from any device — smartphone, tablet, or desktop — via a simple link.",
              },
              {
                icon: <Shield className="w-5 h-5" />,
                title: "Secure Sessions",
                desc: "End-to-end session tracking, consent flows, and encrypted file transfers.",
              },
              {
                icon: <Zap className="w-5 h-5" />,
                title: "AI Copilot",
                desc: "Real-time troubleshooting suggestions and post-call AI summaries for your team.",
              },
              {
                icon: <Users className="w-5 h-5" />,
                title: "Session History",
                desc: "Full audit trail — who joined, when, and how long — with downloadable recordings.",
              },
            ].map((f) => (
              <div key={f.title} className="card hover:shadow-soft transition-shadow duration-200">
                <div className="w-10 h-10 bg-brand-blue-pale rounded-2xl flex items-center justify-center text-brand-blue mb-4">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-brand-navy mb-2">{f.title}</h3>
                <p className="text-sm text-brand-gray-text leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="px-6 py-24">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-brand-navy mb-4">
              Up and running in 30 seconds
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { n: "1", title: "Agent creates session", desc: "One click generates a unique 6-digit session code and shareable link." },
              { n: "2", title: "Customer joins via link", desc: "Customer opens the link, accepts permissions, and enters the session instantly." },
              { n: "3", title: "Support begins", desc: "Live video, chat, annotation tools, and AI assistance — all in one screen." },
            ].map((s) => (
              <div key={s.n} className="text-center">
                <div className="w-12 h-12 bg-brand-blue rounded-2xl flex items-center justify-center text-white font-bold text-lg mx-auto mb-4">
                  {s.n}
                </div>
                <h3 className="font-semibold text-brand-navy mb-2">{s.title}</h3>
                <p className="text-sm text-brand-gray-text leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24 bg-brand-navy">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to transform your support?
          </h2>
          <p className="text-white/60 mb-8">
            No credit card required. Get your first session running in under a minute.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup" className="btn-primary text-base px-8 py-4">
              Create free account
            </Link>
            <Link href="/join" className="btn-secondary text-base px-8 py-4 !bg-white/10 !text-white !border-white/20 hover:!bg-white/20">
              Join existing session
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="px-6 py-8 border-t border-brand-gray-mid">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-brand-blue rounded-lg flex items-center justify-center">
              <Video className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold text-brand-navy text-sm">RemoteCall</span>
          </div>
          <p className="text-xs text-brand-gray-text">
            © 2026 AtomSupport. Built for AtomQuest Hackathon.
          </p>
        </div>
      </footer>
    </div>
  );
}