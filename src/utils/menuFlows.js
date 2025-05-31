function showMainMenu() {
  return {
    type: 'interactive',
    body: '🦷 Menú Principal\n¿Qué deseas hacer?',
    buttons: [
      { id: '1', title: '📅 Agendar Cita' },
      { id: '2', title: '🔍 Consultar Datos' },
      { id: '3', title: '📋 Historial de Citas' },
      { id: '4', title: '🚪 Volver al inicio' }
    ]
  };
}

function formatResponseForCli(response) {
  if (typeof response === 'string') return response;

  let text = response.body + '\n\n';

  if (response.buttons && Array.isArray(response.buttons)) {
    text += '👆 Opciones disponibles:\n';
    response.buttons.forEach((button, index) => {
      text += `${index + 1}. ${button.title}\n`;
    });
    text += '\n💬 Responde con el número de tu opción.';
  }

  return text;
}

module.exports = {
  showMainMenu,
  formatResponseForCli
};