"""
Streamlit UI for Nova Sonic
"""
import streamlit as st
from config import AVAILABLE_VOICES, PORT, WEBSOCKET_PORT

# Page configuration
st.set_page_config(
    page_title="Nova Sonic Voice Chat",
    page_icon="🎤",
    layout="wide"
)

# Custom CSS
st.markdown("""
<style>
    .main-header {
        text-align: center;
        padding: 1rem 0;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-radius: 10px;
        margin-bottom: 2rem;
    }
    .status-box {
        padding: 1rem;
        border-radius: 8px;
        margin: 1rem 0;
        text-align: center;
        font-weight: bold;
    }
    .status-ready {
        background-color: #e8f5e9;
        color: #2e7d32;
    }
    .status-active {
        background-color: #e3f2fd;
        color: #1565c0;
    }
    .status-error {
        background-color: #ffebee;
        color: #c62828;
    }
    .message-user {
        background-color: #667eea;
        color: white;
        padding: 0.8rem;
        border-radius: 15px;
        margin: 0.5rem 0;
        text-align: right;
    }
    .message-assistant {
        background-color: #f5f5f5;
        color: #333;
        padding: 0.8rem;
        border-radius: 15px;
        margin: 0.5rem 0;
    }
    .message-system {
        background-color: #fff3e0;
        color: #e65100;
        padding: 0.8rem;
        border-radius: 15px;
        margin: 0.5rem 0;
        text-align: center;
    }
    .tool-message {
        background-color: #e0f7fa;
        color: #006064;
        padding: 0.8rem;
        border-radius: 15px;
        margin: 0.5rem 0;
        border-left: 4px solid #00acc1;
    }
</style>
""", unsafe_allow_html=True)

# Header
st.markdown("""
<div class="main-header">
    <h1>🎤 Nova Sonic Voice Chat</h1>
    <p>AWS Bedrock Nova Sonic - Real-time Voice Conversation</p>
</div>
""", unsafe_allow_html=True)

# Initialize session state
if 'messages' not in st.session_state:
    st.session_state.messages = []
if 'is_recording' not in st.session_state:
    st.session_state.is_recording = False
if 'status' not in st.session_state:
    st.session_state.status = "ready"

# Sidebar for settings
with st.sidebar:
    st.header("⚙️ Settings")
    
    # Voice selection
    st.subheader("🎙️ Voice Selection")
    voice_options = {v['id']: f"{v['icon']} {v['name']} ({v['language']})" 
                    for v in AVAILABLE_VOICES}
    selected_voice = st.selectbox(
        "Choose a voice",
        options=list(voice_options.keys()),
        format_func=lambda x: voice_options[x],
        disabled=st.session_state.is_recording
    )
    
    st.divider()
    
    # Connection info
    st.subheader("🔌 Connection")
    st.info(f"WebSocket: ws://localhost:{WEBSOCKET_PORT}")
    st.info(f"UI Port: {PORT}")
    
    st.divider()
    
    # Instructions
    st.subheader("📖 How to Use")
    st.markdown("""
    1. Select a voice
    2. Click **Start Conversation**
    3. Allow microphone access
    4. Start speaking!
    5. AI will respond with voice
    6. Click **Stop** to end
    """)
    
    st.divider()
    
    # Clear chat button
    if st.button("🗑️ Clear Chat History"):
        st.session_state.messages = []
        st.rerun()

# Main content area
col1, col2, col3 = st.columns([1, 2, 1])

with col2:
    # Control buttons
    button_col1, button_col2 = st.columns(2)
    
    with button_col1:
        if not st.session_state.is_recording:
            if st.button("▶️ Start Conversation", use_container_width=True, type="primary"):
                st.session_state.is_recording = True
                st.session_state.status = "active"
                st.session_state.messages.append({
                    "role": "system",
                    "content": "🎤 Connecting to Nova Sonic..."
                })
                st.rerun()
    
    with button_col2:
        if st.session_state.is_recording:
            if st.button("⏹️ Stop Conversation", use_container_width=True, type="secondary"):
                st.session_state.is_recording = False
                st.session_state.status = "ready"
                st.session_state.messages.append({
                    "role": "system",
                    "content": "👋 Conversation ended"
                })
                st.rerun()
    
    # Status indicator
    status_class = f"status-{st.session_state.status}"
    status_text = {
        "ready": "⚪ Ready",
        "active": "🟢 Active - Listening...",
        "error": "🔴 Error"
    }.get(st.session_state.status, "⚪ Ready")
    
    st.markdown(f'<div class="status-box {status_class}">{status_text}</div>', 
                unsafe_allow_html=True)

# Chat container
st.subheader("💬 Conversation")

chat_container = st.container()

with chat_container:
    if not st.session_state.messages:
        st.info("👋 Click 'Start Conversation' to begin chatting with Nova Sonic!")
    else:
        for message in st.session_state.messages:
            role = message["role"]
            content = message["content"]
            
            if role == "user":
                st.markdown(f'<div class="message-user">👤 You: {content}</div>', 
                           unsafe_allow_html=True)
            elif role == "assistant":
                st.markdown(f'<div class="message-assistant">🤖 Assistant: {content}</div>', 
                           unsafe_allow_html=True)
            elif role == "system":
                st.markdown(f'<div class="message-system">{content}</div>', 
                           unsafe_allow_html=True)
            elif role == "tool":
                tool_name = message.get("tool_name", "Tool")
                st.markdown(f'<div class="tool-message">🔧 {tool_name}: {content}</div>', 
                           unsafe_allow_html=True)

# Embed WebSocket client JavaScript
if st.session_state.is_recording:
    st.components.v1.html(f"""
    <div id="audio-status" style="text-align: center; padding: 10px; background: #e3f2fd; border-radius: 8px; margin: 10px 0;">
        <p style="margin: 0; color: #1565c0; font-weight: bold;">🎤 Microphone Active</p>
        <p style="margin: 5px 0; font-size: 0.9em; color: #666;">Speak now - AI is listening</p>
    </div>
    
    <script>
        let ws = null;
        let audioContext = null;
        let mediaStream = null;
        let audioWorkletNode = null;
        let isRecording = false;
        let audioQueue = [];
        let isPlayingAudio = false;
        
        const WEBSOCKET_URL = 'ws://localhost:{WEBSOCKET_PORT}';
        const SELECTED_VOICE = '{selected_voice}';
        
        // Initialize WebSocket connection
        async function initWebSocket() {{
            try {{
                ws = new WebSocket(WEBSOCKET_URL);
                
                ws.onopen = async () => {{
                    console.log('WebSocket connected');
                    
                    // Initialize audio
                    audioContext = new (window.AudioContext || window.webkitAudioContext)({{
                        sampleRate: 16000
                    }});
                    
                    // Get microphone access
                    mediaStream = await navigator.mediaDevices.getUserMedia({{
                        audio: {{
                            sampleRate: 16000,
                            channelCount: 1,
                            echoCancellation: true,
                            noiseSuppression: true
                        }}
                    }});
                    
                    // Load audio processor
                    await audioContext.audioWorklet.addModule('data:text/javascript;base64,' + btoa(`
                        class NovaAudioProcessor extends AudioWorkletProcessor {{
                            process(inputs, outputs, parameters) {{
                                const input = inputs[0];
                                if (input && input.length > 0) {{
                                    const channelData = input[0];
                                    const int16Data = new Int16Array(channelData.length);
                                    for (let i = 0; i < channelData.length; i++) {{
                                        const s = Math.max(-1, Math.min(1, channelData[i]));
                                        int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                                    }}
                                    this.port.postMessage({{ type: 'audio', data: int16Data }});
                                }}
                                return true;
                            }}
                        }}
                        registerProcessor('nova-audio-processor', NovaAudioProcessor);
                    `));
                    
                    // Set up audio processing
                    const source = audioContext.createMediaStreamSource(mediaStream);
                    audioWorkletNode = new AudioWorkletNode(audioContext, 'nova-audio-processor');
                    
                    audioWorkletNode.port.onmessage = (event) => {{
                        if (event.data.type === 'audio' && isRecording) {{
                            const audioData = event.data.data;
                            const base64Audio = arrayBufferToBase64(audioData.buffer);
                            
                            if (ws && ws.readyState === WebSocket.OPEN) {{
                                ws.send(JSON.stringify({{
                                    type: 'audio',
                                    audio: base64Audio
                                }}));
                            }}
                        }}
                    }};
                    
                    source.connect(audioWorkletNode);
                    audioWorkletNode.connect(audioContext.destination);
                    
                    // Start session
                    ws.send(JSON.stringify({{
                        type: 'start',
                        voiceId: SELECTED_VOICE
                    }}));
                }};
                
                ws.onmessage = async (event) => {{
                    const data = JSON.parse(event.data);
                    
                    if (data.type === 'ready') {{
                        isRecording = true;
                        console.log('Session ready');
                    }} else if (data.type === 'audio') {{
                        await playAudio(data.content);
                    }} else if (data.type === 'text') {{
                        console.log(`${{data.role}}: ${{data.content}}`);
                    }} else if (data.type === 'error') {{
                        console.error('Error:', data.message);
                    }}
                }};
                
                ws.onerror = (error) => {{
                    console.error('WebSocket error:', error);
                }};
                
                ws.onclose = () => {{
                    console.log('WebSocket closed');
                    cleanup();
                }};
                
            }} catch (error) {{
                console.error('Initialization error:', error);
            }}
        }}
        
        async function playAudio(base64Audio) {{
            try {{
                const audioData = base64ToArrayBuffer(base64Audio);
                const int16Array = new Int16Array(audioData);
                const float32Array = convertInt16ToFloat32(int16Array);
                
                audioQueue.push(float32Array);
                
                if (!isPlayingAudio) {{
                    playNextAudioChunk();
                }}
            }} catch (error) {{
                console.error('Audio playback error:', error);
            }}
        }}
        
        async function playNextAudioChunk() {{
            if (audioQueue.length === 0) {{
                isPlayingAudio = false;
                return;
            }}
            
            isPlayingAudio = true;
            const float32Array = audioQueue.shift();
            
            try {{
                const audioBuffer = audioContext.createBuffer(1, float32Array.length, 24000);
                audioBuffer.getChannelData(0).set(float32Array);
                
                const source = audioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioContext.destination);
                
                source.onended = () => {{
                    playNextAudioChunk();
                }};
                
                source.start();
            }} catch (error) {{
                console.error('Audio chunk playback error:', error);
                playNextAudioChunk();
            }}
        }}
        
        function cleanup() {{
            isRecording = false;
            audioQueue = [];
            isPlayingAudio = false;
            
            if (audioWorkletNode) {{
                audioWorkletNode.disconnect();
                audioWorkletNode = null;
            }}
            
            if (mediaStream) {{
                mediaStream.getTracks().forEach(track => track.stop());
                mediaStream = null;
            }}
            
            if (audioContext) {{
                audioContext.close();
                audioContext = null;
            }}
            
            if (ws) {{
                ws.close();
                ws = null;
            }}
        }}
        
        function arrayBufferToBase64(buffer) {{
            let binary = '';
            const bytes = new Uint8Array(buffer);
            for (let i = 0; i < bytes.byteLength; i++) {{
                binary += String.fromCharCode(bytes[i]);
            }}
            return btoa(binary);
        }}
        
        function base64ToArrayBuffer(base64) {{
            const binaryString = atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {{
                bytes[i] = binaryString.charCodeAt(i);
            }}
            return bytes.buffer;
        }}
        
        function convertInt16ToFloat32(int16Array) {{
            const float32Array = new Float32Array(int16Array.length);
            for (let i = 0; i < int16Array.length; i++) {{
                float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7FFF);
            }}
            return float32Array;
        }}
        
        // Start connection
        initWebSocket();
        
        // Cleanup on page unload
        window.addEventListener('beforeunload', cleanup);
    </script>
    """, height=100)

# Footer
st.markdown("---")
st.markdown("""
<div style="text-align: center; color: #666; font-size: 0.9em;">
    <p>Powered by AWS Bedrock Nova Sonic | Python Implementation</p>
</div>
""", unsafe_allow_html=True)
