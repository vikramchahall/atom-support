require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mediasoup = require("mediasoup");

const app = express();
app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "http://localhost:3000", methods: ["GET", "POST"] },
});

// --- Mediasoup setup ---
let worker;
const routers = new Map();    // sessionCode → router
const transports = new Map(); // transportId → transport
const producers = new Map();  // producerId → producer
const consumers = new Map();  // consumerId → consumer

const mediaCodecs = [
  { kind: "audio", mimeType: "audio/opus", clockRate: 48000, channels: 2 },
  { kind: "video", mimeType: "video/VP8", clockRate: 90000, parameters: {} },
];

async function createWorker() {
  worker = await mediasoup.createWorker({
    logLevel: "warn",
    rtcMinPort: 10000,
    rtcMaxPort: 10100,
  });
  worker.on("died", () => {
    console.error("Mediasoup worker died");
    process.exit(1);
  });
  console.log("Mediasoup worker created");
}

async function getOrCreateRouter(sessionCode) {
  if (!routers.has(sessionCode)) {
    const router = await worker.createRouter({ mediaCodecs });
    routers.set(sessionCode, router);
  }
  return routers.get(sessionCode);
}

// --- Socket.IO ---
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Join session room
  socket.on("join-session", ({ sessionCode, role, name }) => {
    socket.join(sessionCode);
    socket.data = { sessionCode, role, name };
    socket.to(sessionCode).emit("peer-joined", { name, role });
    console.log(`${name} (${role}) joined session ${sessionCode}`);
  });

  // Get RTP capabilities
  socket.on("get-rtp-capabilities", async ({ sessionCode }, callback) => {
    try {
      const router = await getOrCreateRouter(sessionCode);
      callback({ rtpCapabilities: router.rtpCapabilities });
    } catch (err) {
      callback({ error: err.message });
    }
  });

  // Create WebRTC transport
  socket.on("create-transport", async ({ sessionCode, direction }, callback) => {
    try {
      const router = await getOrCreateRouter(sessionCode);
      const transport = await router.createWebRtcTransport({
        listenIps: [{ ip: "0.0.0.0", announcedIp: "127.0.0.1" }],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
      });

      transports.set(transport.id, transport);

      callback({
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      });
    } catch (err) {
      callback({ error: err.message });
    }
  });

  // Connect transport
  socket.on("connect-transport", async ({ transportId, dtlsParameters }, callback) => {
    try {
      const transport = transports.get(transportId);
      await transport.connect({ dtlsParameters });
      callback({ success: true });
    } catch (err) {
      callback({ error: err.message });
    }
  });

  // Produce (send media)
  socket.on("produce", async ({ transportId, kind, rtpParameters, sessionCode }, callback) => {
    try {
      const transport = transports.get(transportId);
      const producer = await transport.produce({ kind, rtpParameters });
      producers.set(producer.id, producer);

      // Notify other peers
      socket.to(sessionCode).emit("new-producer", {
        producerId: producer.id,
        kind,
        peerId: socket.id,
      });

      callback({ id: producer.id });
    } catch (err) {
      callback({ error: err.message });
    }
  });

  // Consume (receive media)
  socket.on("consume", async ({ transportId, producerId, rtpCapabilities, sessionCode }, callback) => {
    try {
      const router = await getOrCreateRouter(sessionCode);
      const transport = transports.get(transportId);

      if (!router.canConsume({ producerId, rtpCapabilities })) {
        callback({ error: "Cannot consume" });
        return;
      }

      const consumer = await transport.consume({
        producerId,
        rtpCapabilities,
        paused: false,
      });
      consumers.set(consumer.id, consumer);

      callback({
        id: consumer.id,
        producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      });
    } catch (err) {
      callback({ error: err.message });
    }
  });

  // Annotations broadcast
  socket.on("annotation", ({ sessionCode, data }) => {
    socket.to(sessionCode).emit("annotation", data);
  });

  // Disconnect
  socket.on("disconnect", () => {
    const { sessionCode, name, role } = socket.data || {};
    if (sessionCode) {
      socket.to(sessionCode).emit("peer-left", { name, role });
    }
    console.log("Client disconnected:", socket.id);
  });
});

// Health check
app.get("/health", (_, res) => res.json({ status: "ok" }));

// Start
const PORT = process.env.PORT || 4000;
createWorker().then(() => {
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});