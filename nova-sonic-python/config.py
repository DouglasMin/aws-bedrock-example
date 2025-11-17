"""
Configuration constants for Nova Sonic Python application
"""
import os
from dotenv import load_dotenv
# import pyaudio  # Not needed - audio handled in browser

# Load environment variables
load_dotenv()

# AWS Configuration
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")

# Server Configuration
PORT = int(os.getenv("PORT", 3000))
WEBSOCKET_PORT = int(os.getenv("WEBSOCKET_PORT", 8765))

# API Keys
BRAVE_SEARCH_API_KEY = os.getenv("BRAVE_SEARCH_API_KEY")

# Debug Mode
DEBUG = os.getenv("DEBUG", "False").lower() == "true"

# Audio Configuration
INPUT_SAMPLE_RATE = 16000
OUTPUT_SAMPLE_RATE = 24000
CHANNELS = 1
FORMAT = 8  # paInt16 equivalent (not used in this implementation)
CHUNK_SIZE = 1024

# Bedrock Configuration
MODEL_ID = "amazon.nova-sonic-v1:0"

# Inference Configuration
DEFAULT_INFERENCE_CONFIG = {
    "maxTokens": 1024,
    "topP": 0.9,
    "temperature": 0
}

# Audio Input Configuration
DEFAULT_AUDIO_INPUT_CONFIG = {
    "mediaType": "audio/lpcm",
    "sampleRateHertz": INPUT_SAMPLE_RATE,
    "sampleSizeBits": 16,
    "channelCount": CHANNELS,
    "audioType": "SPEECH",
    "encoding": "base64"
}

# Audio Output Configuration
DEFAULT_AUDIO_OUTPUT_CONFIG = {
    "mediaType": "audio/lpcm",
    "sampleRateHertz": OUTPUT_SAMPLE_RATE,
    "sampleSizeBits": 16,
    "channelCount": CHANNELS,
    "encoding": "base64",
    "audioType": "SPEECH"
}

# Text Configuration
DEFAULT_TEXT_CONFIG = {
    "mediaType": "text/plain"
}

# System Prompt
DEFAULT_SYSTEM_PROMPT = """You are a helpful voice assistant with access to real-time information tools.

When users ask about weather in any city, use the get_weather tool to provide current weather information.
When users ask to search for information or need current data, use the web_search tool.

Always use the appropriate tool to provide accurate, real-time information. After receiving tool results, provide a natural, conversational response based on the data.

Keep your responses concise and friendly."""

# Available Voices
AVAILABLE_VOICES = [
    {"id": "matthew", "name": "Matthew", "language": "US English", "icon": "👨"},
    {"id": "tiffany", "name": "Tiffany", "language": "US English", "icon": "👩"},
    {"id": "amy", "name": "Amy", "language": "UK English", "icon": "👩"},
    {"id": "lupe", "name": "Lupe", "language": "Español", "icon": "👩"},
    {"id": "carlos", "name": "Carlos", "language": "Español", "icon": "👨"},
    {"id": "ambre", "name": "Ambre", "language": "Français", "icon": "👩"},
    {"id": "florian", "name": "Florian", "language": "Français", "icon": "👨"},
    {"id": "greta", "name": "Greta", "language": "Deutsch", "icon": "👩"},
    {"id": "lennart", "name": "Lennart", "language": "Deutsch", "icon": "👨"},
    {"id": "beatrice", "name": "Beatrice", "language": "Italiano", "icon": "👩"},
    {"id": "lorenzo", "name": "Lorenzo", "language": "Italiano", "icon": "👨"},
]

def debug_print(message: str):
    """Print debug messages if DEBUG mode is enabled"""
    if DEBUG:
        import datetime
        import inspect
        
        # Get caller function name
        frame = inspect.currentframe()
        caller_frame = frame.f_back
        function_name = caller_frame.f_code.co_name
        
        timestamp = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
        print(f"{timestamp} {function_name} {message}")
