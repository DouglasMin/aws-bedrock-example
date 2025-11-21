#!/usr/bin/env python3
"""
Fix IAM role permissions for Bedrock Agents to invoke Lambda functions
"""

import boto3
import json
import os
from pathlib import Path

# Load environment variables
env_file = Path(__file__).parent.parent / ".env"
if env_file.exists():
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key] = value

# AWS clients
session = boto3.Session(
    aws_access_key_id=os.environ.get('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.environ.get('AWS_SECRET_ACCESS_KEY'),
    region_name=os.environ.get('AWS_REGION', 'us-east-1'),
    profile_name='dongik2'  # Use the dongik2 profile
)

bedrock_agent = session.client('bedrock-agent')
iam = session.client('iam')

REGION = os.environ.get('AWS_REGION', 'us-east-1')
ACCOUNT_ID = '863518440691'

# Agent IDs
AGENTS = {
    'investment_research_assistant': 'H9CJAPR0N9',
    'quantitative_analysis_agent': 'V2ITAKMNYM',
    'news_agent': 'BUY4PA99ZD',
    'smart_summarizer_agent': 'PDH838SX05'
}

# Lambda ARNs
LAMBDA_ARNS = [
    f"arn:aws:lambda:{REGION}:{ACCOUNT_ID}:function:stock_data_tools",
    f"arn:aws:lambda:{REGION}:{ACCOUNT_ID}:function:portfolio_optimization",
    f"arn:aws:lambda:{REGION}:{ACCOUNT_ID}:function:web_search"
]

def get_agent_role(agent_id):
    """Get the IAM role ARN for an agent"""
    try:
        response = bedrock_agent.get_agent(agentId=agent_id)
        role_arn = response['agent']['agentResourceRoleArn']
        role_name = role_arn.split('/')[-1]
        return role_name, role_arn
    except Exception as e:
        print(f"❌ Error getting agent {agent_id}: {e}")
        return None, None

def add_lambda_invoke_policy(role_name):
    """Add Lambda invoke policy to IAM role"""
    policy_name = 'BedrockAgentLambdaInvokePolicy'
    
    policy_document = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "AllowLambdaInvoke",
                "Effect": "Allow",
                "Action": [
                    "lambda:InvokeFunction"
                ],
                "Resource": LAMBDA_ARNS
            }
        ]
    }
    
    try:
        # Try to put the policy (creates or updates)
        iam.put_role_policy(
            RoleName=role_name,
            PolicyName=policy_name,
            PolicyDocument=json.dumps(policy_document)
        )
        print(f"  ✅ Added Lambda invoke policy to role: {role_name}")
        return True
    except Exception as e:
        print(f"  ❌ Error adding policy to {role_name}: {e}")
        return False

def main():
    print("🔧 Fixing IAM role permissions for Bedrock Agents...")
    print()
    
    processed_roles = set()
    
    for agent_name, agent_id in AGENTS.items():
        print(f"📋 Processing agent: {agent_name} ({agent_id})")
        
        role_name, role_arn = get_agent_role(agent_id)
        
        if not role_name:
            print(f"  ⚠️  Could not get role for agent")
            continue
        
        print(f"  📝 Role: {role_name}")
        
        # Skip if we already processed this role
        if role_name in processed_roles:
            print(f"  ⏭️  Already processed this role")
            continue
        
        # Add Lambda invoke policy
        if add_lambda_invoke_policy(role_name):
            processed_roles.add(role_name)
        
        print()
    
    print("✅ All agent IAM roles updated!")
    print()
    print("You can now test the agents again:")
    print("  node test-agent.js")

if __name__ == '__main__':
    main()
