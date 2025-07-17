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

// Serve OpenAI API key for voice chat
app.get('/api/openai-key', (req, res) => {
  if (process.env.OPENAI_API_KEY) {
    res.json({ key: process.env.OPENAI_API_KEY });
  } else {
    res.status(404).json({ error: 'OpenAI API key not configured' });
  }
});

// Store conversation history in memory (in production, use Redis or database)
const conversationHistory = new Map();

// OpenAI chat endpoint with conversation memory
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId = 'default' } = req.body;
    
    console.log('User message:', message);
    
    // Get or initialize conversation history for this session
    if (!conversationHistory.has(sessionId)) {
      conversationHistory.set(sessionId, [
        { 
          role: "system", 
          content: `You are Dr. Sarah Peterson, a friendly paleontologist at the Natural History Museum.
          
          CRITICAL RULES:
          1. Keep ALL responses to 1-2 short sentences maximum
          2. Be warm, enthusiastic, and conversational
          3. Remember previous topics in our conversation
          4. End responses with questions like "What's your favorite dinosaur?" or "Want to hear a cool fossil fact?"
          5. Build on what the visitor has already asked about`
        }
      ]);
    }
    
    const messages = conversationHistory.get(sessionId);
    
    // Add user message to history
    messages.push({ role: "user", content: message });
    
    // Keep only last 20 messages to avoid token limits
    if (messages.length > 20) {
      const systemMessage = messages[0];
      messages.splice(0, messages.length - 19);
      messages.unshift(systemMessage);
    }
    
    // Get response from OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: messages,
      max_tokens: 100, // Even shorter to ensure 1-2 sentences
      temperature: 0.7
    });
    
    const response = completion.choices[0].message.content;
    console.log('AI response:', response);
    
    // Add assistant response to history
    messages.push({ role: "assistant", content: response });
    
    res.json({ response });
  } catch (error) {
    console.error('OpenAI error:', error);
    res.status(500).json({ error: 'Failed to get AI response' });
  }
});

// Proxy D-ID stream creation to avoid CORS issues
app.post('/api/streams/create', async (req, res) => {
  try {
    const apiConfig = require('./api.json');
    const fetch = require('node-fetch');
    
    console.log('Stream creation request:', req.body);
    console.log('Using API key:', apiConfig.key ? 'Key present' : 'No key!');
    
    const response = await fetch('https://api.d-id.com/talks/streams', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${apiConfig.key}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(req.body)
    });
    
    // Get the raw text first to see what we're actually receiving
    const rawText = await response.text();
    console.log('Raw D-ID response:', rawText);
    
    // Parse it as JSON
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      console.error('Failed to parse D-ID response as JSON:', e);
      console.error('Raw response was:', rawText);
      return res.status(500).json({ error: 'Invalid response from D-ID API' });
    }
    
    if (!response.ok) {
      console.error('D-ID API error:', response.status, data);
      return res.status(response.status).json(data);
    }
    
    console.log('Stream created successfully:', data.id);
    console.log('Full D-ID response:', JSON.stringify(data, null, 2));
    
    // Check if session_id exists in the D-ID response
    if (!data.session_id) {
      console.error('WARNING: D-ID response missing session_id!');
      console.log('Response keys:', Object.keys(data));
    }
    
    // D-ID might be setting cookies that Express is picking up
    // Let's check the response headers
    console.log('D-ID Response headers:', [...response.headers.entries()]);
    
    res.json(data);
  } catch (error) {
    console.error('D-ID proxy error:', error);
    res.status(500).json({ error: 'Failed to create stream' });
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