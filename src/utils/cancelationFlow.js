// utils/cancelationFlow.js
const Appointment = require('../models/Appointment');
const { getTempData, setTempData } = require('./registrationFlow');

// 🗓️ Obtener citas cancelables del usuario (con mínimo 1 hora de anticipación)
async function getCancelableAppointments(patientId) {
  try {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000); // 1 hora de anticipación mínima

    console.log('🔍 Buscando citas cancelables para paciente:', patientId);
    console.log('⏰ Hora actual:', now.toISOString());
    console.log('⏰ Mínimo para cancelar:', oneHourFromNow.toISOString());

    const appointments = await Appointment.find({
      patientId: patientId,
      status: { $in: ['pendiente', 'confirmada'] }, // Solo citas no canceladas/completadas
      start: { $gte: oneHourFromNow } // Solo citas con 1+ hora de anticipación
    })
    .populate('doctorId', 'name')
    .populate('serviceId', 'name duration')
    .sort({ start: 1 }); // Ordenar por fecha más próxima

    console.log(`📊 Encontradas ${appointments.length} citas cancelables`);
    return appointments;

  } catch (error) {
    console.error('❌ Error obteniendo citas cancelables:', error);
    return [];
  }
}

// 📋 Formatear lista de citas para mostrar al usuario
function formatAppointmentsList(appointments) {
  if (appointments.length === 0) {
    return '❌ No tienes citas disponibles para cancelar.\n\nRecuerda que solo puedes cancelar citas con al menos 1 hora de anticipación.';
  }

  let message = '📋 Tus citas disponibles para cancelar:\n\n';
  
  appointments.forEach((appointment, index) => {
    const startDate = new Date(appointment.start);
    const endDate = new Date(appointment.end);
    
    // Formatear fecha y hora en zona horaria de Colombia
    const dateStr = startDate.toLocaleDateString('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'America/Bogota'
    });
    
    const startTimeStr = startDate.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Bogota'
    });
    
    const endTimeStr = endDate.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Bogota'
    });

    message += `${index + 1}. 📅 ${dateStr}\n`;
    message += `   ⏰ ${startTimeStr} - ${endTimeStr}\n`;
    message += `   👨‍⚕️ ${appointment.doctorId?.name || 'Doctor no especificado'}\n`;
    message += `   🦷 ${appointment.serviceId?.name || 'Servicio no especificado'}\n`;
    message += `   📊 Estado: ${appointment.status}\n\n`;
  });

  message += '💬 Escribe el número de la cita que deseas cancelar.';
  return message;
}

// ✅ Crear mensaje del menú principal
function createMainMenuMessage() {
  return `🦷 Menú Principal
¿Qué deseas hacer?

👆 Opciones disponibles:
1. 📅 Agendar Cita
2. 🚫 Cancelar Cita
3. 📋 Historial de Citas
4. 🚪 Volver al inicio

💬 Responde con el número de tu opción.`;
}

// 🚫 Cancelar cita específica
async function cancelAppointment(appointmentId, patientId) {
  try {
    console.log('🚫 Iniciando cancelación de cita:', appointmentId);

    // Buscar la cita y verificar que pertenece al paciente
    const appointment = await Appointment.findOne({
      _id: appointmentId,
      patientId: patientId,
      status: { $in: ['pendiente', 'confirmada'] }
    })
    .populate('patientId', 'name phone email')
    .populate('doctorId', 'name')
    .populate('serviceId', 'name');

    if (!appointment) {
      return {
        success: false,
        message: '❌ No se encontró la cita o ya fue cancelada.'
      };
    }

    // Verificar que aún se puede cancelar (1 hora de anticipación)
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    
    if (appointment.start < oneHourFromNow) {
      return {
        success: false,
        message: '❌ No puedes cancelar esta cita. Debe hacerse con al menos 1 hora de anticipación.'
      };
    }

    // 📅 Preparar datos para el webhook de Google Calendar (estructura exacta requerida)
    const webhookData = {
      patient: {
        name: appointment.patientId.name,
        phone: appointment.patientId.phone,
        email: appointment.patientId.email || ''
      },
      doctor: {
        name: appointment.doctorId?.name || 'Doctor no especificado'
      },
      service: {
        name: appointment.serviceId?.name || 'Servicio no especificado'
      },
      appointment: {
        date: appointment.start.toISOString().split('T')[0], // YYYY-MM-DD
        startTime: appointment.start.toLocaleTimeString('en-US', { 
          hour12: false, 
          hour: '2-digit', 
          minute: '2-digit',
          timeZone: 'America/Bogota'
        }),
        endTime: appointment.end.toLocaleTimeString('en-US', { 
          hour12: false, 
          hour: '2-digit', 
          minute: '2-digit',
          timeZone: 'America/Bogota'
        }),
        notes: appointment.notes || '',
        status: 'cancelada' // Para cancelación
      }
    };

    console.log('📤 Datos para webhook de cancelación:', JSON.stringify(webhookData, null, 2));

    // 🌐 Enviar webhook a Google Calendar
    const webhookSuccess = await sendCancelationWebhook(webhookData);
    
    if (!webhookSuccess) {
      console.log('⚠️ Webhook falló, pero continuando con cancelación local...');
      // Decidir si continuar o fallar completamente
      // Para mejor UX, continuamos con la cancelación local
    }

    // 💾 Actualizar estado en la base de datos
    appointment.status = 'cancelada';
    await appointment.save();

    console.log('✅ Cita cancelada exitosamente:', appointmentId);

    return {
      success: true,
      message: `✅ Cita cancelada exitosamente.

📅 Detalles de la cita cancelada:
🗓️ Fecha: ${appointment.start.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}
⏰ Hora: ${appointment.start.toLocaleTimeString('es-CO', { 
  hour: '2-digit', 
  minute: '2-digit',
  timeZone: 'America/Bogota'
})}
👨‍⚕️ Doctor: ${appointment.doctorId?.name || 'No especificado'}
🦷 Servicio: ${appointment.serviceId?.name || 'No especificado'}

${webhookSuccess ? 'La cita ha sido eliminada del calendario.' : '⚠️ Nota: La cita fue cancelada en nuestro sistema, pero puede requerir eliminación manual del calendario.'}`
    };

  } catch (error) {
    console.error('❌ Error cancelando cita:', error);
    return {
      success: false,
      message: '❌ Hubo un error al cancelar la cita. Inténtalo más tarde.'
    };
  }
}

// 🌐 Enviar webhook de cancelación a Google Calendar (MEJORADO)
async function sendCancelationWebhook(webhookData) {
  try {
    const WEBHOOK_URL = 'https://hook.us2.make.com/icl53uhz3xl8ugp34pjkrjb8wuwhn7ju';
    
    console.log('📤 Enviando webhook de cancelación a:', WEBHOOK_URL);
    console.log('📦 Payload:', JSON.stringify(webhookData, null, 2));
    
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        // Si Make.com requiere algún header específico, agrégalo aquí
        // 'X-API-Key': process.env.MAKE_API_KEY
      },
      body: JSON.stringify(webhookData),
      timeout: 10000 // 10 segundos timeout
    });

    console.log('📡 Response status:', response.status);
    console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No response body');
      console.error('❌ Error en webhook response:');
      console.error('   Status:', response.status);
      console.error('   Status Text:', response.statusText);
      console.error('   Response Body:', errorText);
      
      // Log adicional para debugging
      if (response.status === 500) {
        console.error('🔍 Error 500 - Posibles causas:');
        console.error('   1. Formato de datos incorrecto en Make.com');
        console.error('   2. Error en el escenario de Make.com');
        console.error('   3. Módulo de Google Calendar mal configurado');
        console.error('   4. Permisos insuficientes en Google Calendar');
      }
      
      return false;
    }

    let result;
    try {
      result = await response.json();
      console.log('✅ Webhook de cancelación enviado exitosamente:', result);
    } catch (jsonError) {
      // Algunos webhooks devuelven texto plano en lugar de JSON
      const textResult = await response.text();
      console.log('✅ Webhook de cancelación enviado (respuesta en texto):', textResult);
      result = { message: textResult };
    }
    
    return true;

  } catch (error) {
    console.error('❌ Error enviando webhook de cancelación:');
    console.error('   Error type:', error.name);
    console.error('   Error message:', error.message);
    
    if (error.name === 'AbortError') {
      console.error('   Causa: Timeout - el webhook tardó más de 10 segundos');
    } else if (error.name === 'TypeError') {
      console.error('   Causa: Problema de red o URL inválida');
    }
    
    return false;
  }
}

// 🎯 Flujo principal de cancelación
async function handleCancelationFlow(currentState, body, from) {
  const tempData = getTempData(from);
  
  if (!tempData || !tempData.patient) {
    return {
      message: '❌ Error: No se encontraron tus datos de sesión. Escribe "menu" para reiniciar.',
      newState: 'initial'
    };
  }

  // 📋 Mostrar lista de citas cancelables
  if (currentState === 'cancelation_list') {
    const appointments = await getCancelableAppointments(tempData.patient._id);
    
    if (appointments.length === 0) {
      return {
        message: `❌ No tienes citas disponibles para cancelar.

Recuerda que solo puedes cancelar citas con al menos 1 hora de anticipación.

${createMainMenuMessage()}`,
        newState: 'main_menu'
      };
    }

    // Guardar las citas en datos temporales para referencia
    setTempData(from, 'cancelableAppointments', appointments);

    return {
      message: formatAppointmentsList(appointments),
      newState: 'cancelation_select'
    };
  }

  // 🎯 Seleccionar cita para cancelar
  if (currentState === 'cancelation_select') {
    const selection = body.trim();
    
    // Validar que sea un número
    const appointmentIndex = parseInt(selection) - 1;
    const appointments = tempData.cancelableAppointments || [];
    
    if (isNaN(appointmentIndex) || appointmentIndex < 0 || appointmentIndex >= appointments.length) {
      return {
        message: `⚠️ Opción inválida. Por favor escribe un número del 1 al ${appointments.length}.`,
        newState: null // Mantener el mismo estado
      };
    }

    const selectedAppointment = appointments[appointmentIndex];
    setTempData(from, 'selectedAppointment', selectedAppointment);

    // Mostrar confirmación
    const startDate = new Date(selectedAppointment.start);
    const dateStr = startDate.toLocaleDateString('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'America/Bogota'
    });
    
    const timeStr = startDate.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Bogota'
    });

    return {
      message: `⚠️ ¿Estás seguro de que deseas cancelar esta cita?

📅 ${dateStr}
⏰ ${timeStr}
👨‍⚕️ ${selectedAppointment.doctorId?.name || 'Doctor no especificado'}
🦷 ${selectedAppointment.serviceId?.name || 'Servicio no especificado'}

Responde:
1 - ✅ Sí, cancelar cita
2 - ❌ No, mantener cita`,
      newState: 'cancelation_confirm'
    };
  }

  // ✅ Confirmar cancelación
  if (currentState === 'cancelation_confirm') {
    const normalized = body.toLowerCase().trim();
    
    if (['1', 'si', 'sí', 'yes'].includes(normalized)) {
      const selectedAppointment = tempData.selectedAppointment;
      
      if (!selectedAppointment) {
        return {
          message: '❌ Error: No se encontró la cita seleccionada. Escribe "menu" para reiniciar.',
          newState: 'initial'
        };
      }

      // Procesar cancelación
      const result = await cancelAppointment(selectedAppointment._id, tempData.patient._id);
      
      // Limpiar datos temporales
      delete tempData.cancelableAppointments;
      delete tempData.selectedAppointment;

      return {
        message: `${result.message}

${createMainMenuMessage()}`,
        newState: 'main_menu'
      };

    } else if (['2', 'no'].includes(normalized)) {
      // Limpiar datos temporales y volver al menú
      delete tempData.cancelableAppointments;
      delete tempData.selectedAppointment;

      return {
        message: `✅ Cita mantenida. No se realizó ninguna cancelación.

${createMainMenuMessage()}`,
        newState: 'main_menu'
      };

    } else {
      return {
        message: '⚠️ Por favor responde:\n1 - Sí, cancelar cita\n2 - No, mantener cita',
        newState: null
      };
    }
  }

  return {
    message: '⚠️ Estado de cancelación no reconocido.',
    newState: 'main_menu'
  };
}

module.exports = {
  getCancelableAppointments,
  formatAppointmentsList,
  cancelAppointment,
  handleCancelationFlow,
  sendCancelationWebhook
};