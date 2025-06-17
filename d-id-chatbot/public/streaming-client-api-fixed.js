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
let sessionId;
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
    
    // Override API settings with provided config
    if (config) {
      DID_API = {
        key: config.key,
        url: config.url || 'https://api.d-id.com',
        service: config.service || 'talks'
      };
      streamingServiceUrl = `${DID_API.url}/${DID_API.service}/streams`;
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

  async connect() {
    if (!DID_API || !DID_API.key) {
      throw new Error('API configuration not loaded');
    }
    
    if (DID_API.key === '🤫') {
      throw new Error('Please put your API key in the configuration');
    }

    if (peerConnection && peerConnection.connectionState === 'connected') {
      return;
    }

    stopAllStreams();
    closePC();

    const sessionResponse = await fetch(`${streamingServiceUrl}`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${DID_API.key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source_url: "https://create-images-results.d-id.com/DefaultPresenters/Emma_f/v1_image.jpeg",
        stream_warmup: true,
        driver_url: "bank://lively"
      })
    });

    const sessionData = await sessionResponse.json();
    
    if (!sessionResponse.ok) {
      throw new Error(`Failed to create stream: ${sessionData.message || sessionResponse.statusText}`);
    }

    streamId = sessionData.id;
    sessionId = sessionData.session_id;

    try {
      sessionClientAnswer = await this.createPeerConnection(
        sessionData.offer,
        sessionData.ice_servers
      );
    } catch (e) {
      console.error('Error during streaming setup', e);
      throw e;
    }

    const startResponse = await fetch(`${streamingServiceUrl}/${streamId}/sdp`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${DID_API.key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        answer: sessionClientAnswer,
        session_id: sessionId
      })
    });

    if (!startResponse.ok) {
      const errorData = await startResponse.json();
      throw new Error(`Failed to start stream: ${errorData.message || startResponse.statusText}`);
    }

    if (this.connectionStateChangeHandler) {
      this.connectionStateChangeHandler('connected');
    }
    
    // Start keepalive to prevent idle disconnection
    this.startKeepAlive();
  }
  
  startKeepAlive() {
    // Send a keepalive message every 20 seconds
    if (keepAliveInterval) {
      clearInterval(keepAliveInterval);
    }
    
    keepAliveInterval = setInterval(() => {
      if (peerConnection && peerConnection.connectionState === 'connected') {
        // Send empty speak request as keepalive
        console.log('Sending keepalive...');
        fetch(`${streamingServiceUrl}/${streamId}/keepalive`, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${DID_API.key}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ session_id: sessionId })
        }).catch(err => {
          console.log('Keepalive failed:', err.message);
        });
      }
    }, 20000); // Every 20 seconds
  }

  async speak(text) {
    if (!streamId) {
      throw new Error('No stream ID - not connected to streaming service');
    }
    
    if (!peerConnection || peerConnection.connectionState !== 'connected') {
      throw new Error('WebRTC not connected (state: ' + (peerConnection?.connectionState || 'no connection') + ')');
    }
    
    if (!isStreamReady) {
      console.log('Warning: Stream may not be ready yet (no stream/ready event received)');
      // Continue anyway as fallback
    }

    const talkResponse = await fetch(`${streamingServiceUrl}/${streamId}`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${DID_API.key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        script: {
          type: 'text',
          input: text,
          provider: {
            type: 'microsoft',
            voice_id: 'en-US-JennyNeural'
          }
        },
        driver_url: 'bank://lively',
        config: {
          stitch: true
        },
        session_id: sessionId
      })
    });

    if (!talkResponse.ok) {
      const errorData = await talkResponse.json();
      throw new Error(`Failed to speak: ${errorData.message || talkResponse.statusText}`);
    }
  }

  async disconnect() {
    if (!streamId) return;

    try {
      await fetch(`${streamingServiceUrl}/${streamId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Basic ${DID_API.key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ session_id: sessionId })
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

      peerConnection.addEventListener('iceconnectionstatechange', () => {
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

      peerConnection.addEventListener('icecandidate', (event) => {
        if (event.candidate) {
          console.log('New ICE candidate', event.candidate);
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
        
        channel.addEventListener('open', () => {
          console.log('Remote data channel opened');
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
  sessionId = null;
  sessionClientAnswer = null;
  isStreamReady = false;
  dataChannel = null;
}

// Export for use in other scripts
window.StreamingApiClient = StreamingApiClient;