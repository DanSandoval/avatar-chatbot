const fetch = require('node-fetch');

class HeyGenService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.heygen.com/v1';
    this.sessions = new Map();
    this.accessToken = null;
  }

  async getAccessToken() {
    const response = await fetch(`${this.baseURL}/streaming.create_token`, {
      method: 'POST',
      headers: {
        'X-Api-Key': this.apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get access token: ${response.status}`);
    }

    const data = await response.json();
    this.accessToken = data.data.token;
    return this.accessToken;
  }

  async getAvatarList() {
    const response = await fetch(`${this.baseURL}/streaming_avatar.list`, {
      headers: {
        'X-Api-Key': this.apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get avatar list: ${response.status}`);
    }

    return response.json();
  }

  async createSession(avatarId = null) {
    // Get access token first
    if (!this.accessToken) {
      await this.getAccessToken();
    }

    // Use a default avatar ID if not specified
    if (!avatarId) {
      avatarId = 'josh_lite3_20230714'; // Public trial avatar
      console.log('Using default avatar:', avatarId);
    }

    const response = await fetch(`${this.baseURL}/streaming.new`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        quality: 'low', // Use low for testing
        avatar_name: avatarId
        // Don't specify voice, let HeyGen use the avatar's default
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create session: ${response.status} - ${error}`);
    }

    const sessionData = await response.json();
    console.log('Session created:', sessionData.data.session_id);
    
    // Store session data
    this.sessions.set(sessionData.data.session_id, {
      ...sessionData.data,
      created_at: Date.now()
    });

    return sessionData.data;
  }

  async startSession(sessionId) {
    const response = await fetch(`${this.baseURL}/streaming.start`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        session_id: sessionId
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to start session: ${response.status}`);
    }

    return response.json();
  }

  async sendTask(sessionId, text) {
    console.log(`Sending text to avatar: "${text}"`);
    
    const response = await fetch(`${this.baseURL}/streaming.task`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        session_id: sessionId,
        text: text,
        task_type: 'repeat', // Use 'repeat' as shown in SDK docs
        task_mode: 'sync'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send task: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async stopSession(sessionId) {
    const response = await fetch(`${this.baseURL}/streaming.stop`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        session_id: sessionId
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to stop session: ${response.status}`);
    }

    this.sessions.delete(sessionId);
    return response.json();
  }

  // Keep session alive with periodic pings
  startKeepAlive(sessionId, interval = 30000) {
    const keepAlive = setInterval(async () => {
      try {
        // Just log - don't send empty tasks
        console.log('Keep-alive check for session:', sessionId);
      } catch (error) {
        console.error('Keep-alive failed:', error);
        clearInterval(keepAlive);
      }
    }, interval);

    // Store interval ID for cleanup
    const session = this.sessions.get(sessionId);
    if (session) {
      session.keepAliveInterval = keepAlive;
    }

    return keepAlive;
  }

  stopKeepAlive(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session && session.keepAliveInterval) {
      clearInterval(session.keepAliveInterval);
    }
  }
}

module.exports = HeyGenService;