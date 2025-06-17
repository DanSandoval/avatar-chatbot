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
app.use('/node_modules', express.static('public/node_modules'));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    hasHeyGenKey: !!process.env.HEYGEN_API_KEY,
    hasOpenAIKey: !!process.env.OPENAI_API_KEY
  });
});

// Cleanup endpoint to close old sessions
app.post('/api/session/cleanup', async (req, res) => {
  try {
    console.log('Cleaning up old sessions...');
    
    // Close any sessions older than 5 minutes
    const now = Date.now();
    for (const [sessionId, session] of activeSessions.entries()) {
      if (now - session.created > 5 * 60 * 1000) {
        try {
          await heygenService.stopSession(sessionId);
          activeSessions.delete(sessionId);
          console.log('Closed old session:', sessionId);
        } catch (err) {
          console.log('Failed to close session:', sessionId, err.message);
        }
      }
    }
    
    res.json({ cleaned: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create session - backend handles token exchange
app.post('/api/session/create', async (req, res) => {
  try {
    console.log('Creating HeyGen session...');
    
    // Get session token from API key
    await heygenService.getAccessToken();
    
    // Create session
    const session = await heygenService.createSession();
    
    // Skip the start session step - it might not be needed
    // await heygenService.startSession(session.session_id);
    
    // Start keep-alive
    heygenService.startKeepAlive(session.session_id);
    
    // Track active session
    activeSessions.set(session.session_id, {
      created: Date.now(),
      heygenSession: session
    });
    
    res.json({
      sessionId: session.session_id,
      url: session.url,
      token: heygenService.accessToken // Send token to frontend for SDK
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
        
        // Send to OpenAI
        openaiService.sendMessage(data.text, async (response) => {
          console.log('GPT response:', response);
          
          // Send response to frontend
          ws.send(JSON.stringify({
            type: 'response',
            text: response
          }));
          
          // Frontend will handle making avatar speak
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

// Start server
async function start() {
  try {
    // Test HeyGen API key
    console.log('Testing HeyGen API...');
    const testToken = await heygenService.getAccessToken();
    console.log('✅ HeyGen API key is valid!');
    
    // Connect to OpenAI
    await openaiService.connect();
    console.log('✅ Connected to OpenAI Realtime API');
    
    app.listen(PORT, () => {
      console.log(`\n🚀 Server running on http://localhost:${PORT}`);
      console.log('\n📝 Instructions:');
      console.log('1. Open http://localhost:3000');
      console.log('2. Click "Start Avatar Session"');
      console.log('3. Wait for avatar to appear');
      console.log('4. Start chatting!\n');
    });
  } catch (error) {
    console.error('❌ Failed to start:', error.message);
    
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      console.log('\n⚠️  HeyGen API key issue:');
      console.log('1. Go to https://app.heygen.com/settings');
      console.log('2. Click on "Subscriptions & API" tab');
      console.log('3. Select "HeyGen API" (not HeyGen App)');
      console.log('4. Copy your API Token');
      console.log('5. Update it in .env file\n');
    }
    
    process.exit(1);
  }
}

start();