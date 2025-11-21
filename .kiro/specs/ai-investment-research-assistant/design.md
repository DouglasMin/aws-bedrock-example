# Design Document

## Overview

The AI Investment Research Assistant is a Node.js application that integrates AWS Bedrock multi-agent collaboration with Nova Sonic real-time voice streaming. The system follows a modular architecture similar to nova-sonic-tool-use, with specialized components for voice interaction, agent orchestration, tool execution, and knowledge base integration.

The application uses WebSocket for bidirectional communication between the browser client and server, and HTTP/2 streaming for communication with AWS Bedrock. The multi-agent system consists of a supervisor agent that coordinates three specialized subagents (News, Quantitative, Summarizer) to provide comprehensive investment research.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser Client                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │  Audio Input │  │ Voice Visual │  │  Chat Display        │ │
│  │  (Microphone)│  │  izer        │  │  (Transcripts/Tools) │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │ WebSocket (Audio + Control)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Node.js Server                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              WebSocket Handler                           │  │
│  │  - Session Management                                    │  │
│  │  - Audio Streaming                                       │  │
│  │  - Event Routing                                         │  │
│  └────────────────────┬─────────────────────────────────────┘  │
│                       │                                          │
│  ┌────────────────────▼─────────────────────────────────────┐  │
│  │           Bedrock Client (HTTP/2)                        │  │
│  │  - Bidirectional Streaming                               │  │
│  │  - Event Stream Generation                               │  │
│  │  - Response Processing                                   │  │
│  └────────────────────┬─────────────────────────────────────┘  │
│                       │                                          │
│  ┌────────────────────▼─────────────────────────────────────┐  │
│  │              Tools Registry                              │  │
│  │  - stock_data_lookup                                     │  │
│  │  - portfolio_optimization                                │  │
│  │  - web_search                                            │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │ AWS SDK
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AWS Bedrock                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Supervisor Agent (investment_research)           │  │
│  │  - Query Analysis                                        │  │
│  │  - Subagent Coordination                                 │  │
│  │  - Response Synthesis                                    │  │
│  └───┬──────────────────┬──────────────────┬────────────────┘  │
│      │                  │                  │                    │
│  ┌───▼──────────┐  ┌───▼──────────┐  ┌───▼──────────┐        │
│  │ News Agent   │  │ Quantitative │  │ Summarizer   │        │
│  │              │  │ Agent        │  │ Agent        │        │
│  │ - KB Query   │  │ - Stock Data │  │ - Synthesis  │        │
│  │ - Web Search │  │ - Portfolio  │  │ - Insights   │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           Knowledge Base (Vector Store)                  │  │
│  │  - 10-K Reports                                          │  │
│  │  - 10-Q Filings                                          │  │
│  │  - Earnings Call Transcripts                            │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    External APIs                                │
│  - Stock Data API (Lambda)                                      │
│  - Web Search API (Lambda)                                      │
│  - S3 (Knowledge Base Documents)                                │
└─────────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

1. **User Voice Input**: User speaks → Browser captures audio → WebSocket sends base64 audio chunks
2. **Server Processing**: Server receives audio → Adds to session queue → Streams to Bedrock
3. **Agent Orchestration**: Supervisor analyzes query → Delegates to subagents → Subagents use tools
4. **Tool Execution**: Agent requests tool → Server executes tool → Returns result to agent
5. **Response Generation**: Agent synthesizes response → Bedrock generates audio → Server streams to client
6. **Client Playback**: Client receives audio chunks → Queues for playback → Plays through speakers

## Components and Interfaces

### 1. Server Entry Point (`server.js`)

**Purpose**: Application bootstrap and environment configuration

**Responsibilities**:
- Load environment variables from `.env`
- Import and start the modular server implementation

**Interface**:
```javascript
// No exports - entry point only
require('dotenv').config();
require('./src/server');
```

### 2. WebSocket Server (`src/server.js`)

**Purpose**: Handle WebSocket connections and route messages

**Responsibilities**:
- Serve static files (HTML, CSS, JS)
- Accept WebSocket connections
- Route messages to appropriate handlers
- Manage session lifecycle
- Log tool availability on startup

**Interface**:
```javascript
// Express app
app.use(express.static('public'));

// WebSocket events
ws.on('connection', (ws) => { ... });
ws.on('message', async (message) => { ... });
ws.on('close', () => { ... });
ws.on('error', (error) => { ... });

// Message types
{
  type: 'start',
  voiceId: string
}
{
  type: 'audio',
  audio: string (base64)
}
{
  type: 'stop'
}
```

### 3. Bedrock Client (`src/client.js`)

**Purpose**: Manage communication with AWS Bedrock

**Responsibilities**:
- Initialize Bedrock Runtime Client with HTTP/2
- Start streaming sessions
- Process response streams
- Handle different event types (text, audio, tool use)
- Detect barge-in interruptions

**Interface**:
```javascript
class NovaClient {
  constructor()
  
  async startSession(sessionId, voiceId, responseHandler)
  // Returns: NovaSession instance
  
  async processResponses(responseBody, session, responseHandler)
  // Processes streaming responses from Bedrock
  
  async handleEvent(evt, session, responseHandler)
  // Handles individual events: textOutput, audioOutput, toolUse, etc.
}

// Response handler callback
responseHandler(type, data)
// Types: 'text', 'audio', 'tool-result', 'barge-in', 'error'
```

### 4. Session Manager (`src/session.js`)

**Purpose**: Manage individual conversation sessions

**Responsibilities**:
- Generate event streams for Bedrock
- Queue audio chunks
- Handle tool use requests
- Send tool results back to Bedrock
- Manage session lifecycle (start/end)

**Interface**:
```javascript
class NovaSession {
  constructor(sessionId, voiceId)
  
  async* generateEventStream()
  // Yields: Bedrock event stream chunks
  
  addAudioChunk(base64Audio)
  // Adds audio to queue for streaming
  
  async handleToolUse(toolUseEvent)
  // Executes tool and returns result
  
  async end()
  // Gracefully ends session
  
  start()
  // Activates session
}
```

### 5. Configuration (`src/config.js`)

**Purpose**: Centralize configuration constants

**Responsibilities**:
- Define inference parameters
- Define audio input/output configurations
- Define system prompts for agents
- Define model IDs

**Interface**:
```javascript
module.exports = {
  DEFAULT_INFERENCE_CONFIG: {
    maxTokens: 1024,
    topP: 0.9,
    temperature: 0
  },
  DEFAULT_AUDIO_INPUT_CONFIG: { ... },
  DEFAULT_AUDIO_OUTPUT_CONFIG: { ... },
  DEFAULT_TEXT_CONFIG: { ... },
  DEFAULT_SYSTEM_PROMPT: string,
  MODEL_ID: 'amazon.nova-sonic-v1:0'
}
```

### 6. Tools Registry (`tools/index.js`)

**Purpose**: Central management of all available tools

**Responsibilities**:
- Register all tools
- Provide tool specifications to Bedrock
- Execute tools by name
- Handle tool errors

**Interface**:
```javascript
function getAllToolSpecs()
// Returns: Array of tool specifications

async function executeTool(toolName, params)
// Returns: Tool execution result

function getAvailableTools()
// Returns: Array of tool names
```

### 7. Stock Data Tool (`tools/stock-data.js`)

**Purpose**: Retrieve historical stock prices

**Responsibilities**:
- Define tool specification for Bedrock
- Call stock data Lambda function
- Format price data as JSON
- Handle API errors

**Interface**:
```javascript
function getToolSpec()
// Returns: Bedrock tool specification

async function execute(params)
// Params: { ticker: string }
// Returns: { ticker, prices: { date: price } }
```

### 8. Portfolio Optimization Tool (`tools/portfolio-optimization.js`)

**Purpose**: Calculate optimal portfolio allocations

**Responsibilities**:
- Define tool specification for Bedrock
- Validate minimum 3 tickers
- Call portfolio optimization Lambda function
- Return allocation percentages

**Interface**:
```javascript
function getToolSpec()
// Returns: Bedrock tool specification

async function execute(params)
// Params: { tickers: string, prices: string }
// Returns: { allocations: { ticker: percentage } }
```

### 9. Web Search Tool (`tools/web-search.js`)

**Purpose**: Search for financial news and information

**Responsibilities**:
- Define tool specification for Bedrock
- Call web search Lambda function
- Format search results
- Handle API errors

**Interface**:
```javascript
function getToolSpec()
// Returns: Bedrock tool specification

async function execute(params)
// Params: { query: string, days?: number }
// Returns: { results: Array<{ title, url, snippet }> }
```

### 10. Agent Helper (`src/agents/agent-helper.js`)

**Purpose**: Utility functions for agent management

**Responsibilities**:
- Create Bedrock agents programmatically
- Configure agent roles and instructions
- Attach tools to agents
- Link knowledge bases to agents
- Delete agents and cleanup

**Interface**:
```javascript
async function createAgent(config)
// Config: { name, role, goal, instructions, tools, kbId, llm }
// Returns: Agent object with ID and ARN

async function createSupervisorAgent(config)
// Config: { name, role, goal, instructions, collaborators, llm }
// Returns: Supervisor agent object

async function deleteAgent(agentName, deleteRole)
// Deletes agent and optionally its IAM role
```

### 11. Knowledge Base Helper (`src/agents/kb-helper.js`)

**Purpose**: Manage Bedrock Knowledge Base

**Responsibilities**:
- Create or retrieve knowledge base
- Configure vector store (OpenSearch Serverless)
- Synchronize data from S3
- Handle data source management

**Interface**:
```javascript
async function createOrRetrieveKnowledgeBase(config)
// Config: { name, description, bucketName, embeddingModel }
// Returns: { kbId, dataSourceId }

async function synchronizeData(kbId, dataSourceId)
// Triggers ingestion job for knowledge base
```

### 12. Client Application (`public/app.js`)

**Purpose**: Browser-side voice interaction

**Responsibilities**:
- Capture microphone audio
- Convert audio formats (Float32 ↔ Int16)
- Send audio via WebSocket
- Receive and play audio responses
- Display transcripts and tool usage
- Visualize audio levels

**Interface**:
```javascript
async function startConversation()
// Initializes audio context and WebSocket

function stopConversation()
// Ends session and cleanup

function addMessage(role, content)
// Displays transcript in UI

function addToolMessage(type, toolName, data)
// Displays tool usage in UI

function playAudio(base64Audio)
// Queues and plays audio response
```

### 13. Audio Processor (`public/audio-processor.js`)

**Purpose**: AudioWorklet for real-time audio processing

**Responsibilities**:
- Process audio in separate thread
- Convert Float32 to Int16
- Send audio chunks to main thread

**Interface**:
```javascript
class NovaAudioProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters)
  // Returns: true to keep processor alive
}
```

## Data Models

### Session State

```javascript
{
  sessionId: string,           // Unique session identifier
  voiceId: string,             // Nova Sonic voice ID
  promptName: string,          // Unique prompt identifier
  contentName: string,         // Content identifier
  audioContentName: string,    // Audio content identifier
  isActive: boolean,           // Session active flag
  audioQueue: Array<Event>,    // Queued audio events
  sessionReady: boolean,       // Ready to receive audio
  currentGenerationStage: string // 'SPECULATIVE' or 'FINAL'
}
```

### Tool Specification

```javascript
{
  toolSpec: {
    name: string,              // Tool identifier
    description: string,       // When to use this tool
    inputSchema: {
      json: string             // JSON schema for parameters
    }
  }
}
```

### Stock Data Response

```javascript
{
  ticker: string,
  prices: {
    [date: string]: number     // ISO date → closing price
  },
  startDate: string,
  endDate: string
}
```

### Portfolio Optimization Response

```javascript
{
  allocations: {
    [ticker: string]: number   // Ticker → allocation percentage
  },
  expectedReturn: number,
  risk: number,
  sharpeRatio: number
}
```

### Web Search Response

```javascript
{
  query: string,
  results: Array<{
    title: string,
    url: string,
    snippet: string,
    publishedDate: string
  }>,
  resultCount: number
}
```

### Knowledge Base Query Response

```javascript
{
  results: Array<{
    content: string,
    source: string,            // Document name
    score: number,             // Relevance score
    metadata: {
      documentType: string,    // '10-K', '10-Q', 'earnings-call'
      company: string,
      quarter: string,
      year: string
    }
  }>
}
```

## Error Handling

### Error Categories

1. **Connection Errors**
   - WebSocket disconnection
   - Bedrock API unavailable
   - Network timeout
   - **Handling**: Retry with exponential backoff, notify user

2. **Authentication Errors**
   - Invalid AWS credentials
   - Insufficient permissions
   - **Handling**: Log error, return clear message to user

3. **Tool Execution Errors**
   - API rate limits
   - Invalid parameters
   - External service unavailable
   - **Handling**: Return error to agent, agent decides fallback

4. **Agent Errors**
   - Agent not found
   - Tool not available
   - Invalid tool response
   - **Handling**: Log error, supervisor agent handles gracefully

5. **Audio Processing Errors**
   - Microphone permission denied
   - Audio format incompatible
   - Buffer overflow
   - **Handling**: Display user-friendly message, suggest fixes

### Error Response Format

```javascript
{
  type: 'error',
  category: string,           // 'connection', 'auth', 'tool', 'agent', 'audio'
  message: string,            // User-friendly message
  details: string,            // Technical details (logged)
  recoverable: boolean,       // Can user retry?
  suggestedAction: string     // What user should do
}
```

### Logging Strategy

- **Console Logs**: Development debugging
- **Error Logs**: All errors with stack traces
- **Tool Logs**: Tool invocations and results
- **Session Logs**: Session lifecycle events
- **Performance Logs**: Latency measurements

## Testing Strategy

### Unit Tests

**Tools Testing** (`tests/test-*.js`)
- Test each tool in isolation
- Mock external API calls
- Verify input validation
- Verify output format
- Test error handling

**Example**:
```javascript
// tests/test-stock-data.js
const stockData = require('../tools/stock-data');

async function testStockData() {
  const result = await stockData.execute({ ticker: 'AAPL' });
  assert(result.ticker === 'AAPL');
  assert(result.prices);
  assert(Object.keys(result.prices).length > 0);
}
```

### Integration Tests

**Agent Integration**
- Test supervisor → subagent communication
- Test tool invocation from agents
- Test knowledge base queries
- Verify response synthesis

**Voice Session Integration**
- Test WebSocket connection
- Test audio streaming
- Test session lifecycle
- Test barge-in detection

### Manual Testing

**Voice Interaction Testing**
- Test various investment questions
- Test multi-turn conversations
- Test interruptions
- Test error recovery
- Test different voice IDs

**Tool Usage Testing**
- Verify stock data retrieval
- Verify portfolio optimization
- Verify web search
- Verify knowledge base queries

### Performance Testing

**Latency Measurements**
- Voice-to-text latency
- Agent response time
- Tool execution time
- Text-to-voice latency
- End-to-end latency

**Load Testing**
- Multiple concurrent sessions
- High-frequency audio streaming
- Large knowledge base queries

## Deployment Considerations

### Environment Variables

```bash
# AWS Configuration
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=us-east-1

# Server Configuration
PORT=3000

# Lambda Function ARNs
STOCK_DATA_LAMBDA_ARN=arn:aws:lambda:...
WEB_SEARCH_LAMBDA_ARN=arn:aws:lambda:...

# Knowledge Base
KNOWLEDGE_BASE_ID=xxx
KNOWLEDGE_BASE_BUCKET=xxx

# Agent IDs (generated during setup)
SUPERVISOR_AGENT_ID=xxx
NEWS_AGENT_ID=xxx
QUANTITATIVE_AGENT_ID=xxx
SUMMARIZER_AGENT_ID=xxx
```

### AWS Resources Required

1. **Bedrock Agents**
   - Supervisor agent
   - News agent
   - Quantitative agent
   - Summarizer agent

2. **Bedrock Knowledge Base**
   - OpenSearch Serverless collection
   - S3 bucket for documents
   - Data source configuration

3. **Lambda Functions**
   - Stock data retrieval function
   - Portfolio optimization function
   - Web search function

4. **IAM Roles**
   - Agent execution roles
   - Lambda execution roles
   - Knowledge base access role

5. **S3 Buckets**
   - Knowledge base documents
   - BDA processing (input/output)

### Deployment Steps

1. **Setup AWS Resources**
   - Deploy Lambda functions
   - Create S3 buckets
   - Configure IAM roles

2. **Initialize Knowledge Base**
   - Upload financial documents to S3
   - Run BDA processing
   - Create knowledge base
   - Synchronize data

3. **Create Agents**
   - Run agent setup script
   - Configure agent instructions
   - Attach tools and knowledge base
   - Test agent responses

4. **Deploy Application**
   - Install dependencies (`npm install`)
   - Configure environment variables
   - Start server (`npm start`)
   - Test voice interaction

### Monitoring and Maintenance

- Monitor WebSocket connection stability
- Track agent invocation success rates
- Monitor tool execution latency
- Track knowledge base query performance
- Monitor AWS service quotas
- Regular knowledge base updates with new documents
