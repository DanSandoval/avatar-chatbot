const WebSocket = require('ws');

class OpenAIRealtimeService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.ws = null;
    this.responseCallback = null;
    this.textBuffer = '';
  }

  connect() {
    return new Promise((resolve, reject) => {
      const url = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01';
      console.log('Connecting to OpenAI Realtime API...');
      
      this.ws = new WebSocket(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      });

      this.ws.on('open', () => {
        console.log('Connected to OpenAI Realtime API');
        
        // Configure session
        this.ws.send(JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['text'],
            instructions: 'You are a helpful assistant. Keep your responses concise and friendly.'
          }
        }));
        
        resolve();
      });

      this.ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);
      });

      this.ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      });

      this.ws.on('close', () => {
        console.log('Disconnected from OpenAI');
      });

      // Add timeout
      setTimeout(() => {
        if (this.ws.readyState !== WebSocket.OPEN) {
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
  }

  handleMessage(message) {
    switch (message.type) {
      case 'response.text.delta':
        if (message.delta) {
          this.textBuffer += message.delta;
        }
        break;
        
      case 'response.text.done':
        if (this.responseCallback && this.textBuffer) {
          // Send complete response
          this.responseCallback(this.textBuffer);
          this.textBuffer = '';
        }
        break;
        
      case 'error':
        console.error('OpenAI error:', message.error);
        break;
    }
  }

  sendMessage(text, onResponse) {
    this.responseCallback = onResponse;
    this.textBuffer = '';
    
    // Create conversation item
    this.ws.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: text
          }
        ]
      }
    }));
    
    // Request response
    this.ws.send(JSON.stringify({
      type: 'response.create'
    }));
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

module.exports = OpenAIRealtimeService;