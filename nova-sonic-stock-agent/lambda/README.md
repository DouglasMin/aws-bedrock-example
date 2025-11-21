# Lambda Functions - Investment Research Tools

This directory contains Lambda functions for the AI Investment Research Assistant.

## Architecture

**Deployment**: Docker + ECR + Terraform
- Each Lambda is containerized
- Images stored in ECR (Elastic Container Registry)
- Infrastructure managed by Terraform
- One-command deployment script

## Lambda Functions

### 1. Stock Data Lambda (`stock-data/`)
- **Function**: Retrieve historical stock prices
- **Tool**: `stock_data_lookup`
- **Input**: `{ ticker: "AAPL" }`
- **Output**: `{ ticker, prices: { "2024-01-01": 150.25, ... }, startDate, endDate }`

### 2. Portfolio Optimization Lambda (`portfolio-optimization/`)
- **Function**: Optimize portfolio allocations
- **Tool**: `portfolio_optimization`
- **Input**: `{ tickers: "AAPL,MSFT,GOOGL", prices: {...} }`
- **Output**: `{ allocations: { "AAPL": 0.35, ... }, expectedReturn, risk, sharpeRatio }`

### 3. Web Search Lambda (`web-search/`)
- **Function**: Search for financial news
- **Tool**: `web_search`
- **Input**: `{ query: "Amazon earnings", days: 7 }`
- **Output**: `{ results: [{ title, url, snippet, publishedDate }], resultCount }`

## Directory Structure

```
lambda/
├── deploy-lambda.sh              # Automated deployment script
├── terraform/                    # Infrastructure as code
│   ├── main.tf                  # Lambda resources, ECR, IAM
│   ├── variables.tf             # Input variables
│   ├── outputs.tf               # Lambda ARNs
│   └── terraform.tfvars         # Your configuration
├── stock-data/
│   ├── Dockerfile
│   ├── index.js                 # Lambda handler
│   ├── package.json
│   └── src/
│       └── stock-api.js
├── portfolio-optimization/
│   ├── Dockerfile
│   ├── index.js
│   ├── package.json
│   └── src/
│       └── optimizer.js
└── web-search/
    ├── Dockerfile
    ├── index.js
    ├── package.json
    └── src/
        └── search-api.js
```

## Prerequisites

1. **AWS CLI** configured with credentials
2. **Docker** with buildx support
3. **Terraform** installed
4. **AWS Account** with permissions for:
   - ECR (create repositories, push images)
   - Lambda (create functions, update code)
   - IAM (create roles)

## Setup

### 1. Configure AWS

```bash
# Set your AWS profile
export AWS_PROFILE=your-profile-name
export AWS_REGION=us-east-1

# Verify credentials
aws sts get-caller-identity
```

### 2. Create ECR Repositories (First Time Only)

```bash
cd terraform
terraform init
terraform apply -target=aws_ecr_repository.stock_data
terraform apply -target=aws_ecr_repository.portfolio_optimization
terraform apply -target=aws_ecr_repository.web_search
```

Or manually:
```bash
aws ecr create-repository --repository-name investment-research-stock-data
aws ecr create-repository --repository-name investment-research-portfolio-optimization
aws ecr create-repository --repository-name investment-research-web-search
```

### 3. Configure Environment Variables

Create `terraform/terraform.tfvars`:
```hcl
aws_region     = "us-east-1"
aws_account_id = "123456789012"

# Optional: API keys for external services
stock_api_key  = "your-alpha-vantage-key"
search_api_key = "your-brave-search-key"
```

## Deployment

### Quick Deploy (All Lambdas)

```bash
./deploy-lambda.sh
```

This script will:
1. ✅ Login to ECR
2. ✅ Build Docker images for each Lambda
3. ✅ Tag with timestamp (forces update)
4. ✅ Push to ECR
5. ✅ Deploy via Terraform
6. ✅ Output Lambda ARNs
7. ✅ Update `../.env` file automatically

### Deploy Single Lambda

```bash
# Build and push
cd stock-data
docker buildx build --platform linux/amd64 -t stock-data:latest --load .
docker tag stock-data:latest $ECR_REPO/investment-research-stock-data:latest
docker push $ECR_REPO/investment-research-stock-data:latest

# Update Lambda
cd ../terraform
terraform apply -target=aws_lambda_function.stock_data
```

## Testing Lambdas

### Test Locally with Docker

```bash
cd stock-data
docker build -t stock-data-test .
docker run -p 9000:8080 stock-data-test

# In another terminal
curl -XPOST "http://localhost:9000/2015-03-31/functions/function/invocations" \
  -d '{"ticker": "AAPL"}'
```

### Test on AWS

```bash
aws lambda invoke \
  --function-name stock_data_tools \
  --payload '{"ticker": "AAPL"}' \
  --profile $AWS_PROFILE \
  response.json

cat response.json
```

## Updating Lambda Code

After making code changes:

```bash
# Quick update
./deploy-lambda.sh

# Or manually
cd stock-data
docker buildx build --platform linux/amd64 -t stock-data:latest --load .
# ... push and deploy
```

## Monitoring

### View Logs

```bash
# Stock Data Lambda
aws logs tail /aws/lambda/stock_data_tools --follow

# Portfolio Optimization Lambda
aws logs tail /aws/lambda/portfolio_optimization --follow

# Web Search Lambda
aws logs tail /aws/lambda/web_search --follow
```

### Check Lambda Status

```bash
aws lambda get-function --function-name stock_data_tools
```

## Troubleshooting

### ECR Login Fails
```bash
# Ensure AWS CLI is configured
aws configure list

# Try explicit region
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin $ECR_REPO
```

### Docker Build Fails
```bash
# Check Docker is running
docker ps

# Check buildx
docker buildx ls

# Create builder if needed
docker buildx create --use
```

### Lambda Update Not Reflecting
```bash
# Force new deployment with timestamp tag
TIMESTAMP=$(date +%s)
docker tag stock-data:latest $ECR_REPO:$TIMESTAMP
docker push $ECR_REPO:$TIMESTAMP

# Update Lambda with specific image
terraform apply -var="stock_data_image_uri=$ECR_REPO:$TIMESTAMP"
```

### Permission Errors
Ensure your IAM user/role has:
- `ecr:GetAuthorizationToken`
- `ecr:BatchCheckLayerAvailability`
- `ecr:PutImage`
- `lambda:UpdateFunctionCode`
- `lambda:CreateFunction`

## Cost Optimization

- **ECR**: ~$0.10/GB/month for storage
- **Lambda**: Free tier includes 1M requests/month
- **Tip**: Delete old ECR images to save costs

```bash
# List images
aws ecr list-images --repository-name investment-research-stock-data

# Delete old images (keep latest 5)
aws ecr batch-delete-image \
  --repository-name investment-research-stock-data \
  --image-ids imageTag=old-timestamp
```

## Next Steps

After deploying Lambdas:

1. ✅ Verify ARNs in `../.env`
2. ✅ Run `node ../scripts/setup-agents.js` to create Bedrock agents
3. ✅ Test with `npm start` in parent directory

## Resources

- [AWS Lambda Container Images](https://docs.aws.amazon.com/lambda/latest/dg/images-create.html)
- [ECR User Guide](https://docs.aws.amazon.com/AmazonECR/latest/userguide/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
