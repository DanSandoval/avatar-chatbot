const fs = require('fs');
const fetch = require('node-fetch');

// Load D-ID API configuration
const config = JSON.parse(fs.readFileSync('./d-id-chatbot/api.json', 'utf8'));

async function testDIDConnection() {
    console.log('Testing D-ID API connection...\n');
    
    // Test 1: Basic API authentication
    console.log('1. Testing API authentication...');
    try {
        const response = await fetch('https://api.d-id.com/talks', {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${config.key}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`   Status: ${response.status}`);
        if (response.ok) {
            console.log('   ✅ API authentication successful');
        } else {
            const error = await response.json();
            console.log('   ❌ API authentication failed:', error);
        }
    } catch (error) {
        console.log('   ❌ Network error:', error.message);
    }
    
    // Test 2: Create a test stream
    console.log('\n2. Testing stream creation...');
    try {
        const streamData = {
            source_url: 'https://create-images-results.d-id.com/DefaultPresenters/Emma_f/v1_image.jpeg'
        };
        
        const response = await fetch('https://api.d-id.com/talks/streams', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${config.key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(streamData)
        });
        
        console.log(`   Status: ${response.status}`);
        const data = await response.json();
        
        if (response.ok) {
            console.log('   ✅ Stream created successfully');
            console.log('   Stream ID:', data.id);
            console.log('   Session ID:', data.session_id);
            console.log('   Full response:', JSON.stringify(data, null, 2));
            
            // Try to delete the stream
            if (data.id) {
                console.log('\n3. Cleaning up test stream...');
                const deleteResponse = await fetch(`https://api.d-id.com/talks/streams/${data.id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Basic ${config.key}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (deleteResponse.ok) {
                    console.log('   ✅ Test stream deleted');
                } else {
                    console.log('   ❌ Failed to delete test stream');
                }
            }
        } else {
            console.log('   ❌ Stream creation failed:', data);
        }
    } catch (error) {
        console.log('   ❌ Error:', error.message);
    }
    
    // Test 3: Check WebSocket connectivity
    console.log('\n4. WebSocket URL configured:', config.websocketUrl);
    console.log('\n💡 If stream creation works but WebRTC fails, the issue is likely:');
    console.log('   - Firewall blocking WebRTC/UDP traffic');
    console.log('   - Browser security settings');
    console.log('   - Network NAT traversal issues');
}

testDIDConnection();