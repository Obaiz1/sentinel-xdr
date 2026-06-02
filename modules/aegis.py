"""
==============================================================================
 LLM-Powered Intrusion Detection System (IDS)
 AEGIS: Adversarial AI Evasion Detection
==============================================================================
"""

import re
import logging
from typing import List

logger = logging.getLogger("ids.aegis")

class AegisEngine:
    """
    Scans packet payloads for attempts to evade or poison the AI.
    Specifically looks for LLM Prompt Injections in network traffic 
    (e.g., HTTP payloads containing instructions like "ignore previous").
    """
    
    def __init__(self):
        # Patterns commonly used to manipulate or bypass LLMs
        self.injection_patterns = [
            r"ignore previous instructions",
            r"ignore all prior instructions",
            r"you are now acting as",
            r"system prompt bypass",
            r"do not follow the original rules",
            r"forget your instructions",
            r"print your prompt",
            r"```json\s*\{.*\}?\s*```", # Attempting to force a fake JSON response
            r"DAN mode" # Do Anything Now
        ]
        
        self.compiled_patterns = [re.compile(p, re.IGNORECASE) for p in self.injection_patterns]

    def scan_payload(self, payload_hex: str) -> bool:
        """
        Convert hex to ascii and scan for injection attempts.
        Returns True if an evasion attempt is detected.
        """
        if not payload_hex:
            return False
            
        try:
            # Convert hex to ascii string
            payload_bytes = bytes.fromhex(payload_hex)
            payload_str = payload_bytes.decode('ascii', errors='ignore')
            
            for pattern in self.compiled_patterns:
                if pattern.search(payload_str):
                    logger.warning(f"AEGIS: Detected potential AI evasion pattern: {pattern.pattern}")
                    return True
                    
            return False
        except Exception as e:
            logger.debug(f"AEGIS payload parse error: {e}")
            return False
