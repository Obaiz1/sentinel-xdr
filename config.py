"""
==============================================================================
 LLM-Powered Intrusion Detection System (IDS) — Configuration Module
==============================================================================
 University Capstone Project — Tier S
 
 Centralized configuration management using Pydantic BaseSettings.
 All environment variables are loaded from .env with sensible defaults.
==============================================================================
"""

from pydantic_settings import BaseSettings
from pydantic import Field
from typing import List, Set, Optional
import os


class TriageThresholds(BaseSettings):
    """
    Thresholds for the heuristic triage engine.
    These values control when packets are flagged as suspicious.
    """

    # Port scan: max unique destination ports from a single IP in a time window
    port_scan_threshold: int = 10
    port_scan_window_seconds: float = 30.0

    # ICMP flood: max ICMP packets from a single IP in a time window
    icmp_flood_threshold: int = 50
    icmp_flood_window_seconds: float = 10.0

    # High frequency: max packets from a single IP in a time window
    high_freq_threshold: int = 100
    high_freq_window_seconds: float = 10.0

    # Payload size threshold (bytes) for flagging unusually large payloads
    large_payload_threshold: int = 1400

    # DNS tunneling: DNS payload size threshold (bytes)
    dns_tunnel_payload_threshold: int = 512

    # Known suspicious destination ports (commonly used by malware/backdoors)
    suspicious_ports: Set[int] = {
        4444,   # Metasploit default
        5555,   # Android Debug Bridge / backdoors
        31337,  # Back Orifice / elite ports
        6666,   # IRC botnets
        6667,   # IRC botnets
        1337,   # Elite / generic backdoor
        12345,  # NetBus trojan
        54321,  # Back Orifice 2000
        8080,   # Alternate HTTP (can be proxy abuse)
        3389,   # RDP (brute force target)
        445,    # SMB (EternalBlue, WannaCry)
        135,    # DCOM / RPC exploit
        1433,   # MSSQL (SQL injection target)
        3306,   # MySQL (SQL injection target)
        5432,   # PostgreSQL (SQL injection target)
        27017,  # MongoDB (NoSQL injection target)
    }


class Settings(BaseSettings):
    """
    Main application settings.
    Loaded from environment variables and .env file.
    """

    # ── Application ──────────────────────────────────────────────────────
    app_name: str = "LLM-Powered IDS"
    app_version: str = "1.0.0"
    debug: bool = True

    # ── LLM Provider Selection ───────────────────────────────────────────
    # Which backend LLM to use as PRIMARY: "nvidia" | "gemini" | "groq".
    # All keys are loaded from the environment (.env) — never hardcoded.
    llm_provider: str = Field(
        default="nvidia",
        description="Primary LLM provider: nvidia | gemini | groq",
    )

    # ── NVIDIA NIM (OpenAI-compatible) ───────────────────────────────────
    nvidia_api_key: Optional[str] = Field(
        default=None,
        description="NVIDIA NIM API key (nvapi-...). Loaded from env only.",
    )
    nvidia_model: str = Field(
        default="meta/llama-3.3-70b-instruct",
        description="NVIDIA NIM model id",
    )
    nvidia_base_url: str = Field(
        default="https://integrate.api.nvidia.com/v1",
        description="NVIDIA NIM OpenAI-compatible base URL",
    )

    # ── Gemini API (optional fallback) ───────────────────────────────────
    # SECURITY: no key hardcoded — supply GEMINI_API_KEY via .env if used.
    gemini_api_key: Optional[str] = Field(
        default=None,
        description="Google Gemini API key for LLM threat analysis"
    )
    gemini_model: str = Field(
        default="gemini-2.0-flash",
        description="Gemini model to use for threat analysis"
    )
    gemini_timeout: int = Field(
        default=30,
        description="Timeout in seconds for Gemini API calls"
    )
    gemini_max_retries: int = Field(
        default=3,
        description="Max retries for failed Gemini API calls"
    )

    # ── Groq API (Fallback) ──────────────────────────────────────────────
    groq_api_key: Optional[str] = Field(
        default=None,
        description="Groq API key for LLM fallback support"
    )
    groq_model: str = Field(
        default="llama-3.3-70b-versatile",
        description="Groq model to use as fallback"
    )

    # ── Network Sniffing ─────────────────────────────────────────────────
    sniff_interface: str = Field(
        default="Wi-Fi",
        description="Network interface to capture packets from"
    )
    sniff_bpf_filter: str = Field(
        default="",
        description="BPF filter for kernel-level packet filtering (e.g., 'tcp')"
    )
    payload_hex_max_bytes: int = Field(
        default=128,
        description="Max bytes of payload hex dump to capture per packet"
    )

    # ── Database ─────────────────────────────────────────────────────────
    db_path: str = Field(
        default="./ids_data.db",
        description="Path to SQLite database file"
    )

    # ── Queue Sizes ──────────────────────────────────────────────────────
    packet_queue_maxsize: int = Field(
        default=10000,
        description="Max packets in the sniffer → triage queue"
    )
    llm_queue_maxsize: int = Field(
        default=500,
        description="Max flagged packets awaiting LLM analysis"
    )

    # ── Alert Buffer ─────────────────────────────────────────────────────
    alert_buffer_size: int = Field(
        default=1000,
        description="Max alerts kept in the in-memory ring buffer"
    )

    # ── LLM Concurrency ─────────────────────────────────────────────────
    llm_max_concurrent: int = Field(
        default=2,
        description="Max concurrent LLM analysis requests"
    )

    # ── RAG Knowledge Base ───────────────────────────────────────────────
    rag_enabled: bool = Field(
        default=True,
        description="Enable RAG-based threat context injection"
    )
    chroma_persist_dir: str = Field(
        default="./chroma_db",
        description="ChromaDB persistence directory"
    )
    rag_top_k: int = Field(
        default=3,
        description="Number of RAG results to inject into LLM prompt"
    )

    # ── Dashboard ────────────────────────────────────────────────────────
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    dashboard_refresh_seconds: int = 3

    # ── Triage Thresholds ────────────────────────────────────────────────
    triage: TriageThresholds = TriageThresholds()

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        env_nested_delimiter = "__"


# ── Singleton Instance ───────────────────────────────────────────────────
settings = Settings()
