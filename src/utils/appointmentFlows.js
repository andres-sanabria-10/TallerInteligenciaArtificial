// utils/appointmentFlow.js
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Service = require('../models/Service');
const Availability = require('../models/Availability'); // 👈 Importar modelo Availability
const { getTempData, setTempData, parseDate } = require('./registrationFlow');
const axios = require('axios');

// URL del webhook de Make (cambiar por la tuya)
const MAKE_WEBHOOK_URL = 'https://hook.us2.make.com/5efq5b9m7ctrr6wsaicx638wvingvhkl';

// 🗓️ Manejo del flujo de agendamiento de citas
async function handleAppointmentFlow(currentState, body, from) {

  // 1️⃣ PRIMER PASO: Mostrar servicios disponibles (ENTRADA PRINCIPAL)
  if (currentState === 'appointment_service' || currentState === 'appointment_start') {
    try {
      const doctors = await Doctor.find({}).sort({ name: 1 });

      if (doctors.length === 0) {
        return {
          message: '❌ No hay doctores disponibles en este momento. Por favor intenta más tarde.',
          newState: 'main_menu'
        };
      }

      let doctorsList = '👨‍⚕️ Doctores Disponibles:\n\n';
      doctors.forEach((doctor, index) => {
        doctorsList += `${index + 1}. ${doctor.name} - ${doctor.specialty}\n`;
      });
      doctorsList += '\n💬 Escribe el número del doctor que prefieres:';

      setTempData(from, 'availableDoctors', doctors);

      return {
        message: doctorsList,
        newState: 'appointment_doctor_selection'
      };
    } catch (error) {
      console.error('❌ Error obteniendo doctores:', error);
      return {
        message: '❌ Error al cargar doctores. Por favor intenta más tarde.',
        newState: 'main_menu'
      };
    }
  }

  // 1️⃣ PRIMER PASO: Mostrar doctores disponibles
  if (currentState === 'appointment_doctor') {
    try {
      const doctors = await Doctor.find({}).sort({ name: 1 });

      if (doctors.length === 0) {
        return {
          message: '❌ No hay doctores disponibles en este momento. Por favor intenta más tarde.',
          newState: 'main_menu'
        };
      }

      let doctorsList = '👨‍⚕️ Doctores Disponibles:\n\n';
      doctors.forEach((doctor, index) => {
        doctorsList += `${index + 1}. ${doctor.name} - ${doctor.specialty}\n`;
      });
      doctorsList += '\n💬 Escribe el número del doctor que prefieres:';

      setTempData(from, 'availableDoctors', doctors);

      return {
        message: doctorsList,
        newState: 'appointment_doctor_selection'
      };
    } catch (error) {
      console.error('❌ Error obteniendo doctores:', error);
      return {
        message: '❌ Error al cargar doctores. Por favor intenta más tarde.',
        newState: 'main_menu'
      };
    }
  }

  // 2️⃣ SEGUNDO PASO: Selección de doctor
  if (currentState === 'appointment_doctor_selection') {
    const tempData = getTempData(from);
    const doctors = tempData.availableDoctors;

    if (!doctors || doctors.length === 0) {
      return {
        message: '❌ Error: No se encontraron doctores. Regresando al menú principal.',
        newState: 'main_menu'
      };
    }

    const doctorIndex = parseInt(body.trim()) - 1;

    if (isNaN(doctorIndex) || doctorIndex < 0 || doctorIndex >= doctors.length) {
      return {
        message: '⚠️ Número de doctor inválido. Por favor elige un número del 1 al ' + doctors.length,
        newState: null
      };
    }

    const selectedDoctor = doctors[doctorIndex];
    setTempData(from, 'selectedDoctor', selectedDoctor);

    try {
      // Mostrar servicios disponibles
      const services = await Service.find({}).sort({ name: 1 });

      if (services.length === 0) {
        return {
          message: '❌ No hay servicios disponibles en este momento. Por favor intenta más tarde.',
          newState: 'main_menu'
        };
      }

      let servicesList = '🦷 Servicios Disponibles:\n\n';
      services.forEach((service, index) => {
        servicesList += `${index + 1}. ${service.name} - $${service.price.toLocaleString()} (${service.durationMinutes} min)\n`;
      });
      servicesList += '\n💬 Escribe el número del servicio que necesitas:';

      setTempData(from, 'availableServices', services);

      return {
        message: `✅ Doctor seleccionado: ${selectedDoctor.name}\n\n${servicesList}`,
        newState: 'appointment_service_selection'
      };
    } catch (error) {
      console.error('❌ Error obteniendo servicios:', error);
      return {
        message: '❌ Error al cargar servicios. Por favor intenta más tarde.',
        newState: 'main_menu'
      };
    }
  }

  // 3️⃣ TERCER PASO: Selección de servicio
  if (currentState === 'appointment_service_selection') {
    const tempData = getTempData(from);
    const services = tempData.availableServices;

    if (!services || services.length === 0) {
      return {
        message: '❌ Error: No se encontraron servicios. Regresando al menú principal.',
        newState: 'main_menu'
      };
    }

    const serviceIndex = parseInt(body.trim()) - 1;

    if (isNaN(serviceIndex) || serviceIndex < 0 || serviceIndex >= services.length) {
      return {
        message: '⚠️ Número de servicio inválido. Por favor elige un número del 1 al ' + services.length,
        newState: null
      };
    }

    const selectedService = services[serviceIndex];
    setTempData(from, 'selectedService', selectedService);

    // Ahora mostrar fechas disponibles para el doctor seleccionado
    try {
      const availableDates = await getAvailableDatesForDoctor(tempData.selectedDoctor._id);

      if (availableDates.length === 0) {
        return {
          message: `❌ El doctor ${tempData.selectedDoctor.name} no tiene fechas disponibles en los próximos días. Por favor elige otro doctor o intenta más tarde.`,
          newState: 'appointment_doctor'
        };
      }

      let datesList = '📅 Fechas disponibles:\n\n';
      availableDates.forEach((dateInfo, index) => {
        const dateStr = dateInfo.date.toLocaleDateString('es-CO', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        datesList += `${index + 1}. ${dateStr} (${dateInfo.availableSlots} horarios disponibles)\n`;
      });
      datesList += '\n💬 Escribe el número de la fecha que prefieres:';

      setTempData(from, 'availableDates', availableDates);

      return {
        message: `✅ Servicio seleccionado: ${selectedService.name} (${selectedService.durationMinutes} min)\n\n${datesList}`,
        newState: 'appointment_date_selection'
      };
    } catch (error) {
      console.error('❌ Error obteniendo fechas disponibles:', error);
      return {
        message: '❌ Error al cargar fechas disponibles. Por favor intenta más tarde.',
        newState: 'main_menu'
      };
    }
  }

  // 4️⃣ CUARTO PASO: Selección de fecha
  if (currentState === 'appointment_date_selection') {
    const tempData = getTempData(from);
    const availableDates = tempData.availableDates;

    if (!availableDates || availableDates.length === 0) {
      return {
        message: '❌ Error: No se encontraron fechas disponibles.',
        newState: 'appointment_doctor'
      };
    }

    const dateIndex = parseInt(body.trim()) - 1;

    if (isNaN(dateIndex) || dateIndex < 0 || dateIndex >= availableDates.length) {
      return {
        message: '⚠️ Número de fecha inválido. Por favor elige un número del 1 al ' + availableDates.length,
        newState: null
      };
    }

    const selectedDate = availableDates[dateIndex];
    setTempData(from, 'selectedDate', selectedDate);

    // Mostrar horarios disponibles para esa fecha específica
    try {
      const availableTimeSlots = await getAvailableTimeSlotsForDate(
        tempData.selectedDoctor._id,
        selectedDate.date,
        tempData.selectedService.durationMinutes
      );

      if (availableTimeSlots.length === 0) {
        return {
          message: '❌ No hay horarios disponibles para esta fecha. Por favor elige otra fecha.',
          newState: null
        };
      }

      let timeSlotsList = '🕐 Horarios disponibles:\n\n';
      availableTimeSlots.forEach((slot, index) => {
        const endTime = calculateEndTime(slot.time, tempData.selectedService.durationMinutes);
        timeSlotsList += `${index + 1}. ${slot.time} - ${endTime}\n`;
      });
      timeSlotsList += '\n💬 Escribe el número del horario que prefieres:';

      setTempData(from, 'availableTimeSlots', availableTimeSlots);

      return {
        message: `✅ Fecha seleccionada: ${selectedDate.date.toLocaleDateString('es-CO')}\n\n${timeSlotsList}`,
        newState: 'appointment_time_selection'
      };
    } catch (error) {
      console.error('❌ Error obteniendo horarios disponibles:', error);
      return {
        message: '❌ Error al cargar horarios disponibles. Por favor intenta más tarde.',
        newState: 'main_menu'
      };
    }
  }

  // 5️⃣ QUINTO PASO: Selección de horario
  if (currentState === 'appointment_time_selection') {
    const tempData = getTempData(from);
    const availableTimeSlots = tempData.availableTimeSlots;

    if (!availableTimeSlots || availableTimeSlots.length === 0) {
      return {
        message: '❌ Error: No se encontraron horarios disponibles.',
        newState: 'appointment_date_selection'
      };
    }

    const timeIndex = parseInt(body.trim()) - 1;

    if (isNaN(timeIndex) || timeIndex < 0 || timeIndex >= availableTimeSlots.length) {
      return {
        message: '⚠️ Número de horario inválido. Por favor elige un número del 1 al ' + availableTimeSlots.length,
        newState: null
      };
    }

    const selectedTimeSlot = availableTimeSlots[timeIndex];

    // Crear fechas y horas completas
    const startDateTime = createDateTime(tempData.selectedDate.date, selectedTimeSlot.time);
    const endDateTime = new Date(startDateTime);
    endDateTime.setMinutes(endDateTime.getMinutes() + tempData.selectedService.durationMinutes);

    // Verificación final de disponibilidad (doble check)
    const conflictingAppointment = await checkDetailedAvailability(
      tempData.selectedDoctor._id,
      startDateTime,
      endDateTime
    );

    if (conflictingAppointment) {
      return {
        message: `⚠️ Este horario ya no está disponible. Por favor elige otro horario.`,
        newState: 'appointment_time_selection'
      };
    }

    setTempData(from, 'startDateTime', startDateTime);
    setTempData(from, 'endDateTime', endDateTime);

    // Mostrar resumen y pedir confirmación
    const summary = `📋 Resumen de tu cita:

👤 Paciente: ${tempData.patient.name}
👨‍⚕️ Doctor: ${tempData.selectedDoctor.name}
🦷 Servicio: ${tempData.selectedService.name}
📅 Fecha: ${startDateTime.toLocaleDateString('es-CO')}
🕐 Hora: ${startDateTime.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })} - ${endDateTime.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
⏱️ Duración: ${tempData.selectedService.durationMinutes} minutos
💰 Precio: $${tempData.selectedService.price.toLocaleString()}

¿Confirmas esta cita?
1. ✅ Sí, confirmar
2. ❌ No, cancelar`;

    return {
      message: summary,
      newState: 'appointment_confirmation'
    };
  }

  // 6️⃣ SEXTO PASO: Confirmación de la cita
  if (currentState === 'appointment_confirmation') {
    const normalized = body.toLowerCase().trim();

    if (['1', 'si', 'sí', 'confirmar', 'ok'].includes(normalized)) {
      // Guardar cita y actualizar disponibilidad
      const result = await saveAppointmentAndUpdateAvailability(from);
      return {
        message: result.message,
        newState: result.success ? 'main_menu' : 'appointment_doctor'
      };
    } else if (['2', 'no', 'cancelar'].includes(normalized)) {
      // Limpiar datos temporales de la cita
      clearAppointmentTempData(from);

      const { showMainMenu, formatResponseForCli } = require('./menuFlows');
      return {
        message: '❌ Cita cancelada.\n\n' + formatResponseForCli(showMainMenu()),
        newState: 'main_menu'
      };
    } else {
      return {
        message: '⚠️ Respuesta no válida. Escribe:\n1 para confirmar\n2 para cancelar',
        newState: null
      };
    }
  }

  return {
    message: '⚠️ Estado de cita no reconocido.',
    newState: 'main_menu'
  };
}

// 🗓️ Obtener fechas disponibles para un doctor (próximos 30 días)
async function getAvailableDatesForDoctor(doctorId) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 30); // Próximos 30 días

    const availabilities = await Availability.find({
      doctorId: doctorId,
      date: { $gte: today, $lte: endDate }
    }).sort({ date: 1 });

    const availableDates = [];

    for (const availability of availabilities) {
      const availableSlots = availability.timeSlots.filter(slot => slot.available).length;
      if (availableSlots > 0) {
        availableDates.push({
          date: availability.date,
          availableSlots: availableSlots
        });
      }
    }

    return availableDates;
  } catch (error) {
    console.error('❌ Error obteniendo fechas disponibles:', error);
    return [];
  }
}

// 🕐 Obtener horarios disponibles para una fecha específica considerando duración del servicio
async function getAvailableTimeSlotsForDate(doctorId, date, serviceDurationMinutes) {
  try {
    // Buscar disponibilidad para esa fecha
    const availability = await Availability.findOne({
      doctorId: doctorId,
      date: {
        $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
        $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
      }
    });

    if (!availability) {
      return [];
    }

    // Filtrar solo slots disponibles
    const availableSlots = availability.timeSlots.filter(slot => slot.available);

    // Verificar que hay suficiente tiempo para el servicio
    const validSlots = [];

    for (const slot of availableSlots) {
      const canFitService = await canServiceFitInTimeSlot(
        doctorId,
        date,
        slot.time,
        serviceDurationMinutes,
        availability.timeSlots
      );

      if (canFitService) {
        validSlots.push(slot);
      }
    }

    return validSlots;
  } catch (error) {
    console.error('❌ Error obteniendo horarios disponibles:', error);
    return [];
  }
}

// ⏰ Verificar si un servicio cabe en un slot de tiempo
async function canServiceFitInTimeSlot(doctorId, date, startTime, durationMinutes, allTimeSlots) {
  try {
    const startDateTime = createDateTime(date, startTime);
    const endDateTime = new Date(startDateTime);
    endDateTime.setMinutes(endDateTime.getMinutes() + durationMinutes);

    // Verificar si hay citas existentes que interfieran
    const conflictingAppointment = await checkDetailedAvailability(doctorId, startDateTime, endDateTime);
    if (conflictingAppointment) {
      return false;
    }

    // Verificar que todos los slots necesarios estén disponibles
    const requiredSlots = Math.ceil(durationMinutes / 15); // Asumiendo slots de 15 minutos
    const startSlotIndex = allTimeSlots.findIndex(slot => slot.time === startTime);

    if (startSlotIndex === -1) {
      return false;
    }

    // Verificar que los próximos slots estén disponibles
    for (let i = 0; i < requiredSlots; i++) {
      if (startSlotIndex + i >= allTimeSlots.length) {
        return false; // No hay suficientes slots
      }

      const slot = allTimeSlots[startSlotIndex + i];
      if (!slot.available) {
        return false; // Slot no disponible
      }
    }

    return true;
  } catch (error) {
    console.error('❌ Error verificando si el servicio cabe:', error);
    return false;
  }
}

// 🔍 Verificación detallada de disponibilidad
async function checkDetailedAvailability(doctorId, startTime, endTime) {
  try {
    const conflictingAppointment = await Appointment.findOne({
      doctorId: doctorId,
      status: { $in: ['pendiente', 'confirmada'] },
      $or: [
        {
          start: { $lt: endTime },
          end: { $gt: startTime }
        }
      ]
    });

    return conflictingAppointment;
  } catch (error) {
    console.error('❌ Error verificando disponibilidad detallada:', error);
    return null;
  }
}

// 💾 Guardar cita y actualizar disponibilidad
// 💾 Guardar cita y actualizar disponibilidad - VERSIÓN CORREGIDA
// 💾 Guardar cita y actualizar disponibilidad - VERSIÓN CORREGIDA CON EVENT ID
async function saveAppointmentAndUpdateAvailability(from) {
  try {
    const tempData = getTempData(from);

    // ✅ VALIDACIÓN MEJORADA: Verificar que todos los datos existen
    if (!tempData) {
      console.error('❌ No hay datos temporales para el usuario:', from);
      return {
        success: false,
        message: '❌ Error: No se encontraron datos de la sesión. Por favor intenta nuevamente.'
      };
    }

    if (!tempData.patient) {
      console.error('❌ No hay datos del paciente');
      return {
        success: false,
        message: '❌ Error: No se encontraron datos del paciente. Por favor registrate primero.'
      };
    }

    if (!tempData.selectedService) {
      console.error('❌ No hay servicio seleccionado');
      return {
        success: false,
        message: '❌ Error: No se seleccionó un servicio. Por favor intenta nuevamente.'
      };
    }

    if (!tempData.selectedDoctor) {
      console.error('❌ No hay doctor seleccionado');
      return {
        success: false,
        message: '❌ Error: No se seleccionó un doctor. Por favor intenta nuevamente.'
      };
    }

    if (!tempData.startDateTime || !tempData.endDateTime) {
      console.error('❌ No hay fechas/horas seleccionadas');
      return {
        success: false,
        message: '❌ Error: No se seleccionó fecha u hora. Por favor intenta nuevamente.'
      };
    }

    console.log('🔄 Guardando cita y actualizando disponibilidad...');
    console.log('📊 Datos del paciente:', tempData.patient.name);
    console.log('📊 Datos del doctor:', tempData.selectedDoctor.name);
    console.log('📊 Datos del servicio:', tempData.selectedService.name);

    // 🔐 GUARDAR DATOS ANTES DE LIMPIAR
    const appointmentDetails = {
      patientName: tempData.patient.name,
      doctorName: tempData.selectedDoctor.name,
      serviceName: tempData.selectedService.name,
      servicePrice: tempData.selectedService.price,
      startDateTime: tempData.startDateTime,
      endDateTime: tempData.endDateTime,
      selectedDate: tempData.selectedDate
    };

    // 🌐 PRIMERO: Enviar a Make webhook y obtener eventId
    console.log('📤 Enviando datos a Make webhook...');
    const webhookResponse = await sendToMakeWebhook(tempData);

    // 🔍 Extraer eventId de la respuesta
    let googleEventId = null;
    if (webhookResponse && webhookResponse.success && webhookResponse.eventId) {
      googleEventId = webhookResponse.eventId;
      console.log('✅ Event ID recibido del webhook:', googleEventId);
    } else {
      console.log('⚠️ No se pudo obtener Event ID del webhook');
    }

    // 💾 SEGUNDO: Crear la cita en MongoDB CON el eventId
    const newAppointment = new Appointment({
      patientId: tempData.patient._id,
      doctorId: tempData.selectedDoctor._id,
      serviceId: tempData.selectedService._id,
      start: tempData.startDateTime,
      end: tempData.endDateTime,
      status: 'confirmada',
      notes: 'Cita agendada vía WhatsApp',
      eventId: googleEventId
    });

    await newAppointment.save();
    console.log('✅ Cita guardada en MongoDB:', newAppointment._id);
    console.log('✅ Event ID guardado:', googleEventId);

    // 🔄 TERCERO: Actualizar disponibilidad
    await updateDoctorAvailability(
      tempData.selectedDoctor._id,
      tempData.selectedDate.date,
      tempData.startDateTime,
      tempData.selectedService.durationMinutes
    );

    // 🧹 Limpiar datos temporales DESPUÉS de guardar todo
    clearAppointmentTempData(from);

    const { showMainMenu, formatResponseForCli } = require('./menuFlows');

    return {
      success: true,
      message: `✅ ¡Cita agendada exitosamente!

📋 Detalles de tu cita:
📅 Fecha: ${appointmentDetails.startDateTime.toLocaleDateString('es-CO')}   
🕐 Hora: ${appointmentDetails.startDateTime.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })} - ${appointmentDetails.endDateTime.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
🦷 Servicio: ${appointmentDetails.serviceName}
👨‍⚕️ Doctor: ${appointmentDetails.doctorName}
💰 Precio: $${appointmentDetails.servicePrice.toLocaleString()}
🆔 ID Evento: ${googleEventId || 'N/A'}

📲 Te enviaremos un recordatorio de tu cita

${formatResponseForCli(showMainMenu())}`
    };

  } catch (error) {
    console.error('❌ Error guardando cita:', error);
    console.error('❌ Stack trace:', error.stack);
    return {
      success: false,
      message: '❌ Hubo un error al agendar tu cita. Por favor intenta nuevamente o contacta al consultorio.'
    };
  }
}

// 📤 Enviar datos a Make webhook - VERSIÓN MEJORADA QUE RETORNA EVENT ID
async function sendToMakeWebhook(tempData) {
  try {
    // 🔍 DEBUG: Verificar qué datos tenemos del paciente
    console.log('🔍 DEBUG - Datos completos de tempData.patient:');
    console.log('📊 Patient object keys:', Object.keys(tempData.patient || {}));
    console.log('📧 Email encontrado:', tempData.patient?.email);
    console.log('📱 Phone encontrado:', tempData.patient?.phone);
    console.log('👤 Name encontrado:', tempData.patient?.name);
    console.log('🆔 DNI encontrado:', tempData.patient?.dni);

    // ✅ ESTRUCTURA COMPLETA con email incluido
    const webhookData = {
      patient: {
        name: tempData.patient.name || 'Sin nombre',
        phone: tempData.patient.phone || 'Sin teléfono',
        email: tempData.patient.email || 'Sin email'
      },
      doctor: {
        name: tempData.selectedDoctor.name || 'Sin doctor'
      },
      service: {
        name: tempData.selectedService.name || 'Sin servicio'
      },
      appointment: {
        date: tempData.startDateTime.toISOString().split('T')[0], // Formato YYYY-MM-DD
        startTime: tempData.startDateTime.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit'
        }), // Formato HH:MM
        endTime: tempData.endDateTime.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit'
        }), // Formato HH:MM
        notes: 'Cita agendada vía WhatsApp',
        status: 'confirmada'
      }
    };

    console.log('📤 Enviando datos a Make webhook:', JSON.stringify(webhookData, null, 2));

    const response = await axios.post(MAKE_WEBHOOK_URL, webhookData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    console.log('✅ Respuesta del webhook recibida:', response.status);
    console.log('📊 Datos de respuesta:', response.data);

    // 🎯 EXTRAER EVENT ID de diferentes formatos posibles
    let eventId = null;

    if (Array.isArray(response.data) && response.data.length > 0) {
      eventId = response.data[0].eventId; // ← ahora sí accedes correctamente
    } else if (response.data && typeof response.data === 'object') {
      eventId = response.data.eventId || response.data.id || response.data['Event ID'];
    }


    return {
      success: true,
      eventId: eventId,
      responseData: response.data
    };

  } catch (webhookError) {
    console.error('⚠️ Error enviando a Make webhook:', webhookError.message);
    if (webhookError.response) {
      console.error('⚠️ Response status:', webhookError.response.status);
      console.error('⚠️ Response data:', webhookError.response.data);
    }

    // Retornar objeto de error pero no lanzar excepción
    return {
      success: false,
      error: webhookError.message,
      eventId: null
    };
  }
}

// 🔄 Actualizar disponibilidad del doctor
async function updateDoctorAvailability(doctorId, date, startDateTime, durationMinutes) {
  try {
    const availability = await Availability.findOne({
      doctorId: doctorId,
      date: {
        $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
        $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
      }
    });

    if (!availability) {
      console.log('⚠️ No se encontró disponibilidad para actualizar');
      return;
    }

    const startTime = startDateTime.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });

    // Marcar como no disponibles los slots necesarios
    const requiredSlots = Math.ceil(durationMinutes / 15);
    const startSlotIndex = availability.timeSlots.findIndex(slot => slot.time === startTime);

    if (startSlotIndex !== -1) {
      for (let i = 0; i < requiredSlots && (startSlotIndex + i) < availability.timeSlots.length; i++) {
        availability.timeSlots[startSlotIndex + i].available = false;
      }

      await availability.save();
      console.log('✅ Disponibilidad actualizada');
    }
  } catch (error) {
    console.error('❌ Error actualizando disponibilidad:', error);
  }
}

// 📤 Enviar datos a Make webhook - ESTRUCTURA SIMPLIFICADA
// 📤 Enviar datos a Make webhook - VERSION CON DEBUG


// 🧹 Limpiar datos temporales de la cita
function clearAppointmentTempData(from) {
  const tempData = getTempData(from);
  if (tempData) {
    delete tempData.selectedService;
    delete tempData.selectedDoctor;
    delete tempData.selectedDate;
    delete tempData.startDateTime;
    delete tempData.endDateTime;
    delete tempData.availableServices;
    delete tempData.availableDoctors;
    delete tempData.availableDates;
    delete tempData.availableTimeSlots;
  }
}

// 🛠️ Funciones auxiliares
function createDateTime(date, timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  const dateTime = new Date(date);
  dateTime.setHours(hours, minutes, 0, 0);
  return dateTime;
}

function calculateEndTime(startTime, durationMinutes) {
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60);
  const endMinutes = totalMinutes % 60;
  return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
}

module.exports = {
  handleAppointmentFlow,
  saveAppointmentAndUpdateAvailability
};