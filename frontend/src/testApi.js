import axios from 'axios';

const testApi = async () => {
  console.log('Testing API configuration...');
  console.log('REACT_APP_API_URL from env:', process.env.REACT_APP_API_URL);
  
  try {
    // Test health endpoint
    const healthResponse = await axios.get('http://localhost:5002/api/health');
    console.log('✅ Health check passed:', healthResponse.data);
    
    // Test check-username endpoint
    const usernameResponse = await axios.get('http://localhost:5002/api/auth/check-username?username=test');
    console.log('✅ Check username passed:', usernameResponse.data);
  } catch (error) {
    console.error('❌ API test failed:', error.message);
  }
};

testApi();