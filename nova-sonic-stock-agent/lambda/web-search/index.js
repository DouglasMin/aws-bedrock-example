/**
 * Web Search Lambda Function
 * Searches the web for financial news and information using Brave Search API
 */

const https = require('https');
const zlib = require('zlib');

/**
 * Lambda handler function
 * @param {Object} event - Lambda event object
 * @param {string} event.query - Search query
 * @param {string} event.days - Number of days to search (optional)
 * @param {string} event.target_website - Specific website to search (optional)
 * @returns {Promise<Object>} Search results
 */
exports.handler = async (event) => {
  console.log('Web Search Lambda invoked with event:', JSON.stringify(event));
  
  try {
    // Extract parameters - handle both direct calls and Bedrock Agent format
    let query, days, targetWebsite;
    
    if (event.parameters && Array.isArray(event.parameters)) {
      // Bedrock Agent format
      const queryParam = event.parameters.find(p => p.name === 'search_query');
      const daysParam = event.parameters.find(p => p.name === 'days');
      const websiteParam = event.parameters.find(p => p.name === 'target_website');
      
      query = queryParam?.value;
      days = daysParam?.value || '7';
      targetWebsite = websiteParam?.value;
    } else {
      // Direct invocation format
      query = event.query || event.body?.query;
      days = event.days || event.body?.days || '7';
      targetWebsite = event.target_website || event.body?.target_website;
    }
    
    if (!query) {
      throw new Error('Missing required parameter: query');
    }
    
    console.log(`Searching for: ${query}`);
    
    // Check if API key is configured
    const apiKey = process.env.SEARCH_API_KEY;
    
    if (!apiKey) {
      console.warn('SEARCH_API_KEY not configured, using mock data');
      const mockResults = generateMockSearchResults(query);
      
      // Return in Bedrock Agent format if called by agent
      if (event.agent) {
        return {
          messageVersion: "1.0",
          response: {
            actionGroup: event.actionGroup,
            function: event.function,
            functionResponse: {
              responseBody: {
                "TEXT": {
                  body: JSON.stringify(mockResults.body)
                }
              }
            }
          }
        };
      }
      
      return mockResults;
    }
    
    // Perform search using Brave Search API
    const results = await performSearch(query, apiKey, days, targetWebsite);
    
    // Return in Bedrock Agent format if called by agent
    if (event.agent) {
      return {
        messageVersion: "1.0",
        response: {
          actionGroup: event.actionGroup,
          function: event.function,
          functionResponse: {
            responseBody: {
              "TEXT": {
                body: JSON.stringify(results)
              }
            }
          }
        }
      };
    }
    
    return {
      statusCode: 200,
      body: results
    };
    
  } catch (error) {
    console.error('Error in web search Lambda:', error);
    
    // Return error in Bedrock Agent format if called by agent
    if (event.agent) {
      return {
        messageVersion: "1.0",
        response: {
          actionGroup: event.actionGroup,
          function: event.function,
          functionResponse: {
            responseBody: {
              "TEXT": {
                body: JSON.stringify({ error: error.message })
              }
            }
          }
        }
      };
    }
    
    return {
      statusCode: 500,
      body: {
        error: error.message,
        query: event.query
      }
    };
  }
};

/**
 * Perform web search using Brave Search API
 * @param {string} query - Search query
 * @param {string} apiKey - Brave Search API key
 * @param {string} days - Number of days to search
 * @param {string} targetWebsite - Specific website to search
 * @returns {Promise<Object>} Search results
 */
async function performSearch(query, apiKey, days, targetWebsite) {
  // Build search query
  let searchQuery = query;
  
  // Add site filter if specified
  if (targetWebsite) {
    searchQuery += ` site:${targetWebsite}`;
  }
  
  // Add financial news sources if not targeting specific site
  if (!targetWebsite) {
    searchQuery += ' (site:reuters.com OR site:bloomberg.com OR site:cnbc.com OR site:marketwatch.com OR site:wsj.com)';
  }
  
  const encodedQuery = encodeURIComponent(searchQuery);
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodedQuery}&count=10`;
  
  const options = {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': apiKey
    }
  };
  
  return new Promise((resolve, reject) => {
    https.get(url, options, (res) => {
      const chunks = [];
      
      res.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      res.on('end', () => {
        try {
          // Combine chunks into buffer
          const buffer = Buffer.concat(chunks);
          
          // Decompress if gzipped
          let data;
          if (res.headers['content-encoding'] === 'gzip') {
            data = zlib.gunzipSync(buffer).toString();
          } else {
            data = buffer.toString();
          }
          
          const response = JSON.parse(data);
          
          // Check for API errors
          if (response.error) {
            reject(new Error(`Search API error: ${response.error}`));
            return;
          }
          
          // Extract and format results
          const results = (response.web?.results || []).map(result => ({
            title: result.title,
            url: result.url,
            snippet: result.description,
            published: result.age || 'Unknown',
            source: extractDomain(result.url)
          }));
          
          resolve({
            query: query,
            results: results,
            totalResults: results.length,
            dataSource: 'brave'
          });
          
        } catch (error) {
          reject(new Error('Failed to parse search response: ' + error.message));
        }
      });
      
    }).on('error', (error) => {
      reject(new Error('Search request failed: ' + error.message));
    });
  });
}

/**
 * Extract domain from URL
 * @param {string} url - Full URL
 * @returns {string} Domain name
 */
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return 'Unknown';
  }
}

/**
 * Generate mock search results for testing
 * @param {string} query - Search query
 * @returns {Object} Mock search results
 */
function generateMockSearchResults(query) {
  console.log(`Generating mock search results for: ${query}`);
  
  // Extract ticker if present in query
  const tickerMatch = query.match(/\b([A-Z]{1,5})\b/);
  const ticker = tickerMatch ? tickerMatch[1] : 'STOCK';
  
  const mockResults = [
    {
      title: `${ticker} Reports Strong Q4 Earnings, Beats Expectations`,
      url: `https://www.reuters.com/markets/${ticker.toLowerCase()}-earnings-2024`,
      snippet: `${ticker} reported quarterly earnings that exceeded analyst expectations, with revenue growth driven by strong demand...`,
      published: '2 days ago',
      source: 'reuters.com'
    },
    {
      title: `${ticker} Stock Analysis: Buy, Sell, or Hold?`,
      url: `https://www.bloomberg.com/news/${ticker.toLowerCase()}-analysis`,
      snippet: `Analysts weigh in on ${ticker}'s recent performance and future outlook. The stock has shown resilience despite market volatility...`,
      published: '1 day ago',
      source: 'bloomberg.com'
    },
    {
      title: `${ticker} Announces New Product Launch`,
      url: `https://www.cnbc.com/2024/${ticker.toLowerCase()}-product-launch`,
      snippet: `${ticker} unveiled its latest innovation today, marking a significant milestone in the company's growth strategy...`,
      published: '3 days ago',
      source: 'cnbc.com'
    },
    {
      title: `Why ${ticker} Stock Is Moving Today`,
      url: `https://www.marketwatch.com/story/${ticker.toLowerCase()}-stock-movement`,
      snippet: `${ticker} shares are trading higher following positive analyst commentary and strong sector performance...`,
      published: '5 hours ago',
      source: 'marketwatch.com'
    },
    {
      title: `${ticker} CEO Discusses Company Strategy`,
      url: `https://www.wsj.com/articles/${ticker.toLowerCase()}-ceo-interview`,
      snippet: `In an exclusive interview, ${ticker}'s CEO outlined the company's vision for the next five years...`,
      published: '1 week ago',
      source: 'wsj.com'
    }
  ];
  
  return {
    statusCode: 200,
    body: {
      query: query,
      results: mockResults,
      totalResults: mockResults.length,
      dataSource: 'mock',
      message: 'Mock search results - configure SEARCH_API_KEY for real data'
    }
  };
}
