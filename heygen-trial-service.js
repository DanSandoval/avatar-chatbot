// HeyGen service for trial mode - no API key required
class HeyGenTrialService {
  constructor() {
    this.sessions = new Map();
  }

  // Trial users get token from HeyGen website
  async createSession(trialToken) {
    console.log('Creating session with trial token');
    
    // Store session info
    const sessionId = `trial-${Date.now()}`;
    this.sessions.set(sessionId, {
      token: trialToken,
      created_at: Date.now()
    });

    return {
      sessionId: sessionId,
      token: trialToken
    };
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  removeSession(sessionId) {
    this.sessions.delete(sessionId);
  }
}

module.exports = HeyGenTrialService;