/**
 * Nova Sonic 실시간 음성 챗봇 서버
 * AWS 공식 문서 기반 완전 재구현
 */
const express = require('express');
const WebSocket = require('ws');
// Stream imports removed - not needed
const { 
    BedrockRuntimeClient,
    InvokeModelWithBidirectionalStreamCommand 
} = require('@aws-sdk/client-bedrock-runtime');
const { NodeHttp2Handler } = require('@smithy/node-http-handler');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📝 AWS Region: ${process.env.AWS_REGION || 'us-east-1'}`);
});

const wss = new WebSocket.Server({ server });

// HTTP/2 handler (공식 문서)
const nodeHttp2Handler = new NodeHttp2Handler({
    requestTimeout: 300000,
    sessionTimeout: 300000,
    disableConcurrentStreams: false,
    maxConcurrentStreams: 20,
});

// Bedrock client (공식 문서)
const bedrockClient = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    },
    requestHandler: nodeHttp2Handler
});

const MODEL_ID = 'amazon.nova-sonic-v1:0';

wss.on('connection', (ws) => {
    console.log('✅ Client connected');
    
    // outputStream variable removed - not needed
    let promptName = generateUUID();
    let contentName = generateUUID();
    let audioContentName = generateUUID();
    let isActive = false;
    let audioQueue = []; // 오디오 이벤트 큐
    let sessionReady = false;

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'start') {
                console.log('🎤 Starting conversation...');
                isActive = true;
                await startSession(ws, data.voiceId || 'matthew');
            } else if (data.type === 'audio' && isActive) {
                if (!sessionReady) {
                    // console.warn('⚠️ Audio received but session not ready yet');
                    return;
                }
                
                // 오디오 청크를 큐에 추가
                audioQueue.push({
                    event: {
                        audioInput: {
                            promptName: promptName,
                            contentName: audioContentName,
                            content: data.audio
                        }
                    }
                });
                
                // 디버깅: 오디오 수신 확인
                // if (audioQueue.length % 100 === 0) {
                //     console.log('🎤 Audio queued, queue size:', audioQueue.length);
                // }
            } else if (data.type === 'stop') {
                console.log('⏹️ Stopping conversation...');
                await endSession();
            }
        } catch (error) {
            console.error('❌ Error:', error);
            ws.send(JSON.stringify({ type: 'error', message: error.message }));
        }
    });

    // Async generator (AWS SDK 요구사항)
    async function* generateEventStream() {
        const textEncoder = new TextEncoder();
        
        // 초기 이벤트들
        const initEvents = [
            // 1. sessionStart
            {
                event: {
                    sessionStart: {
                        inferenceConfiguration: {
                            maxTokens: 1024,
                            topP: 0.9,
                            temperature: 0.7
                        }
                    }
                }
            },
            // 2. promptStart
            {
                event: {
                    promptStart: {
                        promptName: promptName,
                        textOutputConfiguration: {
                            mediaType: 'text/plain'
                        },
                        audioOutputConfiguration: {
                            mediaType: 'audio/lpcm',
                            sampleRateHertz: 24000,
                            sampleSizeBits: 16,
                            channelCount: 1,
                            voiceId: ws.voiceId || 'matthew',
                            encoding: 'base64',
                            audioType: 'SPEECH'
                        }
                    }
                }
            },
            // 3. System prompt contentStart
            {
                event: {
                    contentStart: {
                        promptName: promptName,
                        contentName: contentName,
                        type: 'TEXT',
                        interactive: false,
                        role: 'SYSTEM',
                        textInputConfiguration: {
                            mediaType: 'text/plain'
                        }
                    }
                }
            },
            // 4. textInput
            {
                event: {
                    textInput: {
                        promptName: promptName,
                        contentName: contentName,
                        content: 'You are a friendly assistant. Keep responses short, 2-3 sentences.'
                    }
                }
            },
            // 5. System prompt contentEnd
            {
                event: {
                    contentEnd: {
                        promptName: promptName,
                        contentName: contentName
                    }
                }
            },
            // 6. Audio contentStart
            {
                event: {
                    contentStart: {
                        promptName: promptName,
                        contentName: audioContentName,
                        type: 'AUDIO',
                        interactive: true,
                        role: 'USER',
                        audioInputConfiguration: {
                            mediaType: 'audio/lpcm',
                            sampleRateHertz: 16000,
                            sampleSizeBits: 16,
                            channelCount: 1,
                            audioType: 'SPEECH',
                            encoding: 'base64'
                        }
                    }
                }
            }
        ];
        
        // 초기 이벤트 전송
        for (const event of initEvents) {
            const eventJson = JSON.stringify(event);
            console.log(`📤 Sending: ${Object.keys(event.event)[0]}`);
            yield {
                chunk: {
                    bytes: textEncoder.encode(eventJson)
                }
            };
            await new Promise(resolve => setTimeout(resolve, 30));
        }
        
        // 세션 준비 완료 표시
        sessionReady = true;
        
        // 오디오 이벤트 스트리밍 (AWS 문서: "immediately sent")
        let sentCount = 0;
        while (isActive) {
            if (audioQueue.length > 0) {
                const audioEvent = audioQueue.shift();
                yield {
                    chunk: {
                        bytes: textEncoder.encode(JSON.stringify(audioEvent))
                    }
                };
                sentCount++;
                if (sentCount % 100 === 0) {
                    console.log(`📤 Sent ${sentCount} audio events to Bedrock, queue: ${audioQueue.length}`);
                }
            } else {
                // 큐가 비어있을 때만 짧은 대기 (CPU 과부하 방지)
                await new Promise(resolve => setTimeout(resolve, 1));
            }
        }
        
        console.log('🔚 Event stream ended');
    }

    async function startSession(ws, voiceId) {
        try {
            console.log('📡 Starting session...');
            console.log('🎙️ Selected voice:', voiceId);
            isActive = true;
            
            // voiceId를 ws 객체에 저장 (generator에서 사용)
            ws.voiceId = voiceId;
            
            // Command 생성 (async generator 사용)
            const command = new InvokeModelWithBidirectionalStreamCommand({
                modelId: MODEL_ID,
                body: generateEventStream()
            });

            console.log('📡 Sending command to Bedrock...');
            
            // 스트림 시작 (비동기로 처리하여 generator가 먼저 실행되도록)
            bedrockClient.send(command).then(async response => {
                // console.log('✅ Bedrock response received');
                
                // AWS SDK v3 양방향 스트리밍: response.body가 async iterable
                if (!response.body) {
                    console.error('❌ No body in response!');
                    return;
                }
                
                // 응답 처리 시작
                await processResponses(ws, response.body);
            }).catch(error => {
                console.error('❌ Bedrock error:', error);
                console.error('Error details:', error.stack);
                ws.send(JSON.stringify({ type: 'error', message: error.message }));
                isActive = false;
            });
            
            // Generator가 초기 이벤트를 보낼 시간 대기
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // 세션 준비 완료 대기
            const checkReady = setInterval(() => {
                if (sessionReady) {
                    clearInterval(checkReady);
                    ws.send(JSON.stringify({ type: 'ready', message: 'Session started' }));
                    console.log('✅ Session ready for audio');
                }
            }, 100);


        } catch (error) {
            console.error('❌ Session start error:', error);
            ws.send(JSON.stringify({ type: 'error', message: error.message }));
        }
    }

    function sendEvent(event) {
        if (!isActive) return;
        // 큐에 추가 (generator가 읽어감)
        audioQueue.push(event);
    }

    async function processResponses(ws, responseBody) {
        try {
            console.log('👂 Listening for Bedrock responses...');
            let responseCount = 0;

            // AWS 공식 문서: event.chunk.bytes를 디코딩하고 JSON 파싱
            for await (const event of responseBody) {
                if (!isActive) break;

                responseCount++;
                // if (responseCount % 10 === 0) {
                //     console.log(`📥 Received ${responseCount} response events`);
                // }

                // chunk.bytes 디코딩 (공식 문서 방식)
                if (event.chunk?.bytes) {
                    try {
                        const textResponse = new TextDecoder().decode(event.chunk.bytes);
                        const jsonResponse = JSON.parse(textResponse);

                        // event 객체 내부 확인
                        if (jsonResponse.event) {
                            const evt = jsonResponse.event;

                            // contentStart - generationStage 추적
                            if (evt.contentStart) {
                                const type = evt.contentStart.type;
                                const role = evt.contentStart.role;
                                
                                // additionalModelFields에서 generationStage 확인
                                let generationStage = 'FINAL';
                                if (evt.contentStart.additionalModelFields) {
                                    try {
                                        const additionalFields = JSON.parse(evt.contentStart.additionalModelFields);
                                        generationStage = additionalFields.generationStage || 'FINAL';
                                    } catch (e) {
                                        // 파싱 실패 시 기본값 사용
                                    }
                                }
                                
                                // 세션에 현재 generationStage 저장
                                ws.currentGenerationStage = generationStage;
                                console.log(`📝 Content start: ${type} (${role}) - ${generationStage}`);
                            }
                            // textOutput: ASR 전사 또는 응답
                            else if (evt.textOutput) {
                                const text = evt.textOutput.content;
                                const role = evt.textOutput.role || 'ASSISTANT';
                                
                                // ASSISTANT의 SPECULATIVE 텍스트는 무시 (예측 텍스트)
                                // USER 텍스트와 ASSISTANT의 FINAL 텍스트만 표시
                                if (role === 'ASSISTANT' && ws.currentGenerationStage === 'SPECULATIVE') {
                                    console.log(`🔮 Speculative text (ignored): ${text.substring(0, 50)}...`);
                                } else {
                                    ws.send(JSON.stringify({
                                        type: 'text',
                                        role: role.toLowerCase(),
                                        content: text
                                    }));
                                    console.log(`💬 ${role}: ${text}`);
                                }
                            }
                            // audioOutput: 음성 응답
                            else if (evt.audioOutput) {
                                const audioContent = evt.audioOutput.content;
                                ws.send(JSON.stringify({
                                    type: 'audio',
                                    content: audioContent
                                }));
                                // console.log('🔊 Audio chunk sent to client');
                            }
                            // completionStart
                            // else if (evt.completionStart) {
                            //     console.log('🎬 Completion started:', evt.completionStart.completionId);
                            // }
                            // contentEnd
                            else if (evt.contentEnd) {
                                const stopReason = evt.contentEnd.stopReason;
                                //console.log(`📝 Content end: ${stopReason}`);
                            }
                            // usageEvent
                            // else if (evt.usageEvent) {
                            //     console.log('📊 Usage:', evt.usageEvent.totalTokens, 'tokens');
                            // }
                            // exception
                            else if (evt.exception) {
                                console.error('❌ Bedrock exception:', evt.exception);
                                ws.send(JSON.stringify({ 
                                    type: 'error', 
                                    message: evt.exception.message || 'Unknown error'
                                }));
                            }
                            // 기타 이벤트
                            else {
                                const eventKeys = Object.keys(evt);
                                if (eventKeys.length > 0) {
                                    console.log(`📨 Event: ${eventKeys[0]}`);
                                }
                            }
                        }
                    } catch (parseError) {
                        console.error('❌ JSON parse error:', parseError.message);
                        console.log('Raw response preview:', textResponse?.substring(0, 100));
                    }
                }
            }
            
            console.log('🔚 Response stream ended');
        } catch (error) {
            if (isActive) {
                console.error('❌ Response processing error:', error);
                console.error('Error stack:', error.stack);
                ws.send(JSON.stringify({ type: 'error', message: error.message }));
            }
        }
    }

    async function endSession() {
        if (!isActive) return;
        isActive = false;

        try {
            // 문서에 따른 종료 순서
            // 1. Audio contentEnd
            sendEvent({
                event: {
                    contentEnd: {
                        promptName: promptName,
                        contentName: audioContentName
                    }
                }
            });

            // 2. promptEnd
            sendEvent({
                event: {
                    promptEnd: {
                        promptName: promptName
                    }
                }
            });

            // 3. sessionEnd
            sendEvent({
                event: {
                    sessionEnd: {}
                }
            });

            // 큐 정리
            audioQueue.length = 0;
            sessionReady = false;
            
            console.log('✅ Session ended');
        } catch (error) {
            console.error('❌ Session end error:', error);
        }
    }

    ws.on('close', () => {
        console.log('❌ Client disconnected');
        isActive = false;
        sessionReady = false;
        audioQueue.length = 0;
    });

    ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
    });
});

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

console.log('🎤 Nova Sonic Voice Chat Server');
console.log('================================');
