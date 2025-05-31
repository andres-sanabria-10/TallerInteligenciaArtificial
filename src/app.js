require('dotenv').config(); // Cargar variables de entorno desde .env
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');

// Importar rutas y servicios
const whatsappRoutes = require('./routes/whatsapp');
const { initWhatsApp } = require('./services/whatsappService');

const app = express();

// Usa el puerto definido en el .env o por defecto el 3001
const PORT = process.env.PORT || 3001;

// Middlewares de seguridad, logging, y parsing
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Conexión a MongoDB
mongoose.connect(process.env.DB_URI)
  .then(() => {
    const dbName = mongoose.connection.db.databaseName;
    console.log('✅ Conectado a la base de datos:', dbName);
  })
  .catch(err => {
    console.error('❌ Error al conectar a MongoDB:', err.message);
  });

// Ruta raíz para probar el estado del API
app.get('/', (req, res) => {
  res.json({ 
    message: '🦷 Chatbot Odontología API',
    status: 'active',
    timestamp: new Date().toISOString()
  });
});

// Rutas específicas del API de WhatsApp
app.use('/whatsapp', whatsappRoutes);

// Middleware de manejo de errores generales
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Iniciar servidor
const server = app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
console.log(`📱 Webhook URL: ${process.env.WEBHOOK_URL || `http://localhost:${PORT}/whatsapp/webhook`}`);
  console.log(`🔗 Estado del API: http://localhost:${PORT}/`);
});

// Al final de app.js, después de crear el server
server.on('listening', async () => {
  console.log('🔄 Intentando conectar con WhatsApp...');
  try {
    await initWhatsApp();
  } catch (error) {
    console.log('⚠️ WhatsApp no conectado al inicio. Usar /api/whatsapp/init para conectar manualmente.');
  }
});
module.exports = app;