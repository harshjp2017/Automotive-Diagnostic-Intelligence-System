#!/usr/bin/env python3
"""
Google GenAI SDK (Python) - Vertex AI & Gemini Smoke Test
Prerequisites:
    pip install google-genai
    gcloud auth application-default login
"""

import os
import sys
import time

def main():
    print("=" * 60)
    print("Google GenAI Python Smoke Test: Vertex AI (us-central1)")
    print("=" * 60)

    try:
        from google import genai
        from google.genai import types
    except ImportError:
        print("\n[ERROR] The 'google-genai' SDK is not installed.")
        print("Please run:")
        print("    pip install google-genai\n")
        sys.exit(1)

    # 1. Resolve Project ID & Location
    project_id = (
        sys.argv[1]
        if len(sys.argv) > 1
        else os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get("PROJECT_ID")
    )

    location = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")

    # If no project ID is provided, check for AI Studio GEMINI_API_KEY as fallback
    api_key = os.environ.get("GEMINI_API_KEY")

    if project_id and project_id != "PROJECT_ID":
        print(f"\n[Mode: Vertex AI]")
        print(f"Project ID: {project_id}")
        print(f"Location:   {location}")
        client = genai.Client(vertexai=True, project=project_id, location=location)
    elif api_key:
        print("\n[Mode: Google AI Studio (API Key)]")
        client = genai.Client(api_key=api_key)
    else:
        print("\n[Mode: Vertex AI (Default Project Lookup)]")
        # genai.Client will attempt to read ADC project
        try:
            client = genai.Client(vertexai=True, location=location)
        except Exception as e:
            print(f"[!] Please supply your Project ID as an argument or set GOOGLE_CLOUD_PROJECT:")
            print(f"    python smoke_test.py YOUR_PROJECT_ID")
            print(f"    export GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID")
            sys.exit(1)

    # 2. Run Smoke Test Call
    model_name = "gemini-3.8-flash"
    prompt = "Ping: Perform diagnostic verification of Auto Service RAG connectivity. Reply in under 30 words."

    print(f"\nSending smoke test prompt to '{model_name}'...")
    start_time = time.time()

    try:
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.2,
                system_instruction="You are an ASE Master Certified Automotive Diagnostic Assistant.",
            ),
        )
        elapsed_ms = round((time.time() - start_time) * 1000)

        print("\n[SUCCESS] Response received:")
        print("-" * 60)
        print(response.text.strip())
        print("-" * 60)
        print(f"Latency:      {elapsed_ms} ms")
        if response.usage_metadata:
            print(f"Prompt Tokens: {response.usage_metadata.prompt_token_count}")
            print(f"Output Tokens: {response.usage_metadata.candidates_token_count}")
            print(f"Total Tokens:  {response.usage_metadata.total_token_count}")
        print("\n[STATUS] Gemini API and Vertex AI connectivity verified successfully.")

    except Exception as err:
        elapsed_ms = round((time.time() - start_time) * 1000)
        print(f"\n[FAILURE] Smoke test failed ({elapsed_ms} ms):")
        print(f"Error: {err}")
        print("\nTroubleshooting checklist:")
        print("  1. Have you run 'gcloud auth application-default login'?")
        print("  2. Is Vertex AI enabled? Run: gcloud services enable aiplatform.googleapis.com")
        print("  3. Does your service account have 'roles/aiplatform.user'?")

if __name__ == "__main__":
    main()
