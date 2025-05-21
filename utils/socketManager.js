const jwt = require('jsonwebtoken');
const User = require('../models/user');
const Room = require('../models/room');
const { nanoid } = require('nanoid');

// Connected users map (userId -> socket.id)
const connectedUsers = new Map();

/**
 * Initialize Socket.IO with authentication and event handling
 * @param {Object} io - Socket.IO server instance
 */
function initializeSocketIO(io) {
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

  // Socket.IO connection handling
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userId} (${socket.username})`);
    
    // Store user connection
    connectedUsers.set(socket.userId.toString(), socket.id);
    
    // Register event handlers
    setupRoomEvents(io, socket);
    setupMessageEvents(io, socket);
    setupUserEvents(io, socket);
    
    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
      connectedUsers.delete(socket.userId.toString());
    });
  });
}

/**
 * Setup room-related socket events
 * @param {Object} io - Socket.IO server instance
 * @param {Object} socket - Connected socket
 */
function setupRoomEvents(io, socket) {
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
      socket.emit('room-created', { 
        roomId, 
        name: roomName,
        createdBy: socket.userId,
        participants: [socket.userId],
        createdAt: newRoom.createdAt
      });
    } catch (error) {
      socket.emit('error', { message: 'Failed to create room' });
      console.error('Room creation error:', error);
    }
  });
  
  // Join a room
  socket.on('join-room', async (roomId) => {
    try {
      const room = await Room.findOne({ roomId })
        .populate('participants', 'username')
        .populate('createdBy', 'username');
      
      if (!room) {
        return socket.emit('error', { message: 'Room not found' });
      }
      
      // Check if user is already a participant
      const isParticipant = room.participants.some(p => p._id.toString() === socket.userId);
      
      if (!isParticipant) {
        room.participants.push(socket.userId);
        await room.save();
      }
      
      socket.join(roomId);
      
      // Get room data with populated user info and last 50 messages
      const roomData = {
        roomId: room.roomId,
        name: room.name,
        createdBy: room.createdBy,
        participants: room.participants,
        messages: room.messages.slice(-50), // Last 50 messages
        createdAt: room.createdAt,
        lastActivity: room.lastActivity
      };
      
      socket.emit('room-joined', roomData);
      
      // Only notify others if this is a new participant
      if (!isParticipant) {
        socket.to(roomId).emit('user-joined', { 
          userId: socket.userId, 
          username: socket.username 
        });
      }
    } catch (error) {
      socket.emit('error', { message: 'Failed to join room' });
      console.error('Room join error:', error);
    }
  });
  
  // Leave a room
  socket.on('leave-room', async (roomId) => {
    try {
      const room = await Room.findOne({ roomId });
      
      if (room) {
        // Remove user from participants
        room.participants = room.participants.filter(
          userId => userId.toString() !== socket.userId
        );
        await room.save();
      }
      
      socket.leave(roomId);
      socket.to(roomId).emit('user-left', { 
        userId: socket.userId, 
        username: socket.username 
      });
    } catch (error) {
      socket.emit('error', { message: 'Failed to leave room' });
      console.error('Room leave error:', error);
    }
  });
  
  // Get user's rooms
  socket.on('get-my-rooms', async () => {
    try {
      const rooms = await Room.find({ participants: socket.userId })
        .select('roomId name createdBy participants lastActivity createdAt')
        .populate('createdBy', 'username')
        .sort({ lastActivity: -1 });
      
      socket.emit('my-rooms', rooms);
    } catch (error) {
      socket.emit('error', { message: 'Failed to get rooms' });
      console.error('Get rooms error:', error);
    }
  });
  
  // Check if room exists
  socket.on('check-room', async (roomId) => {
    try {
      const room = await Room.findOne({ roomId });
      
      if (room) {
        socket.emit('room-exists', { 
          exists: true, 
          name: room.name,
          isParticipant: room.participants.includes(socket.userId)
        });
      } else {
        socket.emit('room-exists', { exists: false });
      }
    } catch (error) {
      socket.emit('error', { message: 'Failed to check room' });
      console.error('Check room error:', error);
    }
  });
}

/**
 * Setup message-related socket events
 * @param {Object} io - Socket.IO server instance
 * @param {Object} socket - Connected socket
 */
function setupMessageEvents(io, socket) {
  // Send a message to a room
  socket.on('send-message', async ({ roomId, content }) => {
    try {
      const room = await Room.findOne({ roomId });
      
      if (!room) {
        return socket.emit('error', { message: 'Room not found' });
      }
      
      // Check if user is a participant
      if (!room.participants.some(id => id.toString() === socket.userId)) {
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
  
  // Get previous messages
  socket.on('get-messages', async ({ roomId, limit = 50, before }) => {
    try {
      const room = await Room.findOne({ roomId });
      
      if (!room) {
        return socket.emit('error', { message: 'Room not found' });
      }
      
      // Check if user is a participant
      if (!room.participants.some(id => id.toString() === socket.userId)) {
        return socket.emit('error', { message: 'Access denied' });
      }
      
      let messages = [];
      
      if (before) {
        // Find index of the message with the given timestamp
        const messageIndex = room.messages.findIndex(m => 
          m.createdAt.getTime() === new Date(before).getTime());
        
        if (messageIndex > 0) {
          // Get messages before the given timestamp
          messages = room.messages.slice(
            Math.max(0, messageIndex - limit), 
            messageIndex
          );
        }
      } else {
        // Get the latest messages
        messages = room.messages.slice(-limit);
      }
      
      socket.emit('previous-messages', { 
        roomId,
        messages,
        hasMore: before ? messageIndex > limit : room.messages.length > limit
      });
    } catch (error) {
      socket.emit('error', { message: 'Failed to get messages' });
      console.error('Get messages error:', error);
    }
  });
}

/**
 * Setup user-related socket events
 * @param {Object} io - Socket.IO server instance
 * @param {Object} socket - Connected socket
 */
function setupUserEvents(io, socket) {
  // Update user status (typing indicator)
  socket.on('typing', ({ roomId, isTyping }) => {
    socket.to(roomId).emit('user-typing', {
      userId: socket.userId,
      username: socket.username,
      isTyping
    });
  });
  
  // Get online users in a room
  socket.on('get-online-users', async (roomId) => {
    try {
      const room = await Room.findOne({ roomId })
        .populate('participants', 'username');
      
      if (!room) {
        return socket.emit('error', { message: 'Room not found' });
      }
      
      // Check if user is a participant
      if (!room.participants.some(p => p._id.toString() === socket.userId)) {
        return socket.emit('error', { message: 'Access denied' });
      }
      
      // Get online users
      const onlineUsers = room.participants.filter(user => 
        connectedUsers.has(user._id.toString())
      );
      
      socket.emit('online-users', {
        roomId,
        users: onlineUsers.map(user => ({
          userId: user._id,
          username: user.username
        }))
      });
    } catch (error) {
      socket.emit('error', { message: 'Failed to get online users' });
      console.error('Get online users error:', error);
    }
  });
}

module.exports = {
  initializeSocketIO,
  connectedUsers
};