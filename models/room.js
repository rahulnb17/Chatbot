const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const roomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  messages: [messageSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
});

// Method to check if a user is a participant in the room
roomSchema.methods.isParticipant = function(userId) {
  return this.participants.some(participantId => participantId.equals(userId));
};

// Method to add a message to the room
roomSchema.methods.addMessage = function(userId, username, content) {
  this.messages.push({ userId, username, content });
  this.lastActivity = Date.now();
  return this.save();
};

module.exports = mongoose.models.Room || mongoose.model("Room", roomSchema);
