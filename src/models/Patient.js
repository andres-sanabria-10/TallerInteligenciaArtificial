// src/models/Patient.js
const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true,
    unique: true, // Ya estaba como único 👍
    trim: true
  },
  email: {
    type: String,
    required: false,
    trim: true,
    lowercase: true
  },
  dni: {
    type: String,
    required: true, // Cambiado a true si es obligatorio
    unique: true,   // ← Nuevo: Hacemos que el DNI sea único
    trim: true
  },
  birthDate: {
    type: Date,
    required: false // Puedes cambiar a true si siempre se necesita
  },
  dniExpeditionDate: {
    type: Date,
    required: false // Puedes cambiar a true si siempre se necesita
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Patient', patientSchema);