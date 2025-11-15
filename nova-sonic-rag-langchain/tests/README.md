# Tool Tests

This directory contains standalone test scripts for individual tools.

## Running Tests

Test individual tools without running the full voice chatbot:

```bash
# Test web search tool
node tests/test-search.js

# Test weather tool
node tests/test-weather.js
```

## Adding New Tool Tests

When you add a new tool to `tools/`, create a corresponding test file:

1. Create `tests/test-[toolname].js`
2. Import the tool: `const toolName = require('../tools/toolname');`
3. Call `toolName.execute(params)` with test parameters
4. Log results

### Template

```javascript
/**
 * Test script for [tool name]
 * Run with: node tests/test-[toolname].js
 */

const toolName = require('../tools/toolname');

async function testTool() {
  console.log('🔧 Testing [Tool Name]\n');
  
  const testParams = { /* your test parameters */ };
  
  console.log('📝 Testing with params:', testParams);
  console.log('─'.repeat(50));
  
  try {
    const result = await toolName.execute(testParams);
    console.log('✅ Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testTool();
```
