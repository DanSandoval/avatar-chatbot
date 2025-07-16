const fs = require('fs');
const fetch = require('node-fetch');

// Load D-ID API configuration
const config = JSON.parse(fs.readFileSync('./d-id-chatbot/api.json', 'utf8'));

async function closeDIDSessions() {
    console.log('Checking for active D-ID sessions...');
    
    try {
        // Try to get list of active streams
        const response = await fetch(`${config.url}/talks`, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${config.key}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const error = await response.json();
            console.log('❌ Failed to list sessions:', response.status, error);
            
            if (response.status === 403) {
                console.log('\n💡 This might be an account limit issue. Check:');
                console.log('   - Your D-ID account plan and session limits');
                console.log('   - If you need to upgrade your account');
                console.log('   - Contact D-ID support if sessions are truly stuck');
            }
            return;
        }

        const sessions = await response.json();
        console.log(`📊 Found ${sessions.length || 0} active sessions`);

        if (sessions && sessions.length > 0) {
            console.log('🔄 Attempting to close sessions...');
            
            for (const session of sessions) {
                try {
                    const deleteResponse = await fetch(`${config.url}/talks/streams/${session.id}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Basic ${config.key}`,
                            'Content-Type': 'application/json'
                        }
                    });

                    if (deleteResponse.ok) {
                        console.log(`✅ Closed session: ${session.id}`);
                    } else {
                        console.log(`❌ Failed to close session ${session.id}:`, deleteResponse.status);
                    }
                } catch (error) {
                    console.log(`❌ Error closing session ${session.id}:`, error.message);
                }
            }
        } else {
            console.log('✅ No active sessions found');
            console.log('\n💡 If you\'re still getting "Max sessions reached", this might be:');
            console.log('   - Account plan limits (check your D-ID dashboard)');
            console.log('   - Server-side issue with D-ID');
            console.log('   - Try creating a new API key in your D-ID account');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

closeDIDSessions();