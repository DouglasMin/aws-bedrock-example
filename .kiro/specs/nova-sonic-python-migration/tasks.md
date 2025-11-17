# Implementation Plan

- [x] 1. Set up Python project structure
  - Create `nova-sonic-python` directory with proper folder structure
  - Create `requirements.txt` with all dependencies
  - Create `.env.example` file with required environment variables
  - Create `README.md` with setup instructions
  - _Requirements: 6.1, 6.2_

- [x] 2. Implement configuration module
  - Create `config.py` with audio configurations (sample rates, formats)
  - Define Bedrock inference configurations (temperature, maxTokens, topP)
  - Define system prompt for Nova Sonic
  - Define model ID and region settings
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 3. Implement Bedrock Stream Manager
  - [x] 3.1 Create `bedrock_stream_manager.py` with class structure
    - Initialize Bedrock client with aws-sdk-python
    - Set up HTTP/2 handler and authentication
    - _Requirements: 4.1, 4.2_
  
  - [x] 3.2 Implement bidirectional streaming initialization
    - Create `initialize_stream()` method
    - Set up `invoke_model_with_bidirectional_stream`
    - Initialize audio input/output queues
    - _Requirements: 4.2, 4.3_
  
  - [x] 3.3 Implement event sending methods
    - Create `send_raw_event()` for sending JSON events
    - Create `send_audio_content_start_event()`
    - Create `add_audio_chunk()` for queuing audio
    - Create `send_audio_content_end_event()`
    - _Requirements: 4.3, 5.1, 5.2_
  
  - [x] 3.4 Implement response processing
    - Create `_process_responses()` async method
    - Handle contentStart, textOutput, audioOutput events
    - Handle toolUse and contentEnd events
    - Parse and decode event bytes
    - _Requirements: 4.4, 2.3_
  
  - [x] 3.5 Implement audio input processing
    - Create `_process_audio_input()` async method
    - Process audio queue and send to Bedrock
    - Base64 encode audio chunks
    - _Requirements: 3.1, 3.3_
  
  - [x] 3.6 Implement session lifecycle methods
    - Create `end_session()` method
    - Send sessionEnd event
    - Clean up resources and queues
    - _Requirements: 5.3, 5.4_

- [x] 4. Implement Session Manager
  - [x] 4.1 Create `session.py` with NovaSession class
    - Initialize session with ID and voice selection
    - Generate unique prompt and content names
    - _Requirements: 5.1, 6.4_
  
  - [x] 4.2 Implement event templates
    - Define START_SESSION_EVENT template
    - Define PROMPT_START_EVENT with tool configuration
    - Define CONTENT_START_EVENT for audio
    - Define AUDIO_EVENT_TEMPLATE
    - Define TOOL_RESULT_EVENT template
    - Define CONTENT_END_EVENT and SESSION_END_EVENT
    - _Requirements: 4.3, 5.1, 5.2_
  
  - [x] 4.3 Implement event stream generator
    - Create `generate_event_stream()` async generator
    - Send initialization events in correct order
    - Stream audio events from queue
    - _Requirements: 4.3, 5.1_
  
  - [x] 4.4 Implement tool handling
    - Create `handle_tool_use()` method
    - Call tool registry to execute tools
    - Format tool results for Nova Sonic
    - Send tool result events
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 5. Implement Tool Registry
  - [x] 5.1 Create `tools/__init__.py` with registry functions
    - Implement `get_all_tool_specs()` to collect all tool specs
    - Implement `execute_tool()` to route tool calls
    - Implement `get_available_tools()` for listing
    - _Requirements: 2.1, 2.2_
  
  - [x] 5.2 Implement Weather Tool
    - Create `tools/weather.py`
    - Implement `get_tool_spec()` with proper schema
    - Implement `execute()` to call Open-Meteo API
    - Use Nominatim for geocoding city names
    - Format weather data for response
    - _Requirements: 2.1, 2.3, 7.2_
  
  - [x] 5.3 Implement Search Tool
    - Create `tools/search.py`
    - Implement `get_tool_spec()` with proper schema
    - Implement `execute()` to call Brave Search API
    - Fetch and parse web content with BeautifulSoup
    - Format search results for response
    - _Requirements: 2.1, 2.3, 7.2_

- [x] 6. Implement WebSocket Server
  - [x] 6.1 Create `websocket_server.py` with server class
    - Set up FastAPI or aiohttp WebSocket server
    - Define message handlers for start/stop/audio
    - _Requirements: 1.1, 1.2_
  
  - [x] 6.2 Implement client connection handling
    - Create `handle_client()` method
    - Initialize Bedrock stream on "start" message
    - Handle audio chunks from client
    - Send responses back to client
    - _Requirements: 1.2, 1.3, 1.4_
  
  - [x] 6.3 Implement message routing
    - Route text outputs to client
    - Route audio outputs to client
    - Route tool results to client
    - Handle barge-in events
    - _Requirements: 1.4, 1.5, 2.3_
  
  - [x] 6.4 Implement cleanup on disconnect
    - End Bedrock session
    - Clear audio queues
    - Release resources
    - _Requirements: 5.3, 5.4, 7.3_

- [x] 7. Implement Streamlit UI
  - [x] 7.1 Create `ui.py` with Streamlit interface
    - Create title and description
    - Add voice selector dropdown
    - Add Start/Stop buttons
    - _Requirements: 1.1, 1.5, 6.4_
  
  - [x] 7.2 Implement conversation display
    - Display user messages
    - Display assistant messages
    - Display tool usage notifications
    - Show timestamps
    - _Requirements: 1.5, 2.3_
  
  - [x] 7.3 Implement status indicators
    - Show connection status
    - Show recording status
    - Show AI response status
    - Display error messages
    - _Requirements: 1.5, 7.1_
  
  - [x] 7.4 Add WebSocket client JavaScript
    - Embed JavaScript for WebSocket connection
    - Capture microphone audio with Web Audio API
    - Send audio chunks to Python backend
    - Play received audio chunks
    - _Requirements: 1.2, 1.3, 1.4, 3.1, 3.2_

- [x] 8. Implement Main Application
  - Create `main.py` as entry point
  - Start WebSocket server in background thread
  - Launch Streamlit UI
  - Handle graceful shutdown
  - _Requirements: 1.1, 5.4_

- [x] 9. Create Frontend Audio Handler
  - [x] 9.1 Create `public/audio-handler.js`
    - Initialize Web Audio API context
    - Set up AudioWorklet for microphone capture
    - Convert Float32 to Int16 audio format
    - Base64 encode audio chunks
    - _Requirements: 3.1, 3.3_
  
  - [x] 9.2 Implement audio playback
    - Decode base64 audio from server
    - Convert Int16 to Float32 for playback
    - Queue audio chunks for smooth playback
    - Handle playback errors gracefully
    - _Requirements: 1.4, 3.2, 7.3_
  
  - [x] 9.3 Implement WebSocket communication
    - Connect to Python WebSocket server
    - Send start/stop/audio messages
    - Receive and handle server messages
    - Handle connection errors
    - _Requirements: 1.2, 1.3, 7.1_

- [x] 10. Add error handling and logging
  - Add try-catch blocks for all async operations
  - Implement proper error messages for users
  - Add debug logging for development
  - Handle ValidationException from Bedrock
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 11. Create documentation
  - Write setup instructions in README.md
  - Document environment variables
  - Add usage examples
  - Document tool addition process
  - _Requirements: 6.1, 6.2_

- [ ] 12. Test the application
  - [ ]* 12.1 Test voice conversation flow
    - Start conversation and speak
    - Verify audio is captured and sent
    - Verify AI responds with audio
    - Test stop conversation
    - _Requirements: 1.2, 1.3, 1.4, 5.1, 5.2_
  
  - [ ]* 12.2 Test tool usage
    - Ask about weather in different cities
    - Verify weather tool is called
    - Ask to search for information
    - Verify search tool is called
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [ ]* 12.3 Test voice selection
    - Try different voices (matthew, tiffany, amy)
    - Verify voice changes are applied
    - _Requirements: 6.4_
  
  - [ ]* 12.4 Test error scenarios
    - Test with invalid AWS credentials
    - Test with network disconnection
    - Test with invalid audio format
    - Verify error messages are displayed
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
