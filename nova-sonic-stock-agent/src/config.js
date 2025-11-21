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

const DEFAULT_SYSTEM_PROMPT = `You are an AI Investment Research Assistant with access to specialized financial analysis tools.

Your capabilities include:
1. Retrieving historical stock price data using the stock_data_lookup tool
2. Optimizing investment portfolios using the portfolio_optimization tool (requires at least 3 tickers)
3. Searching for financial news and market information using the web_search tool

When users ask about:
- Stock prices or price history: Use stock_data_lookup with the ticker symbol
- Portfolio optimization: First retrieve stock data for all tickers, then use portfolio_optimization
- Financial news or company information: Use web_search with relevant financial keywords
- Market trends or analysis: Combine data from multiple tools to provide comprehensive insights

Important guidelines:
- Always retrieve stock data before attempting portfolio optimization
- Portfolio optimization requires at least 3 stock tickers
- When presenting portfolio allocations, clarify these are mathematical calculations, not financial advice
- Keep responses professional, fact-based, and structured
- Cite data sources when providing financial information
- Do not provide direct investment advice - focus on data analysis and insights

Provide clear, concise responses that help users make informed investment decisions.`;

const MODEL_ID = 'amazon.nova-sonic-v1:0';

// Bedrock Agent Configuration
const AGENT_CONFIG = {
    INVESTMENT_RESEARCH_ASSISTANT: {
        agentAliasId: process.env.INVESTMENT_RESEARCH_ASSISTANT_ALIAS || 'REP7P9QYYO',
        agentId: process.env.INVESTMENT_RESEARCH_ASSISTANT_ID || 'H9CJAPR0N9'
    },
    QUANTITATIVE_ANALYSIS: {
        agentAliasId: process.env.QUANTITATIVE_ANALYSIS_AGENT_ALIAS || '5ZKVUOB8EQ',
        agentId: process.env.QUANTITATIVE_ANALYSIS_AGENT_ID || 'V2ITAKMNYM'
    },
    SMART_SUMMARIZER: {
        agentAliasId: process.env.SMART_SUMMARIZER_AGENT_ALIAS || '7QFY5QNKQ7',
        agentId: process.env.SMART_SUMMARIZER_AGENT_ID || 'PDH838SX05'
    },
    NEWS_AGENT: {
        agentAliasId: process.env.NEWS_AGENT_ALIAS || 'VBDORVLW8B',
        agentId: process.env.NEWS_AGENT_ID || 'BUY4PA99ZD'
    }
};

module.exports = {
    DEFAULT_INFERENCE_CONFIG,
    DEFAULT_AUDIO_INPUT_CONFIG,
    DEFAULT_AUDIO_OUTPUT_CONFIG,
    DEFAULT_TEXT_CONFIG,
    DEFAULT_SYSTEM_PROMPT,
    MODEL_ID,
    AGENT_CONFIG
};
