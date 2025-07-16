const fs = require('fs');
const fetch = require('node-fetch');

// Load D-ID API configuration
const config = JSON.parse(fs.readFileSync('./d-id-chatbot/api.json', 'utf8'));

async function testSDPExchange() {
    console.log('Testing D-ID SDP exchange...\n');
    
    try {
        // Step 1: Create stream
        console.log('1. Creating stream...');
        const streamData = {
            source_url: 'https://create-images-results.d-id.com/DefaultPresenters/Emma_f/v1_image.jpeg'
        };
        
        const createResponse = await fetch('https://api.d-id.com/talks/streams', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${config.key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(streamData)
        });
        
        if (!createResponse.ok) {
            const error = await createResponse.json();
            console.error('Failed to create stream:', error);
            return;
        }
        
        const streamInfo = await createResponse.json();
        console.log('Stream created:', streamInfo.id);
        console.log('Session ID:', streamInfo.session_id);
        
        // Check the offer SDP
        console.log('\n2. Checking SDP offer...');
        if (streamInfo.offer && streamInfo.offer.sdp) {
            const sdpLines = streamInfo.offer.sdp.split('\n');
            const hasDataChannel = sdpLines.some(line => 
                line.includes('m=application') || 
                line.includes('sctpmap') || 
                line.includes('webrtc-datachannel')
            );
            
            console.log('SDP has data channel:', hasDataChannel ? 'YES' : 'NO');
            
            // Look for specific media types
            const mediaTypes = sdpLines.filter(line => line.startsWith('m='));
            console.log('Media types in offer:', mediaTypes);
            
            // Save full SDP for analysis
            fs.writeFileSync('d-id-offer.sdp', streamInfo.offer.sdp);
            console.log('Full SDP saved to d-id-offer.sdp');
        }
        
        // Clean up
        console.log('\n3. Cleaning up stream...');
        const deleteResponse = await fetch(`https://api.d-id.com/talks/streams/${streamInfo.id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Basic ${config.key}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (deleteResponse.ok) {
            console.log('Stream deleted successfully');
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testSDPExchange();