import { useState } from "react";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import { Search, LogOut, MessageSquare, Plus } from "lucide-react";

const Sidebar = ({
  user,
  chats,
  currentChat,
  setCurrentChat,
  onSearch,
  onLogout,
  searchTerm,
  setSearchTerm,
}) => {
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [newChatEmail, setNewChatEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSearchUser = async () => {
    if (!newChatEmail) return;
    setLoading(true);
    setError("");
    setSearchResults([]);

    try {
      const q = query(
        collection(db, "users"),
        where("email", "==", newChatEmail)
      );

      const querySnapshot = await getDocs(q);
      const users = [];

      querySnapshot.forEach((doc) => {
        if (doc.id !== user.uid) {
          users.push({ id: doc.id, ...doc.data() });
        }
      });

      if (users.length === 0) {
        setError("No user found with that email");
      } else {
        setSearchResults(users);
      }
    } catch (error) {
      console.error("Error searching users: ", error);
      setError("Error searching for user");
    } finally {
      setLoading(false);
    }
  };

  const createNewChat = async (otherUser) => {
    try {
      // Check if chat already exists
      const chatsRef = collection(db, "chats");
      const q = query(
        chatsRef,
        where("participants", "array-contains", user.uid)
      );

      const querySnapshot = await getDocs(q);
      let chatExists = false;
      let existingChatId;

      querySnapshot.forEach((doc) => {
        const chatData = doc.data();
        if (chatData.participants.includes(otherUser.id)) {
          chatExists = true;
          existingChatId = doc.id;
        }
      });

      if (chatExists) {
        const existingChat = chats.find((chat) => chat.id === existingChatId);
        setCurrentChat(existingChat);
      } else {
        // Create new chat
        const newChat = {
          participants: [user.uid, otherUser.id],
          participantsInfo: {
            [user.uid]: {
              displayName: user.displayName,
              photoURL: user.photoURL || "",
            },
            [otherUser.id]: {
              displayName: otherUser.displayName,
              photoURL: otherUser.photoURL || "",
            },
          },
          lastMessage: {
            text: "",
            senderId: "",
            timestamp: serverTimestamp(),
          },
          createdAt: serverTimestamp(),
          name: otherUser.displayName,
        };

        const docRef = await addDoc(chatsRef, newChat);
        setCurrentChat({ id: docRef.id, ...newChat });
      }

      setShowNewChatModal(false);
      setNewChatEmail("");
      setSearchResults([]);
    } catch (error) {
      console.error("Error creating chat: ", error);
      setError("Error creating chat");
    }
  };

  return (
    <div className="w-64 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
      {/* Sidebar header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-green-500 font-bold">
            {user.displayName && user.displayName.charAt(0).toUpperCase()}
          </div>
          <h2 className="text-lg font-medium text-gray-900 truncate">
            {user.displayName}
          </h2>
        </div>
        <button
          onClick={onLogout}
          className="text-gray-500 hover:text-gray-700 p-1 rounded-full"
        >
          <LogOut size={18} />
        </button>
      </div>

      {/* Search */}
      <div className="p-3">
        <div className="relative">
          <input
            type="text"
            placeholder="Search chats"
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm placeholder-gray-400 focus:outline-none focus:border-green-500"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              onSearch(e.target.value);
            }}
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-gray-400" />
          </div>
        </div>
      </div>

      {/* New chat button */}
      <button
        onClick={() => setShowNewChatModal(true)}
        className="mx-3 mb-2 flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
      >
        <Plus size={16} className="mr-2" />
        New Chat
      </button>

      {/* Chats list */}
      <div className="flex-1 overflow-y-auto p-2">
        {chats.length > 0 ? (
          chats.map((chat) => {
            // Get the other participant's info
            const otherParticipantId = chat.participants.find(
              (id) => id !== user.uid
            );
            const otherParticipantInfo =
              chat.participantsInfo?.[otherParticipantId] || {};

            return (
              <div
                key={chat.id}
                onClick={() => setCurrentChat(chat)}
                className={`p-2 rounded-lg cursor-pointer mb-1 ${
                  currentChat?.id === chat.id
                    ? "bg-green-50"
                    : "hover:bg-gray-100"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    {otherParticipantInfo.photoURL ? (
                      <img
                        src={otherParticipantInfo.photoURL}
                        alt="User"
                        className="h-10 w-10 rounded-full"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-500 font-bold">
                        {otherParticipantInfo.displayName
                          ?.charAt(0)
                          .toUpperCase() || "?"}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {otherParticipantInfo.displayName || "Unknown User"}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {chat.lastMessage?.text || "No messages yet"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500">
            <MessageSquare size={24} className="mb-2" />
            <p className="text-sm">No chats yet</p>
          </div>
        )}
      </div>

      {/* New chat modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Start a new chat
            </h3>

            {error && (
              <div className="mb-4 text-sm text-red-600 p-2 bg-red-50 rounded">
                {error}
              </div>
            )}

            <div className="mb-4">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Enter email address
              </label>
              <div className="flex">
                <input
                  type="email"
                  id="email"
                  className="flex-1 border border-gray-300 rounded-l-md px-3 py-2 text-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                  placeholder="user@example.com"
                  value={newChatEmail}
                  onChange={(e) => setNewChatEmail(e.target.value)}
                />
                <button
                  onClick={handleSearchUser}
                  disabled={loading}
                  className="bg-green-600 text-white px-4 py-2 rounded-r-md hover:bg-green-700 text-sm font-medium"
                >
                  {loading ? "Searching..." : "Search"}
                </button>
              </div>
            </div>

            {searchResults.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Search Results:
                </p>
                {searchResults.map((result) => (
                  <div
                    key={result.id}
                    className="flex items-center p-2 border rounded-md hover:bg-gray-50 cursor-pointer mb-2"
                    onClick={() => createNewChat(result)}
                  >
                    <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-green-500 font-bold mr-3">
                      {result.displayName?.charAt(0).toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {result.displayName}
                      </p>
                      <p className="text-xs text-gray-500">{result.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => {
                  setShowNewChatModal(false);
                  setNewChatEmail("");
                  setSearchResults([]);
                  setError("");
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md mr-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
