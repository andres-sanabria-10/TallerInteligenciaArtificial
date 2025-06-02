const express = require('express');
const mongoose = require('mongoose');
const Appointment = require('../src/models/Appointment');
require('dotenv').config();
console.log('DB_URI:', process.env.DB_URI); // Verifica si imprime correctamente la URL

const app = express();
app.use(express.json());

mongoose.connect(process.env.DB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Endpoint para recibir datos y guardar cita
app.post('/add-appointment', async (req, res) => {
  try {
    const appointment = await Appointment.create(req.body); // Insertar en MongoDB
    res.status(201).json({ message: 'Cita creada con éxito', appointment });
  } catch (error) {
    res.status(500).json({ message: 'Error al crear la cita', error });
  }
});

app.listen(3000, () => console.log('🚀 Servidor en http://localhost:3000'));
