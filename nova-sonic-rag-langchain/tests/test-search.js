/**
 * Test script for web search tool
 * Run with: node tests/test-search.js
 */

// Load environment variables from .env file
require('dotenv').config();

const search = require('../tools/search');

async function testSearch() {
  console.log('🔍 Testing Web Search Tool\n');
  
  const testQueries = [
    'How was the APEC 2025 Korea?'
  ];
  
  for (const query of testQueries) {
    console.log(`\n📝 Query: "${query}"`);
    console.log('─'.repeat(50));
    
    try {
      const result = await search.execute({ query });
      console.log('✅ Result:', JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }
}

testSearch();
