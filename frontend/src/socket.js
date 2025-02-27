import { io } from "socket.io-client";

const SERVER_URL =
  import.meta.env.VITE_SOCKET_SERVER_URL || "http://localhost:5007";

let socket = null;

export const initSocket = (userId) => {
  if (socket) {
    console.log("Socket already initialized, closing previous connection");
    socket.disconnect();
  }

  console.log("Initializing socket with URL:", SERVER_URL);

  socket = io(SERVER_URL, {
    withCredentials: true,
    timeout: 10000,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  socket.on("connect", () => {
    console.log("Socket connected with ID:", socket.id);
  });

  socket.on("connect_error", (error) => {
    console.error("Socket connection error:", error);
  });

  socket.on("disconnect", (reason) => {
    console.log(`Socket disconnected: ${reason}`);
  });

  return socket;
};

export const getSocket = () => {
  if (!socket || !socket.connected) {
    console.warn("Socket not connected or initialized");
    throw new Error(
      "Socket not initialized or not connected. Call initSocket first."
    );
  }
  return socket;
};

export const closeSocket = () => {
  if (socket) {
    console.log("Closing socket connection");
    socket.disconnect();
    socket = null;
  }
};
