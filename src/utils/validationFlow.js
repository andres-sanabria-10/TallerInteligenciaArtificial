const Patient = require('../models/Patient');

async function checkIfRegistered(dni) {
  const patient = await Patient.findOne({ dni }).exec();
  return { registered: !!patient, patient };
}

module.exports = { checkIfRegistered };