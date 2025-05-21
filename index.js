require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { nanoid } = require('nanoid');
const jwt = require('jsonwebtoken');

// Import models
const User = require('./models/user');
const Room = require('./models/Room');

// Import routes
const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('Could not connect to MongoDB:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'login.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'signup.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'dashboard.html'));
});

app.get('/chat/:roomId', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'chat.html'));
});

// Socket.io authentication middleware
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error: Token not provided'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    socket.username = decoded.username;
    const user = await User.findById(decoded.userId);
    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }
    next();
  } catch (error) {
    return next(new Error('Authentication error: Invalid token'));
  }
});

// Connected users map (userId -> socket.id)
const connectedUsers = new Map();

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.userId} (${socket.username})`);
  
  // Store the user connection
  connectedUsers.set(socket.userId.toString(), socket.id);
  
  // Create a new room
  socket.on('create-room', async (roomName) => {
    try {
      const roomId = nanoid(10);
      const newRoom = new Room({
        roomId,
        name: roomName,
        createdBy: socket.userId,
        participants: [socket.userId]
      });
      
      await newRoom.save();
      socket.emit('room-created', { roomId, name: roomName });
    } catch (error) {
      socket.emit('error', { message: 'Failed to create room' });
      console.error('Room creation error:', error);
    }
  });
  
  // Join a room
  socket.on('join-room', async (roomId) => {
    try {
      const room = await Room.findOne({ roomId }).populate('participants', 'username');
      
      if (!room) {
        return socket.emit('error', { message: 'Room not found' });
      }
      
      // Check if user is already a participant
      if (!room.participants.some(p => p._id.toString() === socket.userId)) {
        room.participants.push(socket.userId);
        await room.save();
      }
      
      socket.join(roomId);
      
      // Get room data with populated user info and last 50 messages
      const roomData = {
        roomId: room.roomId,
        name: room.name,
        participants: room.participants,
        messages: room.messages.slice(-50) // Last 50 messages
      };
      
      socket.emit('room-joined', roomData);
      socket.to(roomId).emit('user-joined', { userId: socket.userId, username: socket.username });
    } catch (error) {
      socket.emit('error', { message: 'Failed to join room' });
      console.error('Room join error:', error);
    }
  });
  
  // Leave a room
  socket.on('leave-room', async (roomId) => {
    try {
      socket.leave(roomId);
      socket.to(roomId).emit('user-left', { userId: socket.userId, username: socket.username });
    } catch (error) {
      socket.emit('error', { message: 'Failed to leave room' });
      console.error('Room leave error:', error);
    }
  });
  
  // Send a message to a room
  socket.on('send-message', async ({ roomId, content }) => {
    try {
      const room = await Room.findOne({ roomId });
      
      if (!room) {
        return socket.emit('error', { message: 'Room not found' });
      }
      
      // Check if user is a participant
      if (!room.isParticipant(socket.userId)) {
        return socket.emit('error', { message: 'You are not a participant in this room' });
      }
      
      const message = {
        userId: socket.userId,
        username: socket.username,
        content,
        createdAt: new Date()
      };
      
      room.messages.push(message);
      room.lastActivity = new Date();
      await room.save();
      
      io.to(roomId).emit('new-message', message);
    } catch (error) {
      socket.emit('error', { message: 'Failed to send message' });
      console.error('Message send error:', error);
    }
  });
  
  // Get user's rooms
  socket.on('get-my-rooms', async () => {
    try {
      const rooms = await Room.find({ participants: socket.userId })
        .select('roomId name createdBy participants lastActivity')
        .populate('createdBy', 'username');
      
      socket.emit('my-rooms', rooms);
    } catch (error) {
      socket.emit('error', { message: 'Failed to get rooms' });
      console.error('Get rooms error:', error);
    }
  });
  
  // Disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.userId}`);
    connectedUsers.delete(socket.userId.toString());
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});