# Nova Sonic Python - Voice Chat Application

Real-time voice conversation application using AWS Bedrock Nova Sonic with Python.

## Features

- 🎤 Real-time speech-to-speech conversations
- 🔧 Tool use capabilities (weather, web search)
- 🎙️ Multiple voice options (Matthew, Tiffany, Amy, etc.)
- 🛑 Barge-in support
- 🌐 Streamlit web interface

## Prerequisites

- Python 3.10 or higher
- AWS Account with Bedrock access
- Microphone and speakers
- Brave Search API key (for web search tool)

## Installation

1. Clone the repository and navigate to the project directory:
```bash
cd nova-sonic-python
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your AWS credentials and API keys
```

## Configuration

Edit the `.env` file with your credentials:

```
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_REGION=us-east-1
BRAVE_SEARCH_API_KEY=your-brave-search-api-key
```

## Usage

1. Start the application:
```bash
python main.py
```

2. Open your browser to `http://localhost:3000`

3. Select a voice from the dropdown

4. Click "Start Conversation" and allow microphone access

5. Start speaking! The AI will respond with voice and can use tools when needed

6. Click "Stop Conversation" to end the session

## Project Structure

```
nova-sonic-python/
├── main.py                 # Application entry point
├── config.py              # Configuration constants
├── websocket_server.py    # WebSocket server for audio streaming
├── ui.py                  # Streamlit UI
├── src/
│   ├── bedrock_stream_manager.py  # Bedrock streaming handler
│   └── session.py                 # Session management
├── tools/
│   ├── __init__.py       # Tool registry
│   ├── weather.py        # Weather tool
│   └── search.py         # Web search tool
├── public/
│   └── audio-handler.js  # Frontend audio processing
├── requirements.txt      # Python dependencies
└── .env                  # Environment variables (create from .env.example)
```

## Adding New Tools

1. Create a new file in `tools/` directory (e.g., `calculator.py`)

2. Implement two functions:
```python
def get_tool_spec() -> dict:
    return {
        "toolSpec": {
            "name": "calculator",
            "description": "Performs mathematical calculations",
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "expression": {
                            "type": "string",
                            "description": "Mathematical expression to evaluate"
                        }
                    },
                    "required": ["expression"]
                }
            }
        }
    }

async def execute(params: dict) -> dict:
    expression = params["expression"]
    # Your tool logic here
    result = eval(expression)  # Be careful with eval in production!
    return {"result": result}
```

3. Register the tool in `tools/__init__.py`:
```python
from . import calculator

tools = {
    'get_weather': weather,
    'web_search': search,
    'calculator': calculator  # Add your tool
}
```

## Troubleshooting

### Microphone not working
- Check browser permissions for microphone access
- Ensure you're using HTTPS or localhost
- Try a different browser

### AWS Connection errors
- Verify AWS credentials in `.env`
- Check that your AWS account has Bedrock access
- Ensure Nova Sonic is available in your region

### Audio playback issues
- Check speaker/headphone connections
- Verify browser audio permissions
- Try refreshing the page

### Tool execution failures
- Check API keys in `.env`
- Verify network connectivity
- Check tool-specific error messages in console

## Development

### Running in debug mode
```bash
DEBUG=True python main.py
```

### Testing individual components
```python
# Test weather tool
python -c "from tools.weather import execute; import asyncio; print(asyncio.run(execute({'city': 'Seoul'})))"

# Test search tool
python -c "from tools.search import execute; import asyncio; print(asyncio.run(execute({'query': 'AI news'})))"
```

## License

MIT License

## Acknowledgments

- AWS Bedrock Nova Sonic
- AWS SDK for Python (experimental)
- Open-Meteo API for weather data
- Brave Search API for web search
