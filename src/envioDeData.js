// seed.js
const mongoose = require('mongoose');
const Doctor = require('../src/models/Doctor');
const Service = require('../src/models/Service');
const Availability = require('../src/models/Availability');
const Appointment = require('../src/models/Appointment');

const MONGO_URI = 'mongodb+srv://yennyferlesmes:123456789yennyfer@cluster0.nlsx8.mongodb.net/TallerChatBotAndres'; // cambia por tu URL

const existingPatients = [
  { _id: '68378fb89b26ca86e10f5db3', name: 'Ana López' },
  { _id: '68381edbb1b10417793d9364', name: 'andres' },
  { _id: '683bca671fafddfd515ca9b1', name: 'tatiana Mesa' }
];

async function main() {
  await mongoose.connect(MONGO_URI);

  console.log('🧑‍⚕️ Creando doctores...');
  const doctors = await Doctor.insertMany([
    { name: 'Dr. Juan Pérez', email: 'juan.perez@clinicamedica.com', phone: '+573001234567' },
    { name: 'Dra. María Gómez', email: 'maria.gomez@clinicamedica.com', phone: '+573002345678' },
    { name: 'Dr. Carlos Rodríguez', email: 'carlos.rodriguez@clinicamedica.com', phone: '+573003456789' }
  ]);

  console.log('💼 Creando servicios...');
  const services = await Service.insertMany([
    { name: 'Consulta General', durationMinutes: 30, price: 50000 },
    { name: 'Consulta Especializada', durationMinutes: 60, price: 80000 },
    { name: 'Terapia Física', durationMinutes: 120, price: 150000 },
    { name: 'Evaluación Psicológica', durationMinutes: 90, price: 120000 }
  ]);

  console.log('📅 Generando disponibilidad para 6 meses...');
  const startDate = new Date();
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 6);

  const generateTimeSlots = (start, end) => {
    const slots = [];
    let hour = start.getHours();
    let minutes = 0;
    while (hour < end.getHours()) {
      const time = `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      slots.push({ time, available: true });
      minutes += 30;
      if (minutes >= 60) {
        minutes = 0;
        hour += 1;
      }
    }
    return slots;
  };

  for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
    if (date.getDay() === 0 || date.getDay() === 6) continue; // lunes a viernes

    for (const doc of doctors) {
      const slots = [
        ...generateTimeSlots(new Date(0, 0, 0, 8), new Date(0, 0, 0, 12)),
        ...generateTimeSlots(new Date(0, 0, 0, 14), new Date(0, 0, 0, 17))
      ];
      await Availability.create({
        doctorId: doc._id,
        date: new Date(date),
        timeSlots: slots
      });
    }
  }

  console.log('📆 Creando 3 citas con pacientes existentes...');
  await Appointment.insertMany([
    {
      patientId: existingPatients[0]._id,
      doctorId: doctors[0]._id,
      serviceId: services[0]._id,
      start: new Date('2025-06-03T08:00:00Z'),
      end: new Date('2025-06-03T08:30:00Z'),
      status: 'confirmada',
      notes: 'Primera cita de Ana.'
    },
    {
      patientId: existingPatients[1]._id,
      doctorId: doctors[1]._id,
      serviceId: services[1]._id,
      start: new Date('2025-06-04T09:00:00Z'),
      end: new Date('2025-06-04T10:00:00Z'),
      status: 'confirmada',
      notes: 'Consulta especializada para Andrés.'
    },
    {
      patientId: existingPatients[2]._id,
      doctorId: doctors[2]._id,
      serviceId: services[3]._id,
      start: new Date('2025-06-05T14:00:00Z'),
      end: new Date('2025-06-05T15:30:00Z'),
      status: 'confirmada',
      notes: 'Evaluación psicológica para Tatiana.'
    }
  ]);

  console.log('✅ Datos creados correctamente');
  await mongoose.disconnect();
}

main().catch(console.error);
