"""
==============================================================================
 LLM-Powered Intrusion Detection System (IDS)
 CHRONICLE: AI Incident Storytelling Engine
==============================================================================
"""

import time
import uuid
import json
import logging
from typing import Dict, Any, Optional

from google import genai
from google.genai import types

from config import settings
from modules import nvidia_llm

logger = logging.getLogger("ids.chronicle")

CHRONICLE_PROMPT = """You are an expert Security Operations Center (SOC) manager. 
Your task is to generate a C-Suite executive incident report based on the provided attack chain data.

The report should have two sections:
1. **Executive Summary**: A high-level, business-risk focused narrative (2-3 paragraphs) explaining what happened, the adversary's intent, and the impact.
2. **Technical Timeline**: A brief timeline of the MITRE ATT&CK techniques used.

Respond with valid JSON containing two keys: "executive_summary" and "technical_details".
Do not include any markdown fences or extra text outside the JSON object.
"""

class ChronicleEngine:
    """
    Translates raw MACE attack chains into readable executive narratives using Gemini.
    """
    def __init__(self, db_manager):
        self.db_manager = db_manager
        # Gemini optional; NVIDIA NIM is primary. Missing key must not crash boot.
        self.client = None
        if settings.gemini_api_key:
            try:
                self.client = genai.Client(api_key=settings.gemini_api_key)
            except Exception as e:
                logger.warning(f"CHRONICLE: Gemini client init failed: {e}")
        self.model_name = settings.gemini_model

    async def generate_report(self, chain_id: str) -> Optional[Dict[str, Any]]:
        """Generate and save a report for a specific chain."""
        # 1. Check if we already have a report
        existing = await self.db_manager.get_incident_report(chain_id)
        if existing:
            return existing
            
        # 2. Fetch the chain
        chain = await self.db_manager.get_chain_by_id(chain_id)
        if not chain:
            raise ValueError(f"Chain {chain_id} not found.")
            
        # 3. Build context
        context = f"""
        ATTACK CHAIN ID: {chain.get('chain_id')}
        ACTOR IP: {chain.get('actor_id')}
        CHAIN SCORE: {chain.get('chain_score')}
        TACTICS/PHASES: {chain.get('kill_chain_phases')}
        MITRE TECHNIQUES: {chain.get('mitre_techniques')}
        INTENT (AI GUESSED): {chain.get('attacker_intent')}
        FIRST SEEN: {chain.get('first_seen')}
        """
        
        # 4. Generate with LLM (NVIDIA NIM primary, Gemini fallback)
        try:
            logger.info(f"CHRONICLE: Generating narrative for {chain_id}...")
            raw_text: Optional[str] = None

            if nvidia_llm.nvidia_available():
                raw_text = await nvidia_llm.complete(
                    message=context,
                    system_instruction=CHRONICLE_PROMPT,
                    temperature=0.3,
                    max_tokens=1024,
                )
            elif self.client is not None:
                config = types.GenerateContentConfig(
                    system_instruction=CHRONICLE_PROMPT,
                    temperature=0.3,
                    response_mime_type="application/json",
                )
                import asyncio
                response = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: self.client.models.generate_content(
                        model=self.model_name,
                        contents=context,
                        config=config,
                    ),
                )
                raw_text = response.text
            else:
                raise ValueError("No LLM provider configured (set NVIDIA_API_KEY or GEMINI_API_KEY)")

            if not raw_text:
                raise ValueError("Empty response from LLM")

            # Strip accidental markdown fences before parsing.
            cleaned = raw_text.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("```", 2)[1] if "```" in cleaned[3:] else cleaned
                cleaned = cleaned.lstrip("json").strip().strip("`").strip()
            report_data = json.loads(cleaned)
            
            # 5. Save report
            record = {
                "report_id": f"rep_{uuid.uuid4().hex[:8]}",
                "chain_id": chain_id,
                "actor_id": chain.get("actor_id", "unknown"),
                "executive_summary": report_data.get("executive_summary", "Summary unavailable."),
                "technical_details": str(report_data.get("technical_details", "")),
                "generated_at": time.time()
            }
            
            await self.db_manager.insert_incident_report(record)
            logger.info(f"CHRONICLE: Successfully generated report for {chain_id}")
            return record
            
        except Exception as e:
            logger.error(f"CHRONICLE: Failed to generate report: {e}", exc_info=True)
            return None
