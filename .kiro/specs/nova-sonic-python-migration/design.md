# Design Document

## Overview

This document outlines the technical design for migrating the Nova Sonic voice chat application from Node.js to Python. The migration maintains identical functionality while enabling future LangChain and RAG integration.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────┐
│         Browser (Frontend)              │
│  - Streamlit UI (conversation display)  │
│  - WebSocket client (audio streaming)   │
│  - Web Audio API (mic/speaker)          │
└──────────────┬──────────────────────────┘
               │ WebSocket
┌──────────────▼──────────────────────────┐
│      Python Backend Server              │
│  ┌────────────────────────────────────┐ │
│  │  WebSocket Server (FastAPI/aiohttp)│ │
│  └────────────┬───────────────────────┘ │
│               │                          │
│  ┌────────────▼───────────────────────┐ │
│  │  Bedrock Stream Manager            │ │
│  │  - Session management              │ │
│  │  - Event stream handling           │ │
│  │  - Audio queue management          │ │
│  └────────────┬───────────────────────┘ │
│               │                          │
│  ┌────────────▼───────────────────────┐ │
│  │  Tool Registry                     │ │
│  │  - Weather tool                    │ │
│  │  - Web search tool                 │ │
│  └────────────────────────────────────┘ │
└──────────────┬──────────────────────────┘
               │ HTTP/2 Bidirectional
┌──────────────▼──────────────────────────┐
│      AWS Bedrock Nova Sonic             │
│  - Speech-to-speech model               │
│  - Tool use capabilities                │
└─────────────────────────────────────────┘
```

### Technology Stack

**Backend:**
- Python 3.10+
- `aws-sdk-python` (experimental) - Bedrock bidirectional streaming
- `fastapi` or `aiohttp` - WebSocket server
- `pyaudio` - Audio input/output
- `asyncio` - Async event handling

**Frontend:**
- Streamlit - UI framework
- JavaScript - WebSocket client and Web Audio API
- HTML5 Audio API - Microphone capture and playback

**AWS Services:**
- Amazon Bedrock Nova Sonic (amazon.nova-sonic-v1:0)

## Components and Interfaces

### 1. Main Application (`main.py`)

Entry point that launches both Streamlit UI and WebSocket server.

```python
import streamlit as st
import asyncio
from websocket_server import start_websocket_server
from ui import render_streamlit_ui

async def main():
    # Start WebSocket server in background
    ws_task = asyncio.create_task(start_websocket_server())
    
    # Run Streamlit UI
    render_streamlit_ui()
    
    await ws_task

if __name__ == "__main__":
    asyncio.run(main())
```

### 2. WebSocket Server (`websocket_server.py`)

Handles real-time audio streaming between browser and Python backend.

**Interface:**
```python
class WebSocketServer:
    async def start(self, host: str = "localhost", port: int = 8765)
    async def handle_client(self, websocket, path)
    async def send_audio(self, websocket, audio_data: bytes)
    async def receive_audio(self, websocket) -> bytes
```

**Messages:**
- Client → Server: `{"type": "start", "voiceId": "matthew"}`
- Client → Server: `{"type": "audio", "audio": "<base64>"}`
- Client → Server: `{"type": "stop"}`
- Server → Client: `{"type": "ready"}`
- Server → Client: `{"type": "text", "role": "user|assistant", "content": "..."}`
- Server → Client: `{"type": "audio", "content": "<base64>"}`
- Server → Client: `{"type": "tool-result", "toolName": "...", "result": {...}}`

### 3. Bedrock Stream Manager (`bedrock_stream_manager.py`)

Manages bidirectional streaming with Nova Sonic.

**Interface:**
```python
class BedrockStreamManager:
    def __init__(self, model_id: str, region: str)
    def _initialize_client(self)
    async def initialize_stream(self) -> 'BedrockStreamManager'
    async def send_raw_event(self, event_json: str)
    async def send_audio_content_start_event(self)
    def add_audio_chunk(self, audio_bytes: bytes)
    async def send_audio_content_end_event(self)
    async def _process_audio_input(self)
    async def _process_responses(self)
    async def handle_event(self, event: dict)
    async def process_tool_use(self, tool_name: str, tool_input: dict) -> dict
    async def send_tool_result(self, tool_use_id: str, result: dict)
    async def end_session(self)
```

**Key Methods:**
- `initialize_stream()`: Sets up bidirectional stream with Bedrock
- `add_audio_chunk()`: Queues audio for sending to Nova Sonic
- `_process_responses()`: Handles incoming events from Nova Sonic
- `process_tool_use()`: Executes tools and returns results

### 4. Session Manager (`session.py`)

Manages conversation sessions and event generation.

**Interface:**
```python
class NovaSession:
    def __init__(self, session_id: str, voice_id: str = "matthew")
    def start(self)
    async def generate_event_stream(self) -> AsyncGenerator
    def add_audio_chunk(self, base64_audio: str)
    async def handle_tool_use(self, tool_use_event: dict) -> dict
    async def end(self)
```

**Event Templates:**
- `START_SESSION_EVENT`
- `PROMPT_START_EVENT`
- `CONTENT_START_EVENT`
- `AUDIO_EVENT_TEMPLATE`
- `TOOL_RESULT_EVENT`
- `CONTENT_END_EVENT`
- `SESSION_END_EVENT`

### 5. Tool Registry (`tools/__init__.py`)

Central management for all tools.

**Interface:**
```python
def get_all_tool_specs() -> List[dict]
async def execute_tool(tool_name: str, params: dict) -> dict
def get_available_tools() -> List[str]
```

### 6. Weather Tool (`tools/weather.py`)

Fetches weather information using Open-Meteo API.

**Interface:**
```python
def get_tool_spec() -> dict
async def execute(params: dict) -> dict
```

**Input:** `{"city": "Seoul"}`
**Output:** `{"location": "...", "temperature": "...", "condition": "...", "windSpeed": "..."}`

### 7. Search Tool (`tools/search.py`)

Performs web search using Brave Search API.

**Interface:**
```python
def get_tool_spec() -> dict
async def execute(params: dict) -> dict
```

**Input:** `{"query": "latest AI news"}`
**Output:** `{"query": "...", "summary": "...", "topResults": [...]}`

### 8. Configuration (`config.py`)

Centralized configuration constants.

```python
# Audio configurations
INPUT_SAMPLE_RATE = 16000
OUTPUT_SAMPLE_RATE = 24000
CHANNELS = 1
FORMAT = pyaudio.paInt16

# Bedrock configurations
MODEL_ID = "amazon.nova-sonic-v1:0"
DEFAULT_INFERENCE_CONFIG = {
    "maxTokens": 1024,
    "topP": 0.9,
    "temperature": 0
}

# System prompt
DEFAULT_SYSTEM_PROMPT = """You are a helpful voice assistant..."""
```

### 9. Streamlit UI (`ui.py`)

Renders the conversation interface.

**Components:**
- Title and description
- Voice selector dropdown
- Start/Stop buttons
- Conversation history display
- Status indicator
- Tool usage display

## Data Models

### Audio Data Flow

```
Browser Microphone
    ↓ (Float32Array)
Web Audio API
    ↓ (Int16Array, base64)
WebSocket
    ↓ (JSON message)
Python Backend
    ↓ (bytes)
Bedrock Stream Manager
    ↓ (base64 LPCM)
Nova Sonic
    ↓ (base64 LPCM)
Bedrock Stream Manager
    ↓ (bytes)
WebSocket
    ↓ (JSON message)
Browser Speaker
```

### Event Stream Format

All events follow this structure:
```json
{
  "event": {
    "eventType": {
      "field1": "value1",
      "field2": "value2"
    }
  }
}
```

### Tool Specification Format

```python
{
    "toolSpec": {
        "name": "tool_name",
        "description": "Tool description",
        "inputSchema": {
            "json": {
                "type": "object",
                "properties": {...},
                "required": [...]
            }
        }
    }
}
```

## Error Handling

### Connection Errors
- WebSocket disconnection: Clean up resources, notify user
- Bedrock connection failure: Retry with exponential backoff
- Audio device errors: Display clear error message

### Tool Execution Errors
- Tool not found: Return error message to Nova Sonic
- Tool execution failure: Log error, return error response
- Timeout: Cancel tool execution after 30 seconds

### Audio Processing Errors
- Invalid audio format: Skip chunk, log warning
- Buffer overflow: Clear queue, restart stream
- Playback failure: Attempt recovery, notify user

### Validation Errors
- Invalid event format: Log error, continue processing
- Missing required fields: Use default values where possible
- ValidationException from Bedrock: Parse error message, display to user

## Testing Strategy

### Unit Tests
- Test each tool independently
- Test event generation
- Test audio format conversion
- Test configuration loading

### Integration Tests
- Test WebSocket message flow
- Test Bedrock streaming
- Test tool execution flow
- Test session lifecycle

### Manual Testing
- Test voice conversation end-to-end
- Test tool usage (weather, search)
- Test error scenarios
- Test different voices
- Test barge-in functionality

## Performance Considerations

### Audio Streaming
- Use asyncio queues for non-blocking audio processing
- Maintain separate queues for input and output
- Process audio chunks in batches for efficiency

### Memory Management
- Clear audio queues after playback
- Release Bedrock stream resources on session end
- Limit conversation history size

### Concurrency
- Use asyncio for all I/O operations
- Run WebSocket server and Streamlit in separate threads
- Handle multiple concurrent sessions

## Security Considerations

- Load AWS credentials from environment variables only
- Validate all user inputs before processing
- Sanitize tool outputs before sending to Nova Sonic
- Use HTTPS for production deployment
- Implement rate limiting for tool usage

## Deployment

### Local Development
```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

### Environment Variables
```
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
BRAVE_SEARCH_API_KEY=...
PORT=3000
```

### Dependencies
```
aws-sdk-bedrock-runtime>=0.1.0
fastapi>=0.104.0
websockets>=12.0
pyaudio>=0.2.14
streamlit>=1.28.0
aiohttp>=3.9.0
python-dotenv>=1.0.0
```

## Migration Notes

### Key Differences from Node.js Version

1. **Async/Await**: Python uses `asyncio` instead of Node.js promises
2. **Audio Processing**: PyAudio instead of Web Audio API on server
3. **WebSocket**: Python websockets library instead of `ws` package
4. **UI**: Streamlit instead of HTML/CSS/JS
5. **SDK**: aws-sdk-python instead of @aws-sdk/client-bedrock-runtime

### Preserved Functionality

- Bidirectional audio streaming
- Tool use (weather, search)
- Voice selection
- Barge-in support
- Speculative text filtering
- Session management

### Future Enhancements

- LangChain integration for advanced tool orchestration
- RAG (Retrieval-Augmented Generation) with vector database
- Conversation memory and context management
- Additional tools (calculator, Wikipedia, etc.)
- Multi-language support
