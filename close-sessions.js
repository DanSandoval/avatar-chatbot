const fetch = require('node-fetch');
require('dotenv').config();

async function closeSessions() {
  console.log('Closing all HeyGen sessions...\n');
  
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
    
    // List sessions first
    const listResponse = await fetch('https://api.heygen.com/v1/streaming.list', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (listResponse.ok) {
      const data = await listResponse.json();
      
      if (data.data && data.data.sessions && data.data.sessions.length > 0) {
        console.log(`Found ${data.data.sessions.length} active sessions to close:\n`);
        
        // Close each session
        for (const session of data.data.sessions) {
          console.log(`Closing session ${session.session_id}...`);
          
          try {
            const closeResponse = await fetch('https://api.heygen.com/v1/streaming.stop', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                session_id: session.session_id
              })
            });
            
            if (closeResponse.ok) {
              console.log(`✅ Closed session ${session.session_id}`);
            } else {
              console.log(`❌ Failed to close session ${session.session_id}`);
            }
          } catch (err) {
            console.log(`❌ Error closing session ${session.session_id}:`, err.message);
          }
        }
        
        console.log('\nAll sessions closed!');
      } else {
        console.log('No active sessions found.');
      }
    } else {
      console.log('Failed to list sessions:', listResponse.status);
    }
  } catch (error) {
    console.log('Error:', error.message);
  }
}

closeSessions();