"""
Full end-to-end test: Nova provider with actual solve agent + hint prompts.
"""
import os, asyncio
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from services.llm_client import get_provider, parse_llm_json

async def test_agent():
    provider = get_provider()
    print(f"Provider: {provider.name}")

    # Test 1: Solve agent chat (approach phase)
    SYSTEM = "You are a DSA coaching agent. Return only valid JSON. No markdown fences, no extra text."
    PROMPT = """Problem: Two Sum (LC #1, arrays, hash_map pattern, Easy)
Statement: Given an array of integers nums and an integer target, return indices of two numbers that add up to target.
Phase: approach
History: (start of conversation)
Learner message: I'm thinking of using a nested loop approach, O(n^2). Is that okay?

Return JSON:
{
  "response": "<coaching message to learner>",
  "approach_score": 0.4,
  "approach_verdict": "suboptimal",
  "hint": "<optional hint>",
  "next_focus": "<what to think about next>"
}"""

    print("\n=== Test 1: Solve Agent (approach phase) ===")
    raw = await provider.complete_json(system=SYSTEM, prompt=PROMPT, max_tokens=500, temperature=0.3)
    print(f"Raw ({len(raw)} chars): {repr(raw[:300])}")
    parsed = parse_llm_json(raw)
    if parsed:
        print(f"PARSED OK: {list(parsed.keys())}")
        print(f"  response: {parsed.get('response', '')[:120]}")
    else:
        print("PARSE FAILED")

    # Test 2: Hint
    HINT_SYSTEM = "You are a DSA hint engine. Return only valid JSON with field 'hint' (string) and 'hint_level' (int). No markdown fences."
    HINT_PROMPT = """Problem: Two Sum (LC #1, arrays, hash_map)
Code so far: for i in range(len(nums)):
Hint number: 1, elapsed: 120000ms

Return JSON: {"hint": "...", "hint_level": 1}"""

    print("\n=== Test 2: Hint ===")
    raw2 = await provider.complete_json(system=HINT_SYSTEM, prompt=HINT_PROMPT, max_tokens=200, temperature=0.2)
    print(f"Raw ({len(raw2)} chars): {repr(raw2[:200])}")
    parsed2 = parse_llm_json(raw2)
    if parsed2:
        print(f"PARSED OK: hint={repr(parsed2.get('hint', '')[:80])}")
    else:
        print("PARSE FAILED")

    # Test 3: Evaluate
    EVAL_SYSTEM = "You are a DSA solution evaluator. Return only valid JSON. No markdown fences."
    EVAL_PROMPT = """Evaluate this Two Sum solution:
def twoSum(nums, target):
    seen = {}
    for i, n in enumerate(nums):
        if target - n in seen:
            return [seen[target-n], i]
        seen[n] = i
    return []

Tests: 4/4 passed. Time: O(n), Space: O(n).
Return JSON: {"correct": true, "approach_quality": 0.9, "feedback": "...", "mastery_signal": "improve"}"""

    print("\n=== Test 3: Evaluate ===")
    raw3 = await provider.complete_json(system=EVAL_SYSTEM, prompt=EVAL_PROMPT, max_tokens=400, temperature=0.1)
    print(f"Raw ({len(raw3)} chars): {repr(raw3[:200])}")
    parsed3 = parse_llm_json(raw3)
    if parsed3:
        print(f"PARSED OK: correct={parsed3.get('correct')}, feedback={repr(parsed3.get('feedback','')[:80])}")
    else:
        print("PARSE FAILED")

    print("\n=== ALL TESTS DONE ===")

asyncio.run(test_agent())
