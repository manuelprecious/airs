const axios = require('axios');

async function testBackendStatus() {
  console.log('🧪 Testing Backend Status Endpoints...\n');
  
  try {
    // Test basic backend health
    console.log('1. Testing backend health endpoint...');
    const healthResponse = await axios.get('http://localhost:5000/api/health');
    console.log('✅ Backend health:', healthResponse.data);
    
    // Test new system-status endpoint
    console.log('\n2. Testing system-status endpoint...');
    const statusResponse = await axios.get('http://localhost:5000/api/system-status');
    console.log('✅ System status response received');
    console.log('   Watchman running:', statusResponse.data.watchman.running);
    console.log('   Langflow connected:', statusResponse.data.langflow.connected);
    console.log('   Overall status:', statusResponse.data.overall_status);
    
    // Test status-health endpoint
    console.log('\n3. Testing status-health endpoint...');
    const statusHealth = await axios.get('http://localhost:5000/api/status-health');
    console.log('✅ Status health:', statusHealth.data);
    
    console.log('\n🎉 All backend endpoints working correctly!');
    
  } catch (error) {
    console.error('❌ Backend test failed:', error.message);
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response data:', error.response.data);
    }
  }
}

// Run the test
testBackendStatus();