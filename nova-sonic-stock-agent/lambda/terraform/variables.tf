# Terraform Variables for Investment Research Lambda Functions

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "aws_account_id" {
  description = "AWS Account ID"
  type        = string
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "investment-research"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}

# Lambda Image URIs (updated by deployment script)
variable "stock_data_image_uri" {
  description = "ECR image URI for stock data Lambda"
  type        = string
  default     = ""
}

variable "portfolio_image_uri" {
  description = "ECR image URI for portfolio optimization Lambda"
  type        = string
  default     = ""
}

variable "web_search_image_uri" {
  description = "ECR image URI for web search Lambda"
  type        = string
  default     = ""
}

# API Keys
variable "search_api_key" {
  description = "API key for Brave Search service (required for real financial news)"
  type        = string
  default     = ""
  sensitive   = true
}

# Lambda Configuration
variable "lambda_timeout" {
  description = "Lambda function timeout in seconds"
  type        = number
  default     = 30
}

variable "lambda_memory" {
  description = "Lambda function memory in MB"
  type        = number
  default     = 512
}

variable "lambda_architecture" {
  description = "Lambda function architecture"
  type        = string
  default     = "x86_64"
}

# Tags
variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default = {
    Project     = "AI Investment Research Assistant"
    Environment = "dev"
    ManagedBy   = "terraform"
  }
}
