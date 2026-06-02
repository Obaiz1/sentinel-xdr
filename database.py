"""
==============================================================================
 LLM-Powered Intrusion Detection System (IDS) — Database Module
==============================================================================
 University Capstone Project — Tier S
 
 SQLite persistence layer using aiosqlite for async database operations.
 Manages alerts, capture sessions, and aggregated statistics.
 
 Schema Design:
   - alerts: Core table storing packet metadata + LLM analysis results
   - capture_sessions: Tracks start/stop times and aggregate counters
==============================================================================
"""

import aiosqlite
import time
import json
import logging
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, asdict
from config import settings

logger = logging.getLogger("ids.database")


# ── Data Models ──────────────────────────────────────────────────────────────

@dataclass
class AlertRecord:
    """
    Represents a single security alert in the database.
    Combines raw packet metadata with LLM analysis results.
    """
    id: Optional[int] = None
    timestamp: float = 0.0
    src_ip: str = ""
    dst_ip: str = ""
    src_port: Optional[int] = None
    dst_port: Optional[int] = None
    protocol: str = ""
    tcp_flags: Optional[str] = None
    triage_flags: str = ""           # Comma-separated heuristic flags
    threat_level: Optional[str] = None   # Low | Medium | High | Critical
    confidence: Optional[float] = None
    attack_vector: Optional[str] = None
    mitre_technique: Optional[str] = None
    explanation: Optional[str] = None
    recommended_action: Optional[str] = None
    raw_payload_hex: Optional[str] = None
    analyzed_at: Optional[float] = None
    status: str = "pending"          # pending | analyzed | error

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return asdict(self)


@dataclass
class CaptureSession:
    """
    Represents a single packet capture session.
    Tracks duration and aggregate statistics.
    """
    id: Optional[int] = None
    started_at: float = 0.0
    stopped_at: Optional[float] = None
    interface: str = ""
    total_packets: int = 0
    flagged_packets: int = 0
    analyzed_packets: int = 0


# ── Database Manager ─────────────────────────────────────────────────────────

class DatabaseManager:
    """
    Async SQLite database manager for the IDS.
    Provides CRUD operations for alerts and capture sessions.
    
    Usage:
        db = DatabaseManager()
        await db.initialize()
        alert_id = await db.insert_alert(alert_record)
        alerts = await db.get_recent_alerts(limit=50)
        await db.close()
    """

    def __init__(self, db_path: str = None):
        self.db_path = db_path or settings.db_path
        self._connection: Optional[aiosqlite.Connection] = None
        logger.info(f"DatabaseManager initialized with path: {self.db_path}")

    async def initialize(self):
        """
        Initialize the database connection and create tables if they don't exist.
        Called once during application startup.
        """
        self._connection = await aiosqlite.connect(self.db_path)
        self._connection.row_factory = aiosqlite.Row
        await self._create_tables()
        logger.info("Database initialized successfully")

    async def _create_tables(self):
        """Create the database schema if tables don't exist."""
        await self._connection.executescript("""
            -- Core alerts table: stores packet metadata and LLM analysis
            CREATE TABLE IF NOT EXISTS alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp REAL NOT NULL,
                src_ip TEXT NOT NULL,
                dst_ip TEXT NOT NULL,
                src_port INTEGER,
                dst_port INTEGER,
                protocol TEXT NOT NULL,
                tcp_flags TEXT,
                triage_flags TEXT NOT NULL,
                threat_level TEXT,
                confidence REAL,
                attack_vector TEXT,
                mitre_technique TEXT,
                explanation TEXT,
                recommended_action TEXT,
                raw_payload_hex TEXT,
                analyzed_at REAL,
                status TEXT DEFAULT 'pending'
            );

            -- Capture session tracking
            CREATE TABLE IF NOT EXISTS capture_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                started_at REAL NOT NULL,
                stopped_at REAL,
                interface TEXT NOT NULL,
                total_packets INTEGER DEFAULT 0,
                flagged_packets INTEGER DEFAULT 0,
                analyzed_packets INTEGER DEFAULT 0
            );

            -- MACE Attack Chains
            CREATE TABLE IF NOT EXISTS attack_chains (
                chain_id TEXT PRIMARY KEY,
                actor_id TEXT,
                events_json TEXT,          -- JSON array of event IDs
                kill_chain_phases TEXT,    -- JSON array
                mitre_techniques TEXT,     -- JSON array
                chain_score REAL,
                attacker_intent TEXT,
                ai_confidence REAL,
                status TEXT DEFAULT 'active',
                first_seen REAL,
                last_seen REAL,
                created_at REAL
            );

            -- ADRS Response Actions
            CREATE TABLE IF NOT EXISTS response_actions (
                action_id TEXT PRIMARY KEY,
                chain_id TEXT,
                action_type TEXT,
                target_ip TEXT,
                policy_name TEXT,
                executed_at REAL,
                simulated BOOLEAN,
                analyst_approved BOOLEAN,
                approved_by TEXT,
                rollback_at REAL,
                rolled_back BOOLEAN DEFAULT FALSE,
                ai_explanation TEXT,
                outcome TEXT
            );
            
            -- PHANTOM Attacker Profiles
            CREATE TABLE IF NOT EXISTS attacker_profiles (
                actor_id TEXT PRIMARY KEY,
                first_seen REAL,
                last_seen REAL,
                total_chains INTEGER DEFAULT 0,
                known_tactics TEXT,        -- JSON array
                risk_score REAL DEFAULT 0.0,
                confidence_level REAL DEFAULT 0.0,
                profile_notes TEXT
            );

            -- CHRONICLE Incident Reports
            CREATE TABLE IF NOT EXISTS incident_reports (
                report_id TEXT PRIMARY KEY,
                chain_id TEXT,
                actor_id TEXT,
                executive_summary TEXT,
                technical_details TEXT,
                generated_at REAL,
                UNIQUE(chain_id)
            );

            -- Performance indexes
            CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON alerts(timestamp);
            CREATE INDEX IF NOT EXISTS idx_alerts_threat_level ON alerts(threat_level);
            CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
            CREATE INDEX IF NOT EXISTS idx_alerts_src_ip ON alerts(src_ip);
            CREATE INDEX IF NOT EXISTS idx_chains_actor ON attack_chains(actor_id);
            CREATE INDEX IF NOT EXISTS idx_chains_status ON attack_chains(status, last_seen);
        """)
        await self._connection.commit()

    async def close(self):
        """Close the database connection gracefully."""
        if self._connection:
            await self._connection.close()
            self._connection = None
            logger.info("Database connection closed")

    # ── Alert CRUD Operations ────────────────────────────────────────────

    async def insert_alert(self, alert: AlertRecord) -> int:
        """
        Insert a new alert record into the database.
        
        Args:
            alert: AlertRecord with packet metadata and optional LLM results.
            
        Returns:
            The auto-generated alert ID.
        """
        cursor = await self._connection.execute("""
            INSERT INTO alerts (
                timestamp, src_ip, dst_ip, src_port, dst_port,
                protocol, tcp_flags, triage_flags, threat_level,
                confidence, attack_vector, mitre_technique,
                explanation, recommended_action, raw_payload_hex,
                analyzed_at, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            alert.timestamp, alert.src_ip, alert.dst_ip,
            alert.src_port, alert.dst_port, alert.protocol,
            alert.tcp_flags, alert.triage_flags, alert.threat_level,
            alert.confidence, alert.attack_vector, alert.mitre_technique,
            alert.explanation, alert.recommended_action,
            alert.raw_payload_hex, alert.analyzed_at, alert.status
        ))
        await self._connection.commit()
        logger.debug(f"Inserted alert ID={cursor.lastrowid} from {alert.src_ip}")
        return cursor.lastrowid

    async def update_alert_analysis(
        self,
        alert_id: int,
        threat_level: str,
        confidence: float,
        attack_vector: str,
        mitre_technique: str,
        explanation: str,
        recommended_action: str
    ):
        """
        Update an existing alert with LLM analysis results.
        Called after the LLM has processed a flagged packet.
        
        Args:
            alert_id: The ID of the alert to update.
            threat_level: Low | Medium | High | Critical
            confidence: 0.0 to 1.0 confidence score
            attack_vector: Type of attack detected
            mitre_technique: MITRE ATT&CK technique ID
            explanation: Human-readable threat explanation
            recommended_action: Suggested response action
        """
        await self._connection.execute("""
            UPDATE alerts SET
                threat_level = ?,
                confidence = ?,
                attack_vector = ?,
                mitre_technique = ?,
                explanation = ?,
                recommended_action = ?,
                analyzed_at = ?,
                status = 'analyzed'
            WHERE id = ?
        """, (
            threat_level, confidence, attack_vector,
            mitre_technique, explanation, recommended_action,
            time.time(), alert_id
        ))
        await self._connection.commit()
        logger.info(f"Updated alert ID={alert_id} with LLM analysis: {threat_level}")

    async def mark_alert_error(self, alert_id: int, error_msg: str):
        """Mark an alert as failed to analyze."""
        await self._connection.execute("""
            UPDATE alerts SET
                status = 'error',
                explanation = ?,
                analyzed_at = ?
            WHERE id = ?
        """, (f"Analysis failed: {error_msg}", time.time(), alert_id))
        await self._connection.commit()
        logger.warning(f"Alert ID={alert_id} marked as error: {error_msg}")

    async def get_recent_alerts(
        self,
        limit: int = 50,
        offset: int = 0,
        threat_level: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Retrieve recent alerts with optional filtering.
        
        Args:
            limit: Maximum number of alerts to return.
            offset: Number of alerts to skip (for pagination).
            threat_level: Filter by threat level (Low/Medium/High/Critical).
            status: Filter by status (pending/analyzed/error).
            
        Returns:
            List of alert dictionaries ordered by timestamp descending.
        """
        query = "SELECT * FROM alerts WHERE 1=1"
        params = []

        if threat_level:
            query += " AND threat_level = ?"
            params.append(threat_level)
        if status:
            query += " AND status = ?"
            params.append(status)

        query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        cursor = await self._connection.execute(query, params)
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]

    async def get_alert_by_id(self, alert_id: int) -> Optional[Dict[str, Any]]:
        """Retrieve a single alert by its ID."""
        cursor = await self._connection.execute(
            "SELECT * FROM alerts WHERE id = ?", (alert_id,)
        )
        row = await cursor.fetchone()
        return dict(row) if row else None

    async def get_alert_count(self) -> Dict[str, int]:
        """Get alert counts grouped by threat level."""
        cursor = await self._connection.execute("""
            SELECT 
                COUNT(*) as total,
                IFNULL(SUM(CASE WHEN threat_level = 'Critical' THEN 1 ELSE 0 END), 0) as critical,
                IFNULL(SUM(CASE WHEN threat_level = 'High' THEN 1 ELSE 0 END), 0) as high,
                IFNULL(SUM(CASE WHEN threat_level = 'Medium' THEN 1 ELSE 0 END), 0) as medium,
                IFNULL(SUM(CASE WHEN threat_level = 'Low' THEN 1 ELSE 0 END), 0) as low,
                IFNULL(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) as pending,
                IFNULL(SUM(CASE WHEN status = 'analyzed' THEN 1 ELSE 0 END), 0) as analyzed,
                IFNULL(SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END), 0) as errors
            FROM alerts
        """)
        row = await cursor.fetchone()
        return dict(row) if row else {}

    # ── MACE Attack Chains CRUD ──────────────────────────────────────────

    async def insert_or_update_chain(self, chain_data: Dict[str, Any]):
        """Insert a new attack chain or update an existing one."""
        await self._connection.execute("""
            INSERT INTO attack_chains (
                chain_id, actor_id, events_json, kill_chain_phases,
                mitre_techniques, chain_score, attacker_intent, ai_confidence,
                status, first_seen, last_seen, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(chain_id) DO UPDATE SET
                events_json = excluded.events_json,
                kill_chain_phases = excluded.kill_chain_phases,
                mitre_techniques = excluded.mitre_techniques,
                chain_score = excluded.chain_score,
                attacker_intent = excluded.attacker_intent,
                ai_confidence = excluded.ai_confidence,
                status = excluded.status,
                last_seen = excluded.last_seen
        """, (
            chain_data['chain_id'], chain_data['actor_id'], chain_data['events_json'],
            chain_data['kill_chain_phases'], chain_data['mitre_techniques'],
            chain_data.get('chain_score', 0.0), chain_data.get('attacker_intent'),
            chain_data.get('ai_confidence', 0.0), chain_data.get('status', 'active'),
            chain_data['first_seen'], chain_data['last_seen'],
            chain_data.get('created_at', time.time())
        ))
        await self._connection.commit()

    async def get_active_chains(self) -> List[Dict[str, Any]]:
        """Get all active attack chains."""
        cursor = await self._connection.execute(
            "SELECT * FROM attack_chains WHERE status = 'active' ORDER BY chain_score DESC"
        )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]

    # ── ADRS Response Actions CRUD ───────────────────────────────────────

    async def insert_response_action(self, action_data: Dict[str, Any]):
        """Insert a new response action record."""
        await self._connection.execute("""
            INSERT INTO response_actions (
                action_id, chain_id, action_type, target_ip, policy_name,
                executed_at, simulated, analyst_approved, rollback_at,
                rolled_back, outcome
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            action_data['action_id'], action_data['chain_id'], action_data['action_type'],
            action_data['target_ip'], action_data['policy_name'], action_data['executed_at'],
            action_data.get('simulated', False), action_data.get('analyst_approved', False),
            action_data.get('rollback_at', 0.0), action_data.get('rolled_back', False),
            action_data.get('outcome', 'success')
        ))
        await self._connection.commit()

    async def get_recent_actions(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get recent response actions."""
        cursor = await self._connection.execute(
            "SELECT * FROM response_actions ORDER BY executed_at DESC LIMIT ?", (limit,)
        )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]

    # ── PHANTOM Attacker Profiles CRUD ───────────────────────────────────

    async def get_attacker_profile(self, actor_id: str) -> Optional[Dict[str, Any]]:
        cursor = await self._connection.execute(
            "SELECT * FROM attacker_profiles WHERE actor_id = ?", (actor_id,)
        )
        row = await cursor.fetchone()
        return dict(row) if row else None

    async def upsert_attacker_profile(self, profile_data: Dict[str, Any]):
        await self._connection.execute("""
            INSERT INTO attacker_profiles (
                actor_id, first_seen, last_seen, total_chains,
                known_tactics, risk_score, confidence_level, profile_notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(actor_id) DO UPDATE SET
                last_seen = excluded.last_seen,
                total_chains = excluded.total_chains,
                known_tactics = excluded.known_tactics,
                risk_score = excluded.risk_score,
                confidence_level = excluded.confidence_level,
                profile_notes = excluded.profile_notes
        """, (
            profile_data['actor_id'], profile_data['first_seen'], profile_data['last_seen'],
            profile_data.get('total_chains', 0), profile_data.get('known_tactics', '[]'),
            profile_data.get('risk_score', 0.0), profile_data.get('confidence_level', 0.0),
            profile_data.get('profile_notes', '')
        ))
        await self._connection.commit()

    # ── CHRONICLE Incident Reports CRUD ──────────────────────────────────

    async def get_incident_report(self, chain_id: str) -> Optional[Dict[str, Any]]:
        cursor = await self._connection.execute(
            "SELECT * FROM incident_reports WHERE chain_id = ?", (chain_id,)
        )
        row = await cursor.fetchone()
        return dict(row) if row else None

    async def insert_incident_report(self, report_data: Dict[str, Any]):
        await self._connection.execute("""
            INSERT OR REPLACE INTO incident_reports (
                report_id, chain_id, actor_id, executive_summary,
                technical_details, generated_at
            ) VALUES (?, ?, ?, ?, ?, ?)
        """, (
            report_data['report_id'], report_data['chain_id'], report_data['actor_id'],
            report_data['executive_summary'], report_data.get('technical_details', ''),
            report_data['generated_at']
        ))
        await self._connection.commit()
        
    async def get_chain_by_id(self, chain_id: str) -> Optional[Dict[str, Any]]:
        cursor = await self._connection.execute(
            "SELECT * FROM attack_chains WHERE chain_id = ?", (chain_id,)
        )
        row = await cursor.fetchone()
        return dict(row) if row else None

    # ── Statistics Queries ───────────────────────────────────────────────

    async def get_statistics(self) -> Dict[str, Any]:
        """
        Get aggregated statistics for the dashboard.
        Returns threat distribution, top sources, protocol breakdown, and timeline.
        """
        stats = {}

        # Threat level distribution
        cursor = await self._connection.execute("""
            SELECT threat_level, COUNT(*) as count 
            FROM alerts 
            WHERE threat_level IS NOT NULL
            GROUP BY threat_level
        """)
        stats["threat_distribution"] = [dict(r) for r in await cursor.fetchall()]

        # Top 10 source IPs by alert count
        cursor = await self._connection.execute("""
            SELECT src_ip, COUNT(*) as count 
            FROM alerts 
            GROUP BY src_ip 
            ORDER BY count DESC 
            LIMIT 10
        """)
        stats["top_sources"] = [dict(r) for r in await cursor.fetchall()]

        # Protocol breakdown
        cursor = await self._connection.execute("""
            SELECT protocol, COUNT(*) as count 
            FROM alerts 
            GROUP BY protocol 
            ORDER BY count DESC
        """)
        stats["protocol_breakdown"] = [dict(r) for r in await cursor.fetchall()]

        # Top attack vectors
        cursor = await self._connection.execute("""
            SELECT attack_vector, COUNT(*) as count 
            FROM alerts 
            WHERE attack_vector IS NOT NULL
            GROUP BY attack_vector 
            ORDER BY count DESC 
            LIMIT 10
        """)
        stats["top_attack_vectors"] = [dict(r) for r in await cursor.fetchall()]

        # Timeline: alerts per minute (last hour)
        one_hour_ago = time.time() - 3600
        cursor = await self._connection.execute("""
            SELECT 
                CAST((timestamp - ?) / 60 AS INTEGER) as minute_bucket,
                COUNT(*) as count,
                threat_level
            FROM alerts 
            WHERE timestamp > ?
            GROUP BY minute_bucket, threat_level
            ORDER BY minute_bucket
        """, (one_hour_ago, one_hour_ago))
        stats["timeline"] = [dict(r) for r in await cursor.fetchall()]

        # Overall counts
        stats["counts"] = await self.get_alert_count()

        return stats

    # ── Session Management ───────────────────────────────────────────────

    async def create_session(self, interface: str) -> int:
        """Create a new capture session record."""
        cursor = await self._connection.execute("""
            INSERT INTO capture_sessions (started_at, interface)
            VALUES (?, ?)
        """, (time.time(), interface))
        await self._connection.commit()
        return cursor.lastrowid

    async def update_session(
        self,
        session_id: int,
        total_packets: int = 0,
        flagged_packets: int = 0,
        analyzed_packets: int = 0,
        stopped: bool = False
    ):
        """Update a capture session with current statistics."""
        if stopped:
            await self._connection.execute("""
                UPDATE capture_sessions SET
                    stopped_at = ?,
                    total_packets = ?,
                    flagged_packets = ?,
                    analyzed_packets = ?
                WHERE id = ?
            """, (time.time(), total_packets, flagged_packets, analyzed_packets, session_id))
        else:
            await self._connection.execute("""
                UPDATE capture_sessions SET
                    total_packets = ?,
                    flagged_packets = ?,
                    analyzed_packets = ?
                WHERE id = ?
            """, (total_packets, flagged_packets, analyzed_packets, session_id))
        await self._connection.commit()

    async def get_latest_session(self) -> Optional[Dict[str, Any]]:
        """Get the most recent capture session."""
        cursor = await self._connection.execute("""
            SELECT * FROM capture_sessions ORDER BY id DESC LIMIT 1
        """)
        row = await cursor.fetchone()
        return dict(row) if row else None
