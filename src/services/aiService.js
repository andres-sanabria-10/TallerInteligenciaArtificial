const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API, // asegúrate de tener esta variable en .env
});

const askAI = async (prompt) => {
  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'Eres un asistente odontológico profesional.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
    });

    return res.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI Error:', error.message);
    return null;
  }
};

module.exports = { askAI };
