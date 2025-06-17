const express = require('express');
const expressWs = require('express-ws');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const HeyGenTrialService = require('./heygen-trial-service');
const OpenAIRealtimeService = require('./openai-service');

const app = express();
expressWs(app);
const PORT = process.env.PORT || 3000;

// Initialize services
const heygenService = new HeyGenTrialService();
const openaiService = new OpenAIRealtimeService(process.env.OPENAI_API_KEY);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    mode: 'trial',
    timestamp: new Date().toISOString()
  });
});

// Trial session creation - token comes from frontend
app.post('/api/session/create', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ 
        error: 'Trial token required. Get one from https://app.heygen.com/streaming-avatar' 
      });
    }
    
    const session = await heygenService.createSession(token);
    
    res.json({
      sessionId: session.sessionId,
      token: session.token,
      mode: 'trial'
    });
  } catch (error) {
    console.error('Session creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// WebSocket for chat
app.ws('/api/chat', async (ws, req) => {
  console.log('Client connected to chat');
  
  const sessionId = req.query.sessionId;
  const session = heygenService.getSession(sessionId);
  
  if (!session) {
    ws.send(JSON.stringify({ error: 'Invalid session' }));
    ws.close();
    return;
  }
  
  ws.on('message', async (msg) => {
    try {
      const data = JSON.parse(msg);
      
      if (data.type === 'message') {
        console.log('User message:', data.text);
        
        // Send to OpenAI
        openaiService.sendMessage(data.text, async (response) => {
          console.log('GPT response:', response);
          
          // Send response back to frontend
          ws.send(JSON.stringify({
            type: 'response',
            text: response
          }));
          
          // Frontend will handle making avatar speak using SDK
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

// Serve trial-specific HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'trial.html'));
});

// Start server and connect to OpenAI
async function start() {
  try {
    await openaiService.connect();
    console.log('Connected to OpenAI Realtime API');
    
    app.listen(PORT, () => {
      console.log(`\n🚀 Trial Mode Server running on http://localhost:${PORT}`);
      console.log('\n📝 Instructions:');
      console.log('1. Go to https://app.heygen.com/streaming-avatar');
      console.log('2. Click "Try Now" to get a trial token');
      console.log('3. Copy the token and paste it in the app');
      console.log('4. Start chatting!\n');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    console.log('\nStarting without OpenAI connection...');
    
    app.listen(PORT, () => {
      console.log(`\n🚀 Trial Mode Server running on http://localhost:${PORT}`);
      console.log('⚠️  OpenAI connection failed - chat responses will not work');
    });
  }
}

start();