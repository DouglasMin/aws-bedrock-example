#!/bin/bash
# Automated Lambda Deployment Script for Investment Research Tools
# Builds, pushes, and deploys all Lambda functions

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration - Update these values
AWS_PROFILE="${AWS_PROFILE:-dongik2}"
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text --profile $AWS_PROFILE)}"
ECR_REPO_BASE="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

# Lambda function names
LAMBDAS=("stock-data" "portfolio-optimization" "web-search")

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Investment Research Lambda Deployment                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}\n"

echo -e "${YELLOW}📋 Configuration:${NC}"
echo -e "  AWS Profile: ${GREEN}$AWS_PROFILE${NC}"
echo -e "  AWS Region: ${GREEN}$AWS_REGION${NC}"
echo -e "  AWS Account: ${GREEN}$AWS_ACCOUNT_ID${NC}\n"

# Step 1: Login to ECR
echo -e "${YELLOW}🔐 Logging into ECR...${NC}"
aws ecr get-login-password --region "$AWS_REGION" --profile "$AWS_PROFILE" | \
  docker login --username AWS --password-stdin "$ECR_REPO_BASE"
echo -e "${GREEN}✓ ECR login successful${NC}\n"

# Generate timestamp for versioning
TIMESTAMP=$(date +%s)
echo -e "${YELLOW}🏷️  Deployment timestamp: $TIMESTAMP${NC}\n"

# Step 2: Build and push each Lambda
for LAMBDA_NAME in "${LAMBDAS[@]}"; do
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}📦 Processing Lambda: $LAMBDA_NAME${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
  
  LAMBDA_DIR="$LAMBDA_NAME"
  ECR_REPO="$ECR_REPO_BASE/investment-research-$LAMBDA_NAME"
  
  # Check if directory exists
  if [ ! -d "$LAMBDA_DIR" ]; then
    echo -e "${RED}✗ Directory $LAMBDA_DIR not found, skipping...${NC}\n"
    continue
  fi
  
  # Build Docker image
  echo -e "${YELLOW}  🔨 Building Docker image for linux/amd64...${NC}"
  cd "$LAMBDA_DIR"
  docker buildx build --platform linux/amd64 -t "investment-research-$LAMBDA_NAME:latest" --load .
  echo -e "${GREEN}  ✓ Docker image built${NC}\n"
  
  # Tag images
  echo -e "${YELLOW}  🏷️  Tagging images...${NC}"
  docker tag "investment-research-$LAMBDA_NAME:latest" "$ECR_REPO:$TIMESTAMP"
  docker tag "investment-research-$LAMBDA_NAME:latest" "$ECR_REPO:latest"
  echo -e "${GREEN}  ✓ Images tagged${NC}\n"
  
  # Push to ECR
  echo -e "${YELLOW}  📤 Pushing to ECR...${NC}"
  docker push "$ECR_REPO:$TIMESTAMP"
  docker push "$ECR_REPO:latest"
  echo -e "${GREEN}  ✓ Pushed to ECR${NC}\n"
  
  cd ..
done

# Step 3: Deploy with Terraform
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}🔧 Deploying Lambda functions with Terraform...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

cd terraform

# Initialize Terraform if needed
if [ ! -d ".terraform" ]; then
  echo -e "${YELLOW}  📦 Initializing Terraform...${NC}"
  AWS_PROFILE="$AWS_PROFILE" terraform init
  echo -e "${GREEN}  ✓ Terraform initialized${NC}\n"
fi

# Apply Terraform with new image URIs
echo -e "${YELLOW}  🚀 Applying Terraform configuration...${NC}"
AWS_PROFILE="$AWS_PROFILE" terraform apply \
  -var="stock_data_image_uri=$ECR_REPO_BASE/investment-research-stock-data:$TIMESTAMP" \
  -var="portfolio_image_uri=$ECR_REPO_BASE/investment-research-portfolio-optimization:$TIMESTAMP" \
  -var="web_search_image_uri=$ECR_REPO_BASE/investment-research-web-search:$TIMESTAMP" \
  -auto-approve

echo -e "${GREEN}  ✓ Terraform applied${NC}\n"

# Step 4: Get Lambda ARNs
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}📝 Lambda Function ARNs:${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

STOCK_DATA_ARN=$(AWS_PROFILE="$AWS_PROFILE" terraform output -raw stock_data_lambda_arn 2>/dev/null || echo "N/A")
PORTFOLIO_ARN=$(AWS_PROFILE="$AWS_PROFILE" terraform output -raw portfolio_lambda_arn 2>/dev/null || echo "N/A")
WEB_SEARCH_ARN=$(AWS_PROFILE="$AWS_PROFILE" terraform output -raw web_search_lambda_arn 2>/dev/null || echo "N/A")

echo -e "${GREEN}Stock Data Lambda:${NC}"
echo -e "  $STOCK_DATA_ARN\n"

echo -e "${GREEN}Portfolio Optimization Lambda:${NC}"
echo -e "  $PORTFOLIO_ARN\n"

echo -e "${GREEN}Web Search Lambda:${NC}"
echo -e "  $WEB_SEARCH_ARN\n"

# Step 5: Update .env file
cd ../..
ENV_FILE=".env"

echo -e "${YELLOW}📝 Updating $ENV_FILE with Lambda ARNs...${NC}"

# Create or update .env file
if [ ! -f "$ENV_FILE" ]; then
  cp .env.example "$ENV_FILE" 2>/dev/null || touch "$ENV_FILE"
fi

# Update or append Lambda ARNs
sed -i.bak '/^STOCK_DATA_LAMBDA_ARN=/d' "$ENV_FILE" 2>/dev/null || true
sed -i.bak '/^PORTFOLIO_LAMBDA_ARN=/d' "$ENV_FILE" 2>/dev/null || true
sed -i.bak '/^WEB_SEARCH_LAMBDA_ARN=/d' "$ENV_FILE" 2>/dev/null || true

echo "STOCK_DATA_LAMBDA_ARN=$STOCK_DATA_ARN" >> "$ENV_FILE"
echo "PORTFOLIO_LAMBDA_ARN=$PORTFOLIO_ARN" >> "$ENV_FILE"
echo "WEB_SEARCH_LAMBDA_ARN=$WEB_SEARCH_ARN" >> "$ENV_FILE"

rm -f "$ENV_FILE.bak"

echo -e "${GREEN}✓ .env file updated${NC}\n"

# Done!
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  ${GREEN}✅ Deployment Complete!${BLUE}                                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}\n"

echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Verify Lambda ARNs in ${GREEN}.env${NC} file"
echo -e "  2. Run ${GREEN}node scripts/setup-agents.js${NC} to create Bedrock agents"
echo -e "  3. Test with ${GREEN}npm start${NC}\n"
