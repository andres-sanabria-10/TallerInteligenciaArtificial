const { checkIfRegistered } = require('./validationFlow');
const { getTempData, setTempData, parseDate } = require('./registrationFlow');
const Patient = require('../models/Patient');

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

// Funciones auxiliares para comparar fechas completas (solo día)
function startOfDay(date) {
  const d = new Date(date);
  // Usar UTC para evitar problemas de zona horaria
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function endOfDay(date) {
  const d = new Date(date);
  // Usar UTC para evitar problemas de zona horaria
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

// 🔐 Manejo del flujo de autenticación
async function handleAuthenticationFlow(normalized, from, currentState = 'initial') {
  
  // Validación inicial del menú de bienvenida
  if (currentState === 'initial') {
    if (['1', 'si'].includes(normalized)) {
      return {
        message: '🔢 ¿Cuál es tu número de documento?',
        newState: 'dni_requested'
      };
    } else if (['2', 'no'].includes(normalized)) {
      return {
        message: '📝 Por favor, dime tu nombre completo:',
        newState: 'register_name'
      };
    } else if (['3', 'no lo se'].includes(normalized)) {
      return {
        message: '🔢 ¿Cuál es tu número de documento? Lo verificaré para ti.',
        newState: 'check_dni_unknown'
      };
    } else {
      return {
        message: '⚠️ Opción no reconocida. Elige 1, 2 o 3.',
        newState: null
      };
    }
  }

  // Si dijo "Si" o "1" - validar DNI (ya sabe que está registrado)
  if (currentState === 'dni_requested') {
    const dni = normalized;
    const { registered, patient } = await checkIfRegistered(dni);

    if (!registered) {
      return {
        message: '❌ No estás registrado. ¿Quieres registrarte ahora?\n1. Sí\n2. No',
        newState: 'not_registered'
      };
    }

    setTempData(from, 'dni', dni);
    return {
      message: '📅 ¿Cuál es la fecha de expedición de tu documento?\nFormato: DD/MM/YYYY',
      newState: 'dni_expiration_date'
    };
  }

  // Si dijo "No lo sé" - verificar si está registrado
  if (currentState === 'check_dni_unknown') {
    const dni = normalized;
    const { registered, patient } = await checkIfRegistered(dni);

    if (!registered) {
      return {
        message: '❌ No estás registrado en nuestro sistema. ¿Quieres registrarte ahora?\n1. Sí\n2. No',
        newState: 'not_registered'
      };
    }

    // ✅ SÍ está registrado - mostrar mensaje confirmando y pedir fecha de expedición
    setTempData(from, 'dni', dni);
    return {
      message: '✅ ¡Perfecto! Estás registrado en nuestro sistema.\n\nAhora ingresa la fecha de expedición de tu documento para iniciar sesión:\nFormato: DD/MM/YYYY',
      newState: 'dni_expiration_date'
    };
  }

  // Fecha de expedición
  if (currentState === 'dni_expiration_date') {
    const expeditionDate = parseDate(normalized);
    if (!expeditionDate) {
      return {
        message: '⚠️ Fecha inválida. Usa el formato DD/MM/YYYY (ejemplo: 10/10/2005)',
        newState: null
      };
    }

    const tempData = getTempData(from);
    if (!tempData || !tempData.dni) {
      console.log("❌ No hay datos temporales o DNI:", tempData);
      return {
        message: '❌ Error interno. Escribe "menu" para reiniciar.',
        newState: 'initial'
      };
    }

    const { dni } = tempData;

    console.log("🔍 Buscando paciente con:");
    console.log("📅 DNI:", dni);
    console.log("📅 Fecha input del usuario:", normalized);
    console.log("📅 Fecha parseada:", expeditionDate);
    console.log("📅 Rango inicio:", startOfDay(expeditionDate));
    console.log("📅 Rango fin:", endOfDay(expeditionDate));

    // Primero buscar paciente solo por DNI para ver qué tenemos
    const patientByDni = await Patient.findOne({ dni });
    console.log("🔎 Paciente por DNI:", patientByDni ? patientByDni.name : 'No encontrado');
    if (patientByDni) {
      console.log("📅 Fecha en BD:", patientByDni.dniExpeditionDate);
      console.log("📅 Tipo de fecha en BD:", typeof patientByDni.dniExpeditionDate);
    }

    // CORRECCIÓN: Usar el nombre correcto del campo en la BD
    const patient = await Patient.findOne({
      dni,
      dniExpeditionDate: { // Era 'expeditionDate', debe ser 'dniExpeditionDate'
        $gte: startOfDay(expeditionDate),
        $lt: endOfDay(expeditionDate)
      }
    });

    if (!patient) {
      console.log("❌ No se encontró paciente con fecha exacta");
      return {
        message: '❌ La fecha de expedición no coincide. Inténtalo nuevamente.',
        newState: null
      };
    }

    console.log("✅ Paciente encontrado:", patient.name);
    setTempData(from, 'patient', patient);
    return {
      message: showMainMenu(),
      newState: 'main_menu'
    };
  }

  // Estado not_registered
  if (currentState === 'not_registered') {
    if (['1', 'si'].includes(normalized)) {
      return {
        message: '📝 Por favor, dime tu nombre completo:',
        newState: 'register_name'
      };
    } else if (['2', 'no'].includes(normalized)) {
      return {
        message: showMainMenuWelcome(from),
        newState: 'initial'
      };
    } else {
      return {
        message: '⚠️ Opción inválida. Escribe 1 para registrarte o 2 para volver atrás.',
        newState: null
      };
    }
  }

  return {
    message: '⚠️ Estado no reconocido en autenticación.',
    newState: 'initial'
  };
}

// 🎯 Manejo del menú principal
async function handleMainMenuFlow(normalized, from) {
  switch (normalized) {
    case '1':
      return {
        message: '📅 Escribe la fecha y hora para tu cita.',
        newState: null
      };
    case '2':
      const data = getTempData(from)?.patient;
      if (data) {
        return {
          message: `📄 Tus datos:\nNombre: ${data.name}\nDocumento: ${data.dni}`,
          newState: null
        };
      }
      break;
    case '3':
      return {
        message: '📋 Aún no tienes historial de citas.',
        newState: null
      };
    case '4':
      return {
        message: showMainMenuWelcome(from),
        newState: 'initial'
      };
    default:
      return {
        message: '⚠️ Opción no válida. Elige 1, 2, 3 o 4.',
        newState: null
      };
  }
}

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

module.exports = {
  showMainMenu,
  showMainMenuWelcome,
  handleAuthenticationFlow,
  handleMainMenuFlow,
  formatResponseForCli
};