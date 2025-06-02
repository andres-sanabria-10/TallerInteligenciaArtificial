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
const { handleAppointmentFlow } = require('../utils/appointmentFlows');
const { handleCancelationFlow } = require('../utils/cancelationFlow'); // ✅ AGREGADO
const { sendMessage } = require('../services/whatsappService');

// Modelo de paciente
const Patient = require('../models/Patient');

// Estado actual del contacto
const conversationState = {}; // { "573155923440@c.us": "dni_requested", ... }

// Datos temporales mientras se registra
const tempRegistration = {};

// Cache de mensajes procesados (evitar duplicados) - MEJORADO
const processedMessages = new Map(); // Cambiar a Map para mejor control

// Reinicio automático tras inactividad
const conversationTimers = {};

function resetStateAfterTimeout(contact) {
  if (conversationTimers[contact]) clearTimeout(conversationTimers[contact]);

  conversationTimers[contact] = setTimeout(() => {
    console.log(`⏳ Conversación con ${contact} reiniciada por inactividad`);
    conversationState[contact] = 'initial';
    delete tempRegistration[contact];
    delete conversationTimers[contact];
  }, 10 * 60 * 1000); // ✅ CAMBIADO: 10 minutos (las citas pueden tomar tiempo)
}

async function processIncomingMessage(messageData) {
  const { from, body } = messageData;

  // ✅ MEJORADO: Sistema de detección de duplicados más robusto
  const msgKey = `${from}-${body.trim()}`;
  const now = Date.now();
  
  // Si el mismo mensaje se envió hace menos de 5 segundos, es duplicado
  if (processedMessages.has(msgKey)) {
    const lastTime = processedMessages.get(msgKey);
    if (now - lastTime < 5000) { // 5 segundos
      console.log(`🔁 Mensaje duplicado detectado de ${from}: "${body.trim()}". Saltando...`);
      return;
    }
  }
  
  // Actualizar timestamp del mensaje
  processedMessages.set(msgKey, now);
  
  // Limpiar mensajes antiguos cada minuto para evitar memory leaks
  if (processedMessages.size > 100) {
    const cutoff = now - 60000; // 1 minuto
    for (const [key, timestamp] of processedMessages.entries()) {
      if (timestamp < cutoff) {
        processedMessages.delete(key);
      }
    }
  }

  resetStateAfterTimeout(from);

  console.log('📩 MENSAJE RECIBIDO:');
  console.log('- De:', from);
  console.log('- Contenido:', body);
  console.log('- Estado actual:', conversationState[from] || 'undefined');

  try {
    const normalized = body.toLowerCase().trim();

    // Reinicio manual del chatbot
    if (['hola', 'hi', 'menu', 'inicio', 'salir'].includes(normalized)) {
      console.log(`🔄 Usuario escribió "${normalized}" → Reiniciando conversación con ${from}`);
      conversationState[from] = 'initial';
      clearTempData(from);

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

    console.log(`🔄 Procesando estado: ${currentState}`);

    // Validación inicial
    if (currentState === 'initial') {
      const result = await handleAuthenticationFlow(normalized, from);
      if (result.newState) conversationState[from] = result.newState;
      await sendMessage(from, formatResponseForCli(result.message));
      return;
    }

    // Flujo de autenticación (DNI y fecha)
    if (['dni_requested', 'dni_expiration_date', 'not_registered', 'check_dni_unknown'].includes(currentState)) {
      const result = await handleAuthenticationFlow(normalized, from, currentState);
      if (result.newState) conversationState[from] = result.newState;
      await sendMessage(from, formatResponseForCli(result.message));
      
      // ✅ AGREGADO: Si se autentica exitosamente, mostrar menú principal
      if (result.newState === 'main_menu') {
        const menuMessage = showMainMenu();
        await sendMessage(from, formatResponseForCli(menuMessage));
      }
      return;
    }

    // Flujo de registro
    if (currentState.startsWith('register_')) {
      const result = await handleRegistrationSteps(currentState, body, from);
      if (result.newState) conversationState[from] = result.newState;
      await sendMessage(from, result.message);
      
      // ✅ AGREGADO: Si se registra exitosamente, mostrar menú principal
      if (result.newState === 'main_menu') {
        const menuMessage = showMainMenu();
        await sendMessage(from, formatResponseForCli(menuMessage));
      }
      return;
    }

    // ✅ AGREGADO: Flujo de agendamiento de citas
    if (currentState.startsWith('appointment_')) {
      console.log(`🗓️ Procesando flujo de citas: ${currentState}`);
      const result = await handleAppointmentFlow(currentState, body, from);
      if (result.newState) conversationState[from] = result.newState;
      await sendMessage(from, result.message);
      return;
    }

    // ✅ NUEVO: Flujo de cancelación de citas
    if (currentState.startsWith('cancelation_')) {
      console.log(`🚫 Procesando flujo de cancelación: ${currentState}`);
      const result = await handleCancelationFlow(currentState, body, from);
      if (result.newState) conversationState[from] = result.newState;
      await sendMessage(from, result.message);
      return;
    }

    // ✅ CORREGIDO: Menú principal - Mostrar menú si no hay estado específico
    if (currentState === 'main_menu') {
      const result = await handleMainMenuFlow(normalized, from);
      
      // Si no cambió el estado (es decir, permaneció en main_menu), no mostrar el menú nuevamente
      if (result.newState) {
        conversationState[from] = result.newState;
      }
      
      await sendMessage(from, result.message);
      
      // ✅ AGREGADO: Si no hay newState definido (permanece en main_menu), 
      // y el mensaje no incluye ya el menú, mostrarlo
      if (!result.newState && !result.message.includes('👆 Opciones disponibles:')) {
        const menuMessage = showMainMenu();
        await sendMessage(from, formatResponseForCli(menuMessage));
      }
      
      return;
    }

    // Estado desconocido
    console.warn(`⚠️ Estado desconocido: ${currentState}`);
    conversationState[from] = 'initial';
    clearTempData(from);
    await sendMessage(from, '🔄 Tu sesión ha sido reiniciada. Escribe "menu" para comenzar.');
    return;

  } catch (error) {
    console.error('❌ Error procesando mensaje:', error.message);
    console.error('❌ Stack trace:', error.stack);

    try {
      await sendMessage(from, '❌ Lo siento, hubo un error interno. Escribe "menu" para reiniciar.');
    } catch (sendError) {
      console.error('❌ Error enviando mensaje de error:', sendError.message);
    }

    // Limpiar estado en caso de error
    conversationState[from] = 'initial';
    clearTempData(from);
  }
}

module.exports = { processIncomingMessage };