require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();

// Hardcode the allowed origin — no trailing slash, no env var formatting issues
const ALLOWED_ORIGIN = "https://atom-support.vercel.app";

const corsOptions = {
  origin: ALLOWED_ORIGIN,
  methods: ["GET", "POST"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: corsOptions });

const sessionPeers = new Map();

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("join-session", ({ sessionCode, role, name }) => {
    socket.join(sessionCode);
    socket.data = { sessionCode, role, name };
    if (!sessionPeers.has(sessionCode)) sessionPeers.set(sessionCode, new Set());
    sessionPeers.get(sessionCode).add(socket.id);
    socket.to(sessionCode).emit("peer-joined", { socketId: socket.id, name, role });
    const others = [...sessionPeers.get(sessionCode)].filter(id => id !== socket.id);
    socket.emit("existing-peers", { peers: others });
    console.log(`${name} (${role}) joined ${sessionCode}`);
  });

  socket.on("offer",          ({ to, offer })      => io.to(to).emit("offer",          { from: socket.id, offer }));
  socket.on("answer",         ({ to, answer })     => io.to(to).emit("answer",         { from: socket.id, answer }));
  socket.on("ice-candidate",  ({ to, candidate })  => io.to(to).emit("ice-candidate",  { from: socket.id, candidate }));

  socket.on("disconnect", () => {
    const { sessionCode, name, role } = socket.data || {};
    if (sessionCode) {
      sessionPeers.get(sessionCode)?.delete(socket.id);
      socket.to(sessionCode).emit("peer-left", { socketId: socket.id, name, role });
    }
    console.log("Disconnected:", socket.id);
  });
});

app.get("/health", (_, res) => res.json({ status: "ok", allowedOrigin: ALLOWED_ORIGIN }));

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Listening on ${PORT} — CORS: ${ALLOWED_ORIGIN}`));