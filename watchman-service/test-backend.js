const axios = require('axios');

async function testBackend() {
  try {
    console.log('🧪 Testing backend connection...');
    
    const response = await axios.get('http://localhost:5000/api/services', {
      timeout: 5000
    });
    
    console.log('✅ Backend is running!');
    console.log(`📊 Found ${response.data.length} services:`);
    
    response.data.forEach(service => {
      console.log(`   - ${service.name} (${service.id}): ${service.status}`);
    });
    
  } catch (error) {
    console.log('❌ Backend connection failed:');
    
    if (error.code === 'ECONNREFUSED') {
      console.log('   Cannot connect to localhost:5000');
      console.log('   Make sure your AIRS backend is running:');
      console.log('   cd path/to/your/backend');
      console.log('   npm start');
    } else if (error.code === 'ENOTFOUND') {
      console.log('   Host not found');
    } else {
      console.log('   Error:', error.message);
    }
  }
}

testBackend();