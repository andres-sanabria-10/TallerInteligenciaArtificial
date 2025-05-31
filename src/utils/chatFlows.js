const chatFlows = {
  // Mensajes de texto tradicionales
  askDni: '📋 Por favor, ingresa tu número de documento (cédula):',
  askNewPatientDni: '📝 Ingresa tu número de documento para completar tu registro:',
  askExpeditionDate: '📅 Ingresa tu fecha de expedición del documento (formato YYYY-MM-DD):',
  askNewPatientName: '👤 Por favor, ingresa tu nombre completo:',
  askNewPatientEmail: '📧 Ingresa tu correo electrónico:',
  askNewPatientBirthDate: '🎂 Ingresa tu fecha de nacimiento (YYYY-MM-DD):',
  askNewPatientDniExpedition: '📅 Ingresa la fecha de expedición de tu documento (YYYY-MM-DD):',
  patientRegistered: '✅ ¡Registro exitoso! Bienvenido a nuestro consultorio odontológico.',

  // Mensajes con botones interactivos
  start: {
    type: 'interactive',
    body: '🦷 ¡Hola! Bienvenido al **Consultorio Odontológico**\n\n¿Ya tienes una cuenta registrada con nosotros?',
    buttons: [
      { id: '1', title: '✅ Sí, estoy registrado' },
      { id: '2', title: '❌ No estoy registrado' },
      { id: '3', title: '❓ No estoy seguro' }
    ]
  },

  menu: {
    type: 'interactive',
    body: '🏠 **Menú Principal**\n\n¿Ya tienes una cuenta registrada con nosotros?',
    buttons: [
      { id: '1', title: '✅ Sí' },
      { id: '2', title: '❌ No' },
      { id: '3', title: '❓ No estoy seguro' }
    ]
  },

  dniNotFound: {
    type: 'interactive',
    body: '❌ No se encontró ese documento en nuestro sistema.\n\n¿Qué deseas hacer?',
    buttons: [
      { id: '1', title: '🔄 Intentar otro documento' },
      { id: '2', title: '📝 Registrarme como nuevo' }
    ]
  },

  readyToAppoint: {
    type: 'interactive',
    body: '🎉 ¡Bienvenido de nuevo!\n\n¿Qué deseas hacer hoy?',
    buttons: [
      { id: 'schedule', title: '📅 Agendar cita' },
      { id: 'view', title: '👀 Ver mis citas' },
      { id: 'menu', title: '🏠 Menú principal' }
    ]
  },

  // Lista desplegable para servicios (opcional)
  selectService: {
    type: 'list',
    body: '🦷 **Selecciona el servicio que necesitas:**\n\nElige el tratamiento que requieres:',
    buttonText: 'Ver servicios',
    sections: [
      {
        title: 'Servicios Disponibles',
        rows: [
          { id: 'limpieza', title: '🧽 Limpieza dental', description: 'Profilaxis y limpieza profunda - $80.000' },
          { id: 'revision', title: '🔍 Revisión general', description: 'Consulta y diagnóstico - $50.000' },
          { id: 'ortodoncia', title: '🦷 Ortodoncia', description: 'Brackets y alineadores - Consulta' },
          { id: 'endodoncia', title: '🔧 Endodoncia', description: 'Tratamiento de conductos - $350.000' },
          { id: 'blanqueamiento', title: '✨ Blanqueamiento', description: 'Blanqueamiento dental - $200.000' }
        ]
      }
    ]
  },

  // Mensajes informativos adicionales
  welcome: '🦷 **Consultorio Odontológico Digital**\n\n¡Gracias por contactarnos! Estamos aquí para cuidar tu sonrisa.',
  
  help: `🤖 **Comandos disponibles:**

📝 **menu** - Volver al menú principal
📝 **inicio** - Reiniciar conversación  
📝 **ayuda** - Mostrar esta ayuda

🦷 **¿Necesitas ayuda?**
Nuestro horario de atención:
• Lunes a Viernes: 8:00 AM - 6:00 PM
• Sábados: 8:00 AM - 2:00 PM
• Domingos: Cerrado

📞 **Contacto directo:** 3155923440`,

  // Mensajes de error más amigables
  errorGeneral: '❌ Ups, algo salió mal. Escribe **"menu"** para volver al inicio.',
  
  invalidInput: '❌ No entendí tu respuesta. Por favor usa las opciones disponibles o escribe **"ayuda"** para ver los comandos.',
  
  maintenance: '🔧 El sistema está en mantenimiento. Intenta más tarde o contacta directamente al consultorio.',
  
  // Respuestas de confirmación
  appointmentBooked: '✅ **¡Cita agendada exitosamente!** 🎉\n\nRecibirás un mensaje de confirmación pronto.\n\n¿Hay algo más en lo que pueda ayudarte?',
  
  dataUpdated: '✅ **Información actualizada correctamente**\n\n¿Deseas hacer algo más?'
};

module.exports = chatFlows;