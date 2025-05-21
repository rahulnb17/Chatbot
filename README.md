# Chatbot
# 🌍 Anonymous Global Chatbot

A real-time, globally accessible chatbot that allows anonymous conversations between users through shared links — no login required.

## 🚀 Features

- **Real-time Messaging** — Powered by WebSockets for low-latency bidirectional communication.
- **Anonymous Access** — No signup or login required. Just share a link and start chatting.
- **Scalable Deployment** — Served using NGINX for efficient load balancing and link routing.
- **High Performance** — Redis integration ensures fast message queuing and quick delivery, even under heavy traffic.
- **Instant Room Creation** — Each chat session is accessible via a unique sharable link.

---

## 🛠️ Tech Stack

| Technology     | Usage                                      |
|----------------|--------------------------------------------|
| **Python**     | Backend logic and WebSocket handling       |
| **JavaScript** | Frontend interactivity and real-time events|
| **WebSockets** | Real-time bidirectional communication      |
| **NGINX**      | Reverse proxy, link routing, and deployment|
| **Redis**      | Message queue and fast data operations     |

---

## 📦 Setup Instructions

### 1. Clone the Repository
```bash
git clone https://github.com/rahulnb17/Chatbot.git
cd Chatbot
