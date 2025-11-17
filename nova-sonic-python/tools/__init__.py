"""
Tools Registry
Central management for all available tools
"""
from typing import List, Dict, Any
from config import debug_print

# Import tools
from . import weather
from . import search

# Tool registry mapping
tools = {
    'get_weather': weather,
    'web_search': search
}


def get_all_tool_specs() -> List[Dict]:
    """
    Get all tool specifications for Bedrock
    
    Returns:
        List of tool specs
    """
    tool_specs = []
    for tool in tools.values():
        spec = tool.get_tool_spec()
        tool_specs.append(spec)
    
    debug_print(f"Loaded {len(tool_specs)} tool specs")
    return tool_specs


async def execute_tool(tool_name: str, params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Execute a tool by name
    
    Args:
        tool_name: Name of the tool to execute
        params: Parameters for the tool
        
    Returns:
        Tool execution result
        
    Raises:
        Exception: If tool not found or execution fails
    """
    tool = tools.get(tool_name)
    
    if not tool:
        available = ', '.join(tools.keys())
        error_msg = f"Unknown tool: {tool_name}. Available tools: {available}"
        debug_print(error_msg)
        raise Exception(error_msg)
    
    debug_print(f"Executing tool: {tool_name}")
    debug_print(f"Parameters: {params}")
    
    try:
        result = await tool.execute(params)
        debug_print(f"Tool {tool_name} completed successfully")
        return result
    except Exception as error:
        debug_print(f"Tool {tool_name} failed: {error}")
        raise error


def get_available_tools() -> List[str]:
    """
    Get list of available tool names
    
    Returns:
        Array of tool names
    """
    return list(tools.keys())
