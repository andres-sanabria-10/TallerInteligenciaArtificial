// src/models/Service.js
const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  durationMinutes: {
    type: Number,
    required: true
  },
  price: {
    type: Number,
    required: false
  },
  description: {
    type: String,
    default: ''
  }
});

module.exports = mongoose.model('Service', serviceSchema);
