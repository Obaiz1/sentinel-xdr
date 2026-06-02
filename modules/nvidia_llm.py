"""
==============================================================================
 SENTINEL XDR / AI-IDS — NVIDIA NIM LLM Client (OpenAI-compatible)
==============================================================================
 Thin async wrapper around NVIDIA's OpenAI-compatible chat completions API
 (https://integrate.api.nvidia.com/v1). Uses httpx (already a transitive
 dependency) so no extra packages are required.

 SECURITY: the API key is read from settings (which loads it from the
 backend .env). It is NEVER returned to or exposed in the frontend.
==============================================================================
"""

import json
import logging
from typing import AsyncGenerator, Dict, List, Optional

import httpx

from config import settings

logger = logging.getLogger("ids.nvidia")


def nvidia_available() -> bool:
    """True if an NVIDIA NIM key is configured."""
    return bool(settings.nvidia_api_key)


def _headers() -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.nvidia_api_key}",
        "Content-Type": "application/json",
    }


def _build_messages(
    system_instruction: str,
    history: List[Dict[str, str]],
    message: str,
) -> List[Dict[str, str]]:
    msgs: List[Dict[str, str]] = [{"role": "system", "content": system_instruction}]
    for m in history or []:
        role = "assistant" if m.get("role") == "assistant" else "user"
        msgs.append({"role": role, "content": m.get("content", "")})
    msgs.append({"role": "user", "content": message})
    return msgs


async def stream_chat(
    message: str,
    history: List[Dict[str, str]],
    system_instruction: str,
    temperature: float = 0.3,
) -> AsyncGenerator[str, None]:
    """Stream a chat completion from NVIDIA NIM as plain text chunks."""
    if not nvidia_available():
        raise RuntimeError("NVIDIA_API_KEY not configured")

    payload = {
        "model": settings.nvidia_model,
        "messages": _build_messages(system_instruction, history, message),
        "temperature": temperature,
        "stream": True,
    }

    url = f"{settings.nvidia_base_url}/chat/completions"
    timeout = httpx.Timeout(60.0, connect=10.0)

    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream("POST", url, headers=_headers(), json=payload) as resp:
            if resp.status_code != 200:
                detail = (await resp.aread()).decode("utf-8", "ignore")
                raise RuntimeError(f"NVIDIA HTTP {resp.status_code}: {detail[:300]}")
            async for line in resp.aiter_lines():
                if not line or not line.startswith("data:"):
                    continue
                data = line[len("data:"):].strip()
                if data == "[DONE]":
                    break
                try:
                    obj = json.loads(data)
                    delta = obj["choices"][0]["delta"].get("content")
                    if delta:
                        yield delta
                except (json.JSONDecodeError, KeyError, IndexError):
                    continue


async def complete(
    message: str,
    system_instruction: str = "",
    temperature: float = 0.3,
    max_tokens: Optional[int] = None,
) -> str:
    """Non-streaming completion — returns the full text."""
    if not nvidia_available():
        raise RuntimeError("NVIDIA_API_KEY not configured")

    payload: Dict = {
        "model": settings.nvidia_model,
        "messages": _build_messages(system_instruction, [], message),
        "temperature": temperature,
        "stream": False,
    }
    if max_tokens:
        payload["max_tokens"] = max_tokens

    url = f"{settings.nvidia_base_url}/chat/completions"
    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=10.0)) as client:
        resp = await client.post(url, headers=_headers(), json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]
