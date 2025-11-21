# Terraform Outputs for Investment Research Lambda Functions

# ECR Repository URLs
output "ecr_stock_data_url" {
  description = "ECR repository URL for stock data Lambda"
  value       = aws_ecr_repository.stock_data.repository_url
}

output "ecr_portfolio_url" {
  description = "ECR repository URL for portfolio optimization Lambda"
  value       = aws_ecr_repository.portfolio_optimization.repository_url
}

output "ecr_web_search_url" {
  description = "ECR repository URL for web search Lambda"
  value       = aws_ecr_repository.web_search.repository_url
}

# Lambda Function ARNs
output "lambda_stock_data_arn" {
  description = "ARN of stock data Lambda function"
  value       = length(aws_lambda_function.stock_data) > 0 ? aws_lambda_function.stock_data[0].arn : "Not deployed"
}

output "lambda_portfolio_arn" {
  description = "ARN of portfolio optimization Lambda function"
  value       = length(aws_lambda_function.portfolio_optimization) > 0 ? aws_lambda_function.portfolio_optimization[0].arn : "Not deployed"
}

output "lambda_web_search_arn" {
  description = "ARN of web search Lambda function"
  value       = length(aws_lambda_function.web_search) > 0 ? aws_lambda_function.web_search[0].arn : "Not deployed"
}

# Lambda Function Names
output "lambda_stock_data_name" {
  description = "Name of stock data Lambda function"
  value       = local.lambda_names.stock_data
}

output "lambda_portfolio_name" {
  description = "Name of portfolio optimization Lambda function"
  value       = local.lambda_names.portfolio
}

output "lambda_web_search_name" {
  description = "Name of web search Lambda function"
  value       = local.lambda_names.web_search
}

# IAM Role
output "lambda_execution_role_arn" {
  description = "ARN of Lambda execution role"
  value       = aws_iam_role.lambda_execution_role.arn
}

# Region and Account
output "aws_region" {
  description = "AWS region"
  value       = local.region
}

output "aws_account_id" {
  description = "AWS account ID"
  value       = local.account_id
}
