const Patient = require('../models/Patient');

// Datos temporales (en memoria) mientras se registra
const tempRegistration = {};

// 🔄 Manejo de los pasos de registro (MANTIENE LA LÓGICA ORIGINAL)
async function handleRegistrationSteps(currentState, body, from) {
  
  // Registro - nombre
  if (currentState === 'register_name') {
    const name = body.trim();
    if (name.length < 2) {
      return {
        message: '⚠️ Por favor ingresa un nombre válido (mínimo 2 caracteres).',
        newState: null
      };
    }
    
    setTempData(from, 'name', name);
    return {
      message: askDni(from),
      newState: 'register_dni'
    };
  }

  // Registro - DNI
  if (currentState === 'register_dni') {
    const dni = body.trim();
    if (!/^\d{6,15}$/.test(dni)) {
      return {
        message: '⚠️ Por favor ingresa un número de documento válido (solo números, entre 6 y 15 dígitos).',
        newState: null
      };
    }

    // Verificar si el DNI ya existe
    const existingPatient = await Patient.findOne({ dni });
    if (existingPatient) {
      clearTempData(from);
      return {
        message: '⚠️ Ya existe un paciente registrado con ese número de documento. ¿Quizás ya estás registrado? Escribe "menu" para verificar.',
        newState: 'initial'
      };
    }

    setTempData(from, 'dni', dni);
    return {
      message: askEmail(from),
      newState: 'register_email'
    };
  }

  // Registro - correo
  if (currentState === 'register_email') {
    const email = body.trim().toLowerCase();
    
    if (email !== 'no' && !isValidEmail(email)) {
      return {
        message: '⚠️ Por favor ingresa un email válido o escribe "no" si no tienes.',
        newState: null
      };
    }

    setTempData(from, 'email', email);
    return {
      message: askBirthDate(from),
      newState: 'register_birth_date'
    };
  }

  // Registro - fecha de nacimiento
  if (currentState === 'register_birth_date') {
    const birthDate = parseDate(body.toLowerCase().trim());
    if (!birthDate) {
      return {
        message: '⚠️ Fecha inválida. Usa el formato DD/MM/YYYY (ejemplo: 15/05/1990)',
        newState: null
      };
    }

    // Validar que la fecha no sea futura
    if (birthDate > new Date()) {
      return {
        message: '⚠️ La fecha de nacimiento no puede ser futura.',
        newState: null
      };
    }

    setTempData(from, 'birthDate', birthDate);
    return {
      message: askExpeditionDate(from),
      newState: 'register_expedition_date'
    };
  }

  // Registro - fecha de expedición
  if (currentState === 'register_expedition_date') {
    const expeditionDate = parseDate(body.toLowerCase().trim());
    if (!expeditionDate) {
      return {
        message: '⚠️ Fecha inválida. Usa el formato DD/MM/YYYY (ejemplo: 10/10/2005)',
        newState: null
      };
    }

    // Validar que la fecha no sea futura
    if (expeditionDate > new Date()) {
      return {
        message: '⚠️ La fecha de expedición no puede ser futura.',
        newState: null
      };
    }

    const tempData = getTempData(from);
    
    // Validar que la fecha de expedición sea posterior al nacimiento
    if (tempData.birthDate && expeditionDate < tempData.birthDate) {
      return {
        message: '⚠️ La fecha de expedición del documento no puede ser anterior a tu fecha de nacimiento.',
        newState: null
      };
    }

    const fullData = {
      name: tempData.name,
      dni: tempData.dni,
      email: tempData.email,
      birthDate: tempData.birthDate,
      dniExpeditionDate: expeditionDate // Corregido: usar el nombre correcto del campo
    };

    console.log('📋 Datos completos para registro:', fullData);

    const result = await saveRegistration(from, fullData);
    
    // Si el registro fue exitoso, preparar datos temporales para el menú principal
    if (result.includes('exitosamente')) {
      const newPatient = await Patient.findOne({ dni: tempData.dni });
      if (newPatient) {
        setTempData(from, 'patient', newPatient);
      }
      
      const { showMainMenu, formatResponseForCli } = require('./menuFlows');
      return {
        message: result + '\n\n' + formatResponseForCli(showMainMenu()),
        newState: 'main_menu'
      };
    }

    return {
      message: result,
      newState: 'initial'
    };
  }

  return {
    message: '⚠️ Estado de registro no reconocido.',
    newState: 'initial'
  };
}

function startRegistration(phoneNumber) {
  tempRegistration[phoneNumber] = {};
  return '📝 Por favor, dime tu nombre completo:';
}

function askDni(phoneNumber) {
  tempRegistration[phoneNumber].step = 'dni';
  return '🔢 Ahora dime tu número de documento de identidad:';
}

function askEmail(phoneNumber) {
  tempRegistration[phoneNumber].step = 'email';
  return '📧 Dime tu correo electrónico (opcional, puedes escribir "no" si no tienes):';
}

function askBirthDate(phoneNumber) {
  tempRegistration[phoneNumber].step = 'birthDate';
  return '🎂 ¿Cuál es tu fecha de nacimiento? Formato: DD/MM/YYYY';
}

function askExpeditionDate(phoneNumber) {
  tempRegistration[phoneNumber].step = 'expeditionDate';
  return '📅 ¿Cuál es la fecha de expedición de tu documento? Formato: DD/MM/YYYY';
}

// 📅 Parsea fechas en formato DD/MM/YYYY usando UTC
function parseDate(input) {
  const parts = input.split('/');
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0]);
  const month = parseInt(parts[1]) - 1; // Meses empiezan en 0
  const year = parseInt(parts[2]);

  // Crear fecha en UTC para evitar problemas de zona horaria
  const date = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  return isNaN(date.getTime()) ? null : date;
}

async function saveRegistration(phoneNumber, data) {
  try {
    // Validar que tengamos los datos mínimos requeridos
    if (!data.name || !data.dni) {
      return '⚠️ Faltan datos obligatorios (nombre y documento).';
    }

    // Verificar si ya existe un paciente con ese DNI
    const existingPatient = await Patient.findOne({ dni: data.dni });
    if (existingPatient) {
      return '⚠️ Ya existe un paciente registrado con ese número de documento.';
    }

    // Verificar si ya existe un paciente con ese teléfono
    const existingPhone = await Patient.findOne({ phone: phoneNumber });
    if (existingPhone) {
      return '⚠️ Ya existe un paciente registrado con este número de teléfono.';
    }

    const newPatient = new Patient({
      name: data.name.trim(),
      phone: phoneNumber,
      email: data.email && data.email.toLowerCase() !== 'no' ? data.email.trim() : null,
      dni: data.dni.trim(),
      birthDate: data.birthDate || null,
      dniExpeditionDate: data.dniExpeditionDate || null // Corregido: era expeditionDate
    });

    console.log('💾 Guardando paciente:', {
      name: newPatient.name,
      phone: newPatient.phone,
      email: newPatient.email,
      dni: newPatient.dni,
      birthDate: newPatient.birthDate,
      dniExpeditionDate: newPatient.dniExpeditionDate
    });

    await newPatient.save();
    delete tempRegistration[phoneNumber];
    
    return `✅ ¡Registro completado exitosamente!
    
👤 Nombre: ${newPatient.name}
🔢 Documento: ${newPatient.dni}
📧 Email: ${newPatient.email || 'No proporcionado'}

¡Bienvenido a nuestro sistema!`;

  } catch (error) {
    console.error('❌ Error guardando paciente:', error);
    
    // Manejar errores específicos de MongoDB
    if (error.code === 11000) {
      if (error.keyPattern.dni) {
        return '⚠️ Ya existe un paciente con ese número de documento.';
      }
      if (error.keyPattern.phone) {
        return '⚠️ Ya existe un paciente con este número de teléfono.';
      }
    }
    
    return '⚠️ Hubo un problema al registrarte. Por favor intenta más tarde.';
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
  
  console.log(`💾 Datos temporales actualizados para ${phoneNumber}:`, tempRegistration[phoneNumber]);
}

function clearTempData(phoneNumber) {
  delete tempRegistration[phoneNumber];
  console.log(`🗑️ Datos temporales eliminados para ${phoneNumber}`);
}

// Función para validar email básico
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

module.exports = {
  handleRegistrationSteps,
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
  isValidEmail
};