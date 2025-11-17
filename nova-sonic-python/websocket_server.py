"""
WebSocket Server for Nova Sonic
Handles real-time audio streaming between browser and Python backend
"""
import asyncio
import json
import websockets
from typing import Dict, Set
from uuid import uuid4

from src.bedrock_stream_manager import BedrockStreamManager
from config import WEBSOCKET_PORT, debug_print


class WebSocketServer:
    """WebSocket server for handling client connections and audio streaming"""
    
    def __init__(self, host: str = "localhost", port: int = WEBSOCKET_PORT):
        """Initialize the WebSocket server."""
        self.host = host
        self.port = port
        self.clients: Set = set()
        self.sessions: Dict[str, BedrockStreamManager] = {}
    
    async def start(self):
        """Start the WebSocket server."""
        debug_print(f"Starting WebSocket server on {self.host}:{self.port}")
        
        async with websockets.serve(self.handle_client, self.host, self.port):
            debug_print(f"✅ WebSocket server running on ws://{self.host}:{self.port}")
            await asyncio.Future()  # Run forever
    
    async def handle_client(self, websocket):
        """Handle a client connection."""
        client_id = str(uuid4())
        self.clients.add(websocket)
        current_session = None
        
        debug_print(f"✅ Client connected: {client_id}")
        
        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    message_type = data.get("type")
                    
                    if message_type == "start":
                        debug_print("🎤 Starting conversation...")
                        voice_id = data.get("voiceId", "matthew")
                        debug_print(f"🎙️ Selected voice: {voice_id}")
                        
                        # Response handler to send messages back to client
                        def response_handler(msg_type: str, msg_data: dict):
                            asyncio.create_task(
                                self.send_to_client(websocket, msg_type, msg_data)
                            )
                        
                        try:
                            # Create and initialize Bedrock stream manager
                            session_id = str(uuid4())
                            
                            # Send initialization events
                            from src.session import NovaSession
                            from tools import get_all_tool_specs
                            
                            nova_session = NovaSession(session_id, voice_id)
                            nova_session.start()
                            
                            # Initialize stream manager with NovaSession's IDs
                            current_session = BedrockStreamManager()
                            # Sync the prompt and content names
                            current_session.prompt_name = nova_session.prompt_name
                            current_session.content_name = nova_session.content_name
                            current_session.audio_content_name = nova_session.audio_content_name
                            
                            await current_session.initialize_stream(response_handler)
                            
                            # Get tool specs
                            tool_specs = get_all_tool_specs()
                            
                            # Send session start event
                            await current_session.send_raw_event(NovaSession.START_SESSION_EVENT)
                            await asyncio.sleep(0.1)
                            
                            # Send prompt start with tools
                            prompt_start = nova_session.create_prompt_start_event(tool_specs)
                            await current_session.send_raw_event(prompt_start)
                            await asyncio.sleep(0.1)
                            
                            # Send system prompt
                            from config import DEFAULT_SYSTEM_PROMPT
                            
                            system_content_start = NovaSession.TEXT_CONTENT_START_EVENT % (
                                nova_session.prompt_name,
                                nova_session.content_name,
                                "SYSTEM"
                            )
                            await current_session.send_raw_event(system_content_start)
                            await asyncio.sleep(0.03)
                            
                            # Escape the system prompt for JSON
                            escaped_prompt = DEFAULT_SYSTEM_PROMPT.replace('\n', ' ').replace('"', '\\"')
                            system_text = NovaSession.TEXT_INPUT_EVENT % (
                                nova_session.prompt_name,
                                nova_session.content_name,
                                escaped_prompt
                            )
                            await current_session.send_raw_event(system_text)
                            await asyncio.sleep(0.03)
                            
                            system_content_end = NovaSession.CONTENT_END_EVENT % (
                                nova_session.prompt_name,
                                nova_session.content_name
                            )
                            await current_session.send_raw_event(system_content_end)
                            await asyncio.sleep(0.1)
                            
                            # Send audio content start
                            await current_session.send_audio_content_start_event()
                            
                            # Store session
                            self.sessions[client_id] = current_session
                            
                            # Send ready message to client
                            await self.send_to_client(websocket, "ready", {
                                "message": "Session started"
                            })
                            debug_print("✅ Session ready for audio")
                            
                        except Exception as e:
                            debug_print(f"❌ Session start error: {e}")
                            await self.send_to_client(websocket, "error", {
                                "message": str(e)
                            })
                    
                    elif message_type == "audio" and current_session:
                        # Receive audio from client and send to Bedrock
                        audio_base64 = data.get("audio")
                        if audio_base64:
                            import base64
                            audio_bytes = base64.b64decode(audio_base64)
                            current_session.add_audio_chunk(audio_bytes)
                    
                    elif message_type == "stop":
                        debug_print("⏹️ Stopping conversation...")
                        if current_session:
                            await current_session.end_session()
                            if client_id in self.sessions:
                                del self.sessions[client_id]
                            current_session = None
                
                except json.JSONDecodeError as e:
                    debug_print(f"❌ JSON decode error: {e}")
                except Exception as e:
                    debug_print(f"❌ Error processing message: {e}")
                    await self.send_to_client(websocket, "error", {
                        "message": str(e)
                    })
        
        except websockets.exceptions.ConnectionClosed:
            debug_print(f"❌ Client disconnected: {client_id}")
        finally:
            # Cleanup
            self.clients.discard(websocket)
            if current_session:
                await current_session.end_session()
            if client_id in self.sessions:
                del self.sessions[client_id]
            debug_print(f"🧹 Cleaned up session for client: {client_id}")
    
    async def send_to_client(self, websocket, msg_type: str, data: dict):
        """Send a message to a client."""
        try:
            message = json.dumps({
                "type": msg_type,
                **data
            })
            await websocket.send(message)
        except Exception as e:
            debug_print(f"Error sending to client: {e}")


async def start_websocket_server(host: str = "localhost", port: int = WEBSOCKET_PORT):
    """Start the WebSocket server."""
    server = WebSocketServer(host, port)
    await server.start()
