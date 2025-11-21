/**
 * Tools Registry
 * Central management for all available tools
 */

const weather = require('./weather');
const search = require('./search');

// Tool registry mapping
const tools = {
  'get_weather': weather,
  'web_search': search
};

/**
 * Get all tool specifications for Bedrock
 * @returns {Array} Array of tool specs
 */
function getAllToolSpecs() {
  return Object.values(tools).map(tool => tool.getToolSpec());
}

/**
 * Execute a tool by name
 * @param {string} toolName - Name of the tool to execute
 * @param {Object} params - Parameters for the tool
 * @returns {Promise<Object>} Tool execution result
 */
async function executeTool(toolName, params) {
  const tool = tools[toolName];
  
  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}. Available tools: ${Object.keys(tools).join(', ')}`);
  }
  
  console.log(`🔧 Executing tool: ${toolName}`, params);
  
  try {
    const result = await tool.execute(params);
    console.log(`✅ Tool ${toolName} completed successfully`);
    return result;
  } catch (error) {
    console.error(`❌ Tool ${toolName} failed:`, error);
    throw error;
  }
}

/**
 * Get list of available tool names
 * @returns {Array<string>} Array of tool names
 */
function getAvailableTools() {
  return Object.keys(tools);
}

module.exports = {
  getAllToolSpecs,
  executeTool,
  getAvailableTools
};
