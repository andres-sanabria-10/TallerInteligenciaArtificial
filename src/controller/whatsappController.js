const { checkIfRegistered } = require('../utils/validationFlow');
const {
  startRegistration,
  askDni,
  askEmail,
  askBirthDate,
  askExpeditionDate,
  saveRegistration,
  getTempData,
  setTempData,
  clearTempData,
  parseDate,
  isValidEmail,
  handleRegistrationSteps
} = require('../utils/registrationFlow');
const { 
  formatResponseForCli, 
  showMainMenuWelcome, 
  showMainMenu,
  handleAuthenticationFlow,
  handleMainMenuFlow
} = require('../utils/menuFlows');
const { sendMessage } = require('../services/whatsappService');

// Modelo de paciente
const Patient = require('../models/Patient');

// Estado actual del contacto
const conversationState = {}; // { "573155923440@c.us": "dni_requested", ... }

// Datos temporales mientras se registra
const tempRegistration = {};

// Cache de mensajes procesados (evitar duplicados)
const processedMessages = new Set();

// Reinicio automático tras inactividad
const conversationTimers = {};

function resetStateAfterTimeout(contact) {
  if (conversationTimers[contact]) clearTimeout(conversationTimers[contact]);

  conversationTimers[contact] = setTimeout(() => {
    console.log(`⏳ Conversación con ${contact} reiniciada por inactividad`);
    conversationState[contact] = 'initial';
    delete tempRegistration[contact];
    delete conversationTimers[contact];
  }, 5 * 60 * 1000); // 5 minutos sin actividad → reinicia conversación
}

async function processIncomingMessage(messageData) {
  const { from, body } = messageData;

  // Si ya se procesó este mensaje, ignora
  const msgKey = `${from}-${body.trim()}`;
  if (processedMessages.has(msgKey)) {
    console.log(`🔁 Mensaje duplicado detectado. Saltando...`);
    return;
  }
  processedMessages.add(msgKey);
  resetStateAfterTimeout(from);

  console.log('📩 MENSAJE RECIBIDO:');
  console.log('- De:', from);
  console.log('- Contenido:', body);
  console.log('- Tipo:', messageData.type);

  try {
    const normalized = body.toLowerCase().trim();

    // Reinicio manual del chatbot
    if (['hola', 'hi', 'menu', 'inicio', 'salir'].includes(normalized)) {
      console.log(`🔄 Usuario escribió "${normalized}" → Reiniciando conversación con ${from}`);
      conversationState[from] = 'initial';
      delete tempRegistration[from];

      const welcomeMessage = showMainMenuWelcome(from);
      await sendMessage(from, formatResponseForCli(welcomeMessage));
      return;
    }

    // Filtra mensajes del bot hacia sí mismo
    const hostNumber = '573104773839@c.us';
    if (from === hostNumber) {
      console.log('🚫 Bot respondiendo a sí mismo. Ignorando mensaje:', body);
      return;
    }

    // Si no hay estado definido, reinicia
    let currentState = conversationState[from];
    if (!currentState) {
      conversationState[from] = 'initial';
      currentState = 'initial';

      const welcomeMessage = showMainMenuWelcome(from);
      await sendMessage(from, formatResponseForCli(welcomeMessage));
      return;
    }

    // Validación inicial
    if (currentState === 'initial') {
      const result = await handleAuthenticationFlow(normalized, from);
      if (result.newState) conversationState[from] = result.newState;
      await sendMessage(from, result.message);
      return;
    }

    // Flujo de autenticación (DNI y fecha)
    if (['dni_requested', 'dni_expiration_date', 'not_registered', 'check_dni_unknown'].includes(currentState)) {
      const result = await handleAuthenticationFlow(normalized, from, currentState);
      if (result.newState) conversationState[from] = result.newState;
      await sendMessage(from, formatResponseForCli(result.message));
      return;
    }

    // Flujo de registro
    if (currentState.startsWith('register_')) {
      const result = await handleRegistrationSteps(currentState, body, from);
      if (result.newState) conversationState[from] = result.newState;
      await sendMessage(from, result.message);
      return;
    }

    // Menú principal
    if (currentState === 'main_menu') {
      const result = await handleMainMenuFlow(normalized, from);
      if (result.newState) conversationState[from] = result.newState;
      await sendMessage(from, formatResponseForCli(result.message));
      return;
    }

    // Estado desconocido
    console.warn(`⚠️ Estado desconocido: ${currentState}`);
    conversationState[from] = 'initial';
    await sendMessage(from, '🔄 Tu sesión ha sido reiniciada. Vuelve a escribir "menu".');
    return;

  } catch (error) {
    console.error('❌ Error procesando mensaje:', error.message);

    try {
      await sendMessage(from, '❌ Lo siento, hubo un error. Escribe "menu" para volver al inicio.');
    } catch (sendError) {
      console.error('❌ Error enviando mensaje de error:', sendError.message);
    }

    conversationState[from] = 'initial';
    delete tempRegistration[from];
  }
}

module.exports = { processIncomingMessage };