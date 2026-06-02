"""
==============================================================================
 LLM-Powered Intrusion Detection System (IDS)
 ADRS: Autonomous Defensive Response System
==============================================================================
"""

import time
import uuid
import logging
import subprocess
from dataclasses import dataclass
from typing import List, Dict, Any, Optional

from modules.correlation import AttackChain

logger = logging.getLogger("ids.response")

@dataclass
class ResponseActionRecord:
    action_id: str
    chain_id: str
    action_type: str
    target_ip: str
    policy_name: str
    executed_at: float
    simulated: bool
    analyst_approved: bool = False
    rollback_at: float = 0.0
    rolled_back: bool = False
    outcome: str = "success"
    
    def to_db_dict(self):
        return {
            "action_id": self.action_id,
            "chain_id": self.chain_id,
            "action_type": self.action_type,
            "target_ip": self.target_ip,
            "policy_name": self.policy_name,
            "executed_at": self.executed_at,
            "simulated": self.simulated,
            "analyst_approved": self.analyst_approved,
            "rollback_at": self.rollback_at,
            "rolled_back": self.rolled_back,
            "outcome": self.outcome
        }


class ResponsePolicy:
    def __init__(self, name: str, min_score: float, action_type: str, simulated: bool = True):
        self.name = name
        self.min_score = min_score
        self.action_type = action_type
        self.simulated = simulated


# Basic internal whitelist
WHITELIST_IPS = {"127.0.0.1", "10.0.0.1", "192.168.1.1"}

def is_internal_ip(ip: str) -> bool:
    return ip.startswith("10.") or ip.startswith("192.168.") or ip.startswith("172.")

class ADRSEngine:
    """
    Autonomous Defensive Response System.
    Evaluates AttackChains and applies firewall rules (via PowerShell on Windows)
    if the false positive risk is low and the chain score is high.
    """
    def __init__(self, db_manager):
        self.db_manager = db_manager
        
        # Define policies
        self.policies = [
            ResponsePolicy(
                name="Block Active Attacker",
                min_score=60.0,
                action_type="IP_BLOCK",
                simulated=False  # Set to False to actually execute PowerShell
            )
        ]
        
        # Track active blocks to avoid duplicates
        self.active_blocks = set()

    def _compute_fp_risk(self, chain: AttackChain) -> float:
        """Compute the False Positive risk (0.0 to 1.0) before acting."""
        risk = 0.0
        
        # Penalize if IP is internal
        if is_internal_ip(chain.actor_id):
            risk += 0.4
            
        # Penalize if it's on the whitelist
        if chain.actor_id in WHITELIST_IPS:
            risk += 1.0 # Hard block
            
        # Penalize if chain length is too short
        if len(chain.events) < 3:
            risk += 0.3
            
        # Penalize if we don't have high AI confidence yet (if applicable)
        if chain.ai_confidence < 0.7 and chain.chain_score < 80.0:
            risk += 0.2
            
        return min(risk, 1.0)

    async def evaluate_chain(self, chain: AttackChain):
        """Evaluate a chain against policies and execute if appropriate."""
        if chain.actor_id in self.active_blocks:
            return  # Already blocked

        for policy in self.policies:
            if chain.chain_score >= policy.min_score:
                fp_risk = self._compute_fp_risk(chain)
                
                # Safety Gate
                if fp_risk < 0.5:
                    await self._execute_action(chain, policy)
                    break
                else:
                    logger.warning(
                        f"ADRS: Policy '{policy.name}' triggered for {chain.actor_id}, "
                        f"but FP risk is too high ({fp_risk:.2f}). Aborting."
                    )

    async def _execute_action(self, chain: AttackChain, policy: ResponsePolicy):
        target_ip = chain.actor_id
        action_id = f"act_{uuid.uuid4().hex[:8]}"
        outcome = "success"
        
        logger.info(f"ADRS: Executing {policy.action_type} on {target_ip} (Simulated={policy.simulated})")
        
        if not policy.simulated:
            if policy.action_type == "IP_BLOCK":
                # Execute Windows PowerShell command to add a firewall rule
                rule_name = f"ADRS_Block_{target_ip.replace('.', '_')}"
                cmd = (
                    f"New-NetFirewallRule -DisplayName '{rule_name}' "
                    f"-Direction Inbound -Action Block -RemoteAddress {target_ip}"
                )
                try:
                    result = subprocess.run(["powershell", "-Command", cmd], capture_output=True, text=True)
                    if result.returncode != 0:
                        outcome = f"failed: {result.stderr.strip()}"
                        logger.error(f"ADRS PowerShell failed: {outcome}")
                    else:
                        self.active_blocks.add(target_ip)
                except Exception as e:
                    outcome = f"error: {str(e)}"
                    logger.error(f"ADRS Exception: {outcome}")
        else:
            self.active_blocks.add(target_ip)
            
        # Log to DB
        record = ResponseActionRecord(
            action_id=action_id,
            chain_id=chain.chain_id,
            action_type=policy.action_type,
            target_ip=target_ip,
            policy_name=policy.name,
            executed_at=time.time(),
            simulated=policy.simulated,
            outcome=outcome
        )
        
        try:
            await self.db_manager.insert_response_action(record.to_db_dict())
        except Exception as e:
            logger.error(f"ADRS failed to save DB record: {e}")
