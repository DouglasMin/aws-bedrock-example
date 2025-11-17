"""
Bedrock Stream Manager for Nova Sonic
Handles bidirectional streaming with AWS Bedrock
"""
import asyncio
import base64
import json
import uuid
from typing import Callable, Optional

import os
from aws_sdk_bedrock_runtime.client import BedrockRuntimeClient
from aws_sdk_bedrock_runtime.models import (
    InvokeModelWithBidirectionalStreamOperationInput,
    InvokeModelWithBidirectionalStreamInputChunk,
    BidirectionalInputPayloadPart
)
from aws_sdk_bedrock_runtime.config import Config
from smithy_aws_core.identity.environment import EnvironmentCredentialsResolver

from config import (
    MODEL_ID,
    AWS_REGION,
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    debug_print
)


class BedrockStreamManager:
    """Manages bidirectional streaming with AWS Bedrock using asyncio"""
    
    def __init__(self, model_id: str = MODEL_ID, region: str = AWS_REGION):
        """Initialize the stream manager."""
        self.model_id = model_id
        self.region = region
        
        # Asyncio queues for audio streaming
        self.audio_input_queue = asyncio.Queue()
        self.audio_output_queue = asyncio.Queue()
        self.output_queue = asyncio.Queue()
        
        self.response_task = None
        self.stream_response = None
        self.is_active = False
        self.barge_in = False
        self.bedrock_client = None
        
        # Text response components
        self.display_assistant_text = False
        self.role = None
        
        # Session information
        self.prompt_name = str(uuid.uuid4())
        self.content_name = str(uuid.uuid4())
        self.audio_content_name = str(uuid.uuid4())
        self.tool_use_content = ""
        self.tool_use_id = ""
        self.tool_name = ""
        
        # Response handler callback
        self.response_handler: Optional[Callable] = None
    
    def _initialize_client(self):
        """Initialize the Bedrock client."""
        config = Config(
            endpoint_uri=f"https://bedrock-runtime.{self.region}.amazonaws.com",
            region=self.region,
            aws_credentials_identity_resolver=EnvironmentCredentialsResolver(),
        )
        self.bedrock_client = BedrockRuntimeClient(config=config)
        debug_print("Bedrock client initialized")

    async def initialize_stream(self, response_handler: Callable):
        """Initialize the bidirectional stream with Bedrock."""
        if not self.bedrock_client:
            self._initialize_client()
        
        self.response_handler = response_handler
        
        try:
            debug_print("Initializing bidirectional stream...")
            
            # Create the operation input with model_id
            debug_print(f"Creating operation input with model_id: {self.model_id}")
            operation_input = InvokeModelWithBidirectionalStreamOperationInput(
                model_id=self.model_id
            )
            
            debug_print("Calling invoke_model_with_bidirectional_stream...")
            self.stream_response = await self.bedrock_client.invoke_model_with_bidirectional_stream(
                operation_input
            )
            
            debug_print(f"Stream response type: {type(self.stream_response)}")
            debug_print(f"Stream response attributes: {dir(self.stream_response)}")
            
            self.is_active = True
            debug_print("Stream initialized successfully")
            
            # Start processing responses
            self.response_task = asyncio.create_task(self._process_responses())
            
            # Start processing audio input
            asyncio.create_task(self._process_audio_input())
            
            # Wait a bit to ensure everything is set up
            await asyncio.sleep(0.1)
            
            return self
            
        except Exception as e:
            self.is_active = False
            debug_print(f"Failed to initialize stream: {str(e)}")
            raise

    async def send_raw_event(self, event_json: str):
        """Send a raw event JSON to the Bedrock stream."""
        if not self.stream_response or not self.is_active:
            debug_print("Stream not initialized or closed")
            return
        
        event = InvokeModelWithBidirectionalStreamInputChunk(
            value=BidirectionalInputPayloadPart(bytes_=event_json.encode('utf-8'))
        )
        
        try:
            await self.stream_response.input_stream.send(event)
            
            # Log event type for debugging
            if len(event_json) > 200:
                event_data = json.loads(event_json)
                event_type = list(event_data.get("event", {}).keys())
                debug_print(f"Sent event type: {event_type}")
            else:
                debug_print(f"Sent event: {event_json[:100]}...")
                
        except Exception as e:
            debug_print(f"Error sending event: {str(e)}")
    
    async def send_audio_content_start_event(self):
        """Send a content start event for audio to the Bedrock stream."""
        from .session import NovaSession
        
        content_start_event = NovaSession.CONTENT_START_EVENT % (
            self.prompt_name,
            self.audio_content_name
        )
        await self.send_raw_event(content_start_event)
        debug_print("Audio content start event sent")
    
    def add_audio_chunk(self, audio_bytes: bytes):
        """Add an audio chunk to the queue."""
        self.audio_input_queue.put_nowait({
            'audio_bytes': audio_bytes,
            'prompt_name': self.prompt_name,
            'content_name': self.audio_content_name
        })
    
    async def send_audio_content_end_event(self):
        """Send a content end event to the Bedrock stream."""
        if not self.is_active:
            debug_print("Stream is not active")
            return
        
        from .session import NovaSession
        
        content_end_event = NovaSession.CONTENT_END_EVENT % (
            self.prompt_name,
            self.audio_content_name
        )
        await self.send_raw_event(content_end_event)
        debug_print("Audio content end event sent")

    async def _process_responses(self):
        """Process incoming responses from Bedrock."""
        try:
            debug_print("Starting response processing...")
            
            while self.is_active:
                try:
                    output = await self.stream_response.await_output()
                    result = await output[1].receive()
                    
                    if result.value and result.value.bytes_:
                        response_data = result.value.bytes_.decode('utf-8')
                        json_data = json.loads(response_data)
                        
                        if 'event' in json_data:
                            await self.handle_event(json_data['event'])
                        
                        # Put the response in the output queue
                        await self.output_queue.put(json_data)
                        
                except StopAsyncIteration:
                    debug_print("Stream has ended")
                    break
                except json.JSONDecodeError as e:
                    debug_print(f"JSON parse error: {e}")
                    # Continue processing, don't break
                except Exception as e:
                    error_msg = str(e)
                    if "Invalid event bytes" in error_msg:
                        debug_print(f"Invalid event bytes (likely end of response), continuing...")
                        # Don't break, continue processing
                    elif "ValidationException" in error_msg:
                        debug_print(f"Validation error: {error_msg}")
                        break
                    else:
                        debug_print(f"Error receiving response: {e}")
                        break
            
        except Exception as e:
            debug_print(f"Response processing error: {e}")
        finally:
            self.is_active = False
            debug_print("Response processing ended")
    
    async def handle_event(self, evt: dict):
        """Handle individual events from Bedrock."""
        # contentStart - track generation stage
        if 'contentStart' in evt:
            content_start = evt['contentStart']
            self.role = content_start.get('role')
            
            # Check for speculative content
            if 'additionalModelFields' in content_start:
                try:
                    additional_fields = json.loads(content_start['additionalModelFields'])
                    if additional_fields.get('generationStage') == 'SPECULATIVE':
                        self.display_assistant_text = True
                        debug_print("Speculative content detected")
                    else:
                        self.display_assistant_text = False
                except json.JSONDecodeError:
                    debug_print("Error parsing additionalModelFields")
        
        # textOutput: ASR or response
        elif 'textOutput' in evt:
            text_content = evt['textOutput']['content']
            role = evt['textOutput'].get('role', 'ASSISTANT')
            
            # Only display non-speculative assistant text or user text
            if (self.role == "ASSISTANT" and self.display_assistant_text):
                debug_print(f"Speculative text (ignored): {text_content[:50]}...")
            elif self.response_handler:
                self.response_handler('text', {
                    'role': role.lower(),
                    'content': text_content
                })
                debug_print(f"{role}: {text_content}")
        
        # audioOutput: voice response
        elif 'audioOutput' in evt:
            audio_content = evt['audioOutput']['content']
            audio_bytes = base64.b64decode(audio_content)
            
            if not self.barge_in:
                await self.audio_output_queue.put(audio_bytes)
                
                if self.response_handler:
                    self.response_handler('audio', {
                        'content': audio_content
                    })
            else:
                debug_print("Audio output skipped due to barge-in")
        
        # toolUse: tool call request
        elif 'toolUse' in evt:
            self.tool_use_content = evt['toolUse']
            self.tool_name = evt['toolUse']['toolName']
            self.tool_use_id = evt['toolUse']['toolUseId']
            
            debug_print(f"Tool requested: {self.tool_name}")
            
            if self.response_handler:
                self.response_handler('tool-use', {
                    'toolName': self.tool_name,
                    'input': self.tool_use_content.get('content', {})
                })
        
        # contentEnd with TOOL type - execute tool
        elif 'contentEnd' in evt:
            content_type = evt['contentEnd'].get('type')
            stop_reason = evt['contentEnd'].get('stopReason')
            
            # Handle tool execution
            if content_type == 'TOOL':
                try:
                    tool_result = await self.process_tool_use(self.tool_name, self.tool_use_content)
                    tool_content_id = str(uuid.uuid4())
                    
                    await self.send_tool_result(tool_content_id, self.tool_use_id, tool_result)
                    
                    if self.response_handler:
                        self.response_handler('tool-result', {
                            'toolName': self.tool_name,
                            'result': tool_result
                        })
                except Exception as e:
                    debug_print(f"Tool execution failed: {e}")
            
            # Handle barge-in (INTERRUPTED stopReason) - this is the official signal
            if stop_reason == 'INTERRUPTED':
                debug_print("🛑 BARGE-IN DETECTED via stopReason=INTERRUPTED")
                self.barge_in = True
                # Immediately notify client to stop audio playback
                if self.response_handler:
                    self.response_handler('barge-in', {'message': 'User interrupted'})
            
            # Reset barge-in flag when assistant audio content ends normally
            if content_type == 'AUDIO' and stop_reason in ['END_TURN', 'PARTIAL_TURN']:
                debug_print("Assistant audio ended normally, resetting barge-in flag")
                self.barge_in = False
        
        # completionEnd
        elif 'completionEnd' in evt:
            debug_print("End of response sequence")
        
        # Other events
        else:
            event_keys = list(evt.keys())
            if event_keys:
                debug_print(f"Event: {event_keys[0]}")

    async def _process_audio_input(self):
        """Process audio input from the queue and send to Bedrock."""
        from .session import NovaSession
        
        while self.is_active:
            try:
                # Get audio data from the queue
                data = await self.audio_input_queue.get()
                
                audio_bytes = data.get('audio_bytes')
                if not audio_bytes:
                    debug_print("No audio bytes received")
                    continue
                
                # Base64 encode the audio data
                blob = base64.b64encode(audio_bytes)
                audio_event = NovaSession.AUDIO_EVENT_TEMPLATE % (
                    self.prompt_name,
                    self.audio_content_name,
                    blob.decode('utf-8')
                )
                
                # Send the event
                await self.send_raw_event(audio_event)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                debug_print(f"Error processing audio: {e}")

    async def process_tool_use(self, tool_name: str, tool_use_content: dict) -> dict:
        """Execute a tool and return the result."""
        from tools import execute_tool
        
        tool_input = json.loads(tool_use_content.get('content', '{}'))
        debug_print(f"Executing tool: {tool_name} with input: {tool_input}")
        
        try:
            result = await execute_tool(tool_name, tool_input)
            debug_print(f"Tool result: {result}")
            return result
        except Exception as e:
            debug_print(f"Tool execution error: {e}")
            return {"error": str(e)}
    
    async def send_tool_result(self, content_name: str, tool_use_id: str, result: dict):
        """Send tool result back to Bedrock."""
        from .session import NovaSession
        
        # 1. contentStart for tool result
        tool_content_start = NovaSession.TOOL_CONTENT_START_EVENT % (
            self.prompt_name,
            content_name,
            tool_use_id
        )
        await self.send_raw_event(tool_content_start)
        debug_print(f"Sent tool content start event")
        
        # 2. toolResult - build as dictionary then convert to JSON
        if isinstance(result, dict):
            content_json_string = json.dumps(result)
        else:
            content_json_string = str(result)
        
        tool_result_event = {
            "event": {
                "toolResult": {
                    "promptName": self.prompt_name,
                    "contentName": content_name,
                    "content": content_json_string
                }
            }
        }
        
        await self.send_raw_event(json.dumps(tool_result_event))
        debug_print(f"Sent tool result event")
        
        # 3. contentEnd
        tool_content_end = NovaSession.CONTENT_END_EVENT % (
            self.prompt_name,
            content_name
        )
        await self.send_raw_event(tool_content_end)
        debug_print(f"Sent tool content end event")
    
    async def end_session(self):
        """Close the stream and clean up resources."""
        if not self.is_active:
            debug_print("Stream is not active")
            return
        
        debug_print("Ending session...")
        
        from .session import NovaSession
        
        # 1. Audio contentEnd
        audio_content_end = NovaSession.CONTENT_END_EVENT % (
            self.prompt_name,
            self.audio_content_name
        )
        await self.send_raw_event(audio_content_end)
        
        # 2. promptEnd
        prompt_end = NovaSession.PROMPT_END_EVENT % (self.prompt_name)
        await self.send_raw_event(prompt_end)
        
        # 3. sessionEnd
        await self.send_raw_event(NovaSession.SESSION_END_EVENT)
        
        # Wait a bit for events to be sent
        await asyncio.sleep(0.1)
        
        # Now stop the stream
        self.is_active = False
        
        # Clear queues
        while not self.audio_input_queue.empty():
            try:
                self.audio_input_queue.get_nowait()
            except asyncio.QueueEmpty:
                break
        
        while not self.audio_output_queue.empty():
            try:
                self.audio_output_queue.get_nowait()
            except asyncio.QueueEmpty:
                break
        
        debug_print("Session ended")
