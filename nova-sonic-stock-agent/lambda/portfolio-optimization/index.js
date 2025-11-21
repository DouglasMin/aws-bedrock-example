/**
 * Portfolio Optimization Lambda Function
 * Implements Modern Portfolio Theory to optimize portfolio allocations
 */

/**
 * Lambda handler function
 * @param {Object} event - Lambda event object
 * @param {Array<string>} event.tickers - Array of stock ticker symbols
 * @param {Object} event.prices - Price data for each ticker
 * @returns {Promise<Object>} Portfolio optimization results
 */
exports.handler = async (event) => {
  console.log('Portfolio Optimization Lambda invoked with event:', JSON.stringify(event));
  
  try {
    // Extract parameters - handle both direct calls and Bedrock Agent format
    let tickers, prices;
    
    if (event.parameters && Array.isArray(event.parameters)) {
      // Bedrock Agent format
      const tickersParam = event.parameters.find(p => p.name === 'tickers');
      const pricesParam = event.parameters.find(p => p.name === 'prices');
      
      tickers = tickersParam?.value;
      prices = pricesParam?.value;
      
      // Parse if they're strings
      if (typeof tickers === 'string') tickers = tickers.split(',').map(t => t.trim());
      if (typeof prices === 'string') prices = JSON.parse(prices);
    } else {
      // Direct invocation format
      tickers = event.tickers || event.body?.tickers;
      prices = event.prices || event.body?.prices;
    }
    
    if (!tickers || !Array.isArray(tickers)) {
      throw new Error('Missing or invalid parameter: tickers (must be an array)');
    }
    
    if (!prices || typeof prices !== 'object') {
      throw new Error('Missing or invalid parameter: prices (must be an object)');
    }
    
    // Validate minimum tickers
    if (tickers.length < 3) {
      throw new Error('Portfolio optimization requires at least 3 stock tickers');
    }
    
    console.log(`Optimizing portfolio for ${tickers.length} tickers: ${tickers.join(', ')}`);
    
    // Calculate returns for each ticker
    const returns = calculateReturns(tickers, prices);
    
    // Calculate covariance matrix
    const covarianceMatrix = calculateCovarianceMatrix(returns);
    
    // Calculate mean returns
    const meanReturns = calculateMeanReturns(returns);
    
    // Optimize portfolio using Modern Portfolio Theory
    const optimization = optimizePortfolio(tickers, meanReturns, covarianceMatrix);
    
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
                body: JSON.stringify(optimization)
              }
            }
          }
        }
      };
    }
    
    return {
      statusCode: 200,
      body: optimization
    };
    
  } catch (error) {
    console.error('Error in portfolio optimization Lambda:', error);
    
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
        tickers: event.tickers
      }
    };
  }
};

/**
 * Calculate daily returns for each ticker
 * @param {Array<string>} tickers - Stock tickers
 * @param {Object} prices - Price data
 * @returns {Object} Returns for each ticker
 */
function calculateReturns(tickers, prices) {
  const returns = {};
  
  tickers.forEach(ticker => {
    if (!prices[ticker] || !prices[ticker].prices) {
      throw new Error(`Missing price data for ticker: ${ticker}`);
    }
    
    const priceData = prices[ticker].prices;
    const dates = Object.keys(priceData).sort();
    const dailyReturns = [];
    
    for (let i = 1; i < dates.length; i++) {
      const prevPrice = priceData[dates[i - 1]];
      const currPrice = priceData[dates[i]];
      const dailyReturn = (currPrice - prevPrice) / prevPrice;
      dailyReturns.push(dailyReturn);
    }
    
    returns[ticker] = dailyReturns;
  });
  
  return returns;
}

/**
 * Calculate mean returns for each ticker
 * @param {Object} returns - Daily returns
 * @returns {Object} Mean returns
 */
function calculateMeanReturns(returns) {
  const meanReturns = {};
  
  Object.keys(returns).forEach(ticker => {
    const tickerReturns = returns[ticker];
    const sum = tickerReturns.reduce((acc, val) => acc + val, 0);
    meanReturns[ticker] = sum / tickerReturns.length;
  });
  
  return meanReturns;
}

/**
 * Calculate covariance matrix
 * @param {Object} returns - Daily returns
 * @returns {Array<Array<number>>} Covariance matrix
 */
function calculateCovarianceMatrix(returns) {
  const tickers = Object.keys(returns);
  const n = tickers.length;
  const matrix = Array(n).fill(0).map(() => Array(n).fill(0));
  
  // Calculate mean returns
  const means = {};
  tickers.forEach(ticker => {
    const sum = returns[ticker].reduce((acc, val) => acc + val, 0);
    means[ticker] = sum / returns[ticker].length;
  });
  
  // Calculate covariance
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const ticker1 = tickers[i];
      const ticker2 = tickers[j];
      
      let covariance = 0;
      const length = Math.min(returns[ticker1].length, returns[ticker2].length);
      
      for (let k = 0; k < length; k++) {
        covariance += (returns[ticker1][k] - means[ticker1]) * 
                      (returns[ticker2][k] - means[ticker2]);
      }
      
      matrix[i][j] = covariance / (length - 1);
    }
  }
  
  return matrix;
}

/**
 * Optimize portfolio using simplified Modern Portfolio Theory
 * Uses equal-weight as baseline and adjusts based on Sharpe ratio
 * @param {Array<string>} tickers - Stock tickers
 * @param {Object} meanReturns - Mean returns for each ticker
 * @param {Array<Array<number>>} covarianceMatrix - Covariance matrix
 * @returns {Object} Optimization results
 */
function optimizePortfolio(tickers, meanReturns, covarianceMatrix) {
  const n = tickers.length;
  
  // Start with equal weights
  let weights = Array(n).fill(1 / n);
  
  // Simple optimization: adjust weights based on Sharpe ratio
  // This is a simplified version - full MPT would use quadratic programming
  const sharpeRatios = tickers.map((ticker, i) => {
    const expectedReturn = meanReturns[ticker] * 252; // Annualize
    const variance = covarianceMatrix[i][i] * 252; // Annualize
    const stdDev = Math.sqrt(variance);
    return stdDev > 0 ? expectedReturn / stdDev : 0;
  });
  
  // Normalize Sharpe ratios to get weights
  const totalSharpe = sharpeRatios.reduce((sum, sr) => sum + Math.max(sr, 0), 0);
  
  if (totalSharpe > 0) {
    weights = sharpeRatios.map(sr => Math.max(sr, 0) / totalSharpe);
  }
  
  // Ensure weights sum to 1
  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  weights = weights.map(w => w / weightSum);
  
  // Calculate portfolio metrics
  const portfolioReturn = weights.reduce((sum, w, i) => 
    sum + w * meanReturns[tickers[i]] * 252, 0);
  
  let portfolioVariance = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      portfolioVariance += weights[i] * weights[j] * covarianceMatrix[i][j] * 252;
    }
  }
  
  const portfolioRisk = Math.sqrt(portfolioVariance);
  const portfolioSharpe = portfolioRisk > 0 ? portfolioReturn / portfolioRisk : 0;
  
  // Format allocations
  const allocations = {};
  tickers.forEach((ticker, i) => {
    allocations[ticker] = Math.round(weights[i] * 10000) / 100; // Percentage with 2 decimals
  });
  
  // Calculate price statistics
  const priceStats = {};
  tickers.forEach(ticker => {
    priceStats[ticker] = {
      sharpeRatio: Math.round(sharpeRatios[tickers.indexOf(ticker)] * 1000) / 1000
    };
  });
  
  return {
    allocations: allocations,
    expectedReturn: Math.round(portfolioReturn * 10000) / 100, // Percentage
    risk: Math.round(portfolioRisk * 10000) / 100, // Percentage
    sharpeRatio: Math.round(portfolioSharpe * 1000) / 1000,
    tickers: tickers,
    tickerCount: tickers.length,
    priceStats: priceStats,
    dataSource: 'mpt',
    disclaimer: 'This is a mathematical calculation based on historical data and should not be considered financial advice. Past performance does not guarantee future results.'
  };
}
