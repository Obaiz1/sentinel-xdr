"""
==============================================================================
 LLM-Powered Intrusion Detection System (IDS)
 MACE: Multi-Stage Attack Correlation Engine
==============================================================================
"""

import time
import queue
import logging
import threading
import uuid
import json
import asyncio
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional

from modules.triage import TriagedPacket, TriageFlag
from config import settings

logger = logging.getLogger("ids.correlation")

# Simple mapping of heuristic flags to MITRE Tactics
FLAG_TO_TACTIC = {
    TriageFlag.PORT_SCAN: "Reconnaissance",
    TriageFlag.PORT_SWEEP: "Reconnaissance",
    TriageFlag.SYN_FLOOD: "Impact",
    TriageFlag.ICMP_FLOOD: "Impact",
    TriageFlag.SUSPICIOUS_PAYLOAD: "Execution",
    TriageFlag.SUSPICIOUS_PORT: "Lateral Movement",
    TriageFlag.DNS_TUNNEL: "Exfiltration",
    TriageFlag.HIGH_FREQUENCY: "Reconnaissance",
    TriageFlag.NULL_SCAN: "Reconnaissance",
    TriageFlag.XMAS_SCAN: "Reconnaissance",
    TriageFlag.FIN_SCAN: "Reconnaissance",
}

CHAIN_TEMPLATES = [
    {
        "name": "Classic Intrusion",
        "sequence": ["Reconnaissance", "Lateral Movement", "Exfiltration"],
        "max_gap_minutes": 15,
        "score_weight": 90
    },
    {
        "name": "Aggressive Scan & Impact",
        "sequence": ["Reconnaissance", "Impact"],
        "max_gap_minutes": 5,
        "score_weight": 70
    },
    {
        "name": "Persistent Recon",
        "sequence": ["Reconnaissance", "Reconnaissance"],
        "max_gap_minutes": 30,
        "score_weight": 40
    }
]


@dataclass
class AttackChain:
    chain_id: str
    actor_id: str
    events: List[TriagedPacket] = field(default_factory=list)
    kill_chain_phases: List[str] = field(default_factory=list)
    mitre_techniques: List[str] = field(default_factory=list)
    chain_score: float = 0.0
    attacker_intent: Optional[str] = None
    ai_confidence: float = 0.0
    status: str = "active"
    first_seen: float = 0.0
    last_seen: float = 0.0

    def to_db_dict(self):
        # We only store simplified event data in JSON for DB
        events_simplified = [
            {"ts": e.record.timestamp, "flags": e.flags} for e in self.events
        ]
        return {
            "chain_id": self.chain_id,
            "actor_id": self.actor_id,
            "events_json": json.dumps(events_simplified),
            "kill_chain_phases": json.dumps(list(set(self.kill_chain_phases))),
            "mitre_techniques": json.dumps(list(set(self.mitre_techniques))),
            "chain_score": self.chain_score,
            "attacker_intent": self.attacker_intent,
            "ai_confidence": self.ai_confidence,
            "status": self.status,
            "first_seen": self.first_seen,
            "last_seen": self.last_seen,
            "created_at": time.time()
        }


class MACEEngine:
    """
    Multi-Stage Attack Correlation Engine (MACE)
    Consumes TriagedPackets, groups them into Attack Chains by source IP,
    and scores them against predefined kill chain templates.
    """

    def __init__(self, mace_queue: queue.Queue, db_manager, adrs_engine=None, phantom_engine=None):
        self.mace_queue = mace_queue
        self.db_manager = db_manager
        self.adrs_engine = adrs_engine
        self.phantom_engine = phantom_engine
        
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._is_running = False
        
        # State: source_ip -> AttackChain
        self.active_chains: Dict[str, AttackChain] = {}
        self.session_timeout = 600  # 10 minutes of inactivity to close a chain

        # asyncio event loop for DB operations
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    def start(self):
        if self._is_running:
            return
        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._run_loop,
            name="MACEEngine",
            daemon=True
        )
        self._thread.start()
        self._is_running = True
        logger.info("MACE Engine started")

    def stop(self):
        if not self._is_running:
            return
        self._stop_event.set()
        try:
            self.mace_queue.put_nowait(None)
        except queue.Full:
            pass
        if self._thread:
            self._thread.join(timeout=5.0)
            self._thread = None
        self._is_running = False
        logger.info("MACE Engine stopped")

    def _run_loop(self):
        """Runs the event loop in a dedicated thread to handle async DB calls."""
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        
        try:
            self._loop.run_until_complete(self._process_loop())
        except Exception as e:
            logger.error(f"MACE event loop crashed: {e}", exc_info=True)
        finally:
            self._loop.close()

    async def _process_loop(self):
        logger.info("MACE processing loop running")
        while not self._stop_event.is_set():
            try:
                # 1. Process new packets
                packet = await self._loop.run_in_executor(
                    None, lambda: self._safe_get(timeout=1.0)
                )
                
                if packet:
                    await self._process_packet(packet)

                # 2. Prune old chains (run every iteration is fine with small load, 
                # but could be throttled)
                await self._prune_chains()
                
            except Exception as e:
                logger.error(f"Error in MACE loop: {e}", exc_info=True)

    def _safe_get(self, timeout=1.0):
        try:
            return self.mace_queue.get(timeout=timeout)
        except queue.Empty:
            return None

    async def _process_packet(self, packet: TriagedPacket):
        src_ip = packet.record.src_ip
        now = packet.record.timestamp
        
        # 1. Find or create chain
        if src_ip not in self.active_chains:
            self.active_chains[src_ip] = AttackChain(
                chain_id=f"chain_{uuid.uuid4().hex[:8]}",
                actor_id=src_ip,  # For now, actor = src_ip
                first_seen=now,
                last_seen=now
            )
            
        chain = self.active_chains[src_ip]
        chain.events.append(packet)
        chain.last_seen = now
        
        # 2. Extract Tactics
        new_tactics = set()
        for flag in packet.flags:
            tactic = FLAG_TO_TACTIC.get(flag)
            if tactic and tactic not in chain.kill_chain_phases:
                chain.kill_chain_phases.append(tactic)
                new_tactics.add(tactic)
                
        # 3. Score Chain if new tactics appeared or first event
        if new_tactics or len(chain.events) == 1:
            self._score_chain(chain)
            
            # 3.5 Pass to ADRS to evaluate response policies if score > 0
            if self.adrs_engine and chain.chain_score > 0:
                await self.adrs_engine.evaluate_chain(chain)
            
        # 4. Save to DB
        await self.db_manager.insert_or_update_chain(chain.to_db_dict())
        logger.debug(f"MACE updated chain {chain.chain_id} for {src_ip}")

    def _score_chain(self, chain: AttackChain):
        """Evaluate chain against templates to generate a score."""
        max_score = 0.0
        
        # For simplicity, we just look at the order of unique phases in the chain
        phases_present = chain.kill_chain_phases
        
        for template in CHAIN_TEMPLATES:
            # How many stages match?
            matches = 0
            for req_phase in template["sequence"]:
                if req_phase in phases_present:
                    matches += 1
            
            if matches > 0:
                score = template["score_weight"] * (matches / len(template["sequence"]))
                if score > max_score:
                    max_score = score
                    
        chain.chain_score = max_score

    async def _prune_chains(self):
        """Close chains that have been inactive for the session timeout."""
        now = time.time()
        expired_ips = []
        
        for src_ip, chain in self.active_chains.items():
            if (now - chain.last_seen) > self.session_timeout:
                chain.status = "concluded"
                await self.db_manager.insert_or_update_chain(chain.to_db_dict())
                
                # Pass to PHANTOM to update long-term profile
                if self.phantom_engine:
                    await self.phantom_engine.process_chain_conclusion(chain)
                    
                expired_ips.append(src_ip)
                logger.info(f"MACE concluded chain {chain.chain_id} for {src_ip}")
                
        for ip in expired_ips:
            del self.active_chains[ip]
