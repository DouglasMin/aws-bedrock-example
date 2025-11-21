/**
 * Bedrock client wrapper for Nova Sonic
 */

const { 
    BedrockRuntimeClient,
    InvokeModelWithBidirectionalStreamCommand 
} = require('@aws-sdk/client-bedrock-runtime');
const { NodeHttp2Handler } = require('@smithy/node-http-handler');
const { MODEL_ID } = require('./config');
const NovaSession = require('./session');
const HybridSession = require('./hybrid-session');

class NovaClient {
    constructor() {
        // HTTP/2 handler
        const nodeHttp2Handler = new NodeHttp2Handler({
            requestTimeout: 300000,
            sessionTimeout: 300000,
            disableConcurrentStreams: false,
            maxConcurrentStreams: 20,
        });

        // Bedrock client
        this.bedrockClient = new BedrockRuntimeClient({
            region: process.env.AWS_REGION || 'us-east-1',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            },
            requestHandler: nodeHttp2Handler
        });
    }

    /**
     * Start a new streaming session
     * @param {boolean} useAgent - If true, use hybrid mode with Bedrock Agent
     */
    async startSession(sessionId, voiceId, responseHandler, useAgent = true) {
        // Choose session type
        const session = useAgent 
            ? new HybridSession(sessionId, voiceId)
            : new NovaSession(sessionId, voiceId);
        
        session.start();

        try {
            const command = new InvokeModelWithBidirectionalStreamCommand({
                modelId: MODEL_ID,
                body: session.generateEventStream()
            });

            console.log(`📡 Starting ${useAgent ? 'HYBRID' : 'STANDARD'} session...`);
            
            const response = await this.bedrockClient.send(command);
            
            // Process responses
            this.processResponses(response.body, session, responseHandler, useAgent);
            
            return session;
            
        } catch (error) {
            console.error('❌ Bedrock error:', error);
            throw error;
        }
    }

    /**
     * Process response stream from Bedrock
     */
    async processResponses(responseBody, session, responseHandler, useAgent = false) {
        try {
            console.log('👂 Listening for Bedrock responses...');
            let responseCount = 0;

            for await (const event of responseBody) {
                if (!session.isActive) break;

                responseCount++;

                if (event.chunk?.bytes) {
                    try {
                        const textResponse = new TextDecoder().decode(event.chunk.bytes);
                        const jsonResponse = JSON.parse(textResponse);

                        if (jsonResponse.event) {
                            await this.handleEvent(jsonResponse.event, session, responseHandler, useAgent);
                        }
                    } catch (parseError) {
                        console.error('❌ JSON parse error:', parseError.message);
                    }
                }
            }
            
            console.log('🔚 Response stream ended');
        } catch (error) {
            if (session.isActive) {
                console.error('❌ Response processing error:', error);
                responseHandler('error', { message: error.message });
            }
        }
    }

    /**
     * Handle individual events from Bedrock
     */
    async handleEvent(evt, session, responseHandler, useAgent = false) {
        // contentStart - track generation stage
        if (evt.contentStart) {
            const type = evt.contentStart.type;
            const role = evt.contentStart.role;
            
            let generationStage = 'FINAL';
            if (evt.contentStart.additionalModelFields) {
                try {
                    const additionalFields = JSON.parse(evt.contentStart.additionalModelFields);
                    generationStage = additionalFields.generationStage || 'FINAL';
                } catch (e) {
                    // Use default
                }
            }
            
            session.currentGenerationStage = generationStage;
            console.log(`📝 Content start: ${type} (${role}) - ${generationStage}`);
        }
        // textOutput: ASR or response
        else if (evt.textOutput) {
            const text = evt.textOutput.content;
            const role = evt.textOutput.role || 'ASSISTANT';
            
            if (role === 'ASSISTANT' && session.currentGenerationStage === 'SPECULATIVE') {
                console.log(`🔮 Speculative text (ignored): ${text.substring(0, 50)}...`);
            } else {
                // In hybrid mode, USER text is transcription - send to agent
                if (useAgent && role === 'USER' && session.handleTranscribedText) {
                    await session.handleTranscribedText(text, responseHandler);
                } else {
                    responseHandler('text', {
                        role: role.toLowerCase(),
                        content: text
                    });
                    console.log(`💬 ${role}: ${text}`);
                }
            }
        }
        // audioOutput: voice response
        else if (evt.audioOutput) {
            responseHandler('audio', {
                content: evt.audioOutput.content
            });
        }
        // toolUse: tool call request (only in standard mode)
        else if (evt.toolUse && !useAgent) {
            try {
                const toolResult = await session.handleToolUse(evt.toolUse);
                responseHandler('tool-result', {
                    toolName: evt.toolUse.toolName,
                    result: toolResult
                });
            } catch (error) {
                console.error('Tool execution error:', error);
            }
        }
        // contentEnd
        else if (evt.contentEnd) {
            const stopReason = evt.contentEnd.stopReason;
            
            if (stopReason === 'INTERRUPTED') {
                console.log('🛑 Barge-in detected!');
                responseHandler('barge-in', { message: 'User interrupted' });
            }
        }
        // Other events
        else {
            const eventKeys = Object.keys(evt);
            if (eventKeys.length > 0) {
                console.log(`📨 Event: ${eventKeys[0]}`);
            }
        }
    }
}

module.exports = NovaClient;
