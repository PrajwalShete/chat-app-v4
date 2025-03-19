import { useState, useEffect } from "react";
import { Send } from "lucide-react";
import { getSocket } from "../../socket";

const ChatInput = ({ onSendMessage, chatId }) => {
  const [message, setMessage] = useState("");
  const [typingTimeout, setTypingTimeout] = useState(null);
  const [isTypingSent, setIsTypingSent] = useState(false);

  // Clean up timeout when component unmounts
  useEffect(() => {
    return () => {
      if (typingTimeout) {
        clearTimeout(typingTimeout);

        // Ensure we send stopTyping when unmounting
        try {
          const socket = getSocket();
          socket.emit("stopTyping", { chatId });
          console.log("Sent stop typing on unmount for chat:", chatId);
        } catch (error) {
          console.error("Socket not initialized:", error);
        }
      }
    };
  }, [typingTimeout, chatId]);

  // Clean up when chatId changes
  useEffect(() => {
    // Send stop typing when moving to a different chat
    if (isTypingSent) {
      try {
        const socket = getSocket();
        socket.emit("stopTyping", { chatId });
        console.log("Sent stop typing on chat change for chat:", chatId);
        setIsTypingSent(false);
      } catch (error) {
        console.error("Socket not initialized:", error);
      }
    }

    if (typingTimeout) {
      clearTimeout(typingTimeout);
      setTypingTimeout(null);
    }
  }, [chatId]);

  const handleTyping = () => {
    if (!message.trim()) {
      // If message is empty and we previously sent typing
      if (isTypingSent) {
        try {
          const socket = getSocket();
          socket.emit("stopTyping", { chatId });
          console.log("Sent stop typing (empty message) for chat:", chatId);
          setIsTypingSent(false);
        } catch (error) {
          console.error("Socket not initialized:", error);
        }
      }
      return;
    }

    try {
      // Only send typing event if we haven't already
      if (!isTypingSent) {
        const socket = getSocket();
        socket.emit("typing", { chatId });
        console.log("Sent typing for chat:", chatId);
        setIsTypingSent(true);
      }

      // Clear existing timeout
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }

      const timeout = setTimeout(() => {
        try {
          const socket = getSocket();
          socket.emit("stopTyping", { chatId });
          console.log("Sent stop typing (timeout) for chat:", chatId);
          setIsTypingSent(false);
        } catch (error) {
          console.error("Socket not initialized:", error);
        }
      }, 2000);

      setTypingTimeout(timeout);
    } catch (error) {
      console.error("Socket not initialized:", error);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim()) {
      console.log("Submitting message for chat:", chatId);
      onSendMessage(message);
      setMessage("");

      // Stop typing indicator when message is sent
      try {
        const socket = getSocket();
        if (typingTimeout) {
          clearTimeout(typingTimeout);
          setTypingTimeout(null);
        }
        socket.emit("stopTyping", { chatId });
        console.log("Sent stop typing (message sent) for chat:", chatId);
        setIsTypingSent(false);
      } catch (error) {
        console.error("Socket not initialized:", error);
      }
    }
  };

  return (
    <div className="bg-white border-t border-gray-200 p-4">
      <form onSubmit={handleSubmit} className="flex items-center">
        <input
          type="text"
          placeholder="Type a message..."
          className="flex-1 border border-gray-300 rounded-l-md px-4 py-2 focus:outline-none focus:ring-green-500 focus:border-green-500"
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            handleTyping();
          }}
        />
        <button
          type="submit"
          className="bg-green-600 text-white rounded-r-md px-4 py-2 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          disabled={!message.trim()}
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  );
};

export default ChatInput;
