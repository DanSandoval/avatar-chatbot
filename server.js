const express = require('express');
const expressWs = require('express-ws');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const HeyGenService = require('./heygen-service');
const OpenAIRealtimeService = require('./openai-service');

const app = express();
expressWs(app);
const PORT = process.env.PORT || 3000;

// Initialize services
const heygenService = new HeyGenService(process.env.HEYGEN_API_KEY);
const openaiService = new OpenAIRealtimeService(process.env.OPENAI_API_KEY);

// Store active sessions
const activeSessions = new Map();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: {
      hasHeyGenKey: !!process.env.HEYGEN_API_KEY,
      hasOpenAIKey: !!process.env.OPENAI_API_KEY
    }
  });
});

// HeyGen endpoints
app.post('/api/session/create', async (req, res) => {
  try {
    const session = await heygenService.createSession();
    
    // Start session
    await heygenService.startSession(session.session_id);
    
    // Start keep-alive
    heygenService.startKeepAlive(session.session_id);
    
    // Track active session
    activeSessions.set(session.session_id, {
      created: Date.now(),
      heygenSession: session
    });
    
    res.json({
      sessionId: session.session_id,
      url: session.url
    });
  } catch (error) {
    console.error('Session creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/session/:sessionId/speak', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    const result = await heygenService.sendTask(sessionId, text);
    res.json(result);
  } catch (error) {
    console.error('Speak error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/session/:sessionId/stop', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    heygenService.stopKeepAlive(sessionId);
    const result = await heygenService.stopSession(sessionId);
    
    res.json(result);
  } catch (error) {
    console.error('Stop session error:', error);
    res.status(500).json({ error: error.message });
  }
});

// WebSocket endpoint for chat
app.ws('/api/chat', async (ws, req) => {
  console.log('Client connected to chat');
  
  // Get session ID from query params
  const sessionId = req.query.sessionId;
  if (!sessionId || !activeSessions.has(sessionId)) {
    ws.send(JSON.stringify({ error: 'Invalid session' }));
    ws.close();
    return;
  }
  
  ws.on('message', async (msg) => {
    try {
      const data = JSON.parse(msg);
      
      if (data.type === 'message') {
        console.log('User message:', data.text);
        
        // Send to OpenAI and get response
        openaiService.sendMessage(data.text, async (response) => {
          console.log('GPT response:', response);
          
          // Send response to frontend
          ws.send(JSON.stringify({
            type: 'response',
            text: response
          }));
          
          // Make avatar speak
          try {
            await heygenService.sendTask(sessionId, response);
          } catch (error) {
            console.error('Avatar speak error:', error);
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Failed to make avatar speak'
            }));
          }
        });
      }
    } catch (error) {
      console.error('WebSocket error:', error);
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: error.message 
      }));
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
  });
});


// Start server and connect to OpenAI
async function start() {
  try {
    // Connect to OpenAI
    await openaiService.connect();
    console.log('Connected to OpenAI Realtime API');
    
    // Start Express server
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();