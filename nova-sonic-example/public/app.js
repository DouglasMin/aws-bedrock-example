/**
 * Nova Sonic 클라이언트
 */

let ws = null;
let audioContext = null;
let mediaStream = null;
let audioWorkletNode = null;
let analyser = null;
let isRecording = false;
let animationId = null;

// 오디오 재생 큐
let audioQueue = [];
let isPlayingAudio = false;

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const voiceSelected = document.getElementById('voiceSelected');
const voiceDropdown = document.getElementById('voiceDropdown');
const chatContainer = document.getElementById('chatContainer');
const statusDiv = document.getElementById('status');
const visualizerDiv = document.getElementById('audioVisualizer');

let selectedVoice = 'matthew'; // 기본 음성

// 버튼 이벤트
startBtn.addEventListener('click', startConversation);
stopBtn.addEventListener('click', stopConversation);

// 음성 드롭다운 토글
voiceSelected.addEventListener('click', (e) => {
    if (isRecording) return; // 녹음 중에는 변경 불가
    e.stopPropagation();
    voiceSelected.classList.toggle('active');
    voiceDropdown.classList.toggle('show');
});

// 음성 선택
voiceDropdown.addEventListener('click', (e) => {
    const option = e.target.closest('.voice-option');
    if (!option || isRecording) return;
    
    // 모든 옵션에서 selected 제거
    document.querySelectorAll('.voice-option').forEach(o => o.classList.remove('selected'));
    
    // 선택한 옵션에 selected 추가
    option.classList.add('selected');
    selectedVoice = option.dataset.voice;
    
    // 선택된 음성 표시 업데이트
    const icon = option.dataset.icon;
    const name = option.querySelector('.voice-option-name').textContent;
    const lang = option.dataset.lang;
    
    voiceSelected.querySelector('.voice-selected-icon').textContent = icon;
    voiceSelected.querySelector('.voice-selected-name').textContent = name;
    voiceSelected.querySelector('.voice-selected-info').textContent = lang;
    
    // 드롭다운 닫기
    voiceSelected.classList.remove('active');
    voiceDropdown.classList.remove('show');
    
    console.log('Selected voice:', selectedVoice);
});

// 외부 클릭 시 드롭다운 닫기
document.addEventListener('click', () => {
    voiceSelected.classList.remove('active');
    voiceDropdown.classList.remove('show');
});

async function startConversation() {
    try {
        // WebSocket 연결
        ws = new WebSocket(`ws://${window.location.host}`);
        
        ws.onopen = async () => {
            addMessage('system', '연결 중...');
            
            // 오디오 컨텍스트 초기화
            audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 16000
            });
            
            // 마이크 접근
            mediaStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                } 
            });
            
            // AudioWorklet 로드 (ScriptProcessorNode 대신)
            await audioContext.audioWorklet.addModule('audio-processor.js');
            
            // 오디오 분석기 (음성 레벨 표시용)
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            
            // 오디오 처리
            const source = audioContext.createMediaStreamSource(mediaStream);
            audioWorkletNode = new AudioWorkletNode(audioContext, 'nova-audio-processor');
            
            // 분석기 연결
            source.connect(analyser);
            
            // AudioWorklet에서 메시지 수신
            let audioChunkCount = 0;
            let emptyChunkCount = 0;
            audioWorkletNode.port.onmessage = (event) => {
                if (!isRecording) return;
                
                if (event.data.type === 'audio') {
                    const audioData = event.data.data;
                    
                    // 오디오 데이터 검증
                    if (!audioData || audioData.length === 0) {
                        emptyChunkCount++;
                        if (emptyChunkCount % 50 === 0) {
                            console.warn('⚠️ Empty audio chunks:', emptyChunkCount);
                        }
                        return;
                    }
                    
                    // 음량 체크 (모두 0이면 무음)
                    const hasSound = Array.from(audioData).some(val => Math.abs(val) > 100);
                    if (!hasSound && audioChunkCount % 50 === 0) {
                        console.warn('⚠️ Silent audio detected');
                    }
                    
                    const base64Audio = arrayBufferToBase64(audioData.buffer);
                    
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            type: 'audio',
                            audio: base64Audio
                        }));
                        
                        // 디버깅: 오디오 전송 확인
                        audioChunkCount++;
                        // if (audioChunkCount % 50 === 0) {
                        //     console.log(`🎤 Sent ${audioChunkCount} audio chunks (hasSound: ${hasSound})`);
                        // }
                    }
                }
            };
            
            source.connect(audioWorkletNode);
            audioWorkletNode.connect(audioContext.destination);
            
            // 음성 시각화 시작
            startVisualization();
            
            // 세션 시작
            ws.send(JSON.stringify({
                type: 'start',
                voiceId: selectedVoice
            }));
        };
        
        ws.onmessage = async (event) => {
            const data = JSON.parse(event.data);
            
            if (data.type === 'ready') {
                isRecording = true;
                startBtn.disabled = true;
                stopBtn.disabled = false;
                visualizerDiv.style.display = 'flex';
                updateStatus('active', '🎤 듣고 있어요...');
                addMessage('system', '✅ 연결 완료! 이제 말씀해주세요.');
            } else if (data.type === 'text') {
                hideTypingIndicator();
                addMessage(data.role, data.content);
                
                // 사용자 음성이 인식되면 AI 응답 대기 표시
                if (data.role === 'user') {
                    updateStatus('active', '🤖 AI가 생각 중...');
                    showTypingIndicator();
                } else if (data.role === 'assistant') {
                    updateStatus('active', '🔊 AI 응답 중...');
                }
            } else if (data.type === 'audio') {
                await playAudio(data.content);
            } else if (data.type === 'error') {
                hideTypingIndicator();
                addMessage('error', data.message);
                updateStatus('error', '❌ 오류 발생');
            }
        };
        
        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            hideTypingIndicator();
            addMessage('error', '연결 오류가 발생했습니다');
            updateStatus('error', '❌ 연결 오류');
        };
        
        ws.onclose = () => {
            cleanup();
            hideTypingIndicator();
            updateStatus('ready', '⚪ 준비됨');
        };
        
    } catch (error) {
        console.error('Start error:', error);
        hideTypingIndicator();
        addMessage('error', `시작 실패: ${error.message}`);
        updateStatus('error', '❌ 시작 실패');
    }
}

function stopConversation() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'stop' }));
    }
    cleanup();
    hideTypingIndicator();
    addMessage('system', '👋 대화가 종료되었습니다.');
    updateStatus('ready', '⚪ 준비됨');
}

function cleanup() {
    isRecording = false;
    
    // 오디오 큐 정리
    audioQueue = [];
    isPlayingAudio = false;
    
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    
    if (audioWorkletNode) {
        audioWorkletNode.disconnect();
        audioWorkletNode = null;
    }
    
    if (analyser) {
        analyser = null;
    }
    
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
    
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    
    if (ws) {
        ws.close();
        ws = null;
    }
    
    visualizerDiv.style.display = 'none';
    visualizerDiv.innerHTML = '';
    startBtn.disabled = false;
    stopBtn.disabled = true;
}

function startVisualization() {
    // 음성 레벨 바 생성
    visualizerDiv.innerHTML = '';
    const barCount = 20;
    const bars = [];
    
    for (let i = 0; i < barCount; i++) {
        const bar = document.createElement('div');
        bar.className = 'audio-bar';
        bar.style.height = '10px';
        visualizerDiv.appendChild(bar);
        bars.push(bar);
    }
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    let lastSpeechTime = Date.now();
    let isSpeaking = false;
    
    function animate() {
        if (!isRecording) return;
        
        analyser.getByteFrequencyData(dataArray);
        
        // 평균 음량 계산
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        
        // 바 높이 업데이트
        bars.forEach((bar, i) => {
            const value = dataArray[i * Math.floor(dataArray.length / barCount)] || 0;
            const height = Math.max(10, (value / 255) * 50);
            bar.style.height = `${height}px`;
            
            // 음성 감지 시 색상 변경
            if (value > 50) {
                bar.style.background = '#28a745';
            } else {
                bar.style.background = '#667eea';
            }
        });
        
        // 음성 감지 표시 (임계값: 30)
        if (average > 30) {
            if (!isSpeaking) {
                isSpeaking = true;
                // console.log('🎤 Speech detected! Average:', average.toFixed(2));
            }
            lastSpeechTime = Date.now();
            updateStatus('active', `🎤 음성 감지 중... (레벨: ${Math.round(average)})`);
        } else {
            // 음성이 멈춘 지 500ms 후
            if (isSpeaking && Date.now() - lastSpeechTime > 500) {
                isSpeaking = false;
                // console.log('🔇 Speech ended');
                updateStatus('active', '🟢 대화 중 - 말씀해주세요!');
            } else if (!isSpeaking) {
                updateStatus('active', '🟢 대화 중 - 말씀해주세요!');
            }
        }
        
        animationId = requestAnimationFrame(animate);
    }
    
    animate();
}

async function playAudio(base64Audio) {
    try {
        const audioData = base64ToArrayBuffer(base64Audio);
        const int16Array = new Int16Array(audioData);
        const float32Array = convertInt16ToFloat32(int16Array);
        
        // 오디오 청크를 큐에 추가
        audioQueue.push(float32Array);
        
        // 재생 중이 아니면 재생 시작
        if (!isPlayingAudio) {
            playNextAudioChunk();
        }
    } catch (error) {
        console.error('Audio playback error:', error);
    }
}

async function playNextAudioChunk() {
    if (audioQueue.length === 0) {
        isPlayingAudio = false;
        return;
    }
    
    isPlayingAudio = true;
    const float32Array = audioQueue.shift();
    
    try {
        const audioBuffer = audioContext.createBuffer(1, float32Array.length, 24000);
        audioBuffer.getChannelData(0).set(float32Array);
        
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        
        // 현재 청크 재생이 끝나면 다음 청크 재생
        source.onended = () => {
            playNextAudioChunk();
        };
        
        source.start();
    } catch (error) {
        console.error('Audio chunk playback error:', error);
        // 에러가 나도 다음 청크 재생 시도
        playNextAudioChunk();
    }
}

function addMessage(role, content) {
    // 시스템 메시지는 간단하게
    if (role === 'system') {
        const wrapper = document.createElement('div');
        wrapper.className = 'message-wrapper system';
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system';
        messageDiv.textContent = content;
        
        wrapper.appendChild(messageDiv);
        chatContainer.appendChild(wrapper);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        return;
    }
    
    // 에러 메시지
    if (role === 'error') {
        const wrapper = document.createElement('div');
        wrapper.className = 'message-wrapper system';
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message error';
        messageDiv.textContent = '⚠️ ' + content;
        
        wrapper.appendChild(messageDiv);
        chatContainer.appendChild(wrapper);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        return;
    }
    
    // 사용자/AI 메시지 (카카오톡 스타일)
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${role}`;
    
    // 아바타
    const avatar = document.createElement('div');
    avatar.className = `avatar ${role}`;
    avatar.textContent = role === 'user' ? '👤' : '🤖';
    
    // 메시지 버블
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = new Date().toLocaleTimeString('ko-KR', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    messageDiv.appendChild(contentDiv);
    messageDiv.appendChild(timeDiv);
    
    wrapper.appendChild(avatar);
    wrapper.appendChild(messageDiv);
    
    chatContainer.appendChild(wrapper);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// 타이핑 인디케이터 추가/제거
let typingIndicator = null;

function showTypingIndicator() {
    if (typingIndicator) return;
    
    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper assistant';
    wrapper.id = 'typing-indicator';
    
    const avatar = document.createElement('div');
    avatar.className = 'avatar assistant';
    avatar.textContent = '🤖';
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';
    
    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator';
    typingDiv.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
    
    messageDiv.appendChild(typingDiv);
    wrapper.appendChild(avatar);
    wrapper.appendChild(messageDiv);
    
    chatContainer.appendChild(wrapper);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    typingIndicator = wrapper;
}

function hideTypingIndicator() {
    if (typingIndicator) {
        typingIndicator.remove();
        typingIndicator = null;
    }
}

function updateStatus(type, message) {
    statusDiv.className = `status ${type}`;
    statusDiv.innerHTML = message;
    if (type === 'active') {
        statusDiv.innerHTML = '<span class="mic-indicator"></span>' + message;
    }
}

// 오디오 변환 유틸리티
function convertFloat32ToInt16(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
        const s = Math.max(-1, Math.min(1, float32Array[i]));
        int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16Array;
}

function convertInt16ToFloat32(int16Array) {
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7FFF);
    }
    return float32Array;
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}
