# Terraform Variables for Investment Research Lambda Functions
# AWS Account: dongik2

aws_region     = "us-east-1"
aws_account_id = "863518440691"

project_name = "investment-research"
environment  = "dev"

# Lambda Configuration
lambda_timeout      = 30
lambda_memory       = 512
lambda_architecture = "x86_64"

# API Keys
# Stock data uses Yahoo Finance (no API key needed!)
search_api_key = "BSAmFpSfcny5SAfgorimKvhSNMcrGYx"  # Brave Search API key

# Tags
tags = {
  Project     = "AI Investment Research Assistant"
  Environment = "dev"
  ManagedBy   = "terraform"
  Owner       = "dongik2"
}
