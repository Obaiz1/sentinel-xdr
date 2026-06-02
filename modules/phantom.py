"""
==============================================================================
 LLM-Powered Intrusion Detection System (IDS)
 PHANTOM: Attacker Memory & Behavioral Profiling
==============================================================================
"""

import json
import logging
from typing import Dict, Any, Optional

from modules.correlation import AttackChain

logger = logging.getLogger("ids.phantom")

class PhantomEngine:
    """
    Attacker Memory & Behavioral Profiling.
    Tracks adversaries across multiple attack chains, builds long-term behavioral 
    profiles, and persists them to the database.
    """
    def __init__(self, db_manager):
        self.db_manager = db_manager

    async def process_chain_conclusion(self, chain: AttackChain):
        """
        Called when a MACE chain is concluded.
        Updates the long-term profile of the actor.
        """
        actor_id = chain.actor_id
        if not actor_id:
            return
            
        try:
            # 1. Fetch existing profile
            profile = await self.db_manager.get_attacker_profile(actor_id)
            
            if not profile:
                profile = {
                    "actor_id": actor_id,
                    "first_seen": chain.first_seen,
                    "last_seen": chain.last_seen,
                    "total_chains": 0,
                    "known_tactics": "[]",
                    "risk_score": 0.0,
                    "confidence_level": 0.0,
                    "profile_notes": "Initial profile created."
                }
                
            # 2. Update profile data
            profile["last_seen"] = max(profile["last_seen"], chain.last_seen)
            profile["total_chains"] += 1
            
            # Merge tactics
            try:
                known_tactics = set(json.loads(profile["known_tactics"]))
            except:
                known_tactics = set()
                
            for t in chain.kill_chain_phases:
                known_tactics.add(t)
            profile["known_tactics"] = json.dumps(list(known_tactics))
            
            # Update risk score (simple cumulative moving average or penalty)
            # If the new chain is highly malicious, bump the overall risk score
            bump = (chain.chain_score / 100.0) * 20.0
            profile["risk_score"] = min(100.0, profile["risk_score"] + bump)
            
            # Confidence grows with more chains
            profile["confidence_level"] = min(1.0, profile["confidence_level"] + 0.1)
            
            # 3. Save profile back to DB
            await self.db_manager.upsert_attacker_profile(profile)
            logger.info(f"PHANTOM: Updated profile for {actor_id}. Risk={profile['risk_score']:.1f}, Chains={profile['total_chains']}")
            
        except Exception as e:
            logger.error(f"PHANTOM failed to process profile for {actor_id}: {e}", exc_info=True)
