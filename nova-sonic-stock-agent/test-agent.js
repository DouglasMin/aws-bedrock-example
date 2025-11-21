/**
 * Test script for Bedrock Agent integration
 */

require('dotenv').config();
const AgentClient = require('./src/agent-client');
const { randomUUID } = require('crypto');

async function testAgent() {
    const agentClient = new AgentClient();
    const sessionId = randomUUID();
    
    console.log('🧪 Testing Bedrock Agent Integration');
    console.log('=====================================\n');
    
    // Test query
    const query = 'Analyze Tesla stock and give me the latest news';
    
    console.log(`📝 Query: ${query}\n`);
    
    const responses = [];
    
    try {
        await agentClient.invokeAgent(sessionId, query, (type, data) => {
            console.log(`\n[${type}]`, data);
            responses.push({ type, data });
        });
        
        console.log('\n=====================================');
        console.log('✅ Test completed successfully!');
        console.log(`📊 Total responses: ${responses.length}`);
        
        // End session
        await agentClient.endSession(sessionId);
        
    } catch (error) {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    }
}

// Run test
testAgent();
