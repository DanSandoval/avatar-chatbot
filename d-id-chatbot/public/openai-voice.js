// OpenAI Realtime Chat Integration (Unified Text and Voice)
class VoiceChat {
  constructor() {
    this.pc = null;
    this.dc = null;
    this.apiKey = null;
    this._isConnected = false;  // Internal property
    this.audioStream = null;
    this.silentStream = null;
  }

  async start(apiKey, requireAudio = true) {
    try {
      this.apiKey = apiKey;
      console.log('Starting realtime chat connection...');
      
      let stream;
      if (requireAudio) {
        // Get microphone permission for voice mode
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
        this.audioStream = stream;
      } else {
        // Create silent audio track for text-only mode
        stream = this.createSilentAudioStream();
        this.silentStream = stream;
      }
      
      // Setup WebRTC peer connection
      this.pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      });
      
      // Add audio track
      stream.getTracks().forEach(track => {
        this.pc.addTrack(track, stream);
      });
      
      // Create data channel for events
      this.dc = this.pc.createDataChannel('oai-events', {
        ordered: true
      });
      
      // Setup data channel handlers
      this.setupDataChannel();
      
      // Create offer
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      
      // Connect to OpenAI Realtime API
      const response = await fetch('https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/sdp'
        },
        body: offer.sdp
      });
      
      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }
      
      const answerSdp = await response.text();
      const answer = {
        type: 'answer',
        sdp: answerSdp
      };
      
      await this.pc.setRemoteDescription(answer);
      this._isConnected = true;
      console.log('Realtime chat connected successfully');
      
    } catch (error) {
      console.error('Failed to start realtime chat:', error);
      throw error;
    }
  }
  
  createSilentAudioStream() {
    // Create a silent audio stream for initial connection
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    // Set gain to 0 for silence
    gain.gain.value = 0;
    oscillator.connect(gain);
    
    const destination = audioContext.createMediaStreamDestination();
    gain.connect(destination);
    oscillator.start();
    
    return destination.stream;
  }
  
  setupDataChannel() {
    this.dc.onopen = () => {
      console.log('Data channel opened');
      
      // Get conversation history from chat display
      const conversationHistory = this.getConversationHistory();
      
      // Configure the session for paleontologist persona with context
      this.dc.send(JSON.stringify({
        type: 'session.update',
        session: {
          modalities: ['text', 'audio'],
          instructions: `You are Dr. Elias Grant, a friendly paleontologist at the Natural History Museum. 
            You love sharing fascinating facts about dinosaurs and prehistoric life with visitors.
            
            CRITICAL: Keep ALL responses to 1-2 short sentences maximum. Be conversational and natural.
            
            Always maintain your character as a knowledgeable but approachable museum guide.
            
            ${conversationHistory ? `Previous conversation context:\n${conversationHistory}` : ''}
            
            Remember what the visitor has asked about and build upon previous topics naturally.`,
          voice: 'alloy',
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500
          }
        }
      }));
    };
    
    this.dc.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleRealtimeMessage(msg);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };
    
    this.dc.onerror = (error) => {
      console.error('Data channel error:', error);
    };
    
    this.dc.onclose = () => {
      console.log('Data channel closed');
      if (window.handleVoiceDisconnected) {
        window.handleVoiceDisconnected();
      }
    };
  }
  
  handleRealtimeMessage(msg) {
    console.log('Realtime message:', msg.type);
    
    switch (msg.type) {
      // User speech transcription
      case 'conversation.item.created':
        if (msg.item && msg.item.role === 'user' && msg.item.content) {
          const userText = msg.item.content.find(c => c.type === 'input_text')?.text;
          if (userText && window.addMessage) {
            window.addMessage('user', userText);
          }
        }
        break;
      
      // When user starts speaking (interrupt avatar)
      case 'input_audio_buffer.speech_started':
        console.log('User started speaking');
        if (window.streamingClient && window.streamingClient.isSpeaking) {
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
        
      // AI response completed
      case 'response.done':
        // Also check for text in the response output
        if (msg.response && msg.response.output) {
          msg.response.output.forEach(output => {
            if (output.content) {
              output.content.forEach(content => {
                if (content.type === 'text' && content.text) {
                  console.log('AI text response:', content.text);
                  if (window.handleAIResponse) {
                    window.handleAIResponse(content.text);
                  }
                }
              });
            }
          });
        }
        break;
      
      // Handle interruptions
      case 'response.cancelled':
        console.log('Response cancelled due to interruption');
        if (window.streamingClient && window.streamingClient.isSpeaking) {
          window.streamingClient.stopSpeaking();
        }
        break;
        
      // Error handling
      case 'error':
        console.error('Realtime API error:', msg.error);
        if (window.addMessage) {
          window.addMessage('system', `Voice chat error: ${msg.error.message || 'Unknown error'}`);
        }
        break;
    }
  }
  
  // Send text message through data channel
  sendTextMessage(text) {
    if (!this._isConnected || !this.dc || this.dc.readyState !== 'open') {
      throw new Error('Realtime chat not connected');
    }
    
    // Create user message
    this.dc.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{
          type: 'input_text',
          text: text
        }]
      }
    }));
    
    // Trigger AI response
    this.dc.send(JSON.stringify({
      type: 'response.create',
      response: {
        modalities: ['text', 'audio']
      }
    }));
  }
  
  // Enable voice mode (replace silent stream with microphone)
  async enableVoice() {
    if (this.audioStream) {
      console.log('Voice already enabled');
      return;
    }
    
    try {
      // Get microphone permission
      const micStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      this.audioStream = micStream;
      
      // Replace the silent track with microphone track
      const sender = this.pc.getSenders().find(s => s.track && s.track.kind === 'audio');
      if (sender) {
        const micTrack = micStream.getAudioTracks()[0];
        await sender.replaceTrack(micTrack);
      }
      
      console.log('Voice mode enabled');
    } catch (error) {
      console.error('Failed to enable voice:', error);
      throw error;
    }
  }
  
  // Disable voice mode (replace microphone with silent stream)
  async disableVoice() {
    if (!this.audioStream) {
      console.log('Voice already disabled');
      return;
    }
    
    try {
      // Replace microphone track with silent track
      const sender = this.pc.getSenders().find(s => s.track && s.track.kind === 'audio');
      if (sender && this.silentStream) {
        const silentTrack = this.silentStream.getAudioTracks()[0];
        await sender.replaceTrack(silentTrack);
      }
      
      // Stop microphone tracks
      if (this.audioStream) {
        this.audioStream.getTracks().forEach(track => track.stop());
        this.audioStream = null;
      }
      
      console.log('Voice mode disabled');
    } catch (error) {
      console.error('Failed to disable voice:', error);
      throw error;
    }
  }
  
  stop() {
    console.log('Stopping realtime chat...');
    
    if (this.dc) {
      this.dc.close();
    }
    
    if (this.pc) {
      // Stop all tracks
      this.pc.getSenders().forEach(sender => {
        if (sender.track) {
          sender.track.stop();
        }
      });
      
      this.pc.close();
    }
    
    // Clean up audio streams
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
    }
    if (this.silentStream) {
      this.silentStream.getTracks().forEach(track => track.stop());
    }
    
    this.pc = null;
    this.dc = null;
    this._isConnected = false;
    
    console.log('Realtime chat stopped');
  }
  
  isConnected() {
    return this.pc && this.pc.connectionState === 'connected' && 
           this.dc && this.dc.readyState === 'open';
  }
  
  getConversationHistory() {
    // Get last 10 messages from chat history
    const messages = document.querySelectorAll('.message');
    const history = [];
    const recentMessages = Array.from(messages).slice(-10); // Last 10 messages
    
    recentMessages.forEach(msg => {
      const role = msg.classList.contains('user-message') ? 'Visitor' : 'Dr. Elias Grant';
      const text = msg.querySelector('p')?.textContent || msg.textContent;
      if (text) {
        history.push(`${role}: ${text}`);
      }
    });
    
    return history.join('\n');
  }
}

// Export for use in app.js
window.VoiceChat = VoiceChat;