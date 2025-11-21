#!/usr/bin/env node
/**
 * Bedrock Agents Setup Script
 * Creates the 4-agent investment research system:
 * - 3 subagents (smart_summarizer, quantitative_analysis, news)
 * - 1 supervisor agent (investment_research_assistant)
 */

const {
  BedrockAgentClient,
  CreateAgentCommand,
  CreateAgentActionGroupCommand,
  PrepareAgentCommand,
  CreateAgentAliasCommand,
  DeleteAgentCommand,
  ListAgentsCommand,
  AssociateAgentKnowledgeBaseCommand,
  AssociateAgentCollaboratorCommand,
} = require('@aws-sdk/client-bedrock-agent');

const {
  IAMClient,
  CreateRoleCommand,
  AttachRolePolicyCommand,
  GetRoleCommand,
} = require('@aws-sdk/client-iam');

require('dotenv').config();

const region = process.env.AWS_REGION || 'us-east-1';
const accountId = process.env.AWS_ACCOUNT_ID || '863518440691';

// Check for dry-run mode
const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('-d');

const bedrockClient = new BedrockAgentClient({ 
  region,
  profile: 'dongik2'
});

const iamClient = new IAMClient({ 
  region,
  profile: 'dongik2'
});

// Foundation model
const FOUNDATION_MODEL = 'anthropic.claude-3-5-sonnet-20241022-v2:0';

// Lambda ARNs from environment
const STOCK_DATA_LAMBDA_ARN = process.env.STOCK_DATA_LAMBDA_ARN;
const WEB_SEARCH_LAMBDA_ARN = process.env.WEB_SEARCH_LAMBDA_ARN;

console.log('🚀 Starting Bedrock Agents Setup\n');
if (DRY_RUN) {
  console.log('🔍 DRY RUN MODE - No resources will be created\n');
}
console.log(`Region: ${region}`);
console.log(`Account: ${accountId}`);
console.log(`Model: ${FOUNDATION_MODEL}`);
console.log(`Stock Data Lambda: ${STOCK_DATA_LAMBDA_ARN}`);
console.log(`Web Search Lambda: ${WEB_SEARCH_LAMBDA_ARN}\n`);

/**
 * Create IAM role for Bedrock agent
 */
async function createAgentRole(agentName) {
  const roleName = `AmazonBedrockExecutionRoleForAgents_${agentName}`;
  const roleArn = `arn:aws:iam::${accountId}:role/${roleName}`;
  
  if (DRY_RUN) {
    console.log(`[DRY RUN] Would create IAM role: ${roleName}`);
    console.log(`[DRY RUN] Role ARN: ${roleArn}`);
    return roleArn;
  }
  
  try {
    // Check if role exists
    await iamClient.send(new GetRoleCommand({ RoleName: roleName }));
    console.log(`✓ IAM role ${roleName} already exists`);
    return roleArn;
  } catch (error) {
    // If role doesn't exist, create it
    if (error.name === 'NoSuchEntity' || error.name === 'NoSuchEntityException') {
      console.log(`Creating IAM role: ${roleName}`);
      
      // Create role
      const trustPolicy = {
        Version: '2012-10-17',
        Statement: [{
          Effect: 'Allow',
          Principal: { Service: 'bedrock.amazonaws.com' },
          Action: 'sts:AssumeRole'
        }]
      };
      
      await iamClient.send(new CreateRoleCommand({
        RoleName: roleName,
        AssumeRolePolicyDocument: JSON.stringify(trustPolicy),
        Description: `Execution role for Bedrock agent: ${agentName}`
      }));
      
      // Attach policies
      await iamClient.send(new AttachRolePolicyCommand({
        RoleName: roleName,
        PolicyArn: 'arn:aws:iam::aws:policy/AmazonBedrockFullAccess'
      }));
      
      console.log(`✓ Created IAM role: ${roleName}`);
      
      // Wait for role to propagate
      console.log(`  Waiting 10 seconds for IAM role to propagate...`);
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      return roleArn;
    }
    
    // If it's a different error, throw it
    throw error;
  }
}

/**
 * Delete existing agent if it exists
 */
async function deleteAgentIfExists(agentName) {
  if (DRY_RUN) {
    console.log(`[DRY RUN] Would check and delete existing agent: ${agentName}`);
    return;
  }
  
  try {
    const response = await bedrockClient.send(new ListAgentsCommand({}));
    const existingAgent = response.agentSummaries?.find(a => a.agentName === agentName);
    
    if (existingAgent) {
      console.log(`🗑️  Deleting existing agent: ${agentName}`);
      await bedrockClient.send(new DeleteAgentCommand({
        agentId: existingAgent.agentId,
        skipResourceInUseCheck: true
      }));
      console.log(`  Waiting for deletion to complete...`);
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds for deletion
    }
  } catch (error) {
    console.log(`Note: Could not check/delete existing agent: ${error.message}`);
  }
}

/**
 * Create a Bedrock agent
 */
async function createAgent(config) {
  const { name, description, instruction, roleArn, collaboratorAgents } = config;
  
  console.log(`\n📦 Creating agent: ${name}`);
  console.log(`  Description: ${description}`);
  console.log(`  Role: ${roleArn}`);
  if (collaboratorAgents && collaboratorAgents.length > 0) {
    console.log(`  Collaborators: ${collaboratorAgents.length}`);
  }
  
  if (DRY_RUN) {
    console.log(`[DRY RUN] Would create agent with config:`);
    console.log(JSON.stringify({ name, description, foundationModel: FOUNDATION_MODEL }, null, 2));
    return { agentId: `mock-agent-id-${name}`, agentName: name };
  }
  
  await deleteAgentIfExists(name);
  
  const agentConfig = {
    agentName: name,
    description: description,
    instruction: instruction,
    foundationModel: FOUNDATION_MODEL,
    agentResourceRoleArn: roleArn,
    idleSessionTTLInSeconds: 600
  };
  
  // Add collaborator configuration for supervisor agents
  if (collaboratorAgents && collaboratorAgents.length > 0) {
    agentConfig.agentCollaboration = {
      collaborationMode: 'SUPERVISOR',
      collaboratorAgents: collaboratorAgents
    };
  }
  
  const command = new CreateAgentCommand(agentConfig);
  
  const response = await bedrockClient.send(command);
  console.log(`✓ Agent created: ${response.agent.agentId}`);
  
  // Wait for agent to finish creating
  console.log(`  Waiting for agent to be ready...`);
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  return response.agent;
}

/**
 * Add action group (Lambda tools) to agent
 */
async function addActionGroup(agentId, agentVersion, actionGroupConfig) {
  const { name, description, lambdaArn, apiSchema } = actionGroupConfig;
  
  console.log(`  Adding action group: ${name}`);
  console.log(`    Lambda: ${lambdaArn}`);
  console.log(`    API paths: ${Object.keys(apiSchema.paths).join(', ')}`);
  
  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would add action group: ${name}`);
    return;
  }
  
  const command = new CreateAgentActionGroupCommand({
    agentId,
    agentVersion,
    actionGroupName: name,
    description,
    actionGroupExecutor: {
      lambda: lambdaArn
    },
    apiSchema: {
      payload: JSON.stringify(apiSchema)
    }
  });
  
  await bedrockClient.send(command);
  console.log(`  ✓ Action group added: ${name}`);
}

/**
 * Prepare agent (compile and make ready)
 */
async function prepareAgent(agentId) {
  console.log(`  Preparing agent...`);
  
  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would prepare agent: ${agentId}`);
    return;
  }
  
  await bedrockClient.send(new PrepareAgentCommand({ agentId }));
  
  // Wait for preparation
  await new Promise(resolve => setTimeout(resolve, 30000));
  
  console.log(`  ✓ Agent prepared`);
}

/**
 * Create agent alias
 */
async function createAgentAlias(agentId, aliasName = 'prod') {
  console.log(`  Creating alias: ${aliasName}`);
  
  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would create alias: ${aliasName} for agent: ${agentId}`);
    return { agentAliasId: `mock-alias-id-${aliasName}` };
  }
  
  const command = new CreateAgentAliasCommand({
    agentId,
    agentAliasName: aliasName,
    description: `Production alias for agent`
  });
  
  const response = await bedrockClient.send(command);
  console.log(`  ✓ Alias created: ${response.agentAlias.agentAliasId}`);
  
  return response.agentAlias;
}

/**
 * Validate configuration before deployment
 */
async function validateConfiguration() {
  const errors = [];
  
  // Check Lambda ARNs
  if (!STOCK_DATA_LAMBDA_ARN || STOCK_DATA_LAMBDA_ARN === 'N/A') {
    errors.push('STOCK_DATA_LAMBDA_ARN is not set in .env file');
  }
  
  if (!WEB_SEARCH_LAMBDA_ARN || WEB_SEARCH_LAMBDA_ARN === 'N/A') {
    errors.push('WEB_SEARCH_LAMBDA_ARN is not set in .env file');
  }
  
  // Check AWS credentials
  if (!process.env.AWS_PROFILE && (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY)) {
    errors.push('No AWS credentials found. Set AWS_PROFILE or AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY');
  }
  
  // Check account ID
  if (!accountId || accountId === '123456789012') {
    errors.push('AWS_ACCOUNT_ID is not set or is using example value');
  }
  
  if (errors.length > 0) {
    console.error('\n❌ Configuration Errors:');
    errors.forEach(err => console.error(`  - ${err}`));
    console.error('\nPlease fix these errors before deploying.\n');
    return false;
  }
  
  console.log('✅ Configuration validation passed\n');
  return true;
}

/**
 * Main setup function
 */
async function setupAgents() {
  try {
    // Validate configuration
    const isValid = await validateConfiguration();
    if (!isValid) {
      process.exit(1);
    }
    // Step 1: Create smart_summarizer_agent
    console.log('\n' + '='.repeat(60));
    console.log('STEP 1: Creating smart_summarizer_agent');
    console.log('='.repeat(60));
    
    const summarizerRole = await createAgentRole('smart_summarizer');
    const summarizerAgent = await createAgent({
      name: 'smart_summarizer_agent',
      description: 'Financial analyst specializing in synthesizing stock market trends',
      instruction: `You are a Financial Analyst, responsible for analyzing stock trends and financial news to generate structured insights.
Combine stock price trends with financial news to identify key patterns.
Use your expertise to analyze macroeconomic indicators, company earnings, and market sentiment.
Ensure responses are fact-driven, clearly structured, and cite sources where applicable.
Do not generate financial advice—your role is to analyze and summarize available data objectively.
Keep analyses concise and insightful, focusing on major trends and anomalies.
Ensure answers are professional and coherent. No emojis should be displayed.
If given portfolio optimization percentages, indicate that these are based on logic/math from the portfolio optimization tool, and are not considered financial advice.`,
      roleArn: summarizerRole
    });
    
    await prepareAgent(summarizerAgent.agentId);
    const summarizerAlias = await createAgentAlias(summarizerAgent.agentId);
    
    // Step 2: Create quantitative_analysis_agent
    console.log('\n' + '='.repeat(60));
    console.log('STEP 2: Creating quantitative_analysis_agent');
    console.log('='.repeat(60));
    
    const quantRole = await createAgentRole('quantitative_analysis');
    const quantAgent = await createAgent({
      name: 'quantitative_analysis_agent',
      description: 'Financial Data Collector for stock prices and portfolio optimization',
      instruction: `You are a Stock Data and Portfolio Optimization Specialist. Your role is to retrieve real-time stock data and optimize investment portfolios.

Your capabilities include:
1. Retrieving stock price data using the stock_data_lookup tool.
2. Performing portfolio optimization when at least three stock tickers are provided.
3. Enforcing the portfolio optimization rule: If fewer than three tickers are provided, inform the user that optimization requires at least three.

Core behaviors:
- Always retrieve stock data from stock_data_lookup before running portfolio optimization.
- If portfolio optimization is requested, invoke portfolio_optimization only after retrieving stock data.
- Do not attempt to interpret financial trends—focus solely on data retrieval and portfolio structuring.`,
      roleArn: quantRole
    });
    
    // Add action groups for stock data and portfolio optimization
    const stockDataSchema = {
      openapi: '3.0.0',
      info: { title: 'Stock Data API', version: '1.0.0' },
      paths: {
        '/stock_data_lookup': {
          post: {
            operationId: 'stock_data_lookup',
            description: 'Gets 1-month stock price history for a ticker',
            parameters: [{
              name: 'ticker',
              in: 'query',
              required: true,
              schema: { type: 'string' },
              description: 'Stock ticker symbol (e.g., AAPL)'
            }],
            responses: { '200': { description: 'Stock price data' } }
          }
        },
        '/portfolio_optimization': {
          post: {
            operationId: 'portfolio_optimization',
            description: 'Optimizes portfolio given tickers and prices',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      tickers: { type: 'string', description: 'Comma-separated tickers' },
                      prices: { type: 'string', description: 'JSON string of price data' }
                    },
                    required: ['tickers', 'prices']
                  }
                }
              }
            },
            responses: { '200': { description: 'Portfolio optimization results' } }
          }
        }
      }
    };
    
    await addActionGroup(quantAgent.agentId, 'DRAFT', {
      name: 'stock_tools',
      description: 'Stock data and portfolio optimization tools',
      lambdaArn: STOCK_DATA_LAMBDA_ARN,
      apiSchema: stockDataSchema
    });
    
    await prepareAgent(quantAgent.agentId);
    const quantAlias = await createAgentAlias(quantAgent.agentId);
    
    // Step 3: Create news_agent
    console.log('\n' + '='.repeat(60));
    console.log('STEP 3: Creating news_agent');
    console.log('='.repeat(60));
    
    const newsRole = await createAgentRole('news');
    const newsAgent = await createAgent({
      name: 'news_agent',
      description: 'Market News Researcher for financial news and documents',
      instruction: `You are a Financial Document & News Analyst responsible for extracting structured insights from official financial reports and real-time news.

Your capabilities include:
1. Extracting insights from earnings calls, SEC filings (10-K, 10-Q), and corporate press releases.
2. Summarizing financial reports with a focus on factual accuracy.
3. Retrieving the latest financial news when needed.

Core behaviors:
- Use web search to find current financial news and market information.
- Ensure all findings are fact-based, neutral, and structured for investment research.
- Focus on financial news sources like Reuters, Bloomberg, CNBC, MarketWatch, WSJ.`,
      roleArn: newsRole
    });
    
    // Add web search action group
    const webSearchSchema = {
      openapi: '3.0.0',
      info: { title: 'Web Search API', version: '1.0.0' },
      paths: {
        '/web_search': {
          post: {
            operationId: 'web_search',
            description: 'Searches web for investment news and earnings reports',
            parameters: [{
              name: 'search_query',
              in: 'query',
              required: true,
              schema: { type: 'string' },
              description: 'Search query for financial news'
            }],
            responses: { '200': { description: 'Search results' } }
          }
        }
      }
    };
    
    await addActionGroup(newsAgent.agentId, 'DRAFT', {
      name: 'web_search_tools',
      description: 'Web search for financial news',
      lambdaArn: WEB_SEARCH_LAMBDA_ARN,
      apiSchema: webSearchSchema
    });
    
    await prepareAgent(newsAgent.agentId);
    const newsAlias = await createAgentAlias(newsAgent.agentId);
    
    // Step 4: Create supervisor agent with collaborators
    console.log('\n' + '='.repeat(60));
    console.log('STEP 4: Creating investment_research_assistant (Supervisor)');
    console.log('='.repeat(60));
    
    const supervisorRole = await createAgentRole('investment_research_assistant');
    
    // Define collaborator agents
    const collaboratorAgents = [
      {
        agentDescriptor: {
          aliasArn: `arn:aws:bedrock:${region}:${accountId}:agent-alias/${newsAgent.agentId}/${newsAlias.agentAliasId}`
        },
        collaboratorName: 'news_agent',
        collaborationInstruction: 'Use this collaborator for finding news and analyzing specific documents.',
        relayConversationHistory: 'TO_COLLABORATOR'
      },
      {
        agentDescriptor: {
          aliasArn: `arn:aws:bedrock:${region}:${accountId}:agent-alias/${quantAgent.agentId}/${quantAlias.agentAliasId}`
        },
        collaboratorName: 'quantitative_analysis_agent',
        collaborationInstruction: 'Use this collaborator for retrieving stock price history and performing portfolio optimization.',
        relayConversationHistory: 'TO_COLLABORATOR'
      },
      {
        agentDescriptor: {
          aliasArn: `arn:aws:bedrock:${region}:${accountId}:agent-alias/${summarizerAgent.agentId}/${summarizerAlias.agentAliasId}`
        },
        collaboratorName: 'smart_summarizer_agent',
        collaborationInstruction: 'Use this collaborator for synthesizing stock trends, financial data, and generating structured investment insights.',
        relayConversationHistory: 'TO_COLLABORATOR'
      }
    ];
    
    const supervisorAgent = await createAgent({
      name: 'investment_research_assistant',
      description: 'Investment Research Assistant orchestrating subagents',
      instruction: `You are an Investment Research Assistant, responsible for overseeing and synthesizing financial research from specialized agents. Your role is to coordinate subagents to produce structured investment insights.

Your capabilities include:
1. Managing collaboration between subagents to retrieve and analyze financial data.
2. Synthesizing stock trends, financial reports, and market news into a structured analysis.
3. Delivering well-organized, fact-based investment insights with clear distinctions between data sources.

Available subagents:
- news_agent: Retrieves and summarizes the latest financial news
- quantitative_analysis_agent: Provides real-time and historical stock prices, performs portfolio optimization
- smart_summarizer_agent: Synthesizes financial data and market trends into structured investment insights

Core behaviors:
- Only invoke a subagent when necessary. Do not invoke agent for information not requested by user.
- Ensure responses are well-structured, clearly formatted, and relevant to investor decision-making.
- Differentiate between financial news, technical stock analysis, and synthesized insights.`,
      roleArn: supervisorRole,
      collaboratorAgents: collaboratorAgents
    });
    
    await prepareAgent(supervisorAgent.agentId);
    const supervisorAlias = await createAgentAlias(supervisorAgent.agentId);
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ SETUP COMPLETE!');
    console.log('='.repeat(60));
    console.log('\nAgent IDs:');
    console.log(`  smart_summarizer_agent: ${summarizerAgent.agentId}`);
    console.log(`  quantitative_analysis_agent: ${quantAgent.agentId}`);
    console.log(`  news_agent: ${newsAgent.agentId}`);
    console.log(`  investment_research_assistant: ${supervisorAgent.agentId}`);
    
    console.log('\nAgent Aliases:');
    console.log(`  smart_summarizer_agent: ${summarizerAlias.agentAliasId}`);
    console.log(`  quantitative_analysis_agent: ${quantAlias.agentAliasId}`);
    console.log(`  news_agent: ${newsAlias.agentAliasId}`);
    console.log(`  investment_research_assistant: ${supervisorAlias.agentAliasId}`);
    
    console.log('\n📝 Next steps:');
    console.log('  1. Update .env with supervisor agent ID');
    console.log('  2. Test agents in Bedrock console');
    console.log('  3. Run: npm start');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

// Run setup
setupAgents();
