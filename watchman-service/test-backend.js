const http = require('http');

function testEndpoint(url, callback) {
  http.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      try {
        const jsonData = JSON.parse(data);
        callback(null, jsonData);
      } catch (e) {
        callback(e, null);
      }
    });
  }).on('error', (err) => {
    callback(err, null);
  });
}

console.log('🧪 Simple Backend Test...\n');

// Test backend health
testEndpoint('http://localhost:5000/api/health', (err, data) => {
  if (err) {
    console.log('❌ Backend health failed:', err.message);
  } else {
    console.log('✅ Backend health:', data.status);
  }
});

// Test system-status
setTimeout(() => {
  testEndpoint('http://localhost:5000/api/system-status', (err, data) => {
    if (err) {
      console.log('❌ System status failed:', err.message);
    } else {
      console.log('✅ System status:', {
        overall: data.overall_status,
        watchman: data.watchman.running,
        langflow: data.langflow.connected
      });
    }
  });
}, 2000);