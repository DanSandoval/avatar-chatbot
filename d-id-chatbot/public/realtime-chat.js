// Unified OpenAI Realtime API for both text and voice chat
class RealtimeChat {
  constructor() {
    this.pc = null;
    this.dc = null;
    this.apiKey = null;
    this.isConnected = false;
    this.isVoiceMode = false;
    this.audioStream = null;
  }

  async initialize(apiKey) {
    try {
      this.apiKey = apiKey;
      console.log('Initializing Realtime API connection...');
      
      // Setup WebRTC peer connection
      this.pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      });
      
      // Setup data channel first
      this.setupDataChannel();
      
      // Create offer and complete connection in one step
      await this.getOffer();
      
      return true;
    } catch (error) {
      console.error('Failed to initialize Realtime connection:', error);
      throw error;
    }
  }

  setupDataChannel() {
    // Create data channel
    this.dc = this.pc.createDataChannel('oai-events', {
      ordered: true
    });
    
    this.dc.addEventListener('open', () => {
      console.log('Realtime data channel opened');
      this.isConnected = true;
      this.configureSession();
    });
    
    this.dc.addEventListener('message', (e) => {
      this.handleRealtimeMessage(JSON.parse(e.data));
    });
    
    this.dc.addEventListener('close', () => {
      console.log('Realtime data channel closed');
      this.isConnected = false;
      if (window.handleVoiceDisconnected) {
        window.handleVoiceDisconnected();
      }
    });
  }

  async configureSession() {
    // Configure session with Dr. Elias Grant persona
    const sessionConfig = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: `You are Dr. Elias Grant, a friendly paleontologist at the Natural History Museum.
        
        CRITICAL RULES:
        1. Keep ALL responses to 1-2 short sentences maximum
        2. Be warm, enthusiastic, and conversational
        3. Remember previous topics in our conversation
        4. End responses with questions like "What's your favorite dinosaur?" or "Want to hear a cool fossil fact?"
        5. Build on what the visitor has already asked about`,
        voice: 'echo',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.7,
          prefix_padding_ms: 300,
          silence_duration_ms: 500
        },
        temperature: 0.7,
        max_response_output_tokens: 150
      }
    };
    
    this.sendMessage(sessionConfig);
  }

  // Send text message to the AI
  async sendTextMessage(text) {
    if (!this.isConnected) {
      throw new Error('Realtime API not connected');
    }
    
    const message = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{
          type: 'input_text',
          text: text
        }]
      }
    };
    
    this.sendMessage(message);
    
    // Trigger response generation
    this.sendMessage({
      type: 'response.create',
      response: {
        modalities: ['text', 'audio']
      }
    });
  }

  // Enable/disable voice mode
  async toggleVoiceMode(enabled) {
    if (enabled && !this.audioStream) {
      // Get microphone permission and add audio track
      this.audioStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      // Add audio track to peer connection
      this.audioStream.getTracks().forEach(track => {
        this.pc.addTrack(track, this.audioStream);
      });
    } else if (!enabled && this.audioStream) {
      // Stop audio tracks
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }
    
    this.isVoiceMode = enabled;
  }

  async getOffer() {
    // Create offer first
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    
    // Send to OpenAI using the working endpoint format
    const response = await fetch('https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/sdp'
      },
      body: offer.sdp
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI Realtime API error:', response.status, errorText);
      throw new Error(`Failed to get answer: ${response.statusText} - ${errorText}`);
    }
    
    // Get the answer SDP
    const answerSdp = await response.text();
    const answer = {
      type: 'answer',
      sdp: answerSdp
    };
    
    // Set remote description
    await this.pc.setRemoteDescription(answer);
    
    // Return the original offer for compatibility
    return offer;
  }

  async completeConnection(answer) {
    // Connection is already completed in getOffer()
    // This method is no longer needed but kept for compatibility
    console.log('Connection already established in getOffer()');
  }

  sendMessage(message) {
    if (this.dc && this.dc.readyState === 'open') {
      this.dc.send(JSON.stringify(message));
    }
  }

  handleRealtimeMessage(msg) {
    // Log all events for debugging
    console.log('Realtime message:', msg.type);
    
    switch (msg.type) {
      case 'error':
        console.error('Realtime error:', msg.error);
        break;
        
      case 'session.created':
      case 'session.updated':
        console.log('Session event:', msg);
        break;
      
      case 'input_audio_buffer.speech_started':
        console.log('User started speaking');
        if (window.streamingClient && window.streamingClient.stopSpeaking) {
          window.streamingClient.stopSpeaking();
        }
        break;
      
      // Audio transcript completed - this has the text we need!
      case 'response.audio_transcript.done':
        if (msg.transcript) {
          console.log('AI said:', msg.transcript);
          // Send text to avatar for lip-sync
          if (window.handleAIResponse) {
            window.handleAIResponse(msg.transcript);
          }
        }
        break;
        
      // Text response completed
      case 'response.text.done':
        if (msg.text) {
          console.log('AI text response:', msg.text);
          // Send text to avatar for lip-sync
          if (window.handleAIResponse) {
            window.handleAIResponse(msg.text);
          }
        }
        break;
        
      // Handle text content in response output
      case 'response.done':
        if (msg.response && msg.response.output) {
          msg.response.output.forEach(output => {
            if (output.type === 'message' && output.content) {
              output.content.forEach(content => {
                if (content.type === 'text' && content.text) {
                  console.log('AI response text:', content.text);
                  if (window.handleAIResponse) {
                    window.handleAIResponse(content.text);
                  }
                }
              });
            }
          });
        }
        break;
        
      // Handle audio playback
      case 'response.audio_delta':
        // In voice mode, OpenAI plays the audio directly
        // We don't need to handle it here
        break;
    }
  }

  async stop() {
    console.log('Stopping Realtime chat...');
    
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }
    
    if (this.dc) {
      this.dc.close();
    }
    
    if (this.pc) {
      this.pc.close();
    }
    
    this.isConnected = false;
    this.isVoiceMode = false;
  }
}

// Export for use in app.js
window.RealtimeChat = RealtimeChat;