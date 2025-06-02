const Patient = require('../models/Patient');

// ✅ MEJORADO: Función de validación con mejor logging y manejo de errores
async function checkIfRegistered(dni) {
  console.log(`🔎 checkIfRegistered - Buscando DNI: "${dni}"`);
  
  try {
    // Validar que el DNI no esté vacío
    if (!dni || dni.trim() === '') {
      console.log('❌ DNI vacío o undefined');
      return { registered: false, patient: null };
    }

    // Buscar paciente en la base de datos
    const patient = await Patient.findOne({ dni: dni.trim() }).exec();
    
    console.log(`📊 Resultado búsqueda:`, {
      dni: dni.trim(),
      encontrado: !!patient,
      nombre: patient ? patient.name : 'N/A',
      telefono: patient ? patient.phone : 'N/A',
      tieneExpedicion: patient ? !!patient.dniExpeditionDate : false
    });

    return { 
      registered: !!patient, 
      patient: patient || null
    };

  } catch (error) {
    console.error('❌ Error en checkIfRegistered:', error.message);
    console.error('❌ Stack:', error.stack);
    
    // En caso de error, retornar como no registrado para no bloquear el flujo
    return { 
      registered: false, 
      patient: null 
    };
  }
}

// ✅ NUEVA: Función para verificar conexión a la base de datos
async function testDatabaseConnection() {
  try {
    const count = await Patient.countDocuments();
    console.log(`✅ Conexión a BD exitosa. Total pacientes: ${count}`);
    return true;
  } catch (error) {
    console.error('❌ Error conectando a la base de datos:', error.message);
    return false;
  }
}

// ✅ NUEVA: Función para listar algunos pacientes (debugging)
async function listSamplePatients(limit = 3) {
  try {
    const patients = await Patient.find({}).limit(limit).exec();
    console.log('📋 Pacientes de muestra en BD:');
    patients.forEach((patient, index) => {
      console.log(`${index + 1}. DNI: ${patient.dni}, Nombre: ${patient.name}, Teléfono: ${patient.phone}`);
    });
    return patients;
  } catch (error) {
    console.error('❌ Error listando pacientes:', error.message);
    return [];
  }
}

module.exports = { 
  checkIfRegistered,
  testDatabaseConnection,
  listSamplePatients
};