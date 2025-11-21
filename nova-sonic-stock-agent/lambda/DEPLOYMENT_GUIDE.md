# Lambda Deployment Guide

This guide covers deploying the three Lambda functions for the AI Investment Research Assistant.

## Overview

The system uses three Lambda functions:

1. **Stock Data Lambda** - Retrieves historical stock prices (Alpha Vantage API)
2. **Portfolio Optimization Lambda** - Optimizes portfolio allocations using Modern Portfolio Theory
3. **Web Search Lambda** - Searches financial news (Brave Search API)

## Prerequisites

### Required Tools
- Docker Desktop (with buildx support)
- AWS CLI v2
- Terraform >= 1.0
- Node.js 20+

### AWS Requirements
- AWS Account with appropriate permissions
- ECR repositories access
- Lambda creation permissions
- IAM role creation permissions

### API Keys (Optional)
- **Alpha Vantage API Key** - For real stock data (free tier available)
  - Get it at: https://www.alphavantage.co/support/#api-key
- **Brave Search API Key** - For real web search (free tier available)
  - Get it at: https://brave.com/search/api/

> **Note**: Without API keys, Lambda functions will return mock data for testing.

## Quick Start

### 1. Configure AWS Credentials

```bash
# Set your AWS profile (or use default)
export AWS_PROFILE=your-profile-name
export AWS_REGION=us-east-1

# Verify credentials
aws sts get-caller-identity
```

### 2. Create Terraform Variables

```bash
cd lambda/terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:

```hcl
aws_region     = "us-east-1"
aws_account_id = "123456789012"  # Your AWS account ID

# Optional: Add API keys for real data
stock_api_key  = "your-alpha-vantage-key"
search_api_key = "your-brave-search-key"
```

### 3. Create ECR Repositories

```bash
# Run Terraform to create ECR repos (without Lambda functions yet)
terraform init
terraform apply -target=aws_ecr_repository.stock_data \
                -target=aws_ecr_repository.portfolio_optimization \
                -target=aws_ecr_repository.web_search
```

### 4. Deploy Lambda Functions

```bash
# Return to lambda directory
cd ..

# Run deployment script
chmod +x deploy-lambda.sh
./deploy-lambda.sh
```

The script will:
- Build Docker images for all three Lambda functions
- Push images to ECR
- Deploy Lambda functions using Terraform
- Update your `.env` file with Lambda ARNs

### 5. Verify Deployment

```bash
# Check Lambda functions
aws lambda list-functions --query 'Functions[?starts_with(FunctionName, `stock_data`) || starts_with(FunctionName, `portfolio`) || starts_with(FunctionName, `web_search`)].FunctionName'

# Test stock data Lambda
aws lambda invoke \
  --function-name stock_data_tools \
  --payload '{"ticker":"AAPL"}' \
  response.json

cat response.json
```

## Manual Deployment Steps

If you prefer manual deployment or need to troubleshoot:

### Build Docker Images

```bash
cd lambda

# Stock Data Lambda
cd stock-data
docker buildx build --platform linux/amd64 -t investment-research-stock-data:latest --load .
cd ..

# Portfolio Optimization Lambda
cd portfolio-optimization
docker buildx build --platform linux/amd64 -t investment-research-portfolio-optimization:latest --load .
cd ..

# Web Search Lambda
cd web-search
docker buildx build --platform linux/amd64 -t investment-research-web-search:latest --load .
cd ..
```

### Push to ECR

```bash
# Get your AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=us-east-1

# Login to ECR
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Tag and push each image
TIMESTAMP=$(date +%s)

# Stock Data
docker tag investment-research-stock-data:latest \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/investment-research-stock-data:$TIMESTAMP
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/investment-research-stock-data:$TIMESTAMP

# Portfolio Optimization
docker tag investment-research-portfolio-optimization:latest \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/investment-research-portfolio-optimization:$TIMESTAMP
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/investment-research-portfolio-optimization:$TIMESTAMP

# Web Search
docker tag investment-research-web-search:latest \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/investment-research-web-search:$TIMESTAMP
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/investment-research-web-search:$TIMESTAMP
```

### Deploy with Terraform

```bash
cd terraform

terraform apply \
  -var="stock_data_image_uri=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/investment-research-stock-data:$TIMESTAMP" \
  -var="portfolio_image_uri=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/investment-research-portfolio-optimization:$TIMESTAMP" \
  -var="web_search_image_uri=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/investment-research-web-search:$TIMESTAMP"
```

## Testing Lambda Functions

### Test Stock Data Lambda

```bash
aws lambda invoke \
  --function-name stock_data_tools \
  --payload '{"ticker":"AAPL"}' \
  response.json && cat response.json | jq
```

Expected response:
```json
{
  "ticker": "AAPL",
  "prices": {
    "2024-01-01": 175.50,
    "2024-01-02": 176.20,
    ...
  },
  "startDate": "2024-01-01",
  "endDate": "2024-01-30",
  "change": "+2.5%",
  "dataSource": "alphavantage" or "mock"
}
```

### Test Portfolio Optimization Lambda

```bash
# First get stock data for multiple tickers
aws lambda invoke \
  --function-name stock_data_tools \
  --payload '{"ticker":"AAPL"}' \
  aapl.json

aws lambda invoke \
  --function-name stock_data_tools \
  --payload '{"ticker":"MSFT"}' \
  msft.json

aws lambda invoke \
  --function-name stock_data_tools \
  --payload '{"ticker":"GOOGL"}' \
  googl.json

# Combine data and optimize
# (You'll need to format the payload properly)
aws lambda invoke \
  --function-name portfolio_optimization \
  --payload '{"tickers":["AAPL","MSFT","GOOGL"],"prices":{...}}' \
  portfolio.json && cat portfolio.json | jq
```

### Test Web Search Lambda

```bash
aws lambda invoke \
  --function-name web_search \
  --payload '{"query":"Apple earnings Q4 2024"}' \
  search.json && cat search.json | jq
```

## Updating Lambda Functions

To update Lambda code after changes:

```bash
# Rebuild and redeploy
cd lambda
./deploy-lambda.sh
```

Or update a specific Lambda:

```bash
# Build new image
cd stock-data
docker buildx build --platform linux/amd64 -t investment-research-stock-data:latest --load .

# Push to ECR
TIMESTAMP=$(date +%s)
docker tag investment-research-stock-data:latest \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/investment-research-stock-data:$TIMESTAMP
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/investment-research-stock-data:$TIMESTAMP

# Update Lambda
aws lambda update-function-code \
  --function-name stock_data_tools \
  --image-uri $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/investment-research-stock-data:$TIMESTAMP
```

## Monitoring and Logs

### View Lambda Logs

```bash
# Stock Data Lambda
aws logs tail /aws/lambda/stock_data_tools --follow

# Portfolio Optimization Lambda
aws logs tail /aws/lambda/portfolio_optimization --follow

# Web Search Lambda
aws logs tail /aws/lambda/web_search --follow
```

### CloudWatch Metrics

Monitor Lambda performance in AWS Console:
- Invocations
- Duration
- Errors
- Throttles

## Cost Optimization

### Lambda Pricing
- **Free Tier**: 1M requests/month + 400,000 GB-seconds compute
- **After Free Tier**: $0.20 per 1M requests + $0.0000166667 per GB-second

### Estimated Costs (with free tier)
- **Development**: ~$0-5/month
- **Production (1000 requests/day)**: ~$5-15/month

### Cost Saving Tips
1. Use mock data during development (no API costs)
2. Optimize Lambda memory (512MB is sufficient)
3. Set appropriate timeouts (30s default)
4. Use ECR lifecycle policies (keep last 5 images)

## Troubleshooting

### Docker Build Fails

```bash
# Ensure buildx is available
docker buildx version

# Create builder if needed
docker buildx create --use
```

### ECR Push Fails

```bash
# Re-authenticate
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
```

### Lambda Timeout

Increase timeout in `terraform/variables.tf`:

```hcl
variable "lambda_timeout" {
  default = 60  # Increase from 30 to 60 seconds
}
```

### API Rate Limits

**Alpha Vantage**: 5 requests/minute (free tier)
- Solution: Implement caching or upgrade to premium

**Brave Search**: 2000 requests/month (free tier)
- Solution: Use mock data for development

## Cleanup

To remove all Lambda resources:

```bash
cd lambda/terraform
terraform destroy
```

This will delete:
- Lambda functions
- IAM roles
- ECR repositories (and all images)

## Next Steps

After deploying Lambda functions:

1. ✅ Verify Lambda ARNs in `.env` file
2. 📝 Run `node scripts/setup-agents.js` to create Bedrock agents
3. 📚 Run `node scripts/setup-knowledge-base.js` to create knowledge base
4. 🧪 Test with `npm start`

## Support

For issues or questions:
- Check CloudWatch Logs for Lambda errors
- Review Terraform state: `terraform show`
- Test Lambda functions individually before integration
- Verify IAM permissions for Lambda execution role
