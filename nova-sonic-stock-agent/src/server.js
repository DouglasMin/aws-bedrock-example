/**
 * Nova Sonic WebSocket Server
 * Clean, modular implementation
 */

const express = require('express');
const WebSocket = require('ws');
const { randomUUID } = require('crypto');
const NovaClient = require('./client');
const AgentClient = require('./agent-client');
const { getAllToolSpecs } = require('../tools');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());

// Initialize agent client
const agentClient = new AgentClient();

// Text-based agent endpoint for testing
app.post('/api/agent/query', async (req, res) => {
    const { query, sessionId } = req.body;
    
    if (!query) {
        return res.status(400).json({ error: 'Query is required' });
    }
    
    const sid = sessionId || randomUUID();
    const responses = [];
    
    try {
        await agentClient.invokeAgent(sid, query, (type, data) => {
            responses.push({ type, data });
        });
        
        res.json({
            sessionId: sid,
            responses: responses
        });
    } catch (error) {
        console.error('Agent query error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Log available tools on startup
const availableTools = getAllToolSpecs();
console.log('� Availeable tools:', availableTools.length);
availableTools.forEach(tool => {
    console.log(`   - ${tool.toolSpec.name}: ${tool.toolSpec.description}`);
});
console.log('✅ Tools initialized');

const server = app.listen(PORT, () => {
    console.log('🎤 Nova Sonic Voice Chat Server');
    console.log('================================');
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📝 AWS Region: ${process.env.AWS_REGION || 'us-east-1'}`);
});

const wss = new WebSocket.Server({ server });
const novaClient = new NovaClient();

wss.on('connection', (ws) => {
    console.log('✅ Client connected');
    
    let currentSession = null;
    const sessionId = randomUUID();

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'start') {
                console.log('🎤 Starting conversation...');
                console.log('📡 Starting session...');
                console.log('🎙️ Selected voice:', data.voiceId || 'matthew');
                
                // Response handler
                const responseHandler = (type, data) => {
                    ws.send(JSON.stringify({ type, ...data }));
                };
                
                try {
                    // Use hybrid mode (with agent) by default
                    const useAgent = data.useAgent !== false; // Allow override
                    
                    currentSession = await novaClient.startSession(
                        sessionId, 
                        data.voiceId || 'matthew',
                        responseHandler,
                        useAgent
                    );
                    
                    console.log(`🎯 Mode: ${useAgent ? 'HYBRID (Agent)' : 'STANDARD (Tools)'}`);

                    
                    // Wait for session to be ready
                    const checkReady = setInterval(() => {
                        if (currentSession.sessionReady) {
                            clearInterval(checkReady);
                            ws.send(JSON.stringify({ type: 'ready', message: 'Session started' }));
                            console.log('✅ Session ready for audio');
                        }
                    }, 100);
                    
                } catch (error) {
                    console.error('❌ Session start error:', error);
                    ws.send(JSON.stringify({ type: 'error', message: error.message }));
                }
                
            } else if (data.type === 'audio' && currentSession) {
                currentSession.addAudioChunk(data.audio);
                
            } else if (data.type === 'stop') {
                console.log('⏹️ Stopping conversation...');
                if (currentSession) {
                    await currentSession.end();
                    currentSession = null;
                }
            }
        } catch (error) {
            console.error('❌ Error:', error);
            ws.send(JSON.stringify({ type: 'error', message: error.message }));
        }
    });

    ws.on('close', () => {
        console.log('❌ Client disconnected');
        if (currentSession) {
            currentSession.end();
        }
    });

    ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
    });
});
