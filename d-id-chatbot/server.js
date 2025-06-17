const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Import OpenAI
const OpenAI = require('openai');
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve D-ID client script from local copy
app.get('/streaming-client-api-fixed.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'streaming-client-api-fixed.js'));
});

// Serve API configuration file
app.get('/api.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'api.json'));
});

// Serve API configuration to client
app.get('/api/config', (req, res) => {
  const apiConfig = require('./api.json');
  // Don't send the API key to the client, only service info
  res.json({
    service: apiConfig.service,
    url: apiConfig.url,
    websocketUrl: apiConfig.websocketUrl
  });
});

// OpenAI chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    console.log('User message:', message);
    
    // Get response from OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a friendly assistant. Keep your responses concise and conversational." },
        { role: "user", content: message }
      ],
      max_tokens: 150 // Keep responses short for avatar
    });
    
    const response = completion.choices[0].message.content;
    console.log('AI response:', response);
    
    res.json({ response });
  } catch (error) {
    console.error('OpenAI error:', error);
    res.status(500).json({ error: 'Failed to get AI response' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 D-ID Chatbot Server running on http://localhost:${PORT}`);
  console.log('\n📝 Instructions:');
  console.log('1. Make sure the D-ID demo server is NOT running');
  console.log('2. Open http://localhost:3000 in your browser');
  console.log('3. Click "Connect" to start the avatar');
  console.log('4. Type messages to chat with the AI avatar\n');
});