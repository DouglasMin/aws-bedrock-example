/**
 * Session management for Nova Sonic streaming
 */

const { randomUUID } = require('crypto');
const { getAllToolSpecs, executeTool } = require('../tools');
const {
    DEFAULT_INFERENCE_CONFIG,
    DEFAULT_AUDIO_INPUT_CONFIG,
    DEFAULT_AUDIO_OUTPUT_CONFIG,
    DEFAULT_TEXT_CONFIG,
    DEFAULT_SYSTEM_PROMPT
} = require('./config');

class NovaSession {
    constructor(sessionId, voiceId = 'matthew') {
        this.sessionId = sessionId;
        this.voiceId = voiceId;
        this.promptName = randomUUID();
        this.contentName = randomUUID();
        this.audioContentName = randomUUID();
        this.isActive = false;
        this.audioQueue = [];
        this.sessionReady = false;
    }

    /**
     * Generate event stream for Bedrock
     */
    async* generateEventStream() {
        const textEncoder = new TextEncoder();
        
        // Get tool specs
        const toolSpecs = getAllToolSpecs();
        console.log('🔧 Tool specs loaded:', toolSpecs.length);
        console.log('🔧 Tools:', toolSpecs.map(t => t.toolSpec.name));
        
        // Initial events
        const initEvents = [
            // 1. sessionStart
            {
                event: {
                    sessionStart: {
                        inferenceConfiguration: DEFAULT_INFERENCE_CONFIG
                    }
                }
            },
            // 2. promptStart with tools
            {
                event: {
                    promptStart: {
                        promptName: this.promptName,
                        textOutputConfiguration: DEFAULT_TEXT_CONFIG,
                        audioOutputConfiguration: {
                            ...DEFAULT_AUDIO_OUTPUT_CONFIG,
                            voiceId: this.voiceId
                        },
                        toolUseOutputConfiguration: {
                            mediaType: 'application/json'
                        },
                        toolConfiguration: {
                            tools: toolSpecs
                        }
                    }
                }
            },
            // 3. System prompt contentStart
            {
                event: {
                    contentStart: {
                        promptName: this.promptName,
                        contentName: this.contentName,
                        type: 'TEXT',
                        interactive: false,
                        role: 'SYSTEM',
                        textInputConfiguration: DEFAULT_TEXT_CONFIG
                    }
                }
            },
            // 4. textInput
            {
                event: {
                    textInput: {
                        promptName: this.promptName,
                        contentName: this.contentName,
                        content: DEFAULT_SYSTEM_PROMPT
                    }
                }
            },
            // 5. System prompt contentEnd
            {
                event: {
                    contentEnd: {
                        promptName: this.promptName,
                        contentName: this.contentName
                    }
                }
            },
            // 6. Audio contentStart
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
     * Handle tool use and send result
     */
    async handleToolUse(toolUseEvent) {
        const toolName = toolUseEvent.toolName;
        const toolInput = JSON.parse(toolUseEvent.content);
        const toolUseId = toolUseEvent.toolUseId;
        
        console.log(`🔧 Tool requested: ${toolName}`, toolInput);
        
        try {
            const toolResult = await executeTool(toolName, toolInput);
            console.log(`✅ Tool result:`, toolResult);
            
            const toolResultContentId = randomUUID();
            
            // 1. contentStart for tool result
            this.audioQueue.push({
                event: {
                    contentStart: {
                        promptName: this.promptName,
                        contentName: toolResultContentId,
                        interactive: false,
                        type: 'TOOL',
                        role: 'TOOL',
                        toolResultInputConfiguration: {
                            toolUseId: toolUseId,
                            type: 'TEXT',
                            textInputConfiguration: DEFAULT_TEXT_CONFIG
                        }
                    }
                }
            });
            
            // 2. toolResult
            this.audioQueue.push({
                event: {
                    toolResult: {
                        promptName: this.promptName,
                        contentName: toolResultContentId,
                        content: JSON.stringify(toolResult)
                    }
                }
            });
            
            // 3. contentEnd
            this.audioQueue.push({
                event: {
                    contentEnd: {
                        promptName: this.promptName,
                        contentName: toolResultContentId
                    }
                }
            });
            
            return toolResult;
            
        } catch (error) {
            console.error(`❌ Tool execution failed:`, error);
            throw error;
        }
    }

    /**
     * End session
     */
    async end() {
        if (!this.isActive) return;
        
        console.log('🛑 Ending session...');
        
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

        // Wait a bit for events to be sent
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Now stop the stream
        this.isActive = false;
        this.sessionReady = false;
        
        console.log('✅ Session ended');
    }

    start() {
        this.isActive = true;
    }
}

module.exports = NovaSession;
