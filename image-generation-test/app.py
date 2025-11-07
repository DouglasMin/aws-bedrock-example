import streamlit as st
import boto3
import json
import base64
from PIL import Image
import io
from dotenv import load_dotenv
import os

load_dotenv()

st.title("AWS Bedrock Image Generation")

# Boto3 client setup
try:
    bedrock_runtime = boto3.client(
        service_name='bedrock-runtime',
        region_name=os.getenv("AWS_REGION"),
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY")
    )
except Exception as e:
    st.error(f"Error initializing Boto3 client: {e}")
    st.stop()


prompt_text = st.text_input("Enter a prompt for the image:", "A futuristic city at sunset with flying cars")
negative_prompt_text = st.text_input("Enter a negative prompt (what to exclude):", "blurry, low resolution")

if st.button("Generate Image"):
    if not prompt_text:
        st.warning("Please enter a prompt.")
    else:
        with st.spinner("Generating image..."):
            try:
                # Define the model ID and payload
                model_id = "amazon.nova-canvas-v1:0"
                body = json.dumps({
                    "taskType": "TEXT_IMAGE",
                    "textToImageParams": {
                        "text": prompt_text,
                        "negativeText": negative_prompt_text
                    },
                    "imageGenerationConfig": {
                        "numberOfImages": 1,
                        "quality": "standard",
                        "cfgScale": 7.0,
                        "height": 768,
                        "width": 1024,
                        "seed": 0
                    }
                })

                # Invoke the model
                response = bedrock_runtime.invoke_model(
                    body=body,
                    modelId=model_id,
                    accept="application/json",
                    contentType="application/json"
                )

                # Process the response
                response_body = json.loads(response.get("body").read())
                base64_image = response_body["images"][0]

                # Decode and display the image
                image_bytes = base64.b64decode(base64_image)
                image = Image.open(io.BytesIO(image_bytes))

                st.image(image, caption="Generated Image", use_container_width=True)

            except Exception as e:
                st.error(f"An error occurred: {e}")
