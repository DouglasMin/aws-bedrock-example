# Terraform Configuration for Investment Research Lambda Functions

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Configure AWS Provider
provider "aws" {
  region  = var.aws_region
  profile = "dongik2"
  
  default_tags {
    tags = var.tags
  }
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Local values
locals {
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.name
  
  # ECR repository names
  ecr_repos = {
    stock_data    = "${var.project_name}-stock-data"
    portfolio     = "${var.project_name}-portfolio-optimization"
    web_search    = "${var.project_name}-web-search"
  }
  
  # Lambda function names
  lambda_names = {
    stock_data    = "stock_data_tools"
    portfolio     = "portfolio_optimization"
    web_search    = "web_search"
  }
}

# ============================================================================
# ECR Repositories
# ============================================================================

resource "aws_ecr_repository" "stock_data" {
  name                 = local.ecr_repos.stock_data
  image_tag_mutability = "MUTABLE"
  
  image_scanning_configuration {
    scan_on_push = true
  }
  
  tags = {
    Name = "Stock Data Lambda Repository"
  }
}

resource "aws_ecr_repository" "portfolio_optimization" {
  name                 = local.ecr_repos.portfolio
  image_tag_mutability = "MUTABLE"
  
  image_scanning_configuration {
    scan_on_push = true
  }
  
  tags = {
    Name = "Portfolio Optimization Lambda Repository"
  }
}

resource "aws_ecr_repository" "web_search" {
  name                 = local.ecr_repos.web_search
  image_tag_mutability = "MUTABLE"
  
  image_scanning_configuration {
    scan_on_push = true
  }
  
  tags = {
    Name = "Web Search Lambda Repository"
  }
}

# ============================================================================
# IAM Roles and Policies
# ============================================================================

# Lambda Execution Role
resource "aws_iam_role" "lambda_execution_role" {
  name = "${var.project_name}-lambda-execution-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
  
  tags = {
    Name = "Lambda Execution Role"
  }
}

# Attach basic Lambda execution policy
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Custom policy for additional permissions
resource "aws_iam_role_policy" "lambda_custom_policy" {
  name = "${var.project_name}-lambda-custom-policy"
  role = aws_iam_role.lambda_execution_role.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${local.region}:${local.account_id}:*"
      }
    ]
  })
}

# ============================================================================
# Lambda Functions
# ============================================================================

# Stock Data Lambda Function
resource "aws_lambda_function" "stock_data" {
  count = var.stock_data_image_uri != "" ? 1 : 0
  
  function_name = local.lambda_names.stock_data
  role         = aws_iam_role.lambda_execution_role.arn
  
  package_type  = "Image"
  image_uri     = var.stock_data_image_uri
  
  timeout       = var.lambda_timeout
  memory_size   = var.lambda_memory
  architectures = [var.lambda_architecture]
  
  environment {
    variables = {
      NODE_ENV = var.environment
    }
  }
  
  tags = {
    Name = "Stock Data Lambda Function"
  }
}

# Portfolio Optimization Lambda Function
resource "aws_lambda_function" "portfolio_optimization" {
  count = var.portfolio_image_uri != "" ? 1 : 0
  
  function_name = local.lambda_names.portfolio
  role         = aws_iam_role.lambda_execution_role.arn
  
  package_type  = "Image"
  image_uri     = var.portfolio_image_uri
  
  timeout       = var.lambda_timeout
  memory_size   = var.lambda_memory
  architectures = [var.lambda_architecture]
  
  environment {
    variables = {
      NODE_ENV = var.environment
    }
  }
  
  tags = {
    Name = "Portfolio Optimization Lambda Function"
  }
}

# Web Search Lambda Function
resource "aws_lambda_function" "web_search" {
  count = var.web_search_image_uri != "" ? 1 : 0
  
  function_name = local.lambda_names.web_search
  role         = aws_iam_role.lambda_execution_role.arn
  
  package_type  = "Image"
  image_uri     = var.web_search_image_uri
  
  timeout       = var.lambda_timeout
  memory_size   = var.lambda_memory
  architectures = [var.lambda_architecture]
  
  environment {
    variables = {
      NODE_ENV       = var.environment
      SEARCH_API_KEY = var.search_api_key
    }
  }
  
  tags = {
    Name = "Web Search Lambda Function"
  }
}
