#!/usr/bin/env python3
"""
Simplified agent creation script using the helper classes from the notebook.
This creates 4 agents for the AI Investment Research Assistant.
"""

import sys
import boto3
from pathlib import Path

# Add the helper modules to path
SCRIPT_DIR = Path(__file__).resolve().parent
HELPER_DIR = SCRIPT_DIR.parent / "helper"
sys.path.insert(0, str(HELPER_DIR))

try:
    from bedrock_agent import (
        Agent,
        SupervisorAgent,
        region,
        account_id,
        agents_helper,
    )
except ImportError as e:
    print(f"ERROR: Could not import helper modules: {e}")
    print("Make sure the helper files are in nova-sonic-stock-agent/helper/")
    sys.exit(1)

# Configuration
REGION = "us-east-1"
ACCOUNT_ID = "863518440691"
# Nova model options:
# - amazon.nova-micro-v1:0 (text only, fastest, cheapest)
# - amazon.nova-lite-v1:0 (multimodal, balanced)
# - amazon.nova-pro-v1:0 (multimodal, best for function calling & agents) ⭐ RECOMMENDED
# - amazon.nova-premier-v1:0 (multimodal, most capable but expensive)
LLM = "amazon.nova-pro-v1:0"

# Lambda ARNs
STOCK_DATA_TOOLS_ARN = f"arn:aws:lambda:{REGION}:{ACCOUNT_ID}:function:stock_data_tools"
PORTFOLIO_OPTIMIZATION_ARN = f"arn:aws:lambda:{REGION}:{ACCOUNT_ID}:function:portfolio_optimization"
WEB_SEARCH_ARN = f"arn:aws:lambda:{REGION}:{ACCOUNT_ID}:function:web_search"

def clean_up_agents():
    """Delete existing agents if they exist."""
    print("Cleaning up existing agents...")
    agents_helper.delete_agent(
        agent_name="investment_research_assistant", delete_role_flag=True, verbose=True
    )
    agents_helper.delete_agent(
        agent_name="news_agent", delete_role_flag=True, verbose=True
    )
    agents_helper.delete_agent(
        agent_name="quantitative_analysis_agent", delete_role_flag=True, verbose=True
    )
    agents_helper.delete_agent(
        agent_name="smart_summarizer_agent", delete_role_flag=True, verbose=True
    )
    print("Cleanup complete.\n")

def create_agents():
    """Create all 4 agents for the investment research assistant."""
    
    print("=" * 80)
    print("Creating AI Investment Research Assistant Agents")
    print("=" * 80)
    print()
    
    # Clean up first
    clean_up_agents()
    
    # Force recreate
    Agent.set_force_recreate_default(True)
    
    # 1. Create smart_summarizer_agent
    print("Creating smart_summarizer_agent...")
    smart_summarizer_agent = Agent.create(
        name="smart_summarizer_agent",
        role="A financial analyst specializing in synthesizing stock market trends and financial news into structured investment insights.",
        goal="Analyze stock trends and market news to generate insights.",
        instructions="""You are a Financial Analyst, responsible for analyzing stock trends and financial news to generate structured insights.
Combine stock price trends with financial news to identify key patterns.
Use your expertise to analyze macroeconomic indicators, company earnings, and market sentiment.
Ensure responses are fact-driven, clearly structured, and cite sources where applicable.
Do not generate financial advice—your role is to analyze and summarize available data objectively.
Keep analyses concise and insightful, focusing on major trends and anomalies.
Ensure answers are professional and coherent. No emojis should be displayed.
If given portfolio optimization percentages, indicate that these are based on logic/math from the portfolio optimization tool, and are not considered financial advice.""",
        llm=LLM,
    )
    print("✓ smart_summarizer_agent created\n")
    
    # 2. Create quantitative_analysis_agent
    print("Creating quantitative_analysis_agent...")
    quantitative_analysis_agent = Agent.create(
        name="quantitative_analysis_agent",
        role="Financial Data Collector",
        goal="Retrieve real-time and historic stock prices as well as optimizing a portfolio given tickers.",
        instructions="""You are a Stock Data and Portfolio Optimization Specialist. Your role is to retrieve real-time stock data and optimize investment portfolios.

Your capabilities include:
1. Retrieving stock price data using the `stock_data_lookup` tool.
2. Performing portfolio optimization when at least three stock tickers are provided.
3. Enforcing the portfolio optimization rule: If fewer than three tickers are provided, inform the user that optimization requires at least three.

Core behaviors:
- Always retrieve stock data from `stock_data_lookup` before running portfolio optimization.
- If portfolio optimization is requested, invoke `portfolio_optimization` only after retrieving stock data.
- Do not attempt to interpret financial trends—focus solely on data retrieval and portfolio structuring.""",
        tools=[
            {
                "code": STOCK_DATA_TOOLS_ARN,
                "definition": {
                    "name": "stock_data_lookup",
                    "description": "Gets the 1-month stock price history for a given stock ticker, formatted as JSON.",
                    "parameters": {
                        "ticker": {
                            "description": "The ticker to retrieve price history for",
                            "type": "string",
                            "required": True,
                        }
                    },
                },
            },
            {
                "code": PORTFOLIO_OPTIMIZATION_ARN,
                "definition": {
                    "name": "portfolio_optimization",
                    "description": "Optimizes a stock portfolio given a list of tickers and historical prices.",
                    "parameters": {
                        "tickers": {
                            "description": "A comma-separated list of stock tickers to include in the portfolio",
                            "type": "string",
                            "required": True,
                        },
                        "prices": {
                            "description": "A JSON object with dates as keys and stock prices as values",
                            "type": "string",
                            "required": True,
                        },
                    },
                },
            },
        ],
        llm=LLM,
    )
    print("✓ quantitative_analysis_agent created\n")
    
    # 3. Create news_agent
    print("Creating news_agent...")
    news_agent = Agent.create(
        name="news_agent",
        role="Market News Researcher",
        goal="Fetch latest relevant news for a given stock based on a ticker.",
        instructions="""You are a Financial News Analyst responsible for extracting structured insights from real-time news.

Your capabilities include:
1. Retrieving the latest financial news using web search.
2. Summarizing financial news with a focus on factual accuracy.

Core behaviors:
- Use web search to find the latest financial news and market information.
- Ensure all findings are fact-based, neutral, and structured for investment research.
- Focus on recent news and market developments.""",
        tools=[
            {
                "code": WEB_SEARCH_ARN,
                "definition": {
                    "name": "web_search",
                    "description": "Searches the web for investment news and earnings reports.",
                    "parameters": {
                        "search_query": {
                            "description": "The query to search the web with",
                            "type": "string",
                            "required": True,
                        },
                        "target_website": {
                            "description": "Specific website to search",
                            "type": "string",
                            "required": False,
                        },
                        "topic": {
                            "description": "The topic being searched, such as 'news'",
                            "type": "string",
                            "required": False,
                        },
                        "days": {
                            "description": "Number of days of history to search",
                            "type": "string",
                            "required": False,
                        },
                    },
                },
            },
        ],
        llm=LLM,
    )
    print("✓ news_agent created\n")
    
    # 4. Create supervisor agent
    print("Creating investment_research_assistant (supervisor)...")
    investment_research_assistant = SupervisorAgent.create(
        "investment_research_assistant",
        role="Investment Research Assistant",
        goal="A seasoned investment research expert responsible for orchestrating subagents to conduct comprehensive stock analysis.",
        collaboration_type="SUPERVISOR",
        instructions="""You are an Investment Research Assistant, responsible for overseeing and synthesizing financial research from specialized agents.

Your capabilities include:
1. Managing collaboration between subagents to retrieve and analyze financial data.
2. Synthesizing stock trends, financial reports, and market news into a structured analysis.
3. Delivering well-organized, fact-based investment insights with clear distinctions between data sources.

Available subagents:
- **news_agent**: Retrieves and summarizes the latest financial news.
- **quantitative_analysis_agent**: Provides real-time and historical stock prices and portfolio optimization.
- **smart_summarizer_agent**: Synthesizes financial data and market trends into structured investment insights.

Core behaviors:
- Only invoke a subagent when necessary. Do not invoke agent for information not requested by user.
- Ensure responses are well-structured, clearly formatted, and relevant to investor decision-making.
- Differentiate between financial news, technical stock analysis, and synthesized insights.""",
        collaborator_agents=[
            {
                "agent": "news_agent",
                "instructions": "Use this collaborator for finding news and market information.",
            },
            {
                "agent": "quantitative_analysis_agent",
                "instructions": "Use this collaborator for retrieving stock price history and performing portfolio optimization.",
            },
            {
                "agent": "smart_summarizer_agent",
                "instructions": "Use this collaborator for synthesizing stock trends, financial data, and generating structured investment insights.",
            },
        ],
        collaborator_objects=[
            news_agent,
            quantitative_analysis_agent,
            smart_summarizer_agent,
        ],
        llm=LLM,
    )
    print("✓ investment_research_assistant created\n")
    
    print("=" * 80)
    print("SUCCESS! All 4 agents created successfully!")
    print("=" * 80)
    print()
    print("Agents created:")
    print("  1. smart_summarizer_agent")
    print("  2. quantitative_analysis_agent")
    print("  3. news_agent")
    print("  4. investment_research_assistant (supervisor)")
    print()
    print("You can now test the agents in the AWS Bedrock console or via API.")
    
    return investment_research_assistant

if __name__ == "__main__":
    try:
        create_agents()
    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
