// Quick test script for YouTube Music integration
// Run: node test-youtube-integration.js

import axios from 'axios';

const BACKEND_URL = 'http://localhost:5000';
const YOUTUBE_API_URL = 'http://localhost:8000';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = (color, ...args) => console.log(color, ...args, colors.reset);

async function testEndpoint(name, url) {
  try {
    log(colors.cyan, `\n🔍 Testing: ${name}`);
    log(colors.blue, `   URL: ${url}`);
    
    const start = Date.now();
    const response = await axios.get(url, { timeout: 5000 });
    const duration = Date.now() - start;
    
    log(colors.green, `   ✅ Success (${duration}ms)`);
    log(colors.blue, `   Response:`, JSON.stringify(response.data, null, 2).slice(0, 200) + '...');
    return true;
  } catch (error) {
    log(colors.red, `   ❌ Failed: ${error.message}`);
    return false;
  }
}

async function runTests() {
  log(colors.yellow, '\n🎵 YouTube Music Integration Tests\n');
  log(colors.yellow, '═'.repeat(50));
  
  const tests = [
    // Backend health
    {
      name: 'Backend Health Check',
      url: `${BACKEND_URL}/api/test/health`
    },
    
    // YouTube Music API health
    {
      name: 'YouTube Music API Health',
      url: `${YOUTUBE_API_URL}/healthz`
    },
    
    // YouTube Music proxy health
    {
      name: 'YouTube Music Proxy Health',
      url: `${BACKEND_URL}/api/youtube-music/health`
    },
    
    // Search tests
    {
      name: 'JioSaavn Search',
      url: `${BACKEND_URL}/api/music/search?query=test`
    },
    
    {
      name: 'YouTube Music Search',
      url: `${BACKEND_URL}/api/youtube-music/search?query=test&limit=3`
    },
    
    {
      name: 'Unified Search (Both Platforms)',
      url: `${BACKEND_URL}/api/music/search/all?query=arijit&limit=5`
    },
    
    // Additional YouTube features
    {
      name: 'YouTube Music Charts',
      url: `${BACKEND_URL}/api/youtube-music/charts?country=US`
    },
    
    {
      name: 'YouTube Music Home',
      url: `${BACKEND_URL}/api/youtube-music/home?limit=2`
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    const result = await testEndpoint(test.name, test.url);
    if (result) passed++;
    else failed++;
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  log(colors.yellow, '\n' + '═'.repeat(50));
  log(colors.yellow, '\n📊 Test Results:\n');
  log(colors.green, `   ✅ Passed: ${passed}/${tests.length}`);
  
  if (failed > 0) {
    log(colors.red, `   ❌ Failed: ${failed}/${tests.length}`);
    log(colors.yellow, '\n💡 Troubleshooting:');
    log(colors.blue, '   1. Make sure Python YouTube Music API is running on port 8000');
    log(colors.blue, '   2. Make sure Mavrixfy backend is running on port 5000');
    log(colors.blue, '   3. Check .env has YOUTUBE_MUSIC_API_BASE_URL=http://localhost:8000');
    log(colors.blue, '   4. Run: cd Mavrixfy_App/youtube-music-api && python main.py');
  } else {
    log(colors.green, '\n   🎉 All tests passed! YouTube Music integration is working!');
  }
  
  log(colors.reset, '\n');
}

// Run tests
runTests().catch(error => {
  log(colors.red, '\n❌ Test script error:', error.message);
  process.exit(1);
});
