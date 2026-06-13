# AtomSupport

> Real-time video support platform — agents see what customers see, annotate live, and resolve issues faster.

Built for the **AtomQuest Hackathon**.

---

## Demo

**Live:** [(https://atom-support.vercel.app/)]
**Test credentials** (agent login):
| Field | Value |
|---|---|
| Email | tester@gmail.com |
| Password | password |

No account needed for customers — they join via an invite link.

---

## What It Does

AtomSupport connects a support agent to a customer over live video. The agent sees the customer's camera feed and can draw directly on top of it in real time — circling problems, pointing with a laser, dropping numbered stamps. Everything stays peer-to-peer so video never touches a server.

**Agent can:**
- See the customer's live camera feed
- Draw, annotate, and highlight on the video with pen, arrow, rectangle, circle, and laser tools
- Drop numbered stamps to guide step-by-step
- Send and receive chat messages
- Share files (images, PDFs, docs)
- Generate an AI summary of the session with one click

**Customer can:**
- Join with just a link — no account, no app install
- Share their camera and microphone
- See the agent's annotations overlaid on their own feed
- Chat and receive files

---

## Architecture

```
Agent Browser ──── WebRTC P2P ──── Customer Browser
      │                                    │
      └──── WebSocket (PeerJS) ────────────┘
      │
  Next.js (Vercel)
      │
      ├── /api/ai ──── Gemini 1.5 Flash (Google AI)
      │
  Supabase
      ├── Auth          (agent login)
      ├── Postgres      (sessions, messages, files, participants, ai_summaries)
      ├── Realtime      (live chat sync)
      └── Storage       (file uploads → support-files bucket)
```

Video, audio, and annotation data flow **directly peer-to-peer**. Servers are not in the media path after signaling.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Video / Audio | WebRTC via PeerJS |
| Annotations | HTML Canvas (overlay on remote video) |
| Database | Supabase Postgres |
| Auth | Supabase Auth |
| Realtime chat | Supabase Realtime (WebSocket) |
| File storage | Supabase Storage |
| AI summaries | Google Gemini 1.5 Flash |
| Deployment | Vercel (frontend) + Railway (server) |

---

## Local Setup

### Prerequisites

- Node.js 18+
- Supabase account — [supabase.com](https://supabase.com) (free tier works)
- Gemini API key — [aistudio.google.com](https://aistudio.google.com) (free, no card)

### 1. Clone and install

```bash
# Client
cd client
npm install

# Server
cd ../server
npm install
```

### 2. Environment variables

Create `.env.local` inside the `client` folder:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
GEMINI_API_KEY=your-gemini-api-key
```

Create `.env` inside the `server` folder:

```env
PORT=4000
CLIENT_URL=http://localhost:3000
```

### 3. Create Supabase tables

Go to your Supabase project → SQL Editor and run:

```sql
create table sessions (
  id uuid primary key default gen_random_uuid(),
  session_code text unique not null,
  agent_id uuid references auth.users,
  status text default 'active',
  started_at timestamptz default now(),
  ended_at timestamptz,
  created_at timestamptz default now()
);

create table participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id),
  role text,
  name text,
  joined_at timestamptz,
  left_at timestamptz
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id),
  sender text,
  message text,
  created_at timestamptz default now()
);

create table files (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id),
  file_url text,
  file_name text,
  file_size bigint,
  uploaded_by text,
  created_at timestamptz default now()
);

create table ai_summaries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id),
  raw_summary text,
  created_at timestamptz default now()
);
```

### 4. Supabase Storage

Go to **Storage** → create a new bucket:
- Name: `support-files`
- Access: **Public**

### 5. Disable email confirmation

Go to **Authentication → Providers → Email** and turn off **Confirm email** so agents can sign up instantly.

### 6. Enable Realtime

Go to **Database → Replication** and enable INSERT events for:
- `messages`
- `participants`

### 7. Run

```bash
# Terminal 1 — client
cd client
npm run dev

# Terminal 2 — server
cd server
npm start
```

App runs at `http://localhost:3000`

---

## How to Use

### As an Agent
1. Go to `/signup` and create an account
2. Log in at `/login`
3. Click **New Session** on the dashboard
4. Copy the invite link and send it to your customer
5. Use the left toolbar to annotate the customer's video feed
6. Click the paperclip to share files
7. Click the **AI** button to generate a session summary

### As a Customer
1. Open the invite link in any browser — no account needed
2. Enter your name and allow camera/microphone
3. The call connects automatically
4. Chat via the message panel or speak directly
5. Click the hang-up button to leave

---

## Known Limitations

| Limitation | Detail |
|---|---|
| No TURN server | Calls may fail on strict corporate networks. Add a TURN server for production. |
| PeerJS cloud | Uses the free public PeerJS signaling server. Self-host for reliability. |
| One agent per session | Two agents cannot share the same session code simultaneously. |
| Annotations are one-way | Only the agent can draw. The customer cannot annotate back. |
| No recording | Not yet implemented. |
| No RLS | Supabase tables have no row-level security. Add RLS before any public deployment. |

---

## Deployment

| Service | Purpose |
|---|---|
| Vercel | Hosts the Next.js frontend and `/api/ai` route |
| Railway | Hosts the signaling/backend server |
| Supabase | Database, auth, realtime, storage |

Add `GEMINI_API_KEY` to Vercel → Settings → Environment Variables, then redeploy.

---

## License

MIT
