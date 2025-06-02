// src/models/Availability.js
const mongoose = require('mongoose');

const availabilitySchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true
  },
  date: {
    type: Date, // Día específico
    required: true
  },
  timeSlots: [
    {
      time: {
        type: String, // Ej: "08:00"
        required: true
      },
      available: {
        type: Boolean,
        default: true
      }
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Availability', availabilitySchema);
