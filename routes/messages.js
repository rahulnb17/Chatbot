const express = require('express');
const router = express.Router();
const { nanoid } = require('nanoid');
const verifyToken = require('../middleware/verifyToken');
const Room = require('../models/room');
const User = require('../models/user');

// Middleware to verify token for all routes
router.use(verifyToken);

// Get all rooms the user is a participant in
router.get('/rooms', async (req, res) => {
  try {
    const rooms = await Room.find({ participants: req.userId })
      .select('roomId name createdBy participants lastActivity')
      .populate('createdBy', 'username')
      .sort({ lastActivity: -1 });
    
    res.json(rooms);
  } catch (err) {
    console.error('Get rooms error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new room
router.post('/rooms', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Room name is required' });
    }
    
    const roomId = nanoid(10);
    
    const newRoom = new Room({
      roomId,
      name,
      createdBy: req.userId,
      participants: [req.userId]
    });
    
    await newRoom.save();
    
    res.status(201).json({ 
      room: {
        roomId: newRoom.roomId,
        name: newRoom.name,
        createdBy: req.userId,
        participants: [req.userId]
      } 
    });
  } catch (err) {
    console.error('Create room error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a specific room by ID
router.get('/rooms/:roomId', async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId })
      .populate('participants', 'username')
      .populate('createdBy', 'username');
    
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    
    // Check if user is a participant
    if (!room.participants.some(p => p._id.toString() === req.userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    res.json(room);
  } catch (err) {
    console.error('Get room error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Join a room
router.post('/rooms/:roomId/join', async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId });
    
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    
    // Check if user is already a participant
    if (room.participants.includes(req.userId)) {
      return res.status(400).json({ message: 'Already a participant' });
    }
    
    room.participants.push(req.userId);
    await room.save();
    
    res.json({ message: 'Joined room successfully' });
  } catch (err) {
    console.error('Join room error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Leave a room
router.post('/rooms/:roomId/leave', async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId });
    
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    
    // Check if user is a participant
    if (!room.participants.includes(req.userId)) {
      return res.status(400).json({ message: 'Not a participant' });
    }
    
    // Filter out the user from participants
    room.participants = room.participants.filter(
      id => id.toString() !== req.userId
    );
    
    await room.save();
    
    res.json({ message: 'Left room successfully' });
  } catch (err) {
    console.error('Leave room error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get messages from a room
router.get('/rooms/:roomId/messages', async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId });
    
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    
    // Check if user is a participant
    if (!room.participants.some(p => p.toString() === req.userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Handle pagination
    const limit = parseInt(req.query.limit) || 50;
    const skip = parseInt(req.query.skip) || 0;
    
    const messages = room.messages
      .slice(Math.max(0, room.messages.length - skip - limit), room.messages.length - skip);
    
    res.json(messages);
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add a message to a room (REST fallback, prefer Socket.IO for real-time)
router.post('/rooms/:roomId/messages', async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ message: 'Message content is required' });
    }
    
    const room = await Room.findOne({ roomId: req.params.roomId });
    
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    
    // Check if user is a participant
    if (!room.participants.some(p => p.toString() === req.userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const user = await User.findById(req.userId);
    
    const message = {
      userId: req.userId,
      username: user.username,
      content,
      createdAt: new Date()
    };
    
    room.messages.push(message);
    room.lastActivity = new Date();
    await room.save();
    
    res.status(201).json(message);
  } catch (err) {
    console.error('Add message error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;