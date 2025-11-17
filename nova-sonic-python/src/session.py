"""
Session management for Nova Sonic streaming
"""
import asyncio
import uuid
from typing import AsyncGenerator

from config import (
    DEFAULT_INFERENCE_CONFIG,
    DEFAULT_AUDIO_INPUT_CONFIG,
    DEFAULT_AUDIO_OUTPUT_CONFIG,
    DEFAULT_TEXT_CONFIG,
    DEFAULT_SYSTEM_PROMPT,
    debug_print
)


class NovaSession:
    """Manages conversation sessions and event generation"""
    
    # Event templates
    START_SESSION_EVENT = '''{
        "event": {
            "sessionStart": {
                "inferenceConfiguration": {
                    "maxTokens": 1024,
                    "topP": 0.9,
                    "temperature": 0
                }
            }
        }
    }'''
    
    CONTENT_START_EVENT = '''{
        "event": {
            "contentStart": {
                "promptName": "%s",
                "contentName": "%s",
                "type": "AUDIO",
                "interactive": true,
                "role": "USER",
                "audioInputConfiguration": {
                    "mediaType": "audio/lpcm",
                    "sampleRateHertz": 16000,
                    "sampleSizeBits": 16,
                    "channelCount": 1,
                    "audioType": "SPEECH",
                    "encoding": "base64"
                }
            }
        }
    }'''
    
    AUDIO_EVENT_TEMPLATE = '''{
        "event": {
            "audioInput": {
                "promptName": "%s",
                "contentName": "%s",
                "content": "%s"
            }
        }
    }'''
    
    TEXT_CONTENT_START_EVENT = '''{
        "event": {
            "contentStart": {
                "promptName": "%s",
                "contentName": "%s",
                "type": "TEXT",
                "role": "%s",
                "interactive": false,
                "textInputConfiguration": {
                    "mediaType": "text/plain"
                }
            }
        }
    }'''
    
    TEXT_INPUT_EVENT = '''{
        "event": {
            "textInput": {
                "promptName": "%s",
                "contentName": "%s",
                "content": "%s"
            }
        }
    }'''
    
    TOOL_CONTENT_START_EVENT = '''{
        "event": {
            "contentStart": {
                "promptName": "%s",
                "contentName": "%s",
                "interactive": false,
                "type": "TOOL",
                "role": "TOOL",
                "toolResultInputConfiguration": {
                    "toolUseId": "%s",
                    "type": "TEXT",
                    "textInputConfiguration": {
                        "mediaType": "text/plain"
                    }
                }
            }
        }
    }'''
    
    TOOL_RESULT_EVENT = '''{
        "event": {
            "toolResult": {
                "promptName": "%s",
                "contentName": "%s",
                "content": %s
            }
        }
    }'''
    
    CONTENT_END_EVENT = '''{
        "event": {
            "contentEnd": {
                "promptName": "%s",
                "contentName": "%s"
            }
        }
    }'''
    
    PROMPT_END_EVENT = '''{
        "event": {
            "promptEnd": {
                "promptName": "%s"
            }
        }
    }'''
    
    SESSION_END_EVENT = '''{
        "event": {
            "sessionEnd": {}
        }
    }'''
    
    def __init__(self, session_id: str, voice_id: str = "matthew"):
        """Initialize a new session."""
        self.session_id = session_id
        self.voice_id = voice_id
        self.prompt_name = str(uuid.uuid4())
        self.content_name = str(uuid.uuid4())
        self.audio_content_name = str(uuid.uuid4())
        self.is_active = False
        self.audio_queue = []
        self.session_ready = False
        
        debug_print(f"Session initialized: {session_id} with voice: {voice_id}")
    
    def start(self):
        """Start the session."""
        self.is_active = True
        debug_print("Session started")

    def create_prompt_start_event(self, tool_specs: list) -> str:
        """Create a promptStart event with tool configuration."""
        import json
        
        prompt_start = {
            "event": {
                "promptStart": {
                    "promptName": self.prompt_name,
                    "textOutputConfiguration": DEFAULT_TEXT_CONFIG,
                    "audioOutputConfiguration": {
                        **DEFAULT_AUDIO_OUTPUT_CONFIG,
                        "voiceId": self.voice_id
                    },
                    "toolUseOutputConfiguration": {
                        "mediaType": "application/json"
                    },
                    "toolConfiguration": {
                        "tools": tool_specs
                    }
                }
            }
        }
        
        return json.dumps(prompt_start)
    
    async def generate_event_stream(self, tool_specs: list) -> AsyncGenerator:
        """Generate event stream for Bedrock."""
        text_encoder = lambda s: s.encode('utf-8')
        
        debug_print(f"Tool specs loaded: {len(tool_specs)}")
        
        # Initial events
        init_events = [
            # 1. sessionStart
            self.START_SESSION_EVENT,
            
            # 2. promptStart with tools
            self.create_prompt_start_event(tool_specs),
            
            # 3. System prompt contentStart
            self.TEXT_CONTENT_START_EVENT % (
                self.prompt_name,
                self.content_name,
                "SYSTEM"
            ),
            
            # 4. textInput
            self.TEXT_INPUT_EVENT % (
                self.prompt_name,
                self.content_name,
                DEFAULT_SYSTEM_PROMPT
            ),
            
            # 5. System prompt contentEnd
            self.CONTENT_END_EVENT % (
                self.prompt_name,
                self.content_name
            ),
            
            # 6. Audio contentStart
            self.CONTENT_START_EVENT % (
                self.prompt_name,
                self.audio_content_name
            )
        ]
        
        # Send initial events
        for event in init_events:
            event_json = event if isinstance(event, str) else event
            debug_print(f"Sending init event")
            yield {
                "chunk": {
                    "bytes": text_encoder(event_json)
                }
            }
            await asyncio.sleep(0.03)
        
        self.session_ready = True
        debug_print("Session ready for audio")
        
        # Stream audio events
        sent_count = 0
        while self.is_active:
            if self.audio_queue:
                audio_event = self.audio_queue.pop(0)
                yield {
                    "chunk": {
                        "bytes": text_encoder(audio_event)
                    }
                }
                sent_count += 1
                if sent_count % 100 == 0:
                    debug_print(f"Sent {sent_count} audio events, queue: {len(self.audio_queue)}")
            else:
                await asyncio.sleep(0.001)
        
        debug_print("Event stream ended")
    
    def add_audio_chunk(self, base64_audio: str):
        """Add an audio chunk to the queue."""
        if not self.session_ready:
            return
        
        audio_event = self.AUDIO_EVENT_TEMPLATE % (
            self.prompt_name,
            self.audio_content_name,
            base64_audio
        )
        self.audio_queue.append(audio_event)

    async def handle_tool_use(self, tool_use_event: dict) -> dict:
        """Handle tool use and return result."""
        from tools import execute_tool
        import json
        
        tool_name = tool_use_event['toolName']
        tool_input = json.loads(tool_use_event['content'])
        tool_use_id = tool_use_event['toolUseId']
        
        debug_print(f"Tool requested: {tool_name}")
        debug_print(f"Tool input: {tool_input}")
        
        try:
            tool_result = await execute_tool(tool_name, tool_input)
            debug_print(f"Tool result: {tool_result}")
            
            tool_result_content_id = str(uuid.uuid4())
            
            # 1. contentStart for tool result
            self.audio_queue.append(
                self.TOOL_CONTENT_START_EVENT % (
                    self.prompt_name,
                    tool_result_content_id,
                    tool_use_id
                )
            )
            
            # 2. toolResult
            result_json = json.dumps(tool_result) if isinstance(tool_result, dict) else str(tool_result)
            self.audio_queue.append(
                self.TOOL_RESULT_EVENT % (
                    self.prompt_name,
                    tool_result_content_id,
                    result_json
                )
            )
            
            # 3. contentEnd
            self.audio_queue.append(
                self.CONTENT_END_EVENT % (
                    self.prompt_name,
                    tool_result_content_id
                )
            )
            
            return tool_result
            
        except Exception as error:
            debug_print(f"Tool execution failed: {error}")
            raise error
    
    async def end(self):
        """End the session."""
        if not self.is_active:
            return
        
        debug_print("Ending session...")
        
        # 1. Audio contentEnd
        self.audio_queue.append(
            self.CONTENT_END_EVENT % (
                self.prompt_name,
                self.audio_content_name
            )
        )
        
        # 2. promptEnd
        self.audio_queue.append(
            self.PROMPT_END_EVENT % (self.prompt_name)
        )
        
        # 3. sessionEnd
        self.audio_queue.append(self.SESSION_END_EVENT)
        
        # Wait a bit for events to be sent
        await asyncio.sleep(0.1)
        
        # Now stop the stream
        self.is_active = False
        self.session_ready = False
        
        debug_print("Session ended")
