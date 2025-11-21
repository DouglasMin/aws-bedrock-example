# Implementation Plan

- [x] 1. Set up project structure and core configuration
  - ✅ Created `nova-sonic-stock-agent/` directory (copied from nova-sonic-tool-use)
  - ✅ `package.json` exists with all required dependencies
  - ✅ `.env.example` exists
  - ✅ `.gitignore` exists
  - _Requirements: 10.1, 10.2_

- [x] 2. Update server entry point and configuration for investment research
  - ✅ `server.js` exists as application entry point
  - ⚠️ `src/config.js` exists but needs update for investment research system prompt
  - Update DEFAULT_SYSTEM_PROMPT to instruct on investment research capabilities and tool usage
  - _Requirements: 10.1, 10.4_

- [x] 3. Implement WebSocket server
  - ✅ `src/server.js` exists with Express app and WebSocket server
  - ✅ WebSocket connection handling implemented
  - ✅ Message routing for 'start', 'audio', 'stop' implemented
  - ✅ Session management with unique session IDs
  - ✅ Tool availability logging on server startup
  - _Requirements: 1.1, 9.1, 10.4_

- [x] 4. Implement Bedrock client wrapper
  - ✅ `src/client.js` exists with NovaClient class
  - ✅ Constructor with HTTP/2 handler and Bedrock Runtime Client
  - ✅ startSession() method implemented
  - ✅ processResponses() method implemented
  - ✅ handleEvent() method for all event types
  - ✅ Barge-in detection implemented
  - _Requirements: 1.2, 1.3, 1.4, 9.3_

- [x] 5. Implement session management
  - ✅ `src/session.js` exists with NovaSession class
  - ✅ generateEventStream() async generator implemented
  - ✅ Session initialization events implemented
  - ✅ addAudioChunk() implemented
  - ✅ handleToolUse() implemented
  - ✅ end() method implemented
  - _Requirements: 1.5, 7.1, 9.1, 9.2, 9.4_

- [ ] 6. Update tools registry for investment research
  - ✅ `tools/index.js` exists with tool registry
  - ⚠️ Currently registers weather and search tools
  - Update to register stock-data, portfolio-optimization, and web-search tools
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 7. Implement stock data tool
  - Create `tools/stock-data.js` with getToolSpec() and execute() functions
  - Define tool specification with name 'stock_data_lookup', description, and input schema for ticker parameter
  - Implement execute() to call stock data Lambda function via AWS SDK
  - Format response as JSON with ticker, prices object (date → price), startDate, endDate
  - Add error handling for invalid tickers and API failures
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 7.3, 7.4_

- [ ] 8. Implement portfolio optimization tool
  - Create `tools/portfolio-optimization.js` with getToolSpec() and execute() functions
  - Define tool specification with name 'portfolio_optimization', description, and input schema for tickers and prices parameters
  - Implement validation to require at least 3 tickers
  - Implement execute() to call portfolio optimization Lambda function
  - Format response with allocations object (ticker → percentage), expectedReturn, risk, sharpeRatio
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 7.3, 7.4_

- [ ] 9. Adapt web search tool for financial news
  - ✅ `tools/search.js` exists with Brave Search implementation
  - Update tool specification description to focus on financial news and investment information
  - Optionally add filtering for financial news sources
  - Keep existing error handling for API failures and rate limits
  - _Requirements: 5.4, 7.3, 7.4_

- [x] 10. Create Node.js script to set up Bedrock agents
  - Create `scripts/setup-agents.js` using AWS SDK for JavaScript
  - Use @aws-sdk/client-bedrock-agent to create agents programmatically
  - Create smart_summarizer_agent with synthesis instructions
  - Create quantitative_analysis_agent with stock_data_lookup and portfolio_optimization tools attached
  - Create news_agent with web_search tool and knowledge base attachment
  - Create investment_research_assistant supervisor agent with all three collaborators
  - Save agent IDs to .env file for runtime use
  - Include cleanup function to delete agents
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 5.1, 5.2, 5.3_

- [ ] 11. Create Node.js script to set up knowledge base
  - Create `scripts/setup-knowledge-base.js` using AWS SDK for JavaScript
  - Use @aws-sdk/client-bedrock-agent to create knowledge base
  - Create S3 buckets for knowledge base documents and BDA processing
  - Configure BDA project for document, audio, and video processing using @aws-sdk/client-bedrock-data-automation
  - Download sample financial documents (10-K, 10-Q, earnings calls)
  - Process documents through BDA with polling for completion
  - Upload processed results to knowledge base bucket
  - Create knowledge base with vector embeddings (OpenSearch Serverless)
  - Synchronize data sources
  - _Requirements: 6.1, 6.2, 6.3_

- [ ] 12. Update Node.js config to use Bedrock agents
  - Update `src/config.js` to include AGENT_ID environment variable
  - Modify DEFAULT_SYSTEM_PROMPT to work with the supervisor agent
  - Add configuration for agent invocation vs direct Nova Sonic
  - Document that agents must be created via Python notebooks first
  - _Requirements: 2.1, 10.1, 10.2_

- [ ] 13. Implement agent invocation in session
  - Update `src/session.js` to support agent invocation mode
  - When agent mode is enabled, route tool use requests through Bedrock agent
  - Handle agent responses and convert to Nova Sonic events
  - Maintain compatibility with direct tool execution mode
  - _Requirements: 2.1, 2.5, 7.1_

- [x] 14. Implement browser client HTML structure
  - ✅ `public/index.html` exists with voice chat interface
  - ✅ Voice selection dropdown with Nova Sonic voice options
  - ✅ Start/stop conversation buttons
  - ✅ Audio visualizer container
  - ✅ Chat message container for transcripts
  - ✅ Status display for connection and session state
  - ✅ CSS for styling chat messages, tool displays, and visualizer
  - _Requirements: 1.1_

- [x] 15. Implement browser client JavaScript
  - ✅ `public/app.js` exists with WebSocket connection management
  - ✅ startConversation() implemented
  - ✅ AudioWorklet for real-time audio processing
  - ✅ Audio format conversion (Float32 ↔ Int16, base64 encoding)
  - ✅ Audio playback queue for received audio chunks
  - ✅ addMessage() to display transcripts in chat UI
  - ✅ addToolMessage() to display tool usage with icons and formatted data
  - ✅ Audio visualizer with frequency bars
  - ✅ cleanup() for session end
  - _Requirements: 1.1, 1.2, 1.3, 1.5, 7.5_

- [x] 16. Implement audio processor worklet
  - ✅ `public/audio-processor.js` exists with NovaAudioProcessor class
  - ✅ process() method converts Float32 audio to Int16
  - ✅ Posts processed audio chunks to main thread
  - ✅ Buffer management for real-time processing
  - _Requirements: 1.5_

- [x] 17. Create Lambda function for stock data retrieval
  - Create Lambda function that accepts ticker parameter
  - Integrate with stock data API (e.g., Alpha Vantage, Yahoo Finance)
  - Retrieve 1-month historical daily closing prices
  - Format response as JSON with dates and prices
  - Add error handling for invalid tickers and API errors
  - Deploy Lambda and note ARN for configuration
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 18. Create Lambda function for portfolio optimization
  - Create Lambda function that accepts tickers and prices parameters
  - Implement Modern Portfolio Theory optimization algorithm
  - Calculate optimal allocations to maximize Sharpe ratio
  - Calculate expected return, risk, and Sharpe ratio
  - Format response with allocation percentages
  - Add validation for minimum 3 tickers
  - Deploy Lambda and note ARN for configuration
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 19. Create Lambda function for web search
  - Create Lambda function that accepts query and optional days parameters
  - Integrate with web search API (e.g., Brave Search, SerpAPI)
  - Filter results for financial news sources
  - Format response with title, URL, snippet, and published date
  - Add error handling for API failures and rate limits
  - Deploy Lambda and note ARN for configuration
  - _Requirements: 5.4_

- [ ] 20. Create tool test scripts
  - Create `tests/test-stock-data.js` to test stock data tool with sample tickers
  - Create `tests/test-portfolio-optimization.js` to test portfolio optimization with sample data
  - ✅ `tests/test-search.js` exists - update for investment queries
  - ✅ `tests/README.md` exists - update with new test instructions
  - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 5.4_

- [ ] 21. Create comprehensive README documentation
  - Create `README.md` with project overview and architecture diagram
  - Document prerequisites (Node.js, Python, AWS account, Bedrock access, SageMaker for notebooks)
  - Document setup workflow: 1) Run Python notebooks to create agents, 2) Configure Node.js app, 3) Start voice server
  - Document quick start instructions (install, configure, run)
  - Document environment variables with descriptions
  - Document available tools and their usage
  - Document agent architecture and collaboration flow (supervisor + 3 subagents)
  - Explain hybrid approach: Python for agent creation, Node.js for voice interaction
  - Document troubleshooting common issues
  - Document deployment steps for AWS resources
  - _Requirements: 10.1, 10.2, 10.5_

- [ ] 22. Integrate all components and test end-to-end
  - Start server and verify all tools are loaded
  - Test WebSocket connection from browser
  - Test voice input and transcription
  - Test agent orchestration with sample investment questions
  - Test stock data retrieval through voice
  - Test portfolio optimization through voice
  - Test web search through voice
  - Test knowledge base queries through voice
  - Test barge-in interruption
  - Test session cleanup
  - Verify audio output quality and latency
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.5, 4.1, 4.5, 5.1, 5.5, 7.5, 8.1, 8.2, 8.3, 8.4, 8.5, 9.1, 9.2, 9.4_
