const ChatMessages = ({ messages, currentUser, messagesEndRef }) => {
  const formatTime = (timestamp) => {
    if (!timestamp) return "";

    const date = timestamp.toDate();
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
      {messages.length > 0 ? (
        <div className="space-y-4">
          {messages.map((message) => {
            const isOwnMessage = message.senderId === currentUser.uid;

            return (
              <div
                key={message.id}
                className={`flex ${
                  isOwnMessage ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-3/4 rounded-lg px-4 py-2 ${
                    isOwnMessage
                      ? "bg-green-600 text-white rounded-br-none"
                      : "bg-white text-gray-800 rounded-bl-none border border-gray-200"
                  }`}
                >
                  <p className="text-sm">{message.text}</p>
                  <span
                    className={`text-xs ${
                      isOwnMessage ? "text-green-100" : "text-gray-500"
                    } block text-right mt-1`}
                  >
                    {formatTime(message.createdAt)}
                  </span>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      ) : (
        <div className="h-full flex items-center justify-center">
          <p className="text-gray-500 text-sm">
            No messages yet. Start a conversation!
          </p>
        </div>
      )}
    </div>
  );
};

export default ChatMessages;
