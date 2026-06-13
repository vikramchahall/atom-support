require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || "*", methods: ["GET", "POST"] }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || "*", methods: ["GET", "POST"] },
});

// sessionCode → Set of socket ids
const sessionPeers = new Map();

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("join-session", ({ sessionCode, role, name }) => {
    socket.join(sessionCode);
    socket.data = { sessionCode, role, name };

    if (!sessionPeers.has(sessionCode)) sessionPeers.set(sessionCode, new Set());
    sessionPeers.get(sessionCode).add(socket.id);

    // Tell everyone else a new peer arrived
    socket.to(sessionCode).emit("peer-joined", { socketId: socket.id, name, role });

    // Tell the new peer who's already there
    const others = [...sessionPeers.get(sessionCode)].filter(id => id !== socket.id);
    socket.emit("existing-peers", { peers: others });

    console.log(`${name} (${role}) joined ${sessionCode}`);
  });

  // WebRTC signaling — just relay between peers
  socket.on("offer", ({ to, offer }) => {
    io.to(to).emit("offer", { from: socket.id, offer });
  });

  socket.on("answer", ({ to, answer }) => {
    io.to(to).emit("answer", { from: socket.id, answer });
  });

  socket.on("ice-candidate", ({ to, candidate }) => {
    io.to(to).emit("ice-candidate", { from: socket.id, candidate });
  });

  socket.on("disconnect", () => {
    const { sessionCode, name, role } = socket.data || {};
    if (sessionCode) {
      sessionPeers.get(sessionCode)?.delete(socket.id);
      socket.to(sessionCode).emit("peer-left", { socketId: socket.id, name, role });
    }
    console.log("Disconnected:", socket.id);
  });
});

app.get("/health", (_, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));