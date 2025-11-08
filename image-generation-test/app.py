
import streamlit as st
import boto3
import json
import base64
from PIL import Image, ImageDraw
import io
from dotenv import load_dotenv
import os
import numpy as np
from streamlit_drawable_canvas import st_canvas

# Load environment variables from .env file
load_dotenv()

st.set_page_config(layout="wide")
st.title("AWS Nova Canvas Studio")

# --- Boto3 Client Setup ---
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

# --- UI Layout ---
col1, col2 = st.columns([1, 2])

# Set the model ID permanently to Nova Canvas
MODEL_ID = "amazon.nova-canvas-v1:0"

with col1:
    st.subheader("Configuration")
    st.info(f"Currently using model: `{MODEL_ID}`")

    task_type = st.selectbox(
        "Choose a task",
        ("Text-to-Image", "Inpainting (Edit Image)"),
        key="task_type"
    )

    prompt_text = st.text_area("Prompt", height=100, placeholder="e.g., A happy person smiling")
    negative_prompt_text = st.text_area("Negative Prompt (what to exclude)", height=100)

    uploaded_file = None
    if task_type == "Inpainting (Edit Image)":
        uploaded_file = st.file_uploader("Upload an image", type=["png", "jpg", "jpeg"])

    drawing_mode = "rect"
    if task_type == "Inpainting (Edit Image)":
        st.subheader("Masking Controls")
        drawing_mode = st.selectbox(
            "Canvas Mode",
            ("rect", "transform"),
            index=0,
            help="Use 'rect' to draw. Use 'transform' to move/resize."
        )

    st.subheader("Generation Parameters")

    if st.button("Apply Recommended Setup"):
        st.session_state.cfg_scale = 8.0
        st.session_state.seed = 42
    
    cfg_scale = st.slider("CFG Scale", 1.0, 10.0, st.session_state.get('cfg_scale', 8.0), 0.1)
    seed = st.number_input("Seed", value=st.session_state.get('seed', 0))

with col2:
    st.subheader("Canvas / Result")
    
    canvas_result = None
    bg_image = None
    if task_type == "Inpainting (Edit Image)" and uploaded_file:
        st.info("Draw a rectangle over the area you want to change. The drawn (black) area will be modified.")
        original_image = Image.open(uploaded_file)

        max_size = 800
        if original_image.width > max_size or original_image.height > max_size:
            original_image.thumbnail((max_size, max_size))
        
        bg_image = original_image
        
        canvas_result = st_canvas(
            fill_color="rgba(0, 0, 0, 0.3)", # Drawn area will be black (0) with some transparency for visibility
            stroke_width=2,
            stroke_color="rgba(0, 0, 0, 1.0)", # Black stroke
            background_image=bg_image,
            update_streamlit=True,
            height=bg_image.height,
            width=bg_image.width,
            drawing_mode=drawing_mode,
            key="canvas",
        )

    if st.button("Generate Image", use_container_width=True, type="primary"):
        if task_type == "Text-to-Image" and not prompt_text:
            st.warning("Please enter a prompt.")
        elif task_type == "Inpainting (Edit Image)" and not uploaded_file:
            st.warning("Please upload an image for this task.")
        elif task_type == "Inpainting (Edit Image)" and (canvas_result is None or canvas_result.json_data is None or not canvas_result.json_data['objects']):
             st.warning("Please draw a rectangle on the image to define the mask.")
        else:
            with st.spinner(f"Generating image with {MODEL_ID}..."):
                try:
                    body = {}

                    if task_type == "Text-to-Image":
                        body = {
                            "taskType": "TEXT_IMAGE",
                            "textToImageParams": {"text": prompt_text},
                            "imageGenerationConfig": {
                                "numberOfImages": 1, "quality": "standard", "cfgScale": cfg_scale, "seed": seed,
                                "height": 512, "width": 512
                            }
                        }
                        if negative_prompt_text:
                            body["textToImageParams"]["negativeText"] = negative_prompt_text
                    
                    elif task_type == "Inpainting (Edit Image)":
                        # CRITICAL FIX: Mask generation logic inverted as per Nova Canvas documentation
                        
                        image_bytes_io = io.BytesIO()
                        bg_image.save(image_bytes_io, format="PNG")
                        encoded_image = base64.b64encode(image_bytes_io.getvalue()).decode('utf-8')

                        # Initialize mask as WHITE (255), then draw BLACK (0) over the drawn area
                        mask = Image.new("L", (bg_image.width, bg_image.height), 255) # Initialize with WHITE
                        draw = ImageDraw.Draw(mask)
                        
                        if canvas_result.json_data and "objects" in canvas_result.json_data:
                            for obj in canvas_result.json_data["objects"]:
                                if obj['type'] == 'rect':
                                    left, top, width, height = obj["left"], obj["top"], obj["width"], obj["height"]
                                    draw.rectangle([left, top, left + width, top + height], fill=0) # Fill with BLACK

                        mask_bytes_io = io.BytesIO()
                        mask.save(mask_bytes_io, format="PNG")
                        encoded_mask = base64.b64encode(mask_bytes_io.getvalue()).decode('utf-8')

                        body = {
                            "taskType": "INPAINTING",
                            "inPaintingParams": {
                                "text": prompt_text,
                                "image": encoded_image,
                                "maskImage": encoded_mask
                            },
                           "imageGenerationConfig": {
                                "numberOfImages": 1, "quality": "standard", "cfgScale": cfg_scale, "seed": seed
                            }
                        }
                        if negative_prompt_text:
                            body["inPaintingParams"]["negativeText"] = negative_prompt_text
                    
                    response = bedrock_runtime.invoke_model(
                        body=json.dumps(body), modelId=MODEL_ID,
                        accept="application/json", contentType="application/json"
                    )

                    response_body = json.loads(response.get("body").read())
                    base64_image = response_body["images"][0]
                    
                    st.image(
                        base64.b64decode(base64_image), 
                        caption="Generated Image", 
                        use_column_width='auto'
                    )

                except Exception as e:
                    st.error(f"An error occurred: {e}")
