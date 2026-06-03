"""
==============================================================================
 LLM-Powered Intrusion Detection System (IDS)
 ARIA: AI Security Copilot / SOC Agent
==============================================================================
"""

import json
import asyncio
import logging
from typing import AsyncGenerator, List, Dict, Any, Optional

from google import genai
from google.genai import types

from config import settings
from modules import nvidia_llm

logger = logging.getLogger("ids.aria")

_GEMINI_EXHAUSTED = False

ARIA_SYSTEM_PROMPT = """You are ARIA, an AI security copilot inside the SENTINEL XDR dashboard. You help a human operator understand live threats, packets, alerts, MACE attack chains and recommended actions.

You have access to (provided below): live network alerts/metadata, active MACE attack chains, and a MITRE ATT&CK knowledge base.

RESPONSE STYLE — follow strictly:
- Write in PLAIN TEXT only. Do NOT use markdown. No asterisks for bold (no **text**). No asterisk or dash bullet symbols. No markdown links — write the MITRE id and name in plain text like "T1059 Command and Scripting Interpreter".
- Keep answers SHORT by default: a one-line summary, then a few short labelled lines, then a one-line recommendation. Aim for under ~120 words unless the user explicitly asks for a detailed report.
- When the user's message ends with "(Give a detailed report ...)", you may write a longer, structured but still plain-text answer.
- When the user's message ends with "(Answer briefly ...)", be very concise.
- Use the live data below. Reference real numbers (alerts, threat levels, IPs, chain phases) when relevant. If a fact is not in the context, say "I don't have that data yet."
- For recommended actions, state them plainly (e.g. "Recommended: block 198.51.100.88 and monitor repeat traffic.").

Example of the desired tone:
Hello, I analyzed the current dashboard.
Captured packets: 383
Critical threats: 49
Main risk: possible SYN flood from 198.51.100.23 (T1499 Endpoint Denial of Service).
Recommended: block the source IP, watch for repeat traffic, and generate a forensic report.
"""


class ARIAAgent:
    """
    Conversational SOC Copilot.
    Takes user queries, enriches them with DB/RAG context, and streams
    LLM responses back to the dashboard.
    """

    def __init__(self, db_manager, rag_engine=None):
        self.db_manager = db_manager
        self.rag_engine = rag_engine

        # Gemini client is optional now (NVIDIA is primary). Only build it
        # if a Gemini key is actually configured, so a missing key never crashes.
        self.client = None
        if settings.gemini_api_key:
            try:
                self.client = genai.Client(api_key=settings.gemini_api_key)
            except Exception as e:
                logger.warning(f"ARIA: Gemini client init failed: {e}")
        self.model_name = settings.gemini_model

    async def _gather_context(self, query: str) -> str:
        """Gather relevant context from SQLite and ChromaDB."""
        context_parts = []
        
        # 1. Get recent DB alerts
        try:
            recent_alerts = await self.db_manager.get_recent_alerts(limit=5)
            if recent_alerts:
                alert_str = json.dumps([{
                    "id": a["id"], 
                    "ip": a["src_ip"], 
                    "threat": a["threat_level"],
                    "attack": a["attack_vector"]
                } for a in recent_alerts], indent=2)
                context_parts.append(f"--- RECENT ALERTS ---\n{alert_str}")
        except Exception as e:
            logger.warning(f"ARIA DB context error: {e}")

        # 2. Get active chains from MACE
        try:
            active_chains = await self.db_manager.get_active_chains()
            if active_chains:
                chain_str = json.dumps([{
                    "chain_id": c["chain_id"],
                    "actor_ip": c["actor_id"],
                    "score": c["chain_score"],
                    "phases": c["kill_chain_phases"]
                } for c in active_chains], indent=2)
                context_parts.append(f"--- ACTIVE ATTACK CHAINS (MACE) ---\n{chain_str}")
        except Exception as e:
            logger.warning(f"ARIA Chain context error: {e}")

        # 3. Query RAG Engine (if enabled)
        if self.rag_engine and settings.rag_enabled:
            try:
                # We do a generic search using the user's query
                rag_context = self.rag_engine.query_context([query])
                if rag_context:
                    context_parts.append(f"--- MITRE ATT&CK KNOWLEDGE BASE ---\n{rag_context}")
            except Exception as e:
                logger.warning(f"ARIA RAG error: {e}")

        return "\n\n".join(context_parts)

    def _provider_order(self) -> List[str]:
        """Build the ordered list of providers to try, primary first.

        Honours settings.llm_provider, then appends the remaining configured
        providers as fallbacks. Only providers with a key are included.
        """
        available = []
        if nvidia_llm.nvidia_available():
            available.append("nvidia")
        if settings.gemini_api_key and self.client is not None and not _GEMINI_EXHAUSTED:
            available.append("gemini")
        if settings.groq_api_key:
            available.append("groq")

        primary = (settings.llm_provider or "nvidia").lower()
        ordered = [primary] if primary in available else []
        ordered += [p for p in available if p not in ordered]
        return ordered

    async def stream_chat(self, message: str, history: List[Dict[str, str]] = None) -> AsyncGenerator[str, None]:
        """Stream an analysis response from ARIA across available providers."""
        history = history or []
        global _GEMINI_EXHAUSTED

        # 1. Build enriched context (best-effort; never fatal)
        try:
            system_context = await self._gather_context(message)
        except Exception as e:
            logger.warning(f"ARIA context gathering failed: {e}")
            system_context = ""
        full_system_instruction = ARIA_SYSTEM_PROMPT + "\n\n" + system_context

        providers = self._provider_order()
        if not providers:
            yield (
                "**ARIA is not configured.** No LLM provider key was found on the backend. "
                "Set `NVIDIA_API_KEY` (recommended) or `GEMINI_API_KEY` / `GROQ_API_KEY` "
                "in the backend `.env`, then restart the API."
            )
            return

        last_error: Optional[str] = None
        for provider in providers:
            try:
                produced = False
                if provider == "nvidia":
                    async for chunk in nvidia_llm.stream_chat(message, history, full_system_instruction):
                        produced = True
                        yield chunk
                elif provider == "gemini":
                    async for chunk in self._stream_gemini(message, history, full_system_instruction):
                        produced = True
                        yield chunk
                elif provider == "groq":
                    async for chunk in self._stream_groq(message, history, full_system_instruction):
                        produced = True
                        yield chunk
                # Success (even an empty stream counts as a clean response)
                return
            except Exception as e:
                last_error = str(e)
                if provider == "gemini" and ("429" in last_error or "RESOURCE_EXHAUSTED" in last_error):
                    _GEMINI_EXHAUSTED = True
                logger.warning(f"ARIA provider '{provider}' failed, trying next: {last_error}")
                # If this provider already streamed partial output, stop to avoid
                # mixing two answers — surface a soft note instead.
                if produced:
                    yield "\n\n_(response interrupted — provider error)_"
                    return
                continue

        logger.error(f"ARIA: all providers failed. Last error: {last_error}")
        yield (
            "**System Error:** All AI providers are currently unavailable. "
            f"Last error: {last_error}. Please verify the backend LLM keys and try again."
        )

    async def _stream_gemini(self, message: str, history: List[Dict[str, str]], full_system_instruction: str) -> AsyncGenerator[str, None]:
        if self.client is None:
            raise RuntimeError("Gemini client not configured")
        contents = []
        for msg in history:
            role = "user" if msg["role"] == "user" else "model"
            contents.append(
                types.Content(role=role, parts=[types.Part.from_text(text=msg["content"])])
            )
        contents.append(
            types.Content(role="user", parts=[types.Part.from_text(text=message)])
        )
        config = types.GenerateContentConfig(
            system_instruction=full_system_instruction,
            temperature=0.3,
        )
        response = await self.client.aio.models.generate_content_stream(
            model=self.model_name,
            contents=contents,
            config=config,
        )
        async for chunk in response:
            if chunk.text:
                yield chunk.text
            
    async def _stream_groq(self, message: str, history: List[Dict[str, str]], full_system_instruction: str) -> AsyncGenerator[str, None]:
        from groq import AsyncGroq
        groq_client = AsyncGroq(api_key=settings.groq_api_key)
        
        groq_messages = [{"role": "system", "content": full_system_instruction}]
        for msg in history:
            groq_messages.append({"role": msg["role"], "content": msg["content"]})
        groq_messages.append({"role": "user", "content": message})
        
        completion = await groq_client.chat.completions.create(
            model=settings.groq_model if hasattr(settings, 'groq_model') else "llama3-8b-8192",
            messages=groq_messages,
            temperature=0.3,
            stream=True
        )
        async for chunk in completion:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
