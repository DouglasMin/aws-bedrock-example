/**
 * Stock Data Lambda Function
 * Retrieves historical stock price data from Yahoo Finance
 * No API key required!
 */

const https = require('https');

/**
 * Lambda handler function
 * @param {Object} event - Lambda event object
 * @param {string} event.ticker - Stock ticker symbol
 * @returns {Promise<Object>} Stock price data
 */
exports.handler = async (event) => {
  console.log('Stock Data Lambda invoked with event:', JSON.stringify(event));
  
  try {
    // Extract ticker from event - handle both direct calls and Bedrock Agent format
    let ticker;
    
    if (event.parameters && Array.isArray(event.parameters)) {
      // Bedrock Agent format
      const tickerParam = event.parameters.find(p => p.name === 'ticker');
      ticker = tickerParam?.value;
    } else {
      // Direct invocation format
      ticker = event.ticker || event.body?.ticker;
    }
    
    if (!ticker) {
      throw new Error('Missing required parameter: ticker');
    }
    
    // Normalize ticker
    const normalizedTicker = ticker.toUpperCase().trim();
    console.log(`Processing ticker: ${normalizedTicker}`);
    
    // Fetch real stock data from Yahoo Finance (no API key needed!)
    const stockData = await fetchYahooFinanceData(normalizedTicker);
    
    // Return in Bedrock Agent format if called by agent
    if (event.agent) {
      const response = {
        messageVersion: "1.0",
        response: {
          actionGroup: event.actionGroup,
          function: event.function,
          functionResponse: {
            responseBody: {
              "TEXT": {
                body: JSON.stringify(stockData.body)
              }
            }
          }
        }
      };
      console.log('Returning response:', JSON.stringify(response));
      return response;
    }
    
    // Return normal format for direct invocation
    return stockData;
    
  } catch (error) {
    console.error('Error in stock data Lambda:', error);
    
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
        ticker: event.ticker
      }
    };
  }
};

/**
 * Fetch stock data from Yahoo Finance with retry logic
 * No API key required!
 * @param {string} ticker - Stock ticker symbol
 * @param {number} retryCount - Current retry attempt
 * @returns {Promise<Object>} Stock data
 */
async function fetchYahooFinanceData(ticker, retryCount = 0) {
  const maxRetries = 3;
  const retryDelay = 1000 * Math.pow(2, retryCount); // Exponential backoff
  
  // Calculate date range (30 days ago to today)
  const endDate = Math.floor(Date.now() / 1000);
  const startDate = endDate - (30 * 24 * 60 * 60); // 30 days ago
  
  // Yahoo Finance API endpoint with user agent
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${startDate}&period2=${endDate}&interval=1d`;
  
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    };
    
    const req = https.get(url, options, (res) => {
      let data = '';
      
      // Check for rate limiting
      if (res.statusCode === 429) {
        if (retryCount < maxRetries) {
          console.log(`Rate limited, retrying in ${retryDelay}ms (attempt ${retryCount + 1}/${maxRetries})`);
          setTimeout(() => {
            fetchYahooFinanceData(ticker, retryCount + 1)
              .then(resolve)
              .catch(reject);
          }, retryDelay);
          return;
        } else {
          reject(new Error('Yahoo Finance rate limit exceeded. Please try again later.'));
          return;
        }
      }
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          // Check for errors
          if (response.chart && response.chart.error) {
            reject(new Error(`Invalid ticker symbol: ${ticker}`));
            return;
          }
          
          const result = response.chart && response.chart.result && response.chart.result[0];
          
          if (!result || !result.timestamp || !result.indicators.quote[0].close) {
            reject(new Error(`No data available for ticker: ${ticker}`));
            return;
          }
          
          // Extract timestamps and closing prices
          const timestamps = result.timestamp;
          const closePrices = result.indicators.quote[0].close;
          
          // Build prices object with dates
          const prices = {};
          timestamps.forEach((timestamp, index) => {
            const date = new Date(timestamp * 1000).toISOString().split('T')[0];
            const price = closePrices[index];
            if (price !== null) {
              prices[date] = Math.round(price * 100) / 100; // Round to 2 decimals
            }
          });
          
          // Calculate statistics
          const priceValues = Object.values(prices);
          const dates = Object.keys(prices).sort();
          
          if (priceValues.length === 0) {
            reject(new Error(`No valid price data for ticker: ${ticker}`));
            return;
          }
          
          const startPrice = prices[dates[0]];
          const endPrice = prices[dates[dates.length - 1]];
          const change = ((endPrice - startPrice) / startPrice * 100).toFixed(2);
          
          resolve({
            statusCode: 200,
            body: {
              ticker: ticker,
              prices: prices,
              startDate: dates[0],
              endDate: dates[dates.length - 1],
              startPrice: startPrice,
              endPrice: endPrice,
              change: `${change}%`,
              dataPoints: priceValues.length,
              dataSource: 'yahoo_finance',
              message: 'Real-time data from Yahoo Finance'
            }
          });
          
        } catch (error) {
          // If parsing fails and we have retries left, try again
          if (retryCount < maxRetries && data.includes('Too Many Requests')) {
            console.log(`Parse error (rate limit), retrying in ${retryDelay}ms`);
            setTimeout(() => {
              fetchYahooFinanceData(ticker, retryCount + 1)
                .then(resolve)
                .catch(reject);
            }, retryDelay);
          } else {
            reject(new Error('Failed to parse Yahoo Finance response: ' + error.message));
          }
        }
      });
      
    });
    
    req.on('error', (error) => {
      reject(new Error('Yahoo Finance request failed: ' + error.message));
    });
    
    req.end();
  });
}


