const axios = require('axios');

async function testLangflow() {
  try {
    console.log('🧪 Testing Langflow connection...');
    
    const response = await axios.post(
      'http://localhost:7860/api/trigger-remediation', // Your Langflow endpoint
      {
        service_id: 'S1',
        trigger_source: 'test',
        timestamp: new Date().toISOString()
      },
      {
        timeout: 10000
      }
    );
    
    console.log('✅ Langflow is working!');
    console.log('Response:', response.data);
    
  } catch (error) {
    console.log('❌ Langflow connection failed:');
    
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${error.response.data?.error || 'No error details'}`);
    } else if (error.request) {
      console.log('   No response received from Langflow');
      console.log('   Make sure Langflow is running on port 7860');
    } else {
      console.log('   Error:', error.message);
    }
  }
}

testLangflow();