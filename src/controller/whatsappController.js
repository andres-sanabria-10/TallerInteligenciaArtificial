const { checkIfRegistered } = require('../utils/validationFlow');
const {
  startRegistration,
  askEmail,
  askBirthDate,
  askExpeditionDate,
  saveRegistration,
  getTempData,
  setTempData
} = require('../utils/registrationFlow');

const { showMainMenuWelcome, showMainMenu, formatResponseForCli } = require('../utils/menuFlows');
const { sendMessage } = require('../services/whatsappService');

// Modelo de paciente
const Patient = require('../models/Patient');

// Estado actual del contacto
const conversationState = {}; // Ej: { "573155923440@c.us": "dni_requested" }

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
      if (['1', 'si'].includes(normalized)) {
        conversationState[from] = 'dni_requested';
        await sendMessage(from, '🔢 ¿Cuál es tu número de documento?');
      } else if (['2', 'no'].includes(normalized)) {
        conversationState[from] = 'register_name';
        await sendMessage(from, startRegistration(from));
      } else if (['3', 'no lo se'].includes(normalized)) {
        conversationState[from] = 'check_dni_unknown';
        await sendMessage(from, '🔢 ¿Cuál es tu número de documento?');
      } else {
        await sendMessage(from, '⚠️ Opción no reconocida. Elige 1, 2 o 3.');
      }
      return;
    }

    // Si dijo "Si" o "1"
    if (currentState === 'dni_requested') {
      const dni = normalized;
      const { registered, patient } = await checkIfRegistered(dni);

      if (!registered) {
        conversationState[from] = 'not_registered';
        await sendMessage(from, '❌ No estás registrado. ¿Quieres registrarte ahora?\n1. Sí\n2. No');
        return;
      }

      setTempData(from, 'dni', dni);
      conversationState[from] = 'dni_expiration_date';
      await sendMessage(from, '📅 ¿Cuál es la fecha de expedición de tu documento?\nFormato: DD/MM/YYYY');
      return;
    }

    // Fecha de expedición
    if (currentState === 'dni_expiration_date') {
      const expeditionDate = parseDate(normalized);
      if (!expeditionDate) {
        await sendMessage(from, '⚠️ Fecha inválida. Usa el formato DD/MM/YYYY');
        return;
      }

      const tempData = getTempData(from);
      const { dni } = tempData;

      const patient = await Patient.findOne({ dni, dniExpeditionDate: { $eq: expeditionDate } });

      if (!patient) {
        await sendMessage(from, '❌ La fecha de expedición no coincide. Inténtalo nuevamente.');
        return;
      }

      setTempData(from, 'patient', patient);
      conversationState[from] = 'main_menu';
      await sendMessage(from, formatResponseForCli(showMainMenu()));
      return;
    }

    // Estado not_registered
    if (currentState === 'not_registered') {
      if (['1', 'si'].includes(normalized)) {
        conversationState[from] = 'register_name';
        await sendMessage(from, startRegistration(from));
        return;
      } else if (['2', 'no'].includes(normalized)) {
        conversationState[from] = 'initial';
        await sendMessage(from, formatResponseForCli(showMainMenuWelcome(from)));
        return;
      } else {
        await sendMessage(from, '⚠️ Opción inválida. Escribe 1 para registrarte o 2 para volver atrás.');
        return;
      }
    }

    // Registro - nombre
    if (currentState === 'register_name') {
      setTempData(from, 'name', body);
      conversationState[from] = 'register_email';
      await sendMessage(from, askEmail(from));
      return;
    }

    // Registro - correo
    if (currentState === 'register_email') {
      setTempData(from, 'email', body);
      conversationState[from] = 'register_birth_date';
      await sendMessage(from, askBirthDate(from));
      return;
    }

    // Registro - fecha de nacimiento
    if (currentState === 'register_birth_date') {
      const birthDate = parseDate(normalized);
      if (!birthDate) {
        await sendMessage(from, '⚠️ Fecha inválida. Usa el formato DD/MM/YYYY');
        return;
      }

      setTempData(from, 'birthDate', birthDate);
      conversationState[from] = 'register_expedition_date';
      await sendMessage(from, askExpeditionDate(from));
      return;
    }

    // Registro - fecha de expedición
    if (currentState === 'register_expedition_date') {
      const expeditionDate = parseDate(normalized);
      if (!expeditionDate) {
        await sendMessage(from, '⚠️ Fecha inválida. Usa el formato DD/MM/YYYY');
        return;
      }

      const tempData = getTempData(from);
      const fullData = {
        name: tempData.name,
        dni: tempData.dni,
        email: tempData.email || null,
        birthDate: tempData.birthDate ? new Date(tempData.birthDate) : undefined,
        expeditionDate: new Date(expeditionitionDate)
      };

      const result = await saveRegistration(from, fullData);
      conversationState[from] = 'main_menu';
      await sendMessage(from, result + '\n\n' + formatResponseForCli(showMainMenu()));
      return;
    }

    // Menú principal
    if (currentState === 'main_menu') {
      switch (normalized) {
        case '1':
          await sendMessage(from, '📅 Escribe la fecha y hora para tu cita.');
          break;
        case '2':
          const data = getTempData(from)?.patient;
          if (data) {
            await sendMessage(from, `📄 Tus datos:\nNombre: ${data.name}\nDocumento: ${data.dni}`);
          }
          break;
        case '3':
          await sendMessage(from, '📋 Aún no tienes historial de citas.');
          break;
        case '4':
          conversationState[from] = 'initial';
          await sendMessage(from, formatResponseForCli(showMainMenuWelcome(from)));
          break;
        default:
          await sendMessage(from, '⚠️ Opción no válida. Elige 1, 2, 3 o 4.');
      }
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

// 🎨 Menú inicial con botones simulados
function showMainMenuWelcome(contact) {
  return {
    type: 'interactive',
    body: '👋 Bienvenido a nuestro consultorio odontológico.\n\n¿Estás registrado?',
    buttons: [
      { id: '1', title: '✅ Sí' },
      { id: '2', title: '❌ No' },
      { id: '3', title: '❓ No lo sé' }
    ]
  };
}

// 🎨 Menú principal con botones simulados
function showMainMenu() {
  return {
    type: 'interactive',
    body: '🦷 Menú Principal\n¿Qué deseas hacer?',
    buttons: [
      { id: '1', title: '📅 Agendar Cita' },
      { id: '2', title: '🔍 Consultar Datos' },
      { id: '3', title: '📋 Historial de Citas' },
      { id: '4', title: '🚪 Volver al inicio' }
    ]
  };
}

// 🧮 Función para convertir botones a texto plano
function formatResponseForCli(response) {
  if (typeof response === 'string') return response;

  let text = response.body + '\n\n';

  if (response.buttons && Array.isArray(response.buttons)) {
    text += '👆 Opciones disponibles:\n';
    response.buttons.forEach((button, index) => {
      text += `${index + 1}. ${button.title}\n`;
    });
    text += '\n💬 Responde con el número de tu opción.';
  }

  return text;
}

// 📅 Parsea fechas en formato DD/MM/YYYY
function parseDate(input) {
  const parts = input.split('/');
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0]);
  const month = parseInt(parts[1]) - 1; // Meses empiezan en 0
  const year = parseInt(parts[2]);

  const date = new Date(year, month, day);
  return isNaN(date.getTime()) ? null : date.toISOString();
}

module.exports = { processIncomingMessage };