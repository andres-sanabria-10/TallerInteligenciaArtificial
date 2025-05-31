const express = require('express');
const router = express.Router();
const {
  sendMessage,
  isWhatsAppConnected,
  getClientInfo,
  initWhatsApp
} = require('../services/whatsappService');

/**
 * Webhook para recibir mensajes - FORMATO UNIVERSAL
 */
router.post('/webhook', async (req, res) => {
  try {
    console.log('🔔 Webhook recibido:', JSON.stringify(req.body, null, 2));

    let messageData = null;

    // FORMATO 1: wa-automate (formato directo)
    if (req.body.from && req.body.body) {
      messageData = {
        from: req.body.from,
        body: req.body.body,
        type: req.body.type || 'text',
        fromMe: req.body.fromMe || false,
        isGroupMsg: req.body.isGroupMsg || false
      };
      console.log('📱 Formato wa-automate detectado');
    }

    // FORMATO 2: WhatsApp Business API (formato que enviaste)
    else if (req.body.entry && req.body.entry[0] && req.body.entry[0].changes) {
      const changes = req.body.entry[0].changes[0];
      if (changes.value && changes.value.messages && changes.value.messages[0]) {
        const message = changes.value.messages[0];
        messageData = {
          from: message.from,
          body: message.text ? message.text.body : message.body,
          type: message.type === 'text' ? 'chat' : message.type,
          fromMe: false,
          isGroupMsg: false
        };
        console.log('📱 Formato WhatsApp Business API detectado');
      }
    }

    // FORMATO 3: Testing manual (formato simplificado)
    else if (req.body.phone && req.body.message) {
      messageData = {
        from: req.body.phone,
        body: req.body.message,
        type: 'chat',
        fromMe: false,
        isGroupMsg: false
      };
      console.log('📱 Formato de testing detectado');
    }
    // FORMATO 4: wa-automate usando evento "onMessage"
    // FORMATO 4: wa-automate usando evento "onMessage" o "onAnyMessage"
    else if (req.body.data && req.body.data.from && req.body.data.body) {
      messageData = {
        from: req.body.data.from,
        body: req.body.data.body,
        type: req.body.data.type || 'chat',
        fromMe: req.body.data.fromMe || false,
        isGroupMsg: req.body.data.isGroupMsg || false
      };
      console.log(`📱 Formato wa-automate (${req.body.event}) detectado`);
    }



    // Verificar que tenemos datos válidos
    if (!messageData || !messageData.from || !messageData.body) {
      console.log('⚠️ Formato de mensaje no reconocido o incompleto');
      console.log('📋 Formatos soportados:');
      console.log('1. wa-automate: { "from": "573155923440@c.us", "body": "hola", "type": "chat" }');
      console.log('2. WhatsApp Business: { "entry": [{"changes": [{"value": {"messages": [{"from": "573155923440", "text": {"body": "hola"}}]}}]}] }');
      console.log('3. Testing: { "phone": "573155923440", "message": "hola" }');

      return res.status(400).json({
        error: 'Datos de mensaje incompletos',
        receivedFormat: req.body,
        supportedFormats: {
          waAutomate: { from: "573155923440@c.us", body: "hola", type: "chat" },
          businessAPI: { entry: [{ changes: [{ value: { messages: [{ from: "573155923440", text: { body: "hola" } }] } }] }] },
          testing: { phone: "573155923440", message: "hola" }
        }
      });
    }

    // Filtrar mensajes propios y de grupos
    if (messageData.fromMe || messageData.isGroupMsg) {
      console.log('📵 Mensaje filtrado (propio o de grupo)');
      return res.status(200).json({ success: true, message: 'Mensaje filtrado' });
    }

    // Filtrar mensajes que no son de texto
    if (messageData.type !== 'chat' && messageData.type !== 'text') {
      await sendMessage(messageData.from, '📝 Por favor, envía solo mensajes de texto.');
      return res.status(200).json({ success: true, message: 'Tipo de mensaje no soportado' });
    }

    console.log('✅ Procesando mensaje:', {
      from: messageData.from,
      body: messageData.body,
      type: messageData.type
    });

    // Procesar el mensaje
    // Procesar con la lógica del chatbot
    // ✅ USAR ESTO:
    const { processIncomingMessage } = require('../controller/whatsappController');
    await processIncomingMessage(messageData);
    // Responder que el webhook fue procesado correctamente
    res.status(200).json({
      success: true,
      message: 'Mensaje procesado correctamente',
      processedData: {
        from: messageData.from,
        body: messageData.body,
        type: messageData.type
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error en webhook:', error.message);
    res.status(500).json({
      error: 'Error procesando webhook',
      details: error.message
    });
  }
});

/**
 * Endpoint para enviar mensajes manualmente (para testing)
 */
router.post('/send', async (req, res) => {
  try {
    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({
        error: 'Se requieren los campos "to" y "message"',
        example: { to: "573155923440", message: "Hola desde el API" }
      });
    }

    if (!isWhatsAppConnected()) {
      return res.status(503).json({
        error: 'WhatsApp no está conectado',
        solution: 'Ejecuta POST /whatsapp/init para conectar'
      });
    }

    const result = await sendMessage(to, message);

    res.json({
      success: true,
      message: 'Mensaje enviado correctamente',
      data: result
    });

  } catch (error) {
    console.error('❌ Error enviando mensaje:', error.message);
    res.status(500).json({
      error: 'Error enviando mensaje',
      details: error.message
    });
  }
});

/**
 * Verificar estado de WhatsApp
 */
router.get('/status', async (req, res) => {
  try {
    const connected = isWhatsAppConnected();
    const clientInfo = getClientInfo();

    res.json({
      connected,
      clientInfo,
      timestamp: new Date().toISOString(),
      webhookUrl: '/whatsapp/webhook'
    });

  } catch (error) {
    res.status(500).json({
      error: 'Error obteniendo estado',
      details: error.message
    });
  }
});

/**
 * Inicializar conexión WhatsApp manualmente
 */
router.post('/init', async (req, res) => {
  try {
    await initWhatsApp();

    res.json({
      success: true,
      message: 'WhatsApp inicializado correctamente'
    });

  } catch (error) {
    res.status(500).json({
      error: 'Error inicializando WhatsApp',
      details: error.message
    });
  }
});

/**
 * Endpoint de prueba con ejemplos
 */
router.get('/test', (req, res) => {
  res.json({
    message: '🤖 WhatsApp Bot API funcionando',
    webhook: '/whatsapp/webhook',
    endpoints: {
      send: 'POST /whatsapp/send',
      status: 'GET /whatsapp/status',
      init: 'POST /whatsapp/init'
    },
    testingExamples: {
      waAutomateFormat: {
        url: 'POST /whatsapp/webhook',
        body: {
          from: "573155923440@c.us",
          body: "hola",
          type: "chat",
          fromMe: false,
          isGroupMsg: false
        }
      },
      whatsappBusinessFormat: {
        url: 'POST /whatsapp/webhook',
        body: {
          entry: [{
            changes: [{
              value: {
                messages: [{
                  from: "573155923440",
                  text: { body: "hola" },
                  type: "text"
                }]
              }
            }]
          }]
        }
      },
      simpleTesting: {
        url: 'POST /whatsapp/webhook',
        body: {
          phone: "573155923440",
          message: "hola"
        }
      }
    }
  });
});

module.exports = router;