import { useState, useEffect } from "react";
import { getSocket } from "../../socket";

const DebugPanel = ({ currentChat, onlineUsers }) => {
  const [debugInfo, setDebugInfo] = useState({});

  const refreshOnlineStatus = () => {
    try {
      const socket = getSocket();
      socket.emit("getOnlineUsers");
      console.log("Manually requested online users");
    } catch (error) {
      console.error("Socket error:", error);
    }
  };

  useEffect(() => {
    try {
      const socket = getSocket();
      setDebugInfo({
        onlineUsers: Array.from(onlineUsers),
        currentChatId: currentChat?.id,
        socketConnected: socket.connected,
        socketId: socket.id,
      });
    } catch (error) {
      setDebugInfo({
        onlineUsers: Array.from(onlineUsers),
        currentChatId: currentChat?.id,
        socketConnected: false,
        socketId: "Not connected",
      });
    }
  }, [onlineUsers, currentChat]);

  return (
    <div className="bg-white shadow p-3 m-2 text-sm">
      <h4 className="font-bold">Debug Panel</h4>
      <div>Online users: {debugInfo.onlineUsers?.join(", ") || "None"}</div>
      <div>Current chat: {debugInfo.currentChatId || "None"}</div>
      <div>Socket connected: {debugInfo.socketConnected ? "Yes" : "No"}</div>
      <div>Socket ID: {debugInfo.socketId}</div>
      <button
        onClick={refreshOnlineStatus}
        className="bg-blue-500 text-white px-2 py-1 mt-2 text-xs"
      >
        Refresh Online Status
      </button>
    </div>
  );
};

export default DebugPanel;
