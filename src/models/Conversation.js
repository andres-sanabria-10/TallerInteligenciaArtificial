const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true
  },
  state: {
    type: String,
    required: true
  },
  tempData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  messages: [
    {
      fromUser: Boolean,
      message: String,
      timestamp: {
        type: Date,
        default: Date.now
      }
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

conversationSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Conversation', conversationSchema);
