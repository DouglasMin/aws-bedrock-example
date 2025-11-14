/**
 * DuckDuckGo Search Tool - Search the web
 * Uses DuckDuckGo Instant Answer API (free, no API key required)
 */

function getToolSpec() {
  return {
    toolSpec: {
      name: "web_search",
      description: "Search the web using DuckDuckGo to find current information, news, facts, or answers to questions. Use this when you need up-to-date information or when the answer is not in your knowledge base.",
      inputSchema: {
        json: JSON.stringify({
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query or question to look up on the web"
            }
          },
          required: ["query"]
        })
      }
    }
  };
}

async function execute(params) {
  const { query } = params;
  
  try {
    // DuckDuckGo Instant Answer API
    const response = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
      {
        headers: {
          'User-Agent': 'NovaSonicToolUse/1.0'
        }
      }
    );
    
    if (!response.ok) {
      return { error: `Search failed with status: ${response.status}` };
    }
    
    const data = await response.json();
    
    // Build result from available data
    let result = {
      query: query,
      results: []
    };
    
    // Abstract (main answer)
    if (data.Abstract) {
      result.results.push({
        type: 'answer',
        title: data.Heading || 'Answer',
        text: data.Abstract,
        source: data.AbstractSource || 'DuckDuckGo',
        url: data.AbstractURL || ''
      });
    }
    
    // Related topics
    if (data.RelatedTopics && data.RelatedTopics.length > 0) {
      const topics = data.RelatedTopics
        .filter(topic => topic.Text && topic.FirstURL)
        .slice(0, 5)
        .map(topic => ({
          type: 'related',
          text: topic.Text,
          url: topic.FirstURL
        }));
      
      if (topics.length > 0) {
        result.results.push(...topics);
      }
    }
    
    // Definition
    if (data.Definition) {
      result.results.push({
        type: 'definition',
        text: data.Definition,
        source: data.DefinitionSource || 'Dictionary',
        url: data.DefinitionURL || ''
      });
    }
    
    // If no results found
    if (result.results.length === 0) {
      return {
        query: query,
        message: 'No instant answers found. The query might be too specific or require a more detailed web search.',
        suggestion: 'Try rephrasing the query or asking a more general question.'
      };
    }
    
    return result;
    
  } catch (error) {
    console.error('Search tool error:', error);
    return { 
      error: `Failed to perform web search: ${error.message}` 
    };
  }
}

module.exports = { getToolSpec, execute };
