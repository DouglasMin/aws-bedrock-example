/**
 * Bedrock Agent Runtime Client
 * Handles invocation of Bedrock Agents
 */

const {
    BedrockAgentRuntimeClient,
    InvokeAgentCommand
} = require('@aws-sdk/client-bedrock-agent-runtime');
const { AGENT_CONFIG } = require('./config');

class AgentClient {
    constructor() {
        this.client = new BedrockAgentRuntimeClient({
            region: process.env.AWS_REGION || 'us-east-1',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            }
        });
    }

    /**
     * Invoke the Investment Research Assistant agent
     * @param {string} sessionId - Unique session identifier
     * @param {string} inputText - User's query
     * @param {function} responseHandler - Callback for streaming responses
     */
    async invokeAgent(sessionId, inputText, responseHandler) {
        const agentConfig = AGENT_CONFIG.INVESTMENT_RESEARCH_ASSISTANT;
        
        console.log(`🤖 Invoking agent: ${agentConfig.agentId}`);
        console.log(`📝 Query: ${inputText}`);

        const command = new InvokeAgentCommand({
            agentId: agentConfig.agentId,
            agentAliasId: agentConfig.agentAliasId,
            sessionId: sessionId,
            inputText: inputText,
            enableTrace: true,
            endSession: false
        });

        try {
            const response = await this.client.send(command);
            
            // Process the streaming response
            await this.processAgentResponse(response.completion, responseHandler);
            
            return { success: true };
            
        } catch (error) {
            console.error('❌ Agent invocation error:', error);
            throw error;
        }
    }

    /**
     * Process streaming response from Bedrock Agent
     */
    async processAgentResponse(completionStream, responseHandler) {
        let fullResponse = '';
        
        try {
            for await (const event of completionStream) {
                // Chunk with text content
                if (event.chunk) {
                    const chunk = event.chunk;
                    
                    if (chunk.bytes) {
                        const text = new TextDecoder().decode(chunk.bytes);
                        fullResponse += text;
                        
                        // Send text chunk to client
                        responseHandler('agent-text', {
                            content: text,
                            isComplete: false
                        });
                        
                        console.log(`📤 Agent chunk: ${text.substring(0, 100)}...`);
                    }
                }
                
                // Trace events (tool usage, reasoning, etc.)
                else if (event.trace) {
                    const trace = event.trace.trace;
                    
                    if (trace.orchestrationTrace) {
                        const orchTrace = trace.orchestrationTrace;
                        
                        // Rationale/reasoning
                        if (orchTrace.rationale) {
                            console.log(`🧠 Agent reasoning: ${orchTrace.rationale.text}`);
                            responseHandler('agent-reasoning', {
                                content: orchTrace.rationale.text
                            });
                        }
                        
                        // Tool invocation
                        if (orchTrace.invocationInput) {
                            const invocation = orchTrace.invocationInput;
                            console.log(`🔧 Invoking tool: ${invocation.actionGroupInvocationInput?.actionGroupName}`);
                            
                            responseHandler('agent-tool-start', {
                                toolName: invocation.actionGroupInvocationInput?.actionGroupName,
                                input: invocation.actionGroupInvocationInput?.apiPath
                            });
                        }
                        
                        // Observation (tool result)
                        if (orchTrace.observation) {
                            const observation = orchTrace.observation;
                            
                            if (observation.actionGroupInvocationOutput) {
                                console.log(`✅ Tool result received`);
                                responseHandler('agent-tool-result', {
                                    result: observation.actionGroupInvocationOutput.text
                                });
                            }
                        }
                    }
                }
            }
            
            // Send completion signal
            responseHandler('agent-text', {
                content: '',
                isComplete: true,
                fullResponse: fullResponse
            });
            
            console.log(`✅ Agent response complete (${fullResponse.length} chars)`);
            
        } catch (error) {
            console.error('❌ Error processing agent response:', error);
            throw error;
        }
    }

    /**
     * End agent session
     */
    async endSession(sessionId) {
        const agentConfig = AGENT_CONFIG.INVESTMENT_RESEARCH_ASSISTANT;
        
        const command = new InvokeAgentCommand({
            agentId: agentConfig.agentId,
            agentAliasId: agentConfig.agentAliasId,
            sessionId: sessionId,
            inputText: '',
            endSession: true
        });

        try {
            await this.client.send(command);
            console.log('✅ Agent session ended');
        } catch (error) {
            console.error('❌ Error ending session:', error);
        }
    }
}

module.exports = AgentClient;
