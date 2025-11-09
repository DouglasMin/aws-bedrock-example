# Amazon Bedrock Nova Reel Video Generator

A Streamlit application for generating videos from text prompts using Amazon Bedrock's Nova Reel model.

## Prerequisites

- AWS Account with Bedrock access
- Python 3.8+
- S3 bucket for storing generated videos
- AWS credentials with permissions for:
  - `bedrock-runtime:StartAsyncInvoke`
  - `bedrock-runtime:GetAsyncInvoke`
  - `s3:PutObject`
  - `s3:GetObject`
  - `s3:ListBucket`

## Installation

```bash
pip install streamlit boto3
```

## Configuration

Create a `.streamlit/secrets.toml` file with your AWS credentials:

```toml
AWS_ACCESS_KEY_ID = "your-access-key-id"
AWS_SECRET_ACCESS_KEY = "your-secret-access-key"
AWS_REGION_NAME = "us-east-1"
```

## Usage

1. Run the Streamlit app:
```bash
streamlit run app.py
```

2. Enter a text prompt describing the video you want to generate
3. Enter your S3 bucket name (just the name, e.g., `my-bucket`)
4. Click "Generate Video" and wait for the process to complete

## Important Implementation Notes

### ⚠️ Critical Requirements for Nova Reel

When working with Amazon Bedrock Nova Reel (`amazon.nova-reel-v1:0` or `v1:1`), these fields are **REQUIRED**:

#### 1. videoGenerationConfig (REQUIRED)
```python
model_input = {
    "taskType": "TEXT_VIDEO",
    "textToVideoParams": {
        "text": prompt
    },
    "videoGenerationConfig": {  # THIS IS REQUIRED!
        "fps": 24,
        "durationSeconds": 6,
        "dimension": "1280x720",
        "seed": random.randint(0, 2147483646)
    }
}
```

**Error if missing**: `ValidationException: required key [videoGenerationConfig] not found`

#### 2. S3 URI Format (REQUIRED)
The S3 URI **must** point to a bucket or directory with a **trailing slash**:

✅ **Correct**:
```python
s3_output_uri = "s3://my-bucket/"
s3_output_uri = "s3://my-bucket/videos/"
```

❌ **Incorrect**:
```python
s3_output_uri = "s3://my-bucket"  # Missing trailing slash
s3_output_uri = "s3://my-bucket/output/job-123"  # Points to file, not directory
```

**Error if incorrect**: `ValidationException: The provided S3 URI does not point to a bucket or a directory`

### Video Generation Parameters

- **fps**: Frames per second (typically 24)
- **durationSeconds**: Video length (6 seconds for Nova Reel)
- **dimension**: Resolution (options: "1280x720", "1920x1080")
- **seed**: Random seed (0 to 2,147,483,646) for reproducible results

### Output

The generated video will be saved as `output.mp4` in the specified S3 bucket location.

## Troubleshooting

### ValidationException: required key [videoGenerationConfig] not found
- Ensure `videoGenerationConfig` is included in the `model_input` with all required fields

### ValidationException: The provided S3 URI does not point to a bucket or a directory
- Add a trailing slash to your S3 URI
- Ensure the URI points to a directory, not a file

### Video generation takes too long
- Video generation typically takes 2-5 minutes
- The app polls every 30 seconds for status updates
- Check CloudWatch logs if the job fails

## References

- [AWS Bedrock Nova Reel Documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/bedrock-runtime_example_bedrock-runtime_Scenario_AmazonNova_TextToVideo_section.html)
- [Bedrock Runtime API Reference](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_StartAsyncInvoke.html)
