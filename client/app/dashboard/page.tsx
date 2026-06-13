"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Video, Plus, LogOut, Clock, Users, Activity,
  CheckCircle, XCircle, Copy, ExternalLink
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Session = {
  id: string;
  session_code: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  created_at: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [copied, setCopied] = useState<string | null>(null);

useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (!session) {
        router.replace("/login");
        return;
      }
      setUser(session.user);
      fetchSessions(session.user.id);
    }
  );
  return () => subscription.unsubscribe();
}, []);

  async function fetchSessions(agentId: string) {
    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(20);

    console.log("Sessions:", data, error);
    setSessions(data || []);
    setLoading(false);
  }

  async function createSession() {
    setCreating(true);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("sessions")
      .insert({
        session_code: code,
        agent_id: user?.id,
        status: "active",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    console.log("Created session:", data, error);

    if (data) {
      router.push(`/session/${code}?role=agent`);
    } else {
      alert("Failed to create session: " + error?.message);
    }
    setCreating(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function copyLink(code: string) {
    const url = `${window.location.origin}/join?prefill=${code}`;
    navigator.clipboard.writeText(url);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  }

  const activeSessions = sessions.filter((s) => s.status === "active");
  const pastSessions = sessions.filter((s) => s.status !== "active");

  if (!user) {
    return (
      <div className="min-h-screen bg-brand-gray flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-gray">
      {/* NAV */}
      <nav className="bg-brand-navy sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-blue rounded-xl flex items-center justify-center">
              <Video className="w-4 h-4 text-brand-navy" />
            </div>
            <span className="font-bold text-white text-lg tracking-tight">AtomSupport</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-white/50 text-sm hidden md:block">{user?.email}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-white/60 hover:text-white text-sm transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-brand-navy">Support Dashboard</h1>
            <p className="text-brand-gray-text text-sm mt-1">Manage your live and past sessions</p>
          </div>
          <button
            onClick={createSession}
            disabled={creating}
            className="btn-primary flex items-center gap-2 self-start sm:self-auto"
          >
            {creating ? (
              <div className="w-4 h-4 border-2 border-brand-navy/30 border-t-brand-navy rounded-full animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            New Session
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Active Sessions", val: activeSessions.length, icon: <Activity className="w-5 h-5" />, color: "text-green-500" },
            { label: "Total Sessions", val: sessions.length, icon: <Video className="w-5 h-5" />, color: "text-brand-blue" },
            { label: "Completed", val: pastSessions.filter(s => s.status === "ended").length, icon: <CheckCircle className="w-5 h-5" />, color: "text-blue-500" },
            { label: "This Week", val: sessions.filter(s => new Date(s.created_at) > new Date(Date.now() - 7 * 86400000)).length, icon: <Clock className="w-5 h-5" />, color: "text-amber-500" },
          ].map((stat) => (
            <div key={stat.label} className="card">
              <div className={`${stat.color} mb-2`}>{stat.icon}</div>
              <div className="text-2xl font-bold text-brand-navy">{stat.val}</div>
              <div className="text-xs text-brand-gray-text mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Active Sessions */}
        {activeSessions.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-brand-navy uppercase tracking-wide mb-4">
              Active Sessions
            </h2>
            <div className="space-y-3">
              {activeSessions.map((s) => (
                <div key={s.id} className="card flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <div>
                      <p className="font-semibold text-brand-navy">Session #{s.session_code}</p>
                      <p className="text-xs text-brand-gray-text">
                        Started {new Date(s.started_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyLink(s.session_code)}
                      className="btn-ghost flex items-center gap-1 text-xs"
                    >
                      {copied === s.session_code ? (
                        <><CheckCircle className="w-3 h-3 text-green-500" /> Copied</>
                      ) : (
                        <><Copy className="w-3 h-3" /> Copy link</>
                      )}
                    </button>
                    <Link
                      href={`/session/${s.session_code}?role=agent`}
                      className="btn-primary flex items-center gap-1 text-xs px-4 py-2"
                    >
                      Rejoin <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Session History */}
        <div>
          <h2 className="text-sm font-semibold text-brand-navy uppercase tracking-wide mb-4">
            Session History
          </h2>
          {loading ? (
            <div className="card text-center py-12 text-brand-gray-text text-sm">
              Loading sessions...
            </div>
          ) : pastSessions.length === 0 && activeSessions.length === 0 ? (
            <div className="card text-center py-12">
              <Video className="w-10 h-10 text-brand-gray-mid mx-auto mb-3" />
              <p className="text-brand-gray-text text-sm">No sessions yet.</p>
              <p className="text-brand-gray-text text-xs mt-1">Create your first session above.</p>
            </div>
          ) : pastSessions.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-brand-gray-text text-sm">No past sessions yet.</p>
            </div>
          ) : (
            <div className="card p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-gray-mid bg-brand-gray">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-brand-gray-text uppercase tracking-wide">Code</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-brand-gray-text uppercase tracking-wide hidden md:table-cell">Started</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-brand-gray-text uppercase tracking-wide hidden md:table-cell">Ended</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-brand-gray-text uppercase tracking-wide">Status</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-brand-gray-text uppercase tracking-wide">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {pastSessions.map((s, i) => (
                    <tr key={s.id} className={`border-b border-brand-gray-mid/50 hover:bg-brand-gray/50 transition-colors ${i === pastSessions.length - 1 ? "border-0" : ""}`}>
                      <td className="px-6 py-4 font-mono font-semibold text-brand-navy">#{s.session_code}</td>
                      <td className="px-6 py-4 text-brand-gray-text hidden md:table-cell">{new Date(s.started_at).toLocaleString()}</td>
                      <td className="px-6 py-4 text-brand-gray-text hidden md:table-cell">{s.ended_at ? new Date(s.ended_at).toLocaleString() : "—"}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${s.status === "ended" ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"}`}>
                          {s.status === "ended" ? <><CheckCircle className="w-3 h-3" /> Ended</> : <><XCircle className="w-3 h-3" /> {s.status}</>}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button onClick={() => copyLink(s.session_code)} className="text-brand-blue text-xs hover:underline flex items-center gap-1">
                          <Copy className="w-3 h-3" /> Copy
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}