# Bedrock Agent Integration

## Overview

The application now supports **Hybrid Mode** - combining Nova Sonic's voice capabilities with Bedrock Agent's multi-agent orchestration.

## Architecture

### Hybrid Mode (Default)
```
User Speech → Nova Sonic (ASR) → Bedrock Agent → Nova Sonic (TTS) → User Hears
```

**Flow:**
1. User speaks into microphone
2. Nova Sonic transcribes speech to text (ASR)
3. Text is sent to Investment Research Assistant agent
4. Agent orchestrates sub-agents (news, quantitative, summarizer)
5. Agent response (text) is injected back into Nova Sonic
6. Nova Sonic synthesizes speech (TTS)
7. User hears the response

### Standard Mode (Legacy)
```
User Speech → Nova Sonic (ASR + Tools + TTS) → User Hears
```

Direct tool execution without agent orchestration.

## Configuration

### Environment Variables (.env)
```bash
# Bedrock Agent Alias IDs
INVESTMENT_RESEARCH_ASSISTANT_ALIAS=REP7P9QYYO
QUANTITATIVE_ANALYSIS_AGENT_ALIAS=5ZKVUOB8EQ
SMART_SUMMARIZER_AGENT_ALIAS=7QFY5QNKQ7
NEWS_AGENT_ALIAS=VBDORVLW8B
```

## Usage

### 1. Start the Server
```bash
npm start
```

### 2. Test Agent (Text-based)
```bash
node test-agent.js
```

Or visit: `http://localhost:3000/test-agent.html`

### 3. Voice Chat (Hybrid Mode)
Visit: `http://localhost:3000`

The voice interface automatically uses hybrid mode with the Bedrock Agent.

### 4. API Endpoint
```bash
curl -X POST http://localhost:3000/api/agent/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Analyze AAPL stock"}'
```

## Modes

### Hybrid Mode (Default)
- Voice input/output via Nova Sonic
- Intelligence via Bedrock Agent
- Multi-agent orchestration
- Better reasoning and tool coordination

### Standard Mode (Legacy)
To use standard mode (direct tools, no agent):
```javascript
// In client code
ws.send(JSON.stringify({
    type: 'start',
    voiceId: 'matthew',
    useAgent: false  // Disable agent
}));
```

## Files

### New Files
- `src/agent-client.js` - Bedrock Agent Runtime client
- `src/hybrid-session.js` - Hybrid session (voice + agent)
- `test-agent.js` - CLI test script
- `public/test-agent.html` - Web-based test interface

### Modified Files
- `src/client.js` - Added hybrid mode support
- `src/server.js` - Added agent endpoint and hybrid mode
- `src/config.js` - Added agent configuration
- `.env` - Added agent alias IDs

### Existing Files (Unchanged)
- `src/session.js` - Standard mode (legacy)
- `tools/` - Direct tool implementations (used in standard mode)

## Agent Architecture

### Investment Research Assistant (Supervisor)
- Orchestrates all sub-agents
- Manages conversation flow
- Synthesizes final responses

### Sub-Agents
1. **News Agent** - Fetches financial news via web search
2. **Quantitative Analysis Agent** - Stock data and portfolio optimization
3. **Smart Summarizer Agent** - Synthesizes insights and trends

## Benefits of Hybrid Mode

1. **Better Orchestration** - Agent decides which tools to use and when
2. **Multi-Step Reasoning** - Agent can chain multiple operations
3. **Contextual Awareness** - Agent maintains conversation context
4. **Voice Interface** - Natural voice interaction via Nova Sonic
5. **Scalability** - Easy to add more agents without changing voice code

## Testing

### Test Agent Only (No Voice)
```bash
node test-agent.js
```

### Test Voice + Agent
1. Start server: `npm start`
2. Open browser: `http://localhost:3000`
3. Click microphone and speak: "Analyze Tesla stock"

### Test via API
```bash
curl -X POST http://localhost:3000/api/agent/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Get me news about Apple and analyze AAPL stock price",
    "sessionId": "test-123"
  }'
```

## Troubleshooting

### Agent Not Responding
- Check agent alias IDs in `.env`
- Verify AWS credentials
- Check agent status in AWS Console

### Voice Not Working
- Check microphone permissions
- Verify Nova Sonic model access
- Check browser console for errors

### Tools Not Executing
- Verify Lambda functions are deployed
- Check Lambda ARNs in `.env`
- Review agent action group configuration

## Next Steps

1. **Test the integration** - Run `node test-agent.js`
2. **Try voice interface** - Open `http://localhost:3000`
3. **Monitor logs** - Watch for agent invocations and tool calls
4. **Add RAG** - Integrate Knowledge Base for document-based research
5. **Optimize prompts** - Refine agent instructions for better responses
