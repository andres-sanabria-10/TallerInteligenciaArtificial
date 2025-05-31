const { sendMessage } = require('../services/whatsappService'); // ✅ Usar sendMessage consistentemente

// Procesar mensaje entrante (viene del webhook)
const processIncomingMessage = async (messageData) => {
  console.log('📩 MENSAJE RECIBIDO:');
  console.log('- De:', messageData.from);
  console.log('- Contenido:', messageData.body);
  console.log('- Tipo:', messageData.type);

  try {
    // Extraer número de teléfono y texto del mensaje
    const phoneNumber = messageData.from;
    const messageText = messageData.body;

    // Procesar con la lógica del chatbot
    const response = await handleChatFlow(phoneNumber, messageText);
    
    if (response) {
      // Si la respuesta es un objeto interactivo, convertirla a texto simple
      const textResponse = formatResponseForCli(response);
      
      // ✅ Usar sendMessage consistentemente
      await sendMessage(phoneNumber, textResponse);
      console.log('✅ Respuesta enviada:', textResponse);
    }

  } catch (error) {
    console.error('❌ Error procesando mensaje:', error);
    
    // Enviar mensaje de error al usuario
    try {
      await sendMessage(messageData.from, '❌ Lo siento, hubo un error. Escribe "menu" para volver al inicio.');
      console.log('⚠️ Mensaje de error enviado al usuario');
    } catch (sendError) {
      console.error('❌ Error enviando mensaje de error:', sendError);
    }
  }
};

// 🤖 LÓGICA DEL CHATBOT - Adaptada a consultorio odontológico
const handleChatFlow = async (phoneNumber, messageText) => {
  const normalizedMessage = messageText.toLowerCase().trim();
  
  console.log(`🔄 Procesando mensaje de ${phoneNumber}: "${normalizedMessage}"`);
  
  // Mensaje de bienvenida
  if (normalizedMessage === 'hola' || normalizedMessage === 'hi' || normalizedMessage === 'menu') {
    return {
      type: 'interactive',
      body: '¡Hola! 👋 Bienvenido a nuestro consultorio odontológico.\n\n¿En qué puedo ayudarte hoy?',
      buttons: [
        { id: '1', title: '📅 Agendar cita' },
        { id: '2', title: '💰 Precios' },
        { id: '3', title: 'ℹ️ Información' }
      ]
    };
  }
  
  // Manejo de opciones numéricas y palabras clave
  if (normalizedMessage === '1' || normalizedMessage.includes('cita') || normalizedMessage.includes('turno')) {
    return '📅 **Agendar Cita**\n\nPara agendar tu cita, por favor compárteme:\n\n• Tu nombre completo\n• Fecha preferida\n• Tipo de tratamiento\n\n¿Cuándo te gustaría la cita?';
  }
  
  if (normalizedMessage === '2' || normalizedMessage.includes('precio') || normalizedMessage.includes('costo')) {
    return {
      type: 'list',
      body: '💰 Nuestros precios por tratamiento:',
      sections: [{
        title: 'Tratamientos',
        rows: [
          { id: 'limpieza', title: 'Limpieza dental', description: '$80.000' },
          { id: 'resina', title: 'Resina', description: '$120.000' },
          { id: 'endodoncia', title: 'Endodoncia', description: '$350.000' }
        ]
      }]
    };
  }
  
  if (normalizedMessage === '3' || normalizedMessage.includes('horario') || normalizedMessage.includes('hora')) {
    return 'ℹ️ **Información del Consultorio**\n\n🕐 **Horarios:**\n• Lunes a Viernes: 8:00 AM - 6:00 PM\n• Sábados: 8:00 AM - 2:00 PM\n• Domingos: Cerrado\n\n📍 **Ubicación:**\nCalle 123 #45-67, Sogamoso, Boyacá\n\nEscribe "menu" para volver al inicio.';
  }
  
  if (normalizedMessage.includes('ubicacion') || normalizedMessage.includes('direccion')) {
    return '📍 **Nuestra Ubicación:**\n\nCalle 123 #45-67, Sogamoso, Boyacá\n\n¿Necesitas indicaciones específicas?\n\nEscribe "menu" para volver al inicio.';
  }
  
  if (normalizedMessage.includes('gracias')) {
    return '¡De nada! 😊 Estoy aquí para ayudarte. ¿Hay algo más en lo que pueda asistirte?\n\nEscribe "menu" para ver todas las opciones.';
  }
  
  // Respuesta por defecto
  return '🤖 **Consultorio Odontológico**\n\nSoy tu asistente virtual. Puedo ayudarte con:\n\n• 📅 Agendar citas\n• 💰 Información de precios\n• 🕐 Horarios de atención\n• 📍 Ubicación\n\nEscribe "menu" para ver las opciones o dime directamente qué necesitas.';
};

// Convertir respuestas interactivas a texto simple para CLI
const formatResponseForCli = (response) => {
  // Si es string simple, devolverlo tal como está
  if (typeof response === 'string') {
    return response;
  }
  
  // Si es objeto interactivo, convertir a texto
  if (response && response.type === 'interactive') {
    let text = response.body + '\n\n';
    
    if (response.buttons && Array.isArray(response.buttons)) {
      text += '👆 **Opciones disponibles:**\n';
      response.buttons.forEach((button, index) => {
        text += `${button.id || (index + 1)}. ${button.title}\n`;
      });
      text += '\n💬 Responde con el número de tu opción.';
    }
    
    return text;
  }
  
  // Si es lista desplegable, convertir a texto
  if (response && response.type === 'list') {
    let text = response.body + '\n\n';
    
    if (response.sections && Array.isArray(response.sections)) {
      response.sections.forEach(section => {
        text += `📋 **${section.title}:**\n`;
        if (section.rows && Array.isArray(section.rows)) {
          section.rows.forEach((row, index) => {
            text += `${index + 1}. ${row.title}`;
            if (row.description) {
              text += ` - ${row.description}`;
            }
            text += '\n';
          });
        }
      });
      text += '\n💬 Responde con el número de tu opción.';
    }
    
    return text;
  }
  
  // Por defecto, convertir a string
  return String(response);
};

// Webhook endpoint - recibe mensajes del CLI
const whatsappWebhook = async (req, res) => {
  console.log('📩 WEBHOOK RECIBIDO:', JSON.stringify(req.body, null, 2));
  
  try {
    const messageData = req.body;
    
    // Filtrar mensajes propios y de grupos
    if (messageData.fromMe || messageData.isGroupMsg) {
      console.log('📵 Mensaje filtrado (propio o de grupo)');
      return res.status(200).json({ success: true, message: 'Mensaje filtrado' });
    }
    
    // Filtrar mensajes que no son de texto
    if (messageData.type !== 'chat') {
      await sendMessage(messageData.from, '📝 Por favor, envía solo mensajes de texto.');
      return res.status(200).json({ success: true, message: 'Tipo de mensaje no soportado' });
    }
    
    // Procesar mensaje
    await processIncomingMessage(messageData);
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ Error en webhook:', error);
    res.status(500).json({ error: 'Error procesando webhook' });
  }
};

// Función para enviar mensaje manualmente
const sendMessageManually = async (to, message) => {
  try {
    const textResponse = formatResponseForCli(message);
    await sendMessage(to, textResponse);
    console.log(`✅ Mensaje enviado a ${to}: ${textResponse}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error enviando mensaje:', error);
    return { success: false, error: error.message };
  }
};

module.exports = { 
  processIncomingMessage,
  whatsappWebhook,
  sendMessage: sendMessageManually,
  formatResponseForCli,
  handleChatFlow // ✅ Exportar la función del chatbot
};