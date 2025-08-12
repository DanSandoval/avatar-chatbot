'use strict';

// We'll load the API configuration differently to avoid top-level await
let DID_API = null;

const RTCPeerConnection = (
  window.RTCPeerConnection ||
  window.webkitRTCPeerConnection ||
  window.mozRTCPeerConnection
).bind(window);

let peerConnection;
let streamId;
let didSessionId;
let sessionClientAnswer;
let statsIntervalId;
let videoIsPlaying;
let lastBytesReceived;
let streamingServiceUrl = 'https://api.d-id.com/talks/streams';
let isStreamReady = false;
let dataChannel = null;
let keepAliveInterval = null;

const videoElement = document.getElementById('talk-video');
videoElement.setAttribute('playsinline', '');

class StreamingApiClient {
  constructor(config, videoElement) {
    this.videoElement = videoElement || document.getElementById('talk-video');
    this.configuration = config;
    this.avatarUrl = null; // Will be set when connecting
    this.encodedApiKey = null; // Will store base64 encoded API key
    
    // Override API settings with provided config
    if (config) {
      DID_API = {
        key: config.key,
        url: config.url || 'https://api.d-id.com',
        service: config.service || 'talks'
      };
      streamingServiceUrl = `${DID_API.url}/${DID_API.service}/streams`;
      // Use API key directly without base64 encoding (per D-ID docs)
      this.encodedApiKey = config.key;
    }
    
    this.connectionStateChangeHandler = null;
    this.streamReadyHandler = null;
  }

  setConnectionStateChangeHandler(handler) {
    this.connectionStateChangeHandler = handler;
  }

  setStreamReadyHandler(handler) {
    this.streamReadyHandler = handler;
  }
  
  get isStreamReady() {
    return isStreamReady;
  }

  async connect(avatarUrl = null) {
    if (!DID_API || !DID_API.key) {
      throw new Error('API configuration not loaded');
    }
    
    if (DID_API.key === '🤫') {
      throw new Error('Please put your API key in the configuration');
    }

    if (peerConnection && peerConnection.connectionState === 'connected') {
      return;
    }

    // Use provided avatar URL or default to Dr. Henry Grant
    this.avatarUrl = avatarUrl || "https://sdmntprwestus2.oaiusercontent.com/files/00000000-c1cc-61f8-b1c1-32e18ac16218/raw?se=2025-07-17T16%3A30%3A35Z&sp=r&sv=2024-08-04&sr=b&scid=d4fc66ab-44d0-56bd-95bc-42cd3eedc052&skoid=bbd22fc4-f881-4ea4-b2f3-c12033cf6a8b&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2025-07-17T04%3A22%3A34Z&ske=2025-07-18T04%3A22%3A34Z&sks=b&skv=2024-08-04&sig=pqgQbo5Z3plvJOt0ecrbGmAvaBMI23K0aHXUX/7UVyg%3D";

    stopAllStreams();
    closePC();

    console.log('Creating stream with:', {
      avatarUrl: this.avatarUrl
    });
    
    // Use our proxy to avoid CORS issues
    const sessionResponse = await fetch('/api/streams/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        source_url: this.avatarUrl
      })
    }).catch(err => {
      console.error('Fetch error:', err);
      throw new Error('Network error: ' + err.message);
    });
    
    // Debug the raw response
    console.log('Proxy response status:', sessionResponse.status);
    console.log('Proxy response headers:', [...sessionResponse.headers.entries()]);

    let sessionData;
    try {
      sessionData = await sessionResponse.json();
    } catch (e) {
      console.error('Failed to parse response:', e);
      throw new Error(`Stream creation failed with status ${sessionResponse.status}`);
    }
    
    if (!sessionResponse.ok) {
      console.error('Stream creation failed:', sessionData);
      let errorMsg = 'Failed to create stream';
      
      if (sessionData.description) {
        errorMsg += ': ' + sessionData.description;
      } else if (sessionData.message) {
        errorMsg += ': ' + sessionData.message;
      }
      
      // Add helpful message for common errors
      if (errorMsg.includes('cannot download image')) {
        errorMsg += '. Please check that the image URL is valid and accessible.';
      } else if (sessionData.kind === 'InternalServerError' && errorMsg.includes('Stream Error')) {
        errorMsg = 'Failed to create avatar. This usually means the image does not contain a detectable human face. Please use a photo with a clear, front-facing human face.';
      }
      
      throw new Error(errorMsg);
    }

    // Extract session data
    streamId = sessionData.id;
    
    // D-ID API bug: session_id field contains AWS load balancer cookies
    // We'll try to work without it
    didSessionId = sessionData.session_id;
    
    console.log('Session created:', { 
      streamId, 
      didSessionId,
      fullSessionData: sessionData
    });
    
    // D-ID API returns cookies in session_id field - we'll use it as-is
    console.log('Using session_id as provided by D-ID:', didSessionId ? 'Present' : 'Missing');

    try {
      sessionClientAnswer = await this.createPeerConnection(
        sessionData.offer,
        sessionData.ice_servers
      );
    } catch (e) {
      console.error('Error during streaming setup', e);
      throw e;
    }
    
    // Send initial ICE configuration (for idle stream)
    try {
      const iceResponse = await fetch(`${streamingServiceUrl}/${streamId}/ice`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${this.encodedApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(
          didSessionId ? { session_id: didSessionId } : {}
        )
      });
      
      if (!iceResponse.ok) {
        const errorText = await iceResponse.text();
        console.error('Initial ICE config failed:', iceResponse.status, errorText);
      }
    } catch (error) {
      console.error('Error sending initial ICE config:', error);
    }

    const startResponse = await fetch(`${streamingServiceUrl}/${streamId}/sdp`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${this.encodedApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        answer: sessionClientAnswer,
        ...(didSessionId && { session_id: didSessionId })
      })
    });

    if (!startResponse.ok) {
      let errorMessage = `Status: ${startResponse.status}`;
      try {
        const errorData = await startResponse.json();
        console.error('SDP submission failed:', errorData);
        errorMessage = errorData.message || errorData.description || startResponse.statusText;
      } catch (e) {
        const errorText = await startResponse.text();
        console.error('SDP submission failed (raw):', errorText);
      }
      throw new Error(`Failed to start stream: ${errorMessage}`);
    }

    if (this.connectionStateChangeHandler) {
      this.connectionStateChangeHandler('connected');
    }
    
    // Start keepalive to prevent idle disconnection
    this.startKeepAlive();
  }
  
  startKeepAlive() {
    // Monitor connection and restart if needed
    if (keepAliveInterval) {
      clearInterval(keepAliveInterval);
    }
    
    let lastActivity = Date.now();
    
    // Update last activity on any speak
    this._originalSpeak = this.speak.bind(this);
    this.speak = async (text) => {
      lastActivity = Date.now();
      return this._originalSpeak(text);
    };
    
    keepAliveInterval = setInterval(() => {
      if (peerConnection) {
        const timeSinceActivity = Date.now() - lastActivity;
        console.log(`Connection state: ${peerConnection.connectionState}, time since activity: ${Math.floor(timeSinceActivity/1000)}s`);
        
        // If disconnected or failed, notify handler
        if (peerConnection.connectionState === 'disconnected' || 
            peerConnection.connectionState === 'failed' ||
            peerConnection.connectionState === 'closed') {
          console.log('Connection lost, notifying handler');
          if (this.connectionStateChangeHandler) {
            this.connectionStateChangeHandler(peerConnection.connectionState);
          }
          clearInterval(keepAliveInterval);
          keepAliveInterval = null;
        }
      }
    }, 5000); // Check every 5 seconds
  }

  async speak(text) {
    if (!streamId) {
      throw new Error('No stream ID - not connected to streaming service');
    }
    
    // Allow speaking if either connectionState OR iceConnectionState is connected
    if (!peerConnection || (peerConnection.connectionState !== 'connected' && peerConnection.iceConnectionState !== 'connected')) {
      throw new Error('WebRTC not connected (connectionState: ' + (peerConnection?.connectionState || 'no connection') + ', iceConnectionState: ' + (peerConnection?.iceConnectionState || 'no connection') + ')');
    }
    
    if (!isStreamReady) {
      console.log('Warning: Stream may not be ready yet (no stream/ready event received)');
      // Continue anyway as fallback
    }
    
    console.log('Speak request details:', { 
      streamId, 
      didSessionId, 
      didSessionIdType: typeof didSessionId,
      text: text.substring(0, 50) + '...' 
    });

    const talkResponse = await fetch(`${streamingServiceUrl}/${streamId}`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${this.encodedApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        script: {
          type: 'text',
          input: text,
          provider: {
            type: 'microsoft',
            voice_id: 'en-US-AndrewMultilingualNeural'  // Friendly younger male voice, good for Dr. Dino
          }
        },
        driver_url: 'bank://lively',
        config: {
          stitch: true
        },
        ...(didSessionId && { session_id: didSessionId })
      })
    });

    if (!talkResponse.ok) {
      let errorMessage = `Status: ${talkResponse.status}`;
      try {
        const errorData = await talkResponse.json();
        console.error('D-ID speak error details:', {
          status: talkResponse.status,
          statusText: talkResponse.statusText,
          error: errorData,
          streamId: streamId,
          didSessionId: didSessionId
        });
        errorMessage = errorData.message || errorData.error || talkResponse.statusText;
      } catch (e) {
        console.error('Could not parse error response');
      }
      throw new Error(`Failed to speak: ${errorMessage}`);
    }
  }

  async disconnect() {
    if (!streamId) return;

    try {
      await fetch(`${streamingServiceUrl}/${streamId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Basic ${this.encodedApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(
          didSessionId ? { session_id: didSessionId } : {}
        )
      });

      stopAllStreams();
      closePC();
      
      // Stop keepalive
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
      }
      
      if (this.connectionStateChangeHandler) {
        this.connectionStateChangeHandler('disconnected');
      }
    } catch (err) {
      console.error('Error closing stream', err);
    }
  }

  async createPeerConnection(offer, iceServers) {
    if (!peerConnection) {
      peerConnection = new RTCPeerConnection({ iceServers });
      
      // Don't create our own data channel - D-ID creates it
      
      // Store reference to this for use in event listeners
      const self = this;

      // Listen for both connection state changes
      peerConnection.addEventListener('connectionstatechange', () => {
        console.log(`Connection state changed: ${peerConnection.connectionState}, ICE state: ${peerConnection.iceConnectionState}`);
      });
      
      peerConnection.addEventListener('iceconnectionstatechange', () => {
        console.log(`ICE connection state changed: ${peerConnection.iceConnectionState}, Connection state: ${peerConnection.connectionState}`);
        if (this.connectionStateChangeHandler) {
          this.connectionStateChangeHandler(peerConnection.iceConnectionState);
        }
        
        // Fallback: force stream ready after 5 seconds if event not received
        if (peerConnection.iceConnectionState === 'connected' && !isStreamReady) {
          setTimeout(() => {
            if (!isStreamReady) {
              console.log('Forcing stream ready (fallback)');
              isStreamReady = true;
              if (this.streamReadyHandler) {
                this.streamReadyHandler();
              }
            }
          }, 5000);
        }
      });

      peerConnection.addEventListener('icecandidate', async (event) => {
        if (event.candidate) {
          console.log('New ICE candidate', event.candidate);
          
          // Send ICE candidate to D-ID
          try {
            const response = await fetch(`${streamingServiceUrl}/${streamId}/ice`, {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${self.encodedApiKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                candidate: event.candidate.candidate,
                sdpMid: event.candidate.sdpMid,
                sdpMLineIndex: event.candidate.sdpMLineIndex,
                ...(didSessionId && { session_id: didSessionId })
              })
            });
            
            if (!response.ok) {
              const errorText = await response.text();
              console.error('Failed to submit ICE candidate:', response.status, errorText);
            }
          } catch (error) {
            console.error('Error submitting ICE candidate:', error);
          }
        }
      });

      // Track if video has been set to avoid duplicates
      let videoSet = false;
      peerConnection.addEventListener('track', (event) => {
        if (!videoSet && event.streams && event.streams[0]) {
          const remoteStream = event.streams[0];
          setVideoElement(remoteStream, this.videoElement);
          videoSet = true;
        }
      });
      
      // Listen for data channel from remote peer
      peerConnection.addEventListener('datachannel', (event) => {
        const channel = event.channel;
        console.log('Received data channel:', channel.label);
        
        // Store the data channel globally
        dataChannel = channel;
        
        channel.addEventListener('open', () => {
          console.log('Remote data channel opened');
          // Also mark stream ready when data channel opens
          isStreamReady = true;
        });
        
        channel.addEventListener('message', (event) => {
          const [eventType, _] = event.data.split(':');
          console.log('Stream event from remote:', eventType);
          
          if (eventType === 'stream/ready') {
            console.log('Stream is ready!');
            setTimeout(() => {
              isStreamReady = true;
              if (this.streamReadyHandler) {
                this.streamReadyHandler();
              }
            }, 1000); // 1 second delay for synchronization
          }
        });
      });
    }

    await peerConnection.setRemoteDescription(offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    return answer;
  }
}

function setVideoElement(stream, videoElement) {
  if (!stream || !videoElement) {
    console.error('Missing stream or video element');
    return;
  }
  
  console.log('Setting video stream, tracks:', stream.getTracks());
  
  // Set video attributes for autoplay
  videoElement.setAttribute('playsinline', '');
  videoElement.muted = true; // Mute initially to allow autoplay
  videoElement.srcObject = stream;
  videoElement.loop = false;

  // Add event listeners to debug video state
  videoElement.addEventListener('loadedmetadata', () => {
    console.log('Video metadata loaded, dimensions:', videoElement.videoWidth, 'x', videoElement.videoHeight);
  });
  
  videoElement.addEventListener('playing', () => {
    console.log('Video is playing');
  });

  // Play video when user interacts
  const playVideo = async () => {
    try {
      await videoElement.play();
      console.log('Video play() called successfully');
      // Unmute after playing starts
      setTimeout(() => {
        videoElement.muted = false;
        console.log('Video unmuted');
      }, 100);
    } catch (e) {
      if (e.name === 'NotAllowedError') {
        console.log('Autoplay blocked, waiting for user interaction');
      } else {
        console.error('Error playing video', e);
      }
    }
  };

  playVideo();
}

function stopAllStreams() {
  if (videoElement && videoElement.srcObject) {
    videoElement.srcObject.getTracks().forEach((track) => track.stop());
    videoElement.srcObject = null;
  }
}

function closePC() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  if (statsIntervalId) {
    clearInterval(statsIntervalId);
    statsIntervalId = null;
  }

  videoIsPlaying = false;
  streamId = null;
  didSessionId = null;
  sessionClientAnswer = null;
  isStreamReady = false;
  dataChannel = null;
}

// Export for use in other scripts
window.StreamingApiClient = StreamingApiClient;