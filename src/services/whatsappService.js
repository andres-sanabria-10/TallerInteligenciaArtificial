const axios = require('axios');

// URL base de wa-automate (ahora en puerto 8002)
const WA_AUTOMATE_URL = 'http://localhost:8002';

// Estado de conexión global
let isConnected = false;

// Información del cliente conectado
let clientInfo = {
    number: null,
    connected: false
};

// Inicializar conexión con WhatsApp usando /getHostNumber
async function initializeWhatsApp() {
    try {
        console.log('🔄 Verificando conexión con wa-automate...');

        const response = await axios.post(`${WA_AUTOMATE_URL}/getHostNumber`, {});

        if (response.status === 200 && response.data?.success === true) {
            isConnected = true;
            clientInfo = {
                number: response.data.response,
                connected: true
            };
            console.log(`✅ WhatsApp conectado: ${clientInfo.number}`);
            return true;
        }

        throw new Error('No está conectado aún');

    } catch (error) {
        isConnected = false;
        clientInfo = {
            number: null,
            connected: false
        };
        console.error('❌ Error conectando con WhatsApp:', error.message);
        console.log('💡 Asegúrate de que wa-automate esté ejecutándose en puerto 8002');
        return false;
    }
}

// Obtener info del cliente (usa datos guardados, no vuelve a llamar al endpoint)
function getClientInfo() {
    return {
        number: clientInfo.number,
        connected: clientInfo.connected
    };
}

// Enviar mensaje a número
async function sendMessage(to, message) {
    try {
        if (!to || !message) {
            throw new Error('Faltan parámetros: to y message son requeridos');
        }

        if (!isConnected) {
            const reconnected = await initializeWhatsApp();
            if (!reconnected) {
                throw new Error('WhatsApp no está conectado');
            }
        }

        console.log(`📤 Enviando mensaje a ${to}: ${message.substring(0, 50)}...`);

        const response = await axios.post(`${WA_AUTOMATE_URL}/sendText`, {
            args: {
                to: to,
                content: message
            }
        }, {
            timeout: 10000,
            headers: { 
                'Content-Type': 'application/json'
            }
        });

        if (response.data) {
            console.log(`✅ Mensaje enviado exitosamente a ${to}`);
            return response.data;
        } else {
            throw new Error('Respuesta vacía del servidor');
        }

    } catch (error) {
        console.error(`❌ Error enviando mensaje a ${to}:`, error.message);

        if (error.code === 'ECONNREFUSED' || error.message.includes('connect')) {
            isConnected = false;
            console.log('⚠️ Conexión perdida con wa-automate');
        }

        throw error;
    }
}

// Verificar estado de conexión
async function checkConnection() {
    return await initializeWhatsApp();
}

// Obtener info de sesión (usando POST)
async function getSessionInfo() {
    try {
        const response = await axios.post(`${WA_AUTOMATE_URL}/getSessionInfo`, {});
        console.log('✅ Info de sesión obtenida correctamente');
        return response.data;
    } catch (error) {
        console.error('❌ Error obteniendo info de sesión:', error.message);
        return null;
    }
}

// Exportar funciones esenciales
module.exports = {
    initWhatsApp: initializeWhatsApp,
    sendMessage,
    checkConnection,
    getSessionInfo,
    getClientInfo,
    isWhatsAppConnected: () => isConnected
};