/**
 * AudioWorklet Processor for Nova Sonic
 * ScriptProcessorNode 대신 사용
 */
class NovaAudioProcessor extends AudioWorkletProcessor {
    process(inputs, outputs, parameters) {
        const input = inputs[0];
        
        if (input && input.length > 0) {
            const channelData = input[0];
            
            // Float32Array를 Int16Array로 변환
            const int16Data = new Int16Array(channelData.length);
            for (let i = 0; i < channelData.length; i++) {
                const s = Math.max(-1, Math.min(1, channelData[i]));
                int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            
            // 메인 스레드로 전송
            this.port.postMessage({
                type: 'audio',
                data: int16Data
            });
        }
        
        return true; // 계속 처리
    }
}

registerProcessor('nova-audio-processor', NovaAudioProcessor);
