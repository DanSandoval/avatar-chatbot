const fetch = require('node-fetch');
require('dotenv').config();

async function checkSessions() {
  console.log('Checking active HeyGen sessions...\n');
  
  try {
    // First get access token
    const tokenResponse = await fetch('https://api.heygen.com/v1/streaming.create_token', {
      method: 'POST',
      headers: {
        'X-Api-Key': process.env.HEYGEN_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    
    if (!tokenResponse.ok) {
      console.log('Failed to get access token');
      return;
    }
    
    const tokenData = await tokenResponse.json();
    const token = tokenData.data.token;
    console.log('✅ Got access token\n');
    
    // List sessions
    const listResponse = await fetch('https://api.heygen.com/v1/streaming.list', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (listResponse.ok) {
      const data = await listResponse.json();
      console.log('Active sessions:', data);
      
      if (data.data && data.data.sessions) {
        console.log(`\nFound ${data.data.sessions.length} active sessions:`);
        data.data.sessions.forEach((session, i) => {
          console.log(`${i + 1}. Session ID: ${session.session_id}`);
          console.log(`   Created: ${new Date(session.created_at).toLocaleString()}`);
          console.log(`   Status: ${session.status}`);
        });
        
        // Offer to close all sessions
        console.log('\nTo close all sessions, run: node close-sessions.js');
      }
    } else {
      console.log('Failed to list sessions:', listResponse.status);
    }
  } catch (error) {
    console.log('Error:', error.message);
  }
}

checkSessions();