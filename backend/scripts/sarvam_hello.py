"""One Sarvam chat completion, to check the key works. Reads SARVAM_API_KEY from the environment.

    set -a; . ../.env; set +a; .venv/bin/python -m scripts.sarvam_hello
"""
import os

from sarvamai import SarvamAI

client = SarvamAI(api_subscription_key=os.environ["SARVAM_API_KEY"])
response = client.chat.completions(
    model="sarvam-105b",
    messages=[{"role": "user", "content": "Say hello in Tamil and English, in one short line."}],
    max_tokens=1000,
    reasoning_effort="low",  # reasoning counts against max_tokens; keep it short
)
print(response.choices[0].message.content)
