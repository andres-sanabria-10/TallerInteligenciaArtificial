const Patient = require('../models/Patient');
const axios = require('axios');
const { sendMessage } = require('../services/whatsappService');

// Datos temporales (en memoria) mientras se registra
const tempRegistration = {};

function startRegistration(phoneNumber) {
  tempRegistration[phoneNumber] = {};
  return '📝 Por favor, dime tu nombre completo:';
}

function askEmail(phoneNumber) {
  tempRegistration[phoneNumber].step = 'email';
  return '📧 Ahora dime tu correo electrónico (opcional):';
}

function askBirthDate(phoneNumber) {
  tempRegistration[phoneNumber].step = 'birthDate';
  return '🎂 ¿Cuál es tu fecha de nacimiento? Formato: DD/MM/YYYY';
}

function askExpeditionDate(phoneNumber) {
  tempRegistration[phoneNumber].step = 'expeditionDate';
  return '📅 ¿Cuál es la fecha de expedición de tu documento? Formato: DD/MM/YYYY';
}

async function saveRegistration(phoneNumber, data) {
  const newPatient = new Patient({
    name: data.name,
    phone: phoneNumber,
    email: data.email || null,
    dni: data.dni,
    birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
    dniExpeditionDate: data.expeditionDate ? new Date(data.expeditionDate) : undefined
  });

  try {
    await newPatient.save();
    delete tempRegistration[phoneNumber];
    return '✅ Registro completado. ¡Bienvenido!';
  } catch (error) {
    console.error('❌ Error guardando paciente:', error.message);
    return '⚠️ Hubo un problema al registrarte. Intenta más tarde.';
  }
}

function getTempData(phoneNumber) {
  return tempRegistration[phoneNumber] || null;
}

function setTempData(phoneNumber, key, value) {
  if (!tempRegistration[phoneNumber]) {
    tempRegistration[phoneNumber] = {};
  }
  tempRegistration[phoneNumber][key] = value;
}

module.exports = {
  startRegistration,
  askEmail,
  askBirthDate,
  askExpeditionDate,
  saveRegistration,
  getTempData,
  setTempData
};