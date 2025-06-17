const fetch = require('node-fetch');
require('dotenv').config();

async function testHeyGenAPI() {
  console.log('Testing HeyGen API...');
  try {
    const response = await fetch('https://api.heygen.com/v1/avatar.list', {
      headers: {
        'x-api-key': process.env.HEYGEN_API_KEY
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ HeyGen API working!');
      console.log('Available avatars:', data.avatars?.length || 0);
      if (data.avatars?.length > 0) {
        console.log('First avatar ID:', data.avatars[0].avatar_id);
      }
    } else {
      console.log('❌ HeyGen API error:', response.status, response.statusText);
    }
  } catch (error) {
    console.log('❌ HeyGen API error:', error.message);
  }
}

async function testOpenAIAPI() {
  console.log('\nTesting OpenAI API...');
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ OpenAI API working!');
      const realtimeModel = data.data?.find(m => m.id.includes('realtime'));
      if (realtimeModel) {
        console.log('Realtime model found:', realtimeModel.id);
      }
    } else {
      console.log('❌ OpenAI API error:', response.status, response.statusText);
    }
  } catch (error) {
    console.log('❌ OpenAI API error:', error.message);
  }
}

async function runTests() {
  console.log('API Test Script\n');
  
  if (!process.env.HEYGEN_API_KEY || process.env.HEYGEN_API_KEY === 'your_heygen_api_key_here') {
    console.log('⚠️  Please add your HeyGen API key to .env file');
  } else {
    await testHeyGenAPI();
  }
  
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
    console.log('⚠️  Please add your OpenAI API key to .env file');
  } else {
    await testOpenAIAPI();
  }
}

runTests();