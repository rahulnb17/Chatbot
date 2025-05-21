// ========== LOGIN ==========
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = loginForm.username.value;
    const password = loginForm.password.value;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('username', username);
        alert('Login successful!');
        window.location.href = '/dashboard.html';
      } else {
        alert(data.error || 'Login failed.');
      }
    } catch (err) {
      alert('Server error. Try again later.');
    }
  });
}

// ========== SIGNUP ==========
const signupForm = document.getElementById('signupForm');
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = signupForm.username.value;
    const password = signupForm.password.value;

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (res.ok) {
        alert('Signup successful! You can log in now.');
        window.location.href = '/login.html';
      } else {
        alert(data.error || 'Signup failed.');
      }
    } catch (err) {
      alert('Server error. Try again later.');
    }
  });
}

// ========== CHAT (Room-Based) ==========
if (window.location.pathname === '/chat.html') {
  document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get("room");

    if (!roomId) {
      alert("Room ID missing!");
      window.location.href = "dashboard.html";
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      alert("Please log in first.");
      window.location.href = "login.html";
      return;
    }

    document.getElementById("roomDisplay").textContent = `Room: ${roomId}`;

    const socket = io({
      auth: { token }
    });

    socket.emit("joinRoom", roomId);

    const chatBox = document.getElementById("chatBox");
    const input = document.getElementById("messageInput");
    const sendBtn = document.getElementById("sendBtn");

    socket.on("message", (msg) => {
      const div = document.createElement("div");
      div.textContent = msg;
      chatBox.appendChild(div);
      chatBox.scrollTop = chatBox.scrollHeight;
    });

    socket.on("unauthorized", () => {
      alert("Unauthorized! Please log in again.");
      localStorage.removeItem("token");
      window.location.href = "login.html";
    });

    sendBtn.addEventListener("click", () => {
      const message = input.value.trim();
      if (!message) return;

      socket.emit("sendMessage", { roomId, message });
      input.value = "";
    });
  });
}
