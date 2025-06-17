const fetch = require('node-fetch');
require('dotenv').config();

async function testTokenCreation() {
  console.log('Testing HeyGen token creation...');
  
  try {
    const response = await fetch('https://api.heygen.com/v1/streaming.create_token', {
      method: 'POST',
      headers: {
        'X-Api-Key': process.env.HEYGEN_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    
    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (response.ok && data.data?.token) {
      console.log('✅ Token created successfully!');
      console.log('Token:', data.data.token);
    } else {
      console.log('❌ Failed to create token');
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

testTokenCreation();