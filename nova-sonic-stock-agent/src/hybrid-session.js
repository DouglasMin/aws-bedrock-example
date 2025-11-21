/**
 * Hybrid Session: Nova Sonic (voice) + Bedrock Agent (intelligence)
 * 
 * Flow:
 * 1. User speaks → Nova Sonic transcribes (ASR)
 * 2. Transcribed text → Bedrock Agent processes
 * 3. Agent response → Nova Sonic synthesizes to speech (TTS)
 * 4. Speech → User hears
 */

const { randomUUID } = require('crypto');
const AgentClient = require('./agent-client');
const {
    DEFAULT_INFERENCE_CONFIG,
    DEFAULT_AUDIO_INPUT_CONFIG,
    DEFAULT_AUDIO_OUTPUT_CONFIG,
    DEFAULT_TEXT_CONFIG
} = require('./config');

class HybridSession {
    constructor(sessionId, voiceId = 'matthew') {
        this.sessionId = sessionId;
        this.voiceId = voiceId;
        this.promptName = randomUUID();
        this.audioContentName = randomUUID();
        this.isActive = false;
        this.audioQueue = [];
        this.sessionReady = false;
        this.agentClient = new AgentClient();
        this.currentTranscript = '';
        this.isProcessingAgent = false;
    }

    /**
     * Generate event stream for Nova Sonic (voice only, no tools)
     */
    async* generateEventStream() {
        const textEncoder = new TextEncoder();
        
        // Initial events - NO TOOLS, just voice I/O
        const initEvents = [
            // 1. sessionStart
            {
                event: {
                    sessionStart: {
                        inferenceConfiguration: DEFAULT_INFERENCE_CONFIG
                    }
                }
            },
            // 2. promptStart (voice only)
            {
                event: {
                    promptStart: {
                        promptName: this.promptName,
                        textOutputConfiguration: DEFAULT_TEXT_CONFIG,
                        audioOutputConfiguration: {
                            ...DEFAULT_AUDIO_OUTPUT_CONFIG,
                            voiceId: this.voiceId
                        }
                    }
                }
            },
            // 3. Audio contentStart
            {
                event: {
                    contentStart: {
                        promptName: this.promptName,
                        contentName: this.audioContentName,
                        type: 'AUDIO',
                        interactive: true,
                        role: 'USER',
                        audioInputConfiguration: DEFAULT_AUDIO_INPUT_CONFIG
                    }
                }
            }
        ];
        
        // Send initial events
        for (const event of initEvents) {
            const eventJson = JSON.stringify(event);
            console.log(`📤 Sending: ${Object.keys(event.event)[0]}`);
            yield {
                chunk: {
                    bytes: textEncoder.encode(eventJson)
                }
            };
            await new Promise(resolve => setTimeout(resolve, 30));
        }
        
        this.sessionReady = true;
        console.log('✅ Hybrid session ready (voice I/O only)');
        
        // Stream audio events
        let sentCount = 0;
        while (this.isActive) {
            if (this.audioQueue.length > 0) {
                const audioEvent = this.audioQueue.shift();
                yield {
                    chunk: {
                        bytes: textEncoder.encode(JSON.stringify(audioEvent))
                    }
                };
                sentCount++;
                if (sentCount % 100 === 0) {
                    console.log(`📤 Sent ${sentCount} audio events, queue: ${this.audioQueue.length}`);
                }
            } else {
                await new Promise(resolve => setTimeout(resolve, 1));
            }
        }
        
        console.log('🔚 Event stream ended');
    }

    /**
     * Add audio chunk to queue
     */
    addAudioChunk(base64Audio) {
        if (!this.sessionReady) return;
        
        this.audioQueue.push({
            event: {
                audioInput: {
                    promptName: this.promptName,
                    contentName: this.audioContentName,
                    content: base64Audio
                }
            }
        });
    }

    /**
     * Handle transcribed text from Nova Sonic
     * Send to Bedrock Agent for processing
     */
    async handleTranscribedText(text, responseHandler) {
        if (this.isProcessingAgent) {
            console.log('⏳ Agent already processing, skipping...');
            return;
        }

        this.currentTranscript = text;
        console.log(`🎤 Transcribed: ${text}`);
        
        // Notify client
        responseHandler('transcript', { content: text });
        
        // Send to Bedrock Agent
        this.isProcessingAgent = true;
        
        try {
            console.log('🤖 Sending to Bedrock Agent...');
            
            await this.agentClient.invokeAgent(
                this.sessionId,
                text,
                (type, data) => {
                    // Forward agent events to client
                    responseHandler(type, data);
                    
                    // If we get final agent text, inject it into Nova Sonic for TTS
                    if (type === 'agent-text' && data.isComplete && data.fullResponse) {
                        this.injectTextForSpeech(data.fullResponse);
                    }
                }
            );
            
        } catch (error) {
            console.error('❌ Agent processing error:', error);
            responseHandler('error', { message: error.message });
        } finally {
            this.isProcessingAgent = false;
        }
    }

    /**
     * Inject agent response text into Nova Sonic for speech synthesis
     */
    injectTextForSpeech(text) {
        console.log(`🔊 Injecting text for speech: ${text.substring(0, 100)}...`);
        
        const textContentId = randomUUID();
        
        // 1. contentStart for assistant text
        this.audioQueue.push({
            event: {
                contentStart: {
                    promptName: this.promptName,
                    contentName: textContentId,
                    type: 'TEXT',
                    interactive: false,
                    role: 'ASSISTANT',
                    textInputConfiguration: DEFAULT_TEXT_CONFIG
                }
            }
        });
        
        // 2. textInput with agent response
        this.audioQueue.push({
            event: {
                textInput: {
                    promptName: this.promptName,
                    contentName: textContentId,
                    content: text
                }
            }
        });
        
        // 3. contentEnd
        this.audioQueue.push({
            event: {
                contentEnd: {
                    promptName: this.promptName,
                    contentName: textContentId
                }
            }
        });
    }

    /**
     * End session
     */
    async end() {
        if (!this.isActive) return;
        
        console.log('🛑 Ending hybrid session...');
        
        // End agent session
        await this.agentClient.endSession(this.sessionId);
        
        // 1. Audio contentEnd
        this.audioQueue.push({
            event: {
                contentEnd: {
                    promptName: this.promptName,
                    contentName: this.audioContentName
                }
            }
        });

        // 2. promptEnd
        this.audioQueue.push({
            event: {
                promptEnd: {
                    promptName: this.promptName
                }
            }
        });

        // 3. sessionEnd
        this.audioQueue.push({
            event: {
                sessionEnd: {}
            }
        });

        // Wait for events to be sent
        await new Promise(resolve => setTimeout(resolve, 100));
        
        this.isActive = false;
        this.sessionReady = false;
        
        console.log('✅ Hybrid session ended');
    }

    start() {
        this.isActive = true;
    }
}

module.exports = HybridSession;
