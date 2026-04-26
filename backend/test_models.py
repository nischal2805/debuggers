"""
Test Claude Haiku via Bedrock - confirm it works properly for our use case.
"""
import os
import json
import boto3
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

client = boto3.client(
    "bedrock-runtime",
    region_name=os.environ.get("AWS_REGION", "us-east-1"),
    aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
)

HAIKU_MODEL = "anthropic.claude-3-5-haiku-20241022-v1:0"
NOVA_MODEL = "amazon.nova-micro-v1:0"

def test_model(model_id, label):
    print(f"\n{'='*60}")
    print(f"Testing: {label} ({model_id})")
    print('='*60)
    
    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 300,
        "temperature": 0.2,
        "system": "You are a DSA tutor. Return ONLY valid JSON. No markdown fences.",
        "messages": [{"role": "user", "content": 'Return: {"type": "question", "content": "What is a two-sum problem?", "difficulty_level": 3}'}],
    })
    
    try:
        resp = client.invoke_model(
            modelId=model_id,
            body=body,
            contentType="application/json",
            accept="application/json",
        )
        result = json.loads(resp["body"].read())
        parts = [b["text"] for b in result.get("content", []) if b.get("type") == "text"]
        raw = "".join(parts)
        print(f"Raw text: {repr(raw[:300])}")
        parsed = json.loads(raw.strip())
        print(f"Parse SUCCESS: {list(parsed.keys())}")
    except Exception as e:
        print(f"FAILED: {e}")

def test_converse(model_id, label):
    print(f"\n{'='*60}")
    print(f"Converse Test: {label} ({model_id})")
    print('='*60)
    
    try:
        resp = client.converse(
            modelId=model_id,
            system=[{"text": "You are a DSA tutor. Return ONLY valid JSON. No markdown fences."}],
            messages=[{"role": "user", "content": [{"text": 'Return: {"type": "question", "content": "What is a two-sum problem?", "difficulty_level": 3}'}]}],
            inferenceConfig={"maxTokens": 300, "temperature": 0.2},
        )
        content = resp["output"]["message"]["content"]
        print(f"Blocks: {[list(b.keys()) for b in content]}")
        text_parts = [b["text"] for b in content if "text" in b]
        raw = "".join(text_parts).strip()
        print(f"Raw: {repr(raw[:300])}")
        if raw:
            parsed = json.loads(raw)
            print(f"Parse SUCCESS: {list(parsed.keys())}")
        else:
            print("EMPTY TEXT - all in reasoning!")
    except Exception as e:
        print(f"FAILED: {e}")

# Test Claude Haiku (invoke_model API - Anthropic format)
test_model(HAIKU_MODEL, "Claude 3.5 Haiku")

# Test Nova Micro (Converse API - Amazon format)
test_converse(NOVA_MODEL, "Amazon Nova Micro")
