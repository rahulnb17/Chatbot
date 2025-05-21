// chat.js

document.addEventListener("DOMContentLoaded", () => {
    const roomId = new URLSearchParams(window.location.search).get("room");
    const token = localStorage.getItem("token");
  
    if (!roomId || !token) {
      alert("Room ID or token missing. Please log in again.");
      window.location.href = "login.html";
      return;
    }
  
    document.getElementById("roomDisplay").textContent = `Room: ${roomId}`;
  
    const socket = io({
      auth: { token }
    });
  
    // Join the room
    socket.emit("joinRoom", roomId);
  
    // Handle receiving messages
    socket.on("message", (msg) => {
      const chatBox = document.getElementById("chatBox");
      const messageDiv = document.createElement("div");
      messageDiv.textContent = msg;
      chatBox.appendChild(messageDiv);
      chatBox.scrollTop = chatBox.scrollHeight;
    });
  
    // Send message
    document.getElementById("sendBtn").addEventListener("click", () => {
      const input = document.getElementById("messageInput");
      const message = input.value.trim();
  
      if (message !== "") {
        socket.emit("sendMessage", { roomId, message });
        input.value = "";
      }
    });
  
    // Handle unauthorized access
    socket.on("unauthorized", () => {
      alert("Access denied. Please log in again.");
      localStorage.removeItem("token");
      window.location.href = "login.html";
    });
  });
  