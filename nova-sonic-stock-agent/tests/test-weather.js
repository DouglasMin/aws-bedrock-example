/**
 * Test script for weather tool
 * Run with: node tests/test-weather.js
 */

const weather = require('../tools/weather');

async function testWeather() {
  console.log('🌤️  Testing Weather Tool\n');
  
  const testCities = [
    'London',
    'New York',
    'Tokyo',
    'InvalidCityName123'
  ];
  
  for (const city of testCities) {
    console.log(`\n📍 City: "${city}"`);
    console.log('─'.repeat(50));
    
    try {
      const result = await weather.execute({ city });
      console.log('✅ Result:', JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }
}

testWeather();
