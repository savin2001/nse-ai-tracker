"""Anthropic client factory."""
import os
import anthropic


def get_ai() -> anthropic.Anthropic:
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise ValueError("Missing required env var: ANTHROPIC_API_KEY")
    return anthropic.Anthropic(api_key=key)
