const { checkIfRegistered } = require('./validationFlow');
const { getTempData, setTempData, parseDate } = require('./registrationFlow');
const { handleAppointmentFlow } = require('./appointmentFlows');
const { handleCancelationFlow } = require('./cancelationFlow'); // ✅ AGREGADO
const Patient = require('../models/Patient');

function showMainMenu() {
  return {
    type: 'interactive',
    body: '🦷 Menú Principal\n¿Qué deseas hacer?',
    buttons: [
      { id: '1', title: '📅 Agendar Cita' },
      { id: '2', title: '🚫 Cancelar Cita' }, // ✅ CAMBIADO: Reemplaza "Consultar Datos"
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

// 🔐 Manejo del flujo de autenticación - VERSION CORREGIDA
async function handleAuthenticationFlow(normalized, from, currentState = 'initial') {
  
  // Validación inicial del menú de bienvenida
  if (currentState === 'initial') {
    if (['1', 'si'].includes(normalized)) {
      return {
        message: '🔢 Por favor, ingresa tu número de documento:',
        newState: 'dni_requested'
      };
    } else if (['2', 'no'].includes(normalized)) {
      return {
        message: '📝 Por favor, dime tu nombre completo:',
        newState: 'register_name'
      };
    } else if (['3', 'no lo se'].includes(normalized)) {
      return {
        message: '🔢 Por favor, ingresa tu número de documento para verificar si estás registrado:',
        newState: 'check_dni_unknown'
      };
    } else {
      return {
        message: '⚠️ Opción no válida. Por favor responde:\n1 - Sí estoy registrado\n2 - No estoy registrado\n3 - No lo sé',
        newState: null
      };
    }
  }

  // ✅ CORREGIDO: Si dijo "Si" (1) - validar DNI con mejor validación
  if (currentState === 'dni_requested') {
    const dni = normalized.trim();
    
    console.log('🔍 DEBUG - dni_requested state');
    console.log('📝 DNI recibido:', dni);
    console.log('🔢 Es numérico:', /^\d+$/.test(dni));
    console.log('📏 Longitud:', dni.length);
    
    // ✅ VALIDAR FORMATO DEL DNI ANTES DE BUSCAR EN BD
    if (!/^\d{6,15}$/.test(dni)) {
      return {
        message: '⚠️ Por favor ingresa un número de documento válido:\n• Solo números\n• Entre 6 y 15 dígitos\n\nEjemplo: 12345678',
        newState: null // Mantiene el mismo estado para que vuelva a intentar
      };
    }

    console.log('🔎 Buscando en base de datos...');
    const { registered, patient } = await checkIfRegistered(dni);
    console.log('📊 Resultado búsqueda:', { registered, paciente: patient ? patient.name : 'No encontrado' });

    if (!registered) {
      return {
        message: '❌ No encontré tu documento en nuestro sistema.\n\n¿Quieres registrarte ahora?\n1. ✅ Sí, registrarme\n2. ❌ No, revisar documento',
        newState: 'not_registered'
      };
    }

    // ✅ SI está registrado, continuar con fecha de expedición
    setTempData(from, 'dni', dni);
    setTempData(from, 'foundPatient', patient); // Guardar referencia del paciente encontrado
    
    return {
      message: `✅ ¡Perfecto! Encontré tu registro.\n\n👤 Nombre: ${patient.name}\n\n🔐 Para confirmar tu identidad, ingresa la fecha de expedición de tu documento:\n\nFormato: DD/MM/YYYY\nEjemplo: 15/03/2010`,
      newState: 'dni_expiration_date'
    };
  }

  // ✅ CORREGIDO: Si dijo "No lo sé" (3) - verificar si está registrado
  if (currentState === 'check_dni_unknown') {
    const dni = normalized.trim();
    
    console.log('🔍 DEBUG - check_dni_unknown state');
    console.log('📝 DNI recibido:', dni);
    
    // ✅ VALIDAR FORMATO DEL DNI
    if (!/^\d{6,15}$/.test(dni)) {
      return {
        message: '⚠️ Por favor ingresa un número de documento válido:\n• Solo números\n• Entre 6 y 15 dígitos\n\nEjemplo: 12345678',
        newState: null
      };
    }

    console.log('🔎 Verificando si existe en base de datos...');
    const { registered, patient } = await checkIfRegistered(dni);
    console.log('📊 Resultado:', { registered, paciente: patient ? patient.name : 'No encontrado' });

    if (!registered) {
      return {
        message: '❌ Tu documento no está registrado en nuestro sistema.\n\n¿Quieres registrarte ahora?\n1. ✅ Sí, registrarme\n2. ❌ No, revisar documento',
        newState: 'not_registered'
      };
    }

    // ✅ SÍ está registrado - continuar con autenticación
    setTempData(from, 'dni', dni);
    setTempData(from, 'foundPatient', patient);
    
    return {
      message: `✅ ¡Genial! Estás registrado en nuestro sistema.\n\n👤 Nombre: ${patient.name}\n\n🔐 Para confirmar tu identidad, ingresa la fecha de expedición de tu documento:\n\nFormato: DD/MM/YYYY\nEjemplo: 15/03/2010`,
      newState: 'dni_expiration_date'
    };
  }

  // ✅ MEJORADO: Validación de fecha de expedición
  if (currentState === 'dni_expiration_date') {
    const expeditionDateInput = normalized.trim();
    
    console.log('🔍 DEBUG - dni_expiration_date state');
    console.log('📅 Fecha recibida:', expeditionDateInput);
    
    const expeditionDate = parseDate(expeditionDateInput);
    if (!expeditionDate) {
      return {
        message: '⚠️ Fecha inválida. Por favor usa el formato correcto:\n\n📅 DD/MM/YYYY\n\nEjemplos válidos:\n• 15/03/2010\n• 01/12/2005\n• 25/07/2015',
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

    const { dni, foundPatient } = tempData;

    console.log("🔍 Validando fecha de expedición:");
    console.log("📅 DNI:", dni);
    console.log("📅 Fecha input:", expeditionDateInput);
    console.log("📅 Fecha parseada:", expeditionDate);
    console.log("📅 Paciente encontrado:", foundPatient ? foundPatient.name : 'No encontrado');

    // ✅ MEJORADO: Verificar fecha de expedición con el paciente ya encontrado
    if (!foundPatient || !foundPatient.dniExpeditionDate) {
      console.log("❌ No se encontró fecha de expedición en BD");
      return {
        message: '❌ No tenemos registrada tu fecha de expedición. Por favor contacta con el consultorio para actualizar tus datos.',
        newState: 'initial'
      };
    }

    // Comparar fechas (solo día, mes y año)
    const dbExpeditionDate = new Date(foundPatient.dniExpeditionDate);
    const inputDay = expeditionDate.getUTCDate();
    const inputMonth = expeditionDate.getUTCMonth();
    const inputYear = expeditionDate.getUTCFullYear();
    
    const dbDay = dbExpeditionDate.getUTCDate();
    const dbMonth = dbExpeditionDate.getUTCMonth();
    const dbYear = dbExpeditionDate.getUTCFullYear();

    console.log("🔍 Comparando fechas:");
    console.log("📅 Input: ", inputDay, "/", inputMonth + 1, "/", inputYear);
    console.log("📅 BD: ", dbDay, "/", dbMonth + 1, "/", dbYear);

    if (inputDay !== dbDay || inputMonth !== dbMonth || inputYear !== dbYear) {
      console.log("❌ Fechas no coinciden");
      return {
        message: '❌ La fecha de expedición no coincide con nuestros registros.\n\n🔄 Intenta nuevamente o contacta al consultorio si tienes dudas.',
        newState: null
      };
    }

    console.log("✅ Autenticación exitosa para:", foundPatient.name);
    setTempData(from, 'patient', foundPatient);
    
    // ✅ CORREGIDO: Solo mensaje de bienvenida, sin mostrar menú aquí
    return {
      message: `🎉 ¡Bienvenido, ${foundPatient.name}!\n\n✅ Has iniciado sesión correctamente.`,
      newState: 'main_menu'
    };
  }

  // ✅ MEJORADO: Estado not_registered
  if (currentState === 'not_registered') {
    if (['1', 'si', 'sí'].includes(normalized)) {
      return {
        message: '📝 ¡Perfecto! Vamos a registrarte.\n\nPor favor, dime tu nombre completo:',
        newState: 'register_name'
      };
    } else if (['2', 'no'].includes(normalized)) {
      return {
        message: '🔄 De acuerdo. Verifica tu número de documento y vuelve a intentar.\n\n' + formatResponseForCli(showMainMenuWelcome(from)),
        newState: 'initial'
      };
    } else {
      return {
        message: '⚠️ Por favor responde:\n1 - Sí, registrarme\n2 - No, revisar documento',
        newState: null
      };
    }
  }

  return {
    message: '⚠️ Estado no reconocido en autenticación.',
    newState: 'initial'
  };
}

// 🎯 Manejo del menú principal - ACTUALIZADO CON CANCELACIÓN
async function handleMainMenuFlow(normalized, from) {
  switch (normalized) {
    case '1':
      // Iniciar flujo de agendamiento de citas
      const tempData = getTempData(from);
      if (!tempData || !tempData.patient) {
        return {
          message: '❌ Error: No se encontraron tus datos de sesión. Por favor vuelve a iniciar sesión.\n\nEscribe "menu" para reiniciar.',
          newState: 'initial'
        };
      }
      
      // Iniciar flujo de citas
      return await handleAppointmentFlow('appointment_service', '', from);
      
    case '2':
      // ✅ NUEVO: Iniciar flujo de cancelación de citas
      const userData = getTempData(from);
      if (!userData || !userData.patient) {
        return {
          message: '❌ Error: No se encontraron tus datos de sesión. Por favor vuelve a iniciar sesión.\n\nEscribe "menu" para reiniciar.',
          newState: 'initial'
        };
      }
      
      console.log('🚫 Iniciando flujo de cancelación para:', userData.patient.name);
      return await handleCancelationFlow('cancelation_list', '', from);
      
    case '3':
      return {
        message: `📋 Función de historial en desarrollo. 
        
Pronto podrás ver:
• Todas tus citas pasadas
• Citas pendientes
• Historial de tratamientos

${formatResponseForCli(showMainMenu())}`,
        newState: null // ✅ CORREGIDO: Mantener en main_menu
      };
      
    case '4':
      // Limpiar datos de sesión
      const tempDataToClean = getTempData(from);
      if (tempDataToClean) {
        delete tempDataToClean.patient;
        delete tempDataToClean.foundPatient;
        delete tempDataToClean.dni;
      }
      
      return {
        message: '👋 Sesión cerrada correctamente.\n\n' + formatResponseForCli(showMainMenuWelcome(from)),
        newState: 'initial'
      };
      
    default:
      return {
        message: '⚠️ Opción no válida. Por favor elige:\n1 - Agendar Cita\n2 - Cancelar Cita\n3 - Historial\n4 - Salir',
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