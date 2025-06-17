// Simple test to check the API endpoint
async function testAPI() {
    console.log('Testing API endpoint...');
    
    try {
        // Test 1: Check if server is running
        const healthResponse = await fetch('http://localhost:3000/health');
        const healthData = await healthResponse.json();
        console.log('Health check:', healthData);
        
        // Test 2: Try creating a session without token
        console.log('\nTesting session creation without token...');
        const response1 = await fetch('http://localhost:3000/api/session/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        const data1 = await response1.json();
        console.log('Response (no token):', response1.status, data1);
        
        // Test 3: Try creating a session with a dummy token
        console.log('\nTesting session creation with dummy token...');
        const response2 = await fetch('http://localhost:3000/api/session/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: 'dummy-token-for-testing' })
        });
        const data2 = await response2.json();
        console.log('Response (dummy token):', response2.status, data2);
        
        // Test 4: Check what happens with no Content-Type header
        console.log('\nTesting without Content-Type header...');
        const response3 = await fetch('http://localhost:3000/api/session/create', {
            method: 'POST',
            body: JSON.stringify({ token: 'test' })
        });
        const data3 = await response3.text(); // Use text in case it's not JSON
        console.log('Response (no content-type):', response3.status, data3);
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

// Run the test
testAPI();