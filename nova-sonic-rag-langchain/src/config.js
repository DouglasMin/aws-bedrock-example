/**
 * Configuration constants for Nova Sonic
 */

const DEFAULT_INFERENCE_CONFIG = {
    maxTokens: 1024,
    topP: 0.9,
    temperature: 0
};

const DEFAULT_AUDIO_INPUT_CONFIG = {
    mediaType: 'audio/lpcm',
    sampleRateHertz: 16000,
    sampleSizeBits: 16,
    channelCount: 1,
    audioType: 'SPEECH',
    encoding: 'base64'
};

const DEFAULT_AUDIO_OUTPUT_CONFIG = {
    mediaType: 'audio/lpcm',
    sampleRateHertz: 24000,
    sampleSizeBits: 16,
    channelCount: 1,
    encoding: 'base64',
    audioType: 'SPEECH'
};

const DEFAULT_TEXT_CONFIG = {
    mediaType: 'text/plain'
};

const DEFAULT_SYSTEM_PROMPT = `You are a helpful voice assistant with access to real-time information tools.

When users ask about weather in any city, use the get_weather tool to provide current weather information.
When users ask to search for information or need current data, use the web_search tool.

Always use the appropriate tool to provide accurate, real-time information. After receiving tool results, provide a natural, conversational response based on the data.

Keep your responses concise and friendly.`;

const MODEL_ID = 'amazon.nova-sonic-v1:0';

module.exports = {
    DEFAULT_INFERENCE_CONFIG,
    DEFAULT_AUDIO_INPUT_CONFIG,
    DEFAULT_AUDIO_OUTPUT_CONFIG,
    DEFAULT_TEXT_CONFIG,
    DEFAULT_SYSTEM_PROMPT,
    MODEL_ID
};
