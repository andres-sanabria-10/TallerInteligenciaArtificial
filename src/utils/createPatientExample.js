// src/utils/createPatientExample.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

// Importar modelo
const Patient = require('../models/Patient');

// Función para conectar a MongoDB e insertar paciente
async function createSamplePatient() {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.DB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ Conectado a MongoDB');

    const newPatient = new Patient({
      name: 'Ana López',
      phone: '+5491122334456',
      email: 'ana@example.com',
      dni: '87654321',
      birthDate: new Date('1990-05-15'),
      dniExpeditionDate: new Date('2020-01-10')
    });

    // Guardar en la base de datos
    const savedPatient = await newPatient.save();
    console.log('✅ Paciente creado:', savedPatient);

    // Desconectar
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');

  } catch (error) {
    console.error('❌ Error al crear paciente:', error.message);
    process.exit(1);
  }
}

// Ejecutar función
createSamplePatient();