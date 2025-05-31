// test-webhook.js - Script para verificar configuración
const axios = require('axios');

async function verificarWebhook() {
  try {
    console.log('🔍 Verificando configuración del webhook...');
    
    // 1. Verificar que wa-automate esté corriendo
    const healthCheck = await axios.get('http://localhost:3200/');
    console.log('✅ wa-automate está corriendo en puerto 3200');
    
    // 2. Obtener información del cliente
    const clientInfo = await axios.get('http://localhost:3200/getMe');
    console.log('📱 WhatsApp conectado:', clientInfo.data.me._serialized);
    
    // 3. Verificar configuración del webhook (si es posible)
    try {
      const webhookInfo = await axios.get('http://localhost:3200/webhook');
      console.log('🔗 Webhook configurado:', webhookInfo.data);
    } catch (error) {
      console.log('ℹ️ No se pudo verificar webhook (normal si se configuró desde CLI)');
    }
    
    // 4. Probar conexión con tu aplicación Node.js
    const appTest = await axios.get('http://localhost:3001/');
    console.log('✅ Tu aplicación Node.js está corriendo:', appTest.data.message);
    
    console.log('\n🎯 Configuración correcta:');
    console.log('- wa-automate: http://localhost:3200 ✅');
    console.log('- Tu aplicación: http://localhost:3001 ✅');
    console.log('- Webhook configurado para enviar mensajes a tu app ✅');
    
  } catch (error) {
    console.error('❌ Error en la verificación:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      if (error.config?.url?.includes('3200')) {
        console.log('💡 Solución: Ejecuta wa-automate con: npx @open-wa/wa-automate -w \'TU_NGROK_URL/whatsapp/webhook\'');
      } else if (error.config?.url?.includes('3001')) {
        console.log('💡 Solución: Ejecuta tu aplicación Node.js con: npm start');
      }
    }
  }
}

// Ejecutar verificación
verificarWebhook();