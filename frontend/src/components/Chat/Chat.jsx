import { useState, useEffect, useRef } from "react";
import { signOut } from "firebase/auth";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  getDocs,
  getDoc,
  doc,
} from "firebase/firestore"; // Added getDoc and doc imports
import { auth, db } from "../../firebase";
import Sidebar from "./Sidebar";
import ChatMessages from "./ChatMessages";
import ChatInput from "./ChatInput";
import { initSocket, getSocket, closeSocket } from "../../socket";

const Chat = ({ user }) => {
  const [chats, setChats] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [chatUserInfo, setChatUserInfo] = useState(null); // Add this for other user info
  const messagesEndRef = useRef(null);
  const socketInitialized = useRef(false);
  const userStatusMap = useRef(new Map()); // Store user status separately

  // Debug logging
  useEffect(() => {
    console.log("onlineUsers state changed:", Array.from(onlineUsers));
  }, [onlineUsers]);

  // Initialize socket connection
  useEffect(() => {
    if (user && !socketInitialized.current) {
      console.log("Initializing socket for user:", user.uid);
      try {
        const socket = initSocket(user.uid);
        socketInitialized.current = true;

        // Connection established
        socket.on("connect", () => {
          console.log("Socket connected, emitting login");
          socket.emit("login", user.uid);
        });

        // Listen for received online users list
        socket.on("onlineUsersList", (userIds) => {
          console.log("Received online users list:", userIds);
          // Update both states
          userStatusMap.current = new Map(userIds.map((id) => [id, "online"]));
          setOnlineUsers(new Set(userIds));
        });

        // Listen for user status changes
        socket.on("userStatusChanged", ({ userId, status }) => {
          console.log(`User ${userId} status changed to ${status}`);

          // Update user status map
          userStatusMap.current.set(userId, status);

          // Update React state
          setOnlineUsers((prev) => {
            const newSet = new Set(prev);
            if (status === "online") {
              newSet.add(userId);
            } else {
              newSet.delete(userId);
            }
            return newSet;
          });
        });

        // Other event listeners...
        socket.on("userTyping", ({ chatId, userId }) => {
          console.log(`User ${userId} is typing in chat ${chatId}`);
          if (currentChat?.id === chatId) {
            console.log("Setting isTyping to true");
            setIsTyping(true);
          }
        });

        socket.on("userStoppedTyping", ({ chatId }) => {
          console.log(`User stopped typing in chat ${chatId}`);
          if (currentChat?.id === chatId) {
            console.log("Setting isTyping to false");
            setIsTyping(false);
          }
        });

        // Clean up on unmount
        return () => {
          socket.off();
          closeSocket();
          socketInitialized.current = false;
        };
      } catch (error) {
        console.error("Failed to initialize socket:", error);
        socketInitialized.current = false;
      }
    }
  }, [user]);

  // Request online status periodically
  useEffect(() => {
    if (!socketInitialized.current) return;

    // Request online users immediately
    try {
      const socket = getSocket();
      socket.emit("getOnlineUsers");
    } catch (error) {
      console.error("Error requesting online users:", error);
    }

    // Set up periodic polling
    const interval = setInterval(() => {
      try {
        const socket = getSocket();
        socket.emit("getOnlineUsers");
      } catch (error) {
        console.error("Error in heartbeat:", error);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [socketInitialized.current]);

  // Load user's chats
  useEffect(() => {
    if (!user?.uid) return;

    console.log("Loading chats for user:", user.uid);
    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", user.uid)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const chatsList = [];
      querySnapshot.forEach((doc) => {
        chatsList.push({ id: doc.id, ...doc.data() });
      });
      console.log("Loaded chats:", chatsList.length);
      setChats(chatsList);
    });

    return () => unsubscribe();
  }, [user]);

  // NEW EFFECT: Load the other user's info when chat changes
  useEffect(() => {
    const loadChatUserInfo = async () => {
      if (!currentChat || !user) return;

      try {
        // Find the other participant ID (not the current user)
        const otherUserId = currentChat.participants.find(
          (id) => id !== user.uid
        );

        if (!otherUserId) {
          console.warn(
            "Could not find other participant in chat:",
            currentChat.id
          );
          return;
        }

        console.log("Loading user info for:", otherUserId);

        // Get user data from Firestore
        const userDoc = await getDoc(doc(db, "users", otherUserId));

        if (userDoc.exists()) {
          const userData = userDoc.data();
          console.log("Loaded other user data:", userData);
          setChatUserInfo({
            id: otherUserId,
            ...userData,
          });
        } else {
          console.warn("User document not found for:", otherUserId);
          setChatUserInfo(null);
        }
      } catch (error) {
        console.error("Error loading chat user info:", error);
        setChatUserInfo(null);
      }
    };

    loadChatUserInfo();
  }, [currentChat, user]);

  // Load messages for current chat
  useEffect(() => {
    if (currentChat) {
      console.log("Loading messages for chat:", currentChat.id);
      const q = query(
        collection(db, "messages"),
        where("chatId", "==", currentChat.id),
        orderBy("createdAt")
      );

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const messagesList = [];
        querySnapshot.forEach((doc) => {
          messagesList.push({ id: doc.id, ...doc.data() });
        });
        console.log("Loaded messages:", messagesList.length);
        setMessages(messagesList);
      });

      return () => unsubscribe();
    }
  }, [currentChat]);

  // Auto-scroll when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (text) => {
    if (!text.trim() || !currentChat) return;

    console.log("Sending message:", text.substring(0, 20) + "...");
    try {
      const socket = getSocket();
      socket.emit("sendMessage", {
        chatId: currentChat.id,
        text,
      });
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const handleSearch = async (term) => {
    setSearchTerm(term);
    if (!term) return;

    setLoading(true);

    try {
      const q = query(
        collection(db, "users"),
        where("displayName", ">=", term),
        where("displayName", "<=", term + "\uf8ff")
      );

      const querySnapshot = await getDocs(q);
      const users = [];

      querySnapshot.forEach((doc) => {
        if (doc.id !== user.uid) {
          users.push({ id: doc.id, ...doc.data() });
        }
      });

      console.log("Search results:", users);
    } catch (error) {
      console.error("Error searching users:", error);
    } finally {
      setLoading(false);
    }
  };

  // Handle chat selection
  const handleChatSelect = (chat) => {
    console.log("Selecting chat:", chat.id);
    setCurrentChat(chat);

    // Request latest online status when changing chats without affecting current state
    try {
      const socket = getSocket();
      socket.emit("getOnlineUsers");
    } catch (error) {
      console.error("Socket not available:", error);
    }
  };

  // NEW FUNCTION: Get display name for chat header
  const getChatDisplayName = () => {
    if (!currentChat) return "Chat";

    // If we have loaded user info, use the display name
    if (chatUserInfo?.displayName) {
      return chatUserInfo.displayName;
    }

    // Fallback to chat name if available and not current user
    if (currentChat.name && currentChat.name !== user.displayName) {
      return currentChat.name;
    }

    // Last resort - show a placeholder
    return "Chat Participant";
  };

  // Check if other participant is online
  const isOtherParticipantOnline = (chat) => {
    if (!chat || !chat.participants) return false;

    // Find the other participant (not the current user)
    const otherParticipant = chat.participants.find((id) => id !== user.uid);

    // Check in the set directly
    const isOnline = otherParticipant && onlineUsers.has(otherParticipant);

    return isOnline;
  };

  return (
    <div className="h-screen flex overflow-hidden bg-gray-100">
      <Sidebar
        user={user}
        chats={chats}
        currentChat={currentChat}
        setCurrentChat={handleChatSelect} // Use the new handler
        onSearch={handleSearch}
        onLogout={handleLogout}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        onlineUsers={onlineUsers}
      />
      <div className="flex-1 flex flex-col h-full">
        {currentChat ? (
          <>
            <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-500 font-bold">
                  {/* Use the function to get the first letter */}
                  {getChatDisplayName().charAt(0).toUpperCase()}
                </div>
                <div className="ml-3">
                  {/* Use the function to get the right name */}
                  <h3 className="text-lg font-medium text-gray-900">
                    {getChatDisplayName()}
                  </h3>
                  <div className="flex items-center">
                    <span
                      className={`h-2 w-2 rounded-full mr-2 ${
                        isOtherParticipantOnline(currentChat)
                          ? "bg-green-500"
                          : "bg-gray-300"
                      }`}
                    ></span>
                    <p className="text-sm text-gray-500">
                      {isOtherParticipantOnline(currentChat)
                        ? "Online"
                        : "Offline"}
                    </p>
                  </div>
                  {isTyping && (
                    <p className="text-sm font-medium text-blue-500 animate-pulse">
                      Typing...
                    </p>
                  )}
                </div>
              </div>
            </div>
            <ChatMessages
              messages={messages}
              currentUser={user}
              messagesEndRef={messagesEndRef}
            />
            <ChatInput
              onSendMessage={handleSendMessage}
              chatId={currentChat.id}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <h3 className="text-xl font-medium text-gray-700">
              Welcome to Chat App
            </h3>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
