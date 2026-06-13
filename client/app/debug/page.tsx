export default function DebugPage() {
  return (
    <div style={{ padding: 40, fontFamily: "monospace" }}>
      <h2>Env Check</h2>
      <p>SUPABASE_URL: {process.env.NEXT_PUBLIC_SUPABASE_URL || "❌ MISSING"}</p>
      <p>ANON_KEY: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "✅ SET" : "❌ MISSING"}</p>
      <p>SERVER_URL: {process.env.NEXT_PUBLIC_SERVER_URL || "❌ MISSING"}</p>
    </div>
  );
}