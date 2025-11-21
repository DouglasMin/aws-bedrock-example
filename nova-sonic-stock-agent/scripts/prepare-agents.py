#!/usr/bin/env python3
"""
Prepare all Bedrock agents (creates DRAFT versions and aliases)
This is required after creating agents or updating their configurations
"""

import sys
import boto3
from pathlib import Path

# Add the helper modules to path
SCRIPT_DIR = Path(__file__).resolve().parent
HELPER_DIR = SCRIPT_DIR.parent / "helper"
sys.path.insert(0, str(HELPER_DIR))

try:
    from bedrock_agent import agents_helper
except ImportError as e:
    print(f"ERROR: Could not import helper modules: {e}")
    sys.exit(1)

# Agent names
AGENT_NAMES = [
    "investment_research_assistant",
    "quantitative_analysis_agent",
    "news_agent",
    "smart_summarizer_agent"
]

def prepare_agents():
    """Prepare all agents"""
    print("=" * 80)
    print("Preparing Bedrock Agents")
    print("=" * 80)
    print()
    
    for agent_name in AGENT_NAMES:
        print(f"📦 Preparing agent: {agent_name}")
        try:
            agents_helper.prepare_agent(agent_name=agent_name, verbose=True)
            print(f"✅ {agent_name} prepared successfully\n")
        except Exception as e:
            print(f"❌ Error preparing {agent_name}: {e}\n")
    
    print("=" * 80)
    print("All agents prepared!")
    print("=" * 80)
    print()
    print("Wait 30-60 seconds for IAM permissions to propagate, then test:")
    print("  node test-agent.js")

if __name__ == "__main__":
    try:
        prepare_agents()
    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
