"""
==============================================================================
 LLM-Powered Intrusion Detection System (IDS) — FastAPI Main Application
==============================================================================
 University Capstone Project — Tier S
 
 Module 3: FastAPI REST API and application orchestration.
 
 Endpoints:
   GET  /             — API welcome and documentation link
   GET  /status       — System health and component status
   GET  /interfaces   — List available network interfaces
   GET  /alerts       — Paginated alerts with filtering
   GET  /alerts/{id}  — Single alert detail
   GET  /statistics   — Aggregated statistics for dashboard
   POST /toggle-sniffing — Start or stop the packet sniffer
   POST /analyze-sample  — Manual packet analysis (testing)
 
 Lifecycle:
   - Startup: Initialize DB, RAG, triage engine, LLM analyzer
   - Shutdown: Stop sniffer, drain queues, close DB
 
 Concurrency Model:
   Main Thread (uvicorn) → FastAPI async request handling
   Sniffer Thread        → Scapy AsyncSniffer (producer)
   Triage Thread         → Heuristic rule engine (consumer)
   LLM Thread            → Gemini API calls (async event loop)
==============================================================================
"""

import time
import queue
import asyncio
import logging
import platform
from typing import Optional, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from config import settings
from database import DatabaseManager
from modules.sniffer import PacketSniffer
from modules.triage import TriageEngine
from modules.llm_client import LLMAnalyzer
from modules.rag_engine import RAGEngine

# ── Logging Setup ────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s │ %(name)-18s │ %(levelname)-8s │ %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("ids.main")

# ── Shared State ─────────────────────────────────────────────────────────────

# Thread-safe queues connecting the pipeline stages
packet_queue = queue.Queue(maxsize=settings.packet_queue_maxsize)
llm_queue = queue.Queue(maxsize=settings.llm_queue_maxsize)
mace_queue = queue.Queue(maxsize=settings.llm_queue_maxsize)  # Same size as LLM queue

# Component instances (initialized during startup)
db_manager = DatabaseManager()
sniffer = PacketSniffer(packet_queue)
triage_engine = TriageEngine(packet_queue, llm_queue, mace_queue)
llm_analyzer = LLMAnalyzer(llm_queue, db_manager)
rag_engine = RAGEngine()

from modules.response import ADRSEngine
adrs_engine = ADRSEngine(db_manager)

from modules.phantom import PhantomEngine
phantom_engine = PhantomEngine(db_manager)

from modules.correlation import MACEEngine
mace_engine = MACEEngine(mace_queue, db_manager, adrs_engine=adrs_engine, phantom_engine=phantom_engine)

from modules.chronicle import ChronicleEngine
chronicle_engine = ChronicleEngine(db_manager)

from modules.aria import ARIAAgent
aria_agent = ARIAAgent(db_manager, rag_engine)

from modules.aegis import AegisEngine
aegis_engine = AegisEngine()

from modules.demo import DemoEngine
demo_engine = DemoEngine(db_manager, llm_analyzer)

from modules import nvidia_llm

# WebSocket connections for real-time alerts
ws_connections: List[WebSocket] = []

# Session tracking
current_session_id: Optional[int] = None


# ── Application Lifecycle ────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifecycle manager.
    Initializes all components on startup and cleans up on shutdown.
    """
    global current_session_id

    logger.info("=" * 60)
    logger.info(f"  {settings.app_name} v{settings.app_version}")
    logger.info(f"  Starting up on {platform.system()} {platform.release()}")
    logger.info("=" * 60)

    # ── Startup ──────────────────────────────────────────────────────
    try:
        # 1. Initialize database
        await db_manager.initialize()
        logger.info("✓ Database initialized")

        # 2. Initialize RAG engine
        if settings.rag_enabled:
            rag_engine.initialize()
            llm_analyzer.rag_engine = rag_engine
            logger.info(f"✓ RAG engine loaded ({rag_engine.document_count} documents)")

        # 3. Start triage engine (consumer thread)
        triage_engine.start()
        logger.info("✓ Triage engine started")

        # 4. Start LLM analyzer (async thread)
        llm_analyzer.start()
        logger.info("✓ LLM analyzer started")

        # 5. Start MACE engine
        mace_engine.start()
        logger.info("✓ MACE engine started")

        logger.info("─" * 60)
        logger.info(f"  API ready at http://localhost:{settings.api_port}")
        logger.info(f"  Dashboard: streamlit run dashboard/app.py")
        logger.info("─" * 60)

    except Exception as e:
        logger.error(f"Startup failed: {e}", exc_info=True)
        raise

    yield  # ← Application runs here

    # ── Shutdown ─────────────────────────────────────────────────────
    logger.info("Shutting down...")

    # Stop sniffer if running
    if sniffer.is_running:
        sniffer.stop()
        if current_session_id:
            await db_manager.update_session(
                current_session_id,
                total_packets=sniffer.packets_captured,
                flagged_packets=triage_engine.packets_flagged,
                analyzed_packets=llm_analyzer.analyzed_count,
                stopped=True
            )

    # Stop demo mode if active
    if demo_engine.is_running:
        await demo_engine.stop()

    # Stop processing threads
    triage_engine.stop()
    llm_analyzer.stop()
    mace_engine.stop()

    # Close database
    await db_manager.close()

    logger.info("All components shut down cleanly")


# ── FastAPI App ──────────────────────────────────────────────────────────────

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "Tier S LLM-Powered Intrusion Detection System. "
        "Captures network packets, applies heuristic triage, and uses "
        "Google Gemini for AI-powered threat analysis."
    ),
    lifespan=lifespan,
)

# CORS for Streamlit dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request/Response Models ──────────────────────────────────────────────────

class SniffingToggleRequest(BaseModel):
    """Request body for toggling the sniffer."""
    interface: Optional[str] = None
    bpf_filter: Optional[str] = None


class ManualAnalysisRequest(BaseModel):
    """Request body for manual packet analysis."""
    src_ip: str = "192.168.1.100"
    dst_ip: str = "10.0.0.1"
    src_port: Optional[int] = 54321
    dst_port: Optional[int] = 4444
    protocol: str = "TCP"
    tcp_flags: Optional[str] = "S"
    payload_hex: Optional[str] = None
    packet_size: int = 64
    flags: Optional[List[str]] = ["MANUAL_SUBMISSION"]

class AriaChatRequest(BaseModel):
    """Request body for ARIA chat."""
    message: str
    history: List[dict] = []


# ── API Endpoints ────────────────────────────────────────────────────────────

@app.get("/", tags=["System"])
async def root():
    """API welcome endpoint with system info."""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "status": "operational",
        "documentation": "/docs",
        "endpoints": {
            "status": "GET /status",
            "interfaces": "GET /interfaces",
            "alerts": "GET /alerts",
            "statistics": "GET /statistics",
            "toggle_sniffing": "POST /toggle-sniffing",
            "analyze_sample": "POST /analyze-sample",
        },
    }


@app.get("/status", tags=["System"])
async def get_status():
    """
    Get comprehensive system health status.
    Shows state of all components: sniffer, triage, LLM, database, RAG.
    """
    return {
        "system": {
            "name": settings.app_name,
            "version": settings.app_version,
            "platform": f"{platform.system()} {platform.release()}",
            "uptime_note": "Check /statistics for detailed metrics",
        },
        "sniffer": sniffer.status,
        "demo": demo_engine.status,
        "triage": triage_engine.status,
        "llm_analyzer": llm_analyzer.status,
        "rag_engine": {
            "enabled": settings.rag_enabled,
            "initialized": rag_engine.is_initialized,
            "document_count": rag_engine.document_count,
        },
        "queues": {
            "packet_queue_size": packet_queue.qsize(),
            "packet_queue_max": settings.packet_queue_maxsize,
            "llm_queue_size": llm_queue.qsize(),
            "llm_queue_max": settings.llm_queue_maxsize,
        },
        "database": {
            "path": settings.db_path,
            "connected": db_manager._connection is not None,
        },
    }


@app.get("/interfaces", tags=["System"])
async def list_interfaces():
    """List all available network interfaces on the system."""
    interfaces = PacketSniffer.list_interfaces()
    return {
        "interfaces": interfaces,
        "current": sniffer.interface,
        "count": len(interfaces),
    }


@app.post("/toggle-sniffing", tags=["Sniffing"])
async def toggle_sniffing(request: SniffingToggleRequest = SniffingToggleRequest()):
    """
    Start or stop the packet sniffer.
    
    If running → stops the sniffer.
    If stopped → starts on the specified (or default) interface.
    """
    global current_session_id, sniffer

    if sniffer.is_running:
        # ── Stop Sniffer ─────────────────────────────────────────────
        sniffer.stop()

        if current_session_id:
            await db_manager.update_session(
                current_session_id,
                total_packets=sniffer.packets_captured,
                flagged_packets=triage_engine.packets_flagged,
                analyzed_packets=llm_analyzer.analyzed_count,
                stopped=True,
            )

        return {
            "action": "stopped",
            "message": "Packet sniffer stopped",
            "stats": {
                "packets_captured": sniffer.packets_captured,
                "packets_flagged": triage_engine.packets_flagged,
                "packets_analyzed": llm_analyzer.analyzed_count,
            },
        }
    else:
        # ── Start Sniffer ────────────────────────────────────────────
        interface = request.interface or settings.sniff_interface

        # Recreate sniffer with new settings if interface changed
        if interface != sniffer.interface:
            sniffer = PacketSniffer(
                packet_queue,
                interface=interface,
                bpf_filter=request.bpf_filter
            )

        try:
            sniffer.start()
            current_session_id = await db_manager.create_session(interface)

            return {
                "action": "started",
                "message": f"Packet sniffer started on {interface}",
                "session_id": current_session_id,
                "interface": interface,
            }
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to start sniffer: {str(e)}. "
                       f"Ensure you have admin privileges and the interface '{interface}' exists."
            )


@app.get("/alerts", tags=["Alerts"])
async def get_alerts(
    limit: int = Query(50, ge=1, le=500, description="Max alerts to return"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    level: Optional[str] = Query(None, description="Filter: Low/Medium/High/Critical"),
    status: Optional[str] = Query(None, description="Filter: pending/analyzed/error"),
):
    """
    Get paginated list of security alerts with optional filtering.
    Returns alerts ordered by most recent first.
    """
    alerts = await db_manager.get_recent_alerts(
        limit=limit,
        offset=offset,
        threat_level=level,
        status=status,
    )
    total = await db_manager.get_alert_count()

    return {
        "alerts": alerts,
        "pagination": {
            "limit": limit,
            "offset": offset,
            "returned": len(alerts),
            "total": total.get("total", 0),
        },
        "filters": {
            "level": level,
            "status": status,
        },
    }


@app.get("/alerts/recent", tags=["Alerts"])
async def get_recent_alerts_memory():
    """
    Get recent alerts from the in-memory buffer (faster than DB query).
    Used by the dashboard for real-time updates.
    """
    return {
        "alerts": llm_analyzer.get_recent_alerts(limit=100),
        "count": len(llm_analyzer.get_recent_alerts()),
    }


@app.get("/alerts/{alert_id}", tags=["Alerts"])
async def get_alert_detail(alert_id: int):
    """Get detailed information for a specific alert."""
    alert = await db_manager.get_alert_by_id(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")
    return alert


@app.get("/statistics", tags=["Analytics"])
async def get_statistics():
    """
    Get aggregated statistics for the dashboard.
    Includes threat distribution, top sources, protocol breakdown, and timeline.
    """
    stats = await db_manager.get_statistics()
    
    # Add real-time component stats
    stats["real_time"] = {
        "sniffer": sniffer.status,
        "triage": triage_engine.status,
        "llm": llm_analyzer.status,
    }

    return stats


@app.post("/analyze-sample", tags=["Analysis"])
async def analyze_sample(request: ManualAnalysisRequest):
    """
    Submit packet data manually for LLM analysis.
    Useful for testing the LLM pipeline without live capture.
    """
    try:
        analysis = await llm_analyzer.analyze_manual(request.model_dump())

        if analysis:
            return {
                "success": True,
                "analysis": analysis.to_dict(),
                "input": request.model_dump(),
            }
        else:
            return {
                "success": False,
                "error": "LLM analysis returned no results. Check Gemini API connectivity.",
                "input": request.model_dump(),
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/chains", tags=["Queries"])
async def get_active_chains():
    """Retrieve active attack chains built by MACE."""
    try:
        chains = await db_manager.get_active_chains()
        return {"chains": chains}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chronicle/{chain_id}", tags=["CHRONICLE"])
async def generate_chronicle_report(chain_id: str):
    """Generate an executive narrative for an attack chain."""
    try:
        report = await chronicle_engine.generate_report(chain_id)
        if not report:
            raise HTTPException(status_code=404, detail="Could not generate report or chain not found.")
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── XDR Engine Suite — manual run dispatcher ──────────────────────────────────

VALID_ENGINES = {"mace", "aria", "adrs", "phantom", "aegis", "chronicle"}


def _engine_result(engine: str, title: str, summary: str, *, metrics: dict = None, items: list = None, status: str = "success") -> dict:
    return {
        "engine": engine,
        "status": status,
        "title": title,
        "summary": summary,
        "metrics": metrics or {},
        "items": items or [],
        "timestamp": time.time(),
    }


async def _run_mace() -> dict:
    chains = await db_manager.get_active_chains()
    top = max(chains, key=lambda c: c.get("chain_score", 0)) if chains else None
    items = [
        {
            "label": c.get("chain_id", "—"),
            "value": f"{c.get('actor_id', '?')} · score {float(c.get('chain_score', 0)):.0f}",
        }
        for c in chains[:8]
    ]
    summary = (
        f"{len(chains)} active attack chain(s) correlated."
        + (f" Highest-risk actor: {top.get('actor_id')} (score {float(top.get('chain_score',0)):.0f})." if top else " No multi-stage activity detected — system monitoring.")
    )
    return _engine_result(
        "mace", "Multi-Stage Attack Correlation", summary,
        metrics={"active_chains": len(chains)}, items=items,
    )


async def _run_aria() -> dict:
    if not nvidia_llm.nvidia_available() and not settings.gemini_api_key and not settings.groq_api_key:
        return _engine_result(
            "aria", "AI Security Copilot",
            "AI provider not configured. Set NVIDIA_API_KEY (or GEMINI/GROQ) in the backend .env.",
            status="not_configured",
        )
    context = await aria_agent._gather_context("Give a situational awareness summary")
    prompt = (
        "Based on the live SOC context below, give a concise situational-awareness "
        "summary in 3 short bullet points. If there is no data, say the network is quiet.\n\n"
        + (context or "No live alerts or chains currently.")
    )
    try:
        text = await nvidia_llm.complete(prompt, system_instruction="You are ARIA, a concise SOC analyst.", max_tokens=300)
    except Exception as e:
        return _engine_result("aria", "AI Security Copilot", f"AI provider error: {e}", status="error")
    return _engine_result("aria", "AI Security Copilot", text.strip())


async def _run_adrs() -> dict:
    """Safe DRY-RUN: report what ADRS would do — never executes firewall changes here."""
    chains = await db_manager.get_active_chains()
    actions = await db_manager.get_recent_actions(limit=10)
    decisions = []
    for c in chains:
        score = float(c.get("chain_score", 0))
        actor = c.get("actor_id", "?")
        if score >= 60.0:
            internal = actor.startswith(("10.", "192.168.", "172."))
            verdict = "WOULD ABORT (internal/whitelisted)" if internal else "WOULD BLOCK (dry-run)"
            decisions.append({"label": actor, "value": f"score {score:.0f} → {verdict}"})
    summary = (
        f"Evaluated {len(chains)} chain(s) against block policy (min score 60). "
        f"{len(decisions)} candidate action(s) identified. "
        f"{len(actions)} action(s) on record. This is a non-destructive dry-run."
    )
    items = decisions or [{"label": a.get("target_ip", "—"), "value": f"{a.get('action_type','?')} · {a.get('outcome','?')}"} for a in actions[:8]]
    return _engine_result("adrs", "Autonomous Defence Response", summary,
                          metrics={"candidates": len(decisions), "logged_actions": len(actions)}, items=items)


async def _run_phantom() -> dict:
    chains = await db_manager.get_active_chains()
    actors = []
    seen = set()
    for c in chains:
        aid = c.get("actor_id")
        if aid and aid not in seen:
            seen.add(aid)
            profile = await db_manager.get_attacker_profile(aid)
            if profile:
                actors.append({
                    "label": aid,
                    "value": f"risk {float(profile.get('risk_score',0)):.0f} · {profile.get('total_chains',0)} chain(s)",
                })
            else:
                actors.append({"label": aid, "value": "new actor — profile forming"})
    summary = (
        f"Tracking {len(actors)} distinct actor profile(s)."
        if actors else
        "No attacker profiles yet. Profiles build as MACE concludes attack chains."
    )
    return _engine_result("phantom", "Attacker Memory Profiling", summary,
                          metrics={"profiles": len(actors)}, items=actors)


async def _run_aegis() -> dict:
    alerts = await db_manager.get_recent_alerts(limit=100)
    scanned = 0
    detections = []
    for a in alerts:
        payload = a.get("raw_payload_hex") or a.get("payload_hex")
        if not payload:
            continue
        scanned += 1
        if aegis_engine.scan_payload(payload):
            detections.append({
                "label": f"alert #{a.get('id','?')}",
                "value": f"{a.get('src_ip','?')} → {a.get('dst_ip','?')} · injection pattern",
            })
    summary = (
        f"Scanned {scanned} payload(s) for LLM prompt-injection / AI-evasion patterns. "
        + (f"{len(detections)} suspicious payload(s) flagged." if detections else "No evasion attempts detected.")
    )
    return _engine_result("aegis", "AI Evasion Detection", summary,
                          metrics={"scanned": scanned, "detections": len(detections)}, items=detections)


async def _run_chronicle() -> dict:
    chains = await db_manager.get_active_chains()
    if not chains:
        return _engine_result(
            "chronicle", "Incident Storytelling",
            "No attack chains available to narrate yet. CHRONICLE generates executive reports once MACE builds a chain.",
            status="empty",
        )
    target = max(chains, key=lambda c: c.get("chain_score", 0))
    report = await chronicle_engine.generate_report(target.get("chain_id"))
    if not report:
        return _engine_result("chronicle", "Incident Storytelling", "Could not generate a report (LLM unavailable).", status="error")
    return _engine_result(
        "chronicle", "Incident Storytelling",
        report.get("executive_summary", "Report generated."),
        metrics={"chain_id": target.get("chain_id"), "actor": target.get("actor_id")},
    )


@app.post("/api/sniffer/demo/start", tags=["Sniffing"])
async def start_demo():
    """Start safe Demo Mode — synthetic events only, NO packet capture."""
    await demo_engine.start()
    return {"action": "demo_started", "demo": demo_engine.status}


@app.post("/api/sniffer/demo/stop", tags=["Sniffing"])
async def stop_demo():
    """Stop Demo Mode."""
    await demo_engine.stop()
    return {"action": "demo_stopped", "demo": demo_engine.status}


@app.post("/api/engines/{engine}/run", tags=["Engines"])
async def run_engine(engine: str):
    """Run a single XDR engine on the current live data and return structured output."""
    engine = engine.lower()
    if engine not in VALID_ENGINES:
        raise HTTPException(status_code=404, detail=f"Unknown engine '{engine}'")
    runners = {
        "mace": _run_mace, "aria": _run_aria, "adrs": _run_adrs,
        "phantom": _run_phantom, "aegis": _run_aegis, "chronicle": _run_chronicle,
    }
    try:
        return await runners[engine]()
    except Exception as e:
        logger.error(f"Engine '{engine}' run failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"{engine} run failed: {e}")


# ── ARIA Endpoints ───────────────────────────────────────────────────────────

@app.post("/api/aria/chat", tags=["ARIA"])
async def aria_chat(request: AriaChatRequest):
    """
    Stream a response from the ARIA AI Copilot.
    """
    async def generate():
        async for chunk in aria_agent.stream_chat(request.message, request.history):
            yield chunk

    return StreamingResponse(generate(), media_type="text/plain")

# ── WebSocket for Real-Time Alerts ───────────────────────────────────────────

@app.websocket("/ws/alerts")
async def websocket_alerts(websocket: WebSocket):
    """
    WebSocket endpoint for real-time alert streaming.
    Sends new alerts to connected dashboard clients.
    """
    await websocket.accept()
    ws_connections.append(websocket)
    logger.info(f"WebSocket client connected ({len(ws_connections)} total)")

    last_count = 0
    try:
        while True:
            # Check for new alerts
            current_alerts = llm_analyzer.get_recent_alerts()
            current_count = len(current_alerts)

            if current_count > last_count:
                new_alerts = current_alerts[last_count:]
                for alert in new_alerts:
                    await websocket.send_json(alert)
                last_count = current_count

            await asyncio.sleep(1.0)

    except WebSocketDisconnect:
        ws_connections.remove(websocket)
        logger.info(f"WebSocket client disconnected ({len(ws_connections)} remaining)")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        if websocket in ws_connections:
            ws_connections.remove(websocket)


# ── Entry Point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.debug,
        log_level="info",
    )
