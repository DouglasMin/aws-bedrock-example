#!/bin/bash

# Fix Lambda permissions for Bedrock Agents
# This script adds resource-based policies to Lambda functions to allow Bedrock agents to invoke them

set -e

REGION="us-east-1"
ACCOUNT_ID="863518440691"

# Lambda functions
LAMBDAS=(
    "stock_data_tools"
    "portfolio_optimization"
    "web_search"
)

# Agent IDs
AGENTS=(
    "H9CJAPR0N9"  # investment_research_assistant
    "V2ITAKMNYM"  # quantitative_analysis_agent
    "BUY4PA99ZD"  # news_agent
)

echo "🔧 Adding Lambda permissions for Bedrock Agents..."
echo ""

for lambda_name in "${LAMBDAS[@]}"; do
    echo "📦 Processing Lambda: $lambda_name"
    
    for agent_id in "${AGENTS[@]}"; do
        statement_id="bedrock-agent-${agent_id}-$(date +%s)"
        
        echo "  ➕ Adding permission for agent: $agent_id"
        
        aws lambda add-permission \
            --function-name "$lambda_name" \
            --statement-id "$statement_id" \
            --action "lambda:InvokeFunction" \
            --principal "bedrock.amazonaws.com" \
            --source-arn "arn:aws:bedrock:${REGION}:${ACCOUNT_ID}:agent/${agent_id}" \
            --region "$REGION" \
            2>/dev/null || echo "    ⚠️  Permission may already exist"
    done
    
    echo "  ✅ Done with $lambda_name"
    echo ""
done

echo "✅ All Lambda permissions updated!"
echo ""
echo "You can now test the agents again:"
echo "  node test-agent.js"
