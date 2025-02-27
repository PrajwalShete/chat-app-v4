const express = require("express");
const http = require("http");
const cors = require("cors");
const socketIo = require("socket.io");
const admin = require("firebase-admin");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Initialize Firebase Admin
const serviceAccount = require("./firebase-service-account.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Middleware
app.use(cors());
app.use(express.json());

// Online users
const onlineUsers = new Map();

// Debug endpoint to see current online users
app.get("/debug/online-users", (req, res) => {
  const users = Array.from(onlineUsers.entries()).map(([id, socketId]) => ({
    userId: id,
    socketId,
  }));
  res.json({ users });
});

// Socket.io connection
io.on("connection", (socket) => {
  console.log(`[${new Date().toISOString()}] New socket connected:`, socket.id);

  // Send online users list when requested - broadcast to ALL clients
  socket.on("getOnlineUsers", () => {
    const onlineUsersList = Array.from(onlineUsers.keys());
    console.log(
      `[${new Date().toISOString()}] Broadcasting online users list:`,
      onlineUsersList
    );

    // Broadcast to all clients to ensure consistent state
    io.emit("onlineUsersList", onlineUsersList);
  });

  // User connects and authenticates
  socket.on("login", async (userId) => {
    try {
      console.log(
        `[${new Date().toISOString()}] User ${userId} logging in with socket ${
          socket.id
        }`
      );

      // Store the user ID with this socket
      socket.userId = userId;
      onlineUsers.set(userId, socket.id);

      // Update user status in Firestore
      const userRef = admin.firestore().collection("users").doc(userId);
      await userRef.update({
        status: "online",
        lastSeen: admin.firestore.FieldValue.serverTimestamp(),
      });

      // CRITICAL: Broadcast to ALL clients that this user is online
      io.emit("userStatusChanged", {
        userId,
        status: "online",
      });

      // Send the current online users list to all clients
      const onlineUsersList = Array.from(onlineUsers.keys());
      io.emit("onlineUsersList", onlineUsersList);

      console.log(
        `[${new Date().toISOString()}] User ${userId} successfully logged in`
      );
      console.log(
        `[${new Date().toISOString()}] Current online users:`,
        onlineUsersList
      );
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] Login error for ${userId}:`,
        error
      );
      socket.emit("error", { message: "Login failed", details: error.message });
    }
  });

  // User sends a message
  socket.on("sendMessage", async (messageData) => {
    try {
      const { chatId, text } = messageData;

      if (!socket.userId) {
        console.error(
          `[${new Date().toISOString()}] Unauthenticated message attempt`
        );
        socket.emit("error", { message: "Not authenticated" });
        return;
      }

      console.log(
        `[${new Date().toISOString()}] Message from ${
          socket.userId
        } in chat ${chatId}: ${text.substring(0, 20)}...`
      );

      // Get chat to find recipients
      const chatRef = admin.firestore().collection("chats").doc(chatId);
      const chatDoc = await chatRef.get();

      if (!chatDoc.exists) {
        console.error(`[${new Date().toISOString()}] Chat ${chatId} not found`);
        socket.emit("error", { message: "Chat not found" });
        return;
      }

      const chatData = chatDoc.data();

      // Add message to Firestore
      const messageRef = await admin.firestore().collection("messages").add({
        chatId,
        senderId: socket.userId,
        text,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        read: false,
      });

      // Update last message in chat
      await chatRef.update({
        "lastMessage.text": text,
        "lastMessage.senderId": socket.userId,
        "lastMessage.timestamp": admin.firestore.FieldValue.serverTimestamp(),
      });

      // Create message object with ID
      const messageWithId = {
        id: messageRef.id,
        chatId,
        senderId: socket.userId,
        text,
        createdAt: new Date(),
      };

      // Send confirmation to sender
      socket.emit("messageSent", messageWithId);

      // Notify recipients
      chatData.participants.forEach((participantId) => {
        if (participantId !== socket.userId && onlineUsers.has(participantId)) {
          const recipientSocket = onlineUsers.get(participantId);
          console.log(
            `[${new Date().toISOString()}] Sending message to ${participantId} (socket: ${recipientSocket})`
          );
          io.to(recipientSocket).emit("newMessage", messageWithId);
        }
      });
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Send message error:`, error);
      socket.emit("error", {
        message: "Failed to send message",
        details: error.message,
      });
    }
  });

  // User starts typing
  socket.on("typing", async ({ chatId }) => {
    if (!socket.userId) {
      console.error(
        `[${new Date().toISOString()}] Unauthenticated typing event attempt`
      );
      return;
    }

    console.log(
      `[${new Date().toISOString()}] User ${
        socket.userId
      } typing in chat ${chatId}`
    );

    try {
      // Get chat to find who to notify
      const chatDoc = await admin
        .firestore()
        .collection("chats")
        .doc(chatId)
        .get();

      if (!chatDoc.exists) {
        console.error(
          `[${new Date().toISOString()}] Chat ${chatId} not found for typing event`
        );
        return;
      }

      const chatData = chatDoc.data();
      chatData.participants.forEach((participantId) => {
        if (participantId !== socket.userId && onlineUsers.has(participantId)) {
          const recipientSocket = onlineUsers.get(participantId);
          console.log(
            `[${new Date().toISOString()}] Sending typing event to ${participantId} (socket: ${recipientSocket})`
          );
          io.to(recipientSocket).emit("userTyping", {
            chatId,
            userId: socket.userId,
          });
        }
      });
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] Typing notification error:`,
        error
      );
    }
  });

  // User stops typing
  socket.on("stopTyping", async ({ chatId }) => {
    if (!socket.userId) {
      console.error(
        `[${new Date().toISOString()}] Unauthenticated stop typing event attempt`
      );
      return;
    }

    console.log(
      `[${new Date().toISOString()}] User ${
        socket.userId
      } stopped typing in chat ${chatId}`
    );

    try {
      // Get chat to find who to notify
      const chatDoc = await admin
        .firestore()
        .collection("chats")
        .doc(chatId)
        .get();

      if (!chatDoc.exists) {
        console.error(
          `[${new Date().toISOString()}] Chat ${chatId} not found for stop typing event`
        );
        return;
      }

      const chatData = chatDoc.data();
      chatData.participants.forEach((participantId) => {
        if (participantId !== socket.userId && onlineUsers.has(participantId)) {
          const recipientSocket = onlineUsers.get(participantId);
          console.log(
            `[${new Date().toISOString()}] Sending stop typing event to ${participantId} (socket: ${recipientSocket})`
          );
          io.to(recipientSocket).emit("userStoppedTyping", {
            chatId,
            userId: socket.userId,
          });
        }
      });
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] Stop typing notification error:`,
        error
      );
    }
  });

  // User disconnects
  socket.on("disconnect", async () => {
    console.log(
      `[${new Date().toISOString()}] Socket disconnected:`,
      socket.id
    );

    if (socket.userId) {
      try {
        // Check if this user is still online with this socket
        if (onlineUsers.get(socket.userId) === socket.id) {
          console.log(
            `[${new Date().toISOString()}] User ${
              socket.userId
            } fully disconnected`
          );

          // Update user status in Firestore
          const userRef = admin
            .firestore()
            .collection("users")
            .doc(socket.userId);
          await userRef.update({
            status: "offline",
            lastSeen: admin.firestore.FieldValue.serverTimestamp(),
          });

          // Remove from online users map
          onlineUsers.delete(socket.userId);

          // Broadcast to all clients that this user is offline
          io.emit("userStatusChanged", {
            userId: socket.userId,
            status: "offline",
          });

          // Update online users list for all clients
          const onlineUsersList = Array.from(onlineUsers.keys());
          io.emit("onlineUsersList", onlineUsersList);
        } else {
          console.log(
            `[${new Date().toISOString()}] User ${
              socket.userId
            } is still online with another socket`
          );
        }
      } catch (error) {
        console.error(`[${new Date().toISOString()}] Disconnect error:`, error);
      }
    }
  });

  // Handle socket errors
  socket.on("error", (error) => {
    console.error(`[${new Date().toISOString()}] Socket error:`, error);
  });
});

// Routes
app.get("/", (req, res) => {
  res.send("Chat App API is running");
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    connections: io.engine.clientsCount,
    onlineUsers: Array.from(onlineUsers.keys()),
  });
});

// Start server
const PORT = process.env.PORT || 5007;
server.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Server running on port ${PORT}`);
});

// Handle server errors
server.on("error", (error) => {
  console.error(`[${new Date().toISOString()}] Server error:`, error);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error(`[${new Date().toISOString()}] Uncaught exception:`, error);
});

// Handle unhandled rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error(
    `[${new Date().toISOString()}] Unhandled rejection at:`,
    promise,
    "reason:",
    reason
  );
});
