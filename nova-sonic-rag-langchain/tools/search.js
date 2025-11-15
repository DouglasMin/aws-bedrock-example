/**
 * Brave Search Tool - Search the web
 * Uses Brave Search API for reliable, privacy-focused web search
 */

function getToolSpec() {
  return {
    toolSpec: {
      name: "web_search",
      description: "Search the web using Brave Search to find current information, news, facts, or answers to questions. Use this when you need up-to-date information or when the answer is not in your knowledge base.",
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
  
  // Validate API key
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    console.error('❌ BRAVE_SEARCH_API_KEY not found in environment variables');
    return { 
      error: 'Search API key not configured. Please set BRAVE_SEARCH_API_KEY in .env file.' 
    };
  }
  
  try {
    // Build API URL with query parameters
    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    url.searchParams.append('q', query);
    url.searchParams.append('count', '5'); // Get top 5 results
    url.searchParams.append('safesearch', 'moderate');
    url.searchParams.append('text_decorations', 'false'); // No highlighting markers
    url.searchParams.append('summary', '1'); // Request AI summary
    
    // Make API request
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Brave Search API error (${response.status}):`, errorText);
      
      if (response.status === 401) {
        return { error: 'Invalid API key. Please check BRAVE_SEARCH_API_KEY in .env file.' };
      } else if (response.status === 429) {
        return { error: 'Rate limit exceeded. Please try again later.' };
      }
      
      return { error: `Search failed with status: ${response.status}` };
    }
    
    const data = await response.json();
    
    // Extract web results
    const webResults = data.web?.results || [];
    
    if (webResults.length === 0) {
      return {
        query: query,
        message: 'No search results found.',
        suggestion: 'Try rephrasing the query or using different keywords.'
      };
    }
    
    // Check if AI summary is available (only in paid plans)
    let aiSummary = null;
    if (data.summarizer && data.summarizer.key) {
      console.log('📝 Fetching AI summary...');
      aiSummary = await fetchBraveSummary(data.summarizer.key, apiKey);
    }
    
    // Format results in a concise, voice-friendly format
    const results = webResults.map((result, index) => ({
      title: result.title || 'No title',
      url: result.url || '',
      snippet: result.description || 'No description available'
    }));
    
    // Create a natural language summary for voice output
    const summary = await formatSearchResultsForVoice(query, results, aiSummary);
    
    return {
      query: query,
      summary: summary,
      resultCount: results.length,
      topResults: results.slice(0, 3).map(r => ({
        title: r.title,
        url: r.url
      }))
    };
    
  } catch (error) {
    console.error('❌ Search tool error:', error);
    return { 
      error: `Failed to perform web search: ${error.message}` 
    };
  }
}

/**
 * Fetch AI-generated summary from Brave Summarizer API
 * This is a separate, free API call that doesn't count against quota
 */
async function fetchBraveSummary(summaryKey, apiKey) {
  try {
    const url = new URL('https://api.search.brave.com/res/v1/summarizer/search');
    url.searchParams.append('key', summaryKey);
    url.searchParams.append('entity_info', '1');
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey
      }
    });
    
    if (!response.ok) {
      console.error(`❌ Brave Summarizer API error (${response.status})`);
      return null;
    }
    
    const data = await response.json();
    
    // Extract summary text
    if (data.summary && data.summary.length > 0) {
      return data.summary[0].data || null;
    }
    
    return null;
    
  } catch (error) {
    console.error('❌ Failed to fetch Brave summary:', error.message);
    return null;
  }
}

/**
 * Fetch and extract main content from a webpage
 * Returns cleaned text content for analysis
 */
async function fetchArticleContent(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 5000 // 5 second timeout
    });
    
    if (!response.ok) {
      return null;
    }
    
    const html = await response.text();
    const cheerio = require('cheerio');
    const $ = cheerio.load(html);
    
    // Remove script, style, nav, footer, ads
    $('script, style, nav, footer, aside, .ad, .advertisement, .social-share').remove();
    
    // Try to find main content area
    let content = '';
    const contentSelectors = [
      'article',
      'main',
      '[role="main"]',
      '.article-content',
      '.post-content',
      '.entry-content',
      '#content',
      '.content'
    ];
    
    for (const selector of contentSelectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        content = element.text();
        break;
      }
    }
    
    // Fallback to body if no main content found
    if (!content) {
      content = $('body').text();
    }
    
    // Clean up whitespace
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();
    
    // Limit to first 2000 characters for token efficiency
    if (content.length > 2000) {
      content = content.substring(0, 2000) + '...';
    }
    
    return content;
    
  } catch (error) {
    console.error(`Failed to fetch article from ${url}:`, error.message);
    return null;
  }
}

/**
 * Format search results with AI summary or article content
 * Provides deep insights using Brave's AI or web scraping
 */
async function formatSearchResultsForVoice(query, results, aiSummary) {
  if (results.length === 0) {
    return `No results found for "${query}".`;
  }
  
  let summary = `Search Results for "${query}":\n\n`;
  
  // If AI summary is available, use it (preferred method)
  if (aiSummary) {
    summary += `=== AI-GENERATED SUMMARY ===\n`;
    summary += `${aiSummary}\n\n`;
    summary += `=== SOURCE REFERENCES ===\n`;
    results.slice(0, 3).forEach((result, index) => {
      summary += `${index + 1}. ${result.title}\n`;
      summary += `   ${result.url}\n\n`;
    });
  } else {
    // Fallback: Fetch article content from top result
    summary += `Found ${results.length} relevant sources.\n\n`;
    
    const topResult = results[0];
    summary += `=== TOP RESULT (Detailed Analysis) ===\n`;
    summary += `Title: ${topResult.title}\n`;
    summary += `Source: ${topResult.url}\n\n`;
    
    console.log(`📖 Fetching article content from: ${topResult.url}`);
    const articleContent = await fetchArticleContent(topResult.url);
    
    if (articleContent) {
      summary += `ARTICLE CONTENT:\n${articleContent}\n\n`;
    } else {
      summary += `SUMMARY: ${topResult.snippet}\n\n`;
    }
    
    // Add other results as references
    if (results.length > 1) {
      summary += `=== ADDITIONAL SOURCES ===\n`;
      results.slice(1, 4).forEach((result, index) => {
        summary += `${index + 2}. ${result.title}\n`;
        summary += `   ${result.snippet}\n`;
        summary += `   ${result.url}\n\n`;
      });
    }
  }
  
  if (results.length > 4) {
    summary += `Plus ${results.length - 4} more sources available.\n`;
  }
  
  return summary;
}

module.exports = { getToolSpec, execute };
