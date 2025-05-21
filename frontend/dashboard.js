// dashboard.js

document.addEventListener("DOMContentLoaded", () => {
    const createBtn = document.getElementById("createRoom");
    const joinBtn = document.getElementById("joinRoom");
    const joinInput = document.getElementById("joinRoomId");
  
    // Ensure user is logged in
    const token = localStorage.getItem("token");
    if (!token) {
      alert("You must log in first!");
      window.location.href = "login.html";
      return;
    }
  
    // Create room
    createBtn.addEventListener("click", () => {
      const roomId = Math.random().toString(36).substr(2, 8);
      window.location.href = `chat.html?room=${roomId}`;
    });
  
    // Join room
    joinBtn.addEventListener("click", () => {
      const roomId = joinInput.value.trim();
      if (roomId === "") {
        alert("Please enter a Room ID.");
      } else {
        window.location.href = `chat.html?room=${roomId}`;
      }
    });
  });
  