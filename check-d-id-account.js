const fs = require('fs');
const fetch = require('node-fetch');

// Load D-ID API configuration
const config = JSON.parse(fs.readFileSync('./d-id-chatbot/api.json', 'utf8'));

async function checkAccount() {
    console.log('Checking D-ID account and limits...\n');
    
    // Decode the API key to show the email
    const [email, password] = Buffer.from(config.key, 'base64').toString().split(':');
    console.log('Account email:', email);
    console.log('API key (partial):', password.substring(0, 8) + '...\n');
    
    // Test different endpoints
    const endpoints = [
        '/credits',
        '/credits/balance',
        '/talks',
        '/talks/streams',
        '/limits',
        '/account',
        '/user',
        '/actors'
    ];
    
    for (const endpoint of endpoints) {
        try {
            console.log(`Testing ${endpoint}...`);
            const response = await fetch(`https://api.d-id.com${endpoint}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${config.key}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log(`  Status: ${response.status}`);
            if (response.ok) {
                const data = await response.json();
                console.log(`  ✅ Success:`, JSON.stringify(data, null, 2));
            } else if (response.status === 404) {
                console.log(`  ⚠️  Endpoint not found`);
            } else {
                const error = await response.json().catch(() => response.statusText);
                console.log(`  ❌ Error:`, error);
            }
        } catch (error) {
            console.log(`  ❌ Network error:`, error.message);
        }
        console.log('');
    }
    
    console.log('\n💡 Next steps:');
    console.log('1. Log into https://studio.d-id.com');
    console.log('2. Check your credits/usage');
    console.log('3. Look for any active sessions');
    console.log('4. Try generating a fresh API key');
    console.log('5. Make sure your account has API access enabled');
}

checkAccount();