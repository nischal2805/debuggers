"""
Test Nova models and cross-region Claude inference profiles.
"""
import os
import json
import re
import boto3
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

client = boto3.client(
    "bedrock-runtime",
    region_name=os.environ.get("AWS_REGION", "us-east-1"),
    aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
)

AGENT_PROMPT = """\
You are a DSA tutor. Learner is at knowledge level 0.5 for "arrays" topic.
Ask a medium-difficulty conceptual question about the Two Sum pattern.

Return ONLY this JSON (no markdown fences, no explanation):
{
  "type": "question",
  "content": "<your question to the learner>",
  "expected_answer_type": "text",
  "difficulty_level": 3,
  "pattern_name": "hash_map",
  "next_action": "wait_for_answer"
}
"""

MODELS = [
    ("amazon.nova-micro-v1:0", "Nova Micro"),
    ("amazon.nova-lite-v1:0", "Nova Lite"),
    ("us.anthropic.claude-3-5-haiku-20241022-v1:0", "Claude 3.5 Haiku (us cross-region)"),
    ("us.anthropic.claude-3-haiku-20240307-v1:0", "Claude 3 Haiku (us cross-region)"),
]

def test_converse(model_id, label):
    print(f"\n{'='*60}")
    print(f"{label}")
    print(f"Model: {model_id}")
    
    try:
        resp = client.converse(
            modelId=model_id,
            system=[{"text": "Return ONLY valid JSON. No markdown fences."}],
            messages=[{"role": "user", "content": [{"text": AGENT_PROMPT}]}],
            inferenceConfig={"maxTokens": 400, "temperature": 0.2},
        )
        content = resp["output"]["message"]["content"]
        text_parts = [b["text"] for b in content if "text" in b]
        raw = "".join(text_parts).strip()
        
        cleaned = re.sub(r'^```[a-zA-Z]*\n?', '', raw)
        cleaned = re.sub(r'\n?```\s*$', '', cleaned).strip()
        
        parsed = json.loads(cleaned)
        print(f"SUCCESS - keys: {list(parsed.keys())}")
        print(f"  content preview: {repr(parsed.get('content', '')[:80])}")
    except json.JSONDecodeError as e:
        print(f"JSON PARSE FAILED: {e}")
        print(f"  raw: {repr(raw[:200])}")
    except Exception as e:
        print(f"API FAILED: {type(e).__name__}: {str(e)[:150]}")

for model_id, label in MODELS:
    test_converse(model_id, label)

print("\n\nDONE")
