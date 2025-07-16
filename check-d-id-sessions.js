const fs = require('fs');
const fetch = require('node-fetch');

// Load D-ID API configuration
const config = JSON.parse(fs.readFileSync('./d-id-chatbot/api.json', 'utf8'));

async function checkSessions() {
    console.log('Checking D-ID sessions...\n');
    
    try {
        const response = await fetch('https://api.d-id.com/talks/streams', {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${config.key}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`Status: ${response.status}`);
        const data = await response.text();
        
        try {
            const jsonData = JSON.parse(data);
            console.log('Response:', JSON.stringify(jsonData, null, 2));
        } catch {
            console.log('Response:', data);
        }
        
    } catch (error) {
        console.log('Error:', error.message);
    }
}

checkSessions();