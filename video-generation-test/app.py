import streamlit as st
import boto3
import os
import time
import json
import random

# Set up AWS credentials
# It's recommended to use IAM roles or environment variables for credentials in production
# For simplicity, we'll use environment variables here
os.environ['AWS_ACCESS_KEY_ID'] = st.secrets["AWS_ACCESS_KEY_ID"]
os.environ['AWS_SECRET_ACCESS_KEY'] = st.secrets["AWS_SECRET_ACCESS_KEY"]
os.environ['AWS_REGION_NAME'] = st.secrets["AWS_REGION_NAME"]

# Create a Bedrock client
bedrock = boto3.client(
    service_name='bedrock-runtime',
    region_name=os.environ['AWS_REGION_NAME'],
    aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
    aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY']
)

# Create an S3 client
s3 = boto3.client(
    service_name='s3',
    region_name=os.environ['AWS_REGION_NAME'],
    aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
    aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY']
)

st.title("🎬 Bedrock Video Generation")

prompt = st.text_input("Enter a prompt for the video:")
s3_bucket = st.text_input("Enter the S3 bucket name for the output video:")

if st.button("Generate Video"):
    if prompt and s3_bucket:
        with st.spinner("Generating video... This may take a few minutes."):
            try:
                # Create a unique job name
                job_name = f"video-generation-{int(time.time())}"
                
                # Ensure the bucket name is properly formatted
                # Remove 's3://' prefix if user included it
                bucket_name = s3_bucket.replace("s3://", "").strip("/")
                
                # Construct the S3 URI - must point to a directory (with trailing slash)
                s3_output_uri = f"s3://{bucket_name}/"

                # Set up the request body with required videoGenerationConfig
                seed = random.randint(0, 2147483646)
                
                model_input = {
                    "taskType": "TEXT_VIDEO",
                    "textToVideoParams": {
                        "text": prompt
                    },
                    "videoGenerationConfig": {
                        "fps": 24,
                        "durationSeconds": 6,
                        "dimension": "1280x720",
                        "seed": seed
                    }
                }

                # Invoke the model asynchronously
                response = bedrock.start_async_invoke(
                    modelId='amazon.nova-reel-v1:1',
                    modelInput=model_input,
                    outputDataConfig={
                        's3OutputDataConfig': {
                            's3Uri': s3_output_uri
                        }
                    }
                )

                # Get the invocation ARN
                invocation_arn = response.get('invocationArn')

                if invocation_arn:
                    st.write(f"Video generation job started with ARN: {invocation_arn}")

                    # Poll for the job status
                    while True:
                        job_status_response = bedrock.get_async_invoke(invocationArn=invocation_arn)
                        status = job_status_response['status']

                        if status == 'Completed':
                            output_location = job_status_response['outputDataConfig']['s3OutputDataConfig']['s3Uri']
                            st.success("Video generated successfully!")
                            st.write(f"Output video is available at: {output_location}")

                            # To display the video, we need to find the video file in the output location
                            # and generate a presigned URL.
                            try:
                                # The output from Bedrock is in the root of the specified S3 URI
                                # List objects to find the generated video file
                                objects = s3.list_objects_v2(Bucket=bucket_name, Prefix="")
                                video_key = None
                                for obj in objects.get('Contents', []):
                                    if obj['Key'].endswith('.mp4'):
                                        video_key = obj['Key']
                                        break

                                if video_key:
                                    presigned_url = s3.generate_presigned_url('get_object',
                                                                            Params={'Bucket': bucket_name,
                                                                                    'Key': video_key},
                                                                            ExpiresIn=3600)
                                    st.video(presigned_url)
                                else:
                                    st.warning("Could not find the generated video file in the output location.")

                            except Exception as e:
                                st.error(f"Error generating presigned URL: {e}")

                            break
                        elif status == 'Failed':
                            st.error(f"Video generation failed: {job_status_response.get('failureMessage', 'No failure message')}")
                            break
                        elif status in ['InProgress', 'Submitted']:
                            st.write("Job is still in progress...")
                            time.sleep(30)  # Wait for 30 seconds before checking again
                        else:
                            st.warning(f"Unknown job status: {status}")
                            break
                else:
                    st.error("Failed to start video generation job.")

            except Exception as e:
                st.error(f"An error occurred: {e}")
    else:
        st.warning("Please enter a prompt and an S3 bucket name.")
