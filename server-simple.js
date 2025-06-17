const express = require('express');
const expressWs = require('express-ws');
const cors = require('cors');
require('dotenv').config();

const app = express();
expressWs(app);
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString()
  });
});

// Simplified session creation (mock for testing)
app.post('/api/session/create', async (req, res) => {
  console.log('Creating mock session...');
  
  // Return mock session data
  res.json({
    sessionId: 'mock-session-123',
    url: 'wss://mock-avatar-url'
  });
});

// Mock WebSocket endpoint
app.ws('/api/chat', (ws, req) => {
  console.log('Client connected to chat');
  
  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      console.log('Received:', data);
      
      if (data.type === 'message') {
        // Echo back with mock response
        setTimeout(() => {
          ws.send(JSON.stringify({
            type: 'response',
            text: `Mock response to: "${data.text}"`
          }));
        }, 1000);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Simple server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log('\nNote: This is a simplified version without real API connections');
  console.log('HeyGen authentication is failing - check your API key');
});