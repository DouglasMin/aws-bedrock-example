# AWS Nova Canvas Studio

A Streamlit application for generating and editing images using Amazon Bedrock's Nova Canvas model. Supports text-to-image generation and inpainting (image editing with masks).

## Prerequisites

- AWS Account with Bedrock access
- Python 3.8+
- AWS credentials with permissions for:
  - `bedrock-runtime:InvokeModel`

## Installation

```bash
pip install -r requirements.txt
```

### Dependencies
- `streamlit==1.40.0` - Web UI framework
- `boto3` - AWS SDK for Python
- `Pillow` - Image processing
- `python-dotenv` - Environment variable management
- `streamlit-drawable-canvas` - Interactive canvas for mask drawing

## Configuration

Create a `.env` file in the project root with your AWS credentials:

```env
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_REGION=us-east-1
```

⚠️ **Security Note**: The `.env` file is included in `.gitignore` to prevent accidentally committing credentials. Never commit this file to version control.

## Usage

1. Run the Streamlit app:
```bash
streamlit run app.py
```

2. Choose a task:
   - **Text-to-Image**: Generate images from text descriptions
   - **Inpainting**: Edit existing images by masking areas to modify

3. Configure generation parameters and click "Generate Image"

## Features

### Text-to-Image Generation
- Enter a text prompt describing the image you want
- Optional negative prompt to exclude unwanted elements
- Adjustable CFG scale (1.0-10.0) for prompt adherence
- Seed control for reproducible results
- Output: 512x512 images

### Inpainting (Image Editing)
- Upload an existing image (PNG, JPG, JPEG)
- Draw rectangles on areas you want to modify
- Enter a prompt describing what should replace the masked area
- The app will regenerate only the masked regions

## Important Implementation Notes

### ⚠️ Critical Requirements for Nova Canvas

#### 1. Model ID
The app uses `amazon.nova-canvas-v1:0` which is set permanently in `app.py`:
```python
MODEL_ID = "amazon.nova-canvas-v1:0"
```

#### 2. Task Types and Required Fields

**Text-to-Image**:
```python
body = {
    "taskType": "TEXT_IMAGE",
    "textToImageParams": {"text": prompt_text},
    "imageGenerationConfig": {
        "numberOfImages": 1,
        "quality": "standard",
        "cfgScale": cfg_scale,
        "seed": seed,
        "height": 512,
        "width": 512
    }
}
```

**Inpainting**:
```python
body = {
    "taskType": "INPAINTING",
    "inPaintingParams": {
        "text": prompt_text,
        "image": encoded_image,  # Base64 encoded
        "maskImage": encoded_mask  # Base64 encoded
    },
    "imageGenerationConfig": {
        "numberOfImages": 1,
        "quality": "standard",
        "cfgScale": cfg_scale,
        "seed": seed
    }
}
```

#### 3. Mask Image Format (CRITICAL!)

**The mask logic is inverted from what you might expect:**

- **WHITE (255)**: Areas to KEEP unchanged
- **BLACK (0)**: Areas to MODIFY/REGENERATE

```python
# Initialize mask as WHITE (keep everything)
mask = Image.new("L", (bg_image.width, bg_image.height), 255)

# Draw BLACK over areas to modify
draw.rectangle([left, top, left + width, top + height], fill=0)
```

This is the **opposite** of typical image editing software where black usually means "protect" and white means "edit". Getting this wrong will result in the entire image being regenerated except the area you wanted to change.

#### 4. Image Encoding
Both the source image and mask must be:
- Base64 encoded
- PNG format
- Same dimensions

```python
image_bytes_io = io.BytesIO()
bg_image.save(image_bytes_io, format="PNG")
encoded_image = base64.b64encode(image_bytes_io.getvalue()).decode('utf-8')
```

### Generation Parameters

- **CFG Scale** (1.0-10.0): Controls how closely the model follows the prompt
  - Lower values: More creative/varied results
  - Higher values: Stricter adherence to prompt
  - Recommended: 8.0

- **Seed**: Integer value for reproducible results
  - Same seed + same prompt = same image
  - Use 0 for random generation

- **Quality**: Set to "standard" (other options may be available)

- **Dimensions**: 512x512 for text-to-image (configurable in code)

## Canvas Controls (Inpainting Mode)

- **rect**: Draw rectangles to define mask areas
- **transform**: Move or resize existing rectangles

The drawn rectangles (shown in black with transparency) define the areas that will be regenerated based on your prompt.

## Troubleshooting

### Error: "Please draw a rectangle on the image to define the mask"
- You must draw at least one rectangle on the uploaded image in inpainting mode
- Switch canvas mode to "rect" if you can't draw

### Inpainting modifies the wrong areas
- Check mask logic: BLACK (0) = modify, WHITE (255) = keep
- Verify the mask is being generated correctly in `app.py` lines 115-125

### AWS Credentials Error
- Verify your `.env` file exists and contains valid credentials
- Check that the credentials have `bedrock-runtime:InvokeModel` permissions
- Ensure the region is correct (us-east-1 for Nova Canvas)

### Image quality issues
- Adjust CFG scale (try 8.0 as a starting point)
- Refine your prompt to be more specific
- Try different seed values

### Canvas not displaying
- Ensure uploaded image is not too large (automatically resized to 800px max)
- Check that `streamlit-drawable-canvas` is installed correctly

## File Structure

```
image-generation-test/
├── app.py                 # Main Streamlit application
├── requirements.txt       # Python dependencies
├── .env                   # AWS credentials (DO NOT COMMIT)
├── .gitignore            # Excludes .env from git
└── README.md             # This file
```

## References

- [AWS Bedrock Nova Canvas Documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-nova-canvas.html)
- [Bedrock Runtime API Reference](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_InvokeModel.html)
- [Streamlit Drawable Canvas](https://github.com/andfanilo/streamlit-drawable-canvas)

## Security Best Practices

1. **Never commit `.env` files** - Already configured in `.gitignore`
2. **Use IAM roles** in production instead of access keys
3. **Rotate credentials** regularly
4. **Use AWS Secrets Manager** for production deployments
5. **Limit IAM permissions** to only what's needed (principle of least privilege)
