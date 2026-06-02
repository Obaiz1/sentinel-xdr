"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import * as THREE from "three";

// Dynamically import react-globe.gl to avoid SSR issues with canvas/window
const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

export default function HeroGlobe() {
  const globeEl = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLabel, setLocationLabel] = useState<string>("Locating…");
  const [countries, setCountries] = useState({ features: [] });

  // Deep dark cyberpunk globe core. Built once and passed as the `globeMaterial`
  // PROP (supported by react-globe.gl) instead of calling globeEl.current.globeMaterial(),
  // which is not exposed as a function in this library version.
  const globeMaterial = useMemo(() => {
    const material = new THREE.MeshPhongMaterial({
      color: new THREE.Color("#000a18"), // Deep dark core
      emissive: new THREE.Color("#000000"),
      transparent: true,
      opacity: 0.8,
    });
    return material;
  }, []);

  // Fetch GeoJSON for the continental hex map
  useEffect(() => {
    fetch("https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson")
      .then((res) => res.json())
      .then(setCountries)
      .catch((err) => console.error("Failed to load globe GeoJSON", err));
  }, []);

  // Keep globe container fully responsive
  useEffect(() => {
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight
      });
      const observer = new ResizeObserver((entries) => {
        if (entries[0]) {
          setDimensions({
            width: entries[0].contentRect.width,
            height: entries[0].contentRect.height
          });
        }
      });
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }
  }, []);

  // Fetch real location
  useEffect(() => {
    if (!navigator.geolocation) { setLocationLabel("Location unavailable"); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserPos({ lat: latitude, lng: longitude });
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
          const data = await res.json();
          const city = data.address?.city || data.address?.town || data.address?.county || "Unknown";
          const country = data.address?.country_code?.toUpperCase() || "";
          setLocationLabel(`${city}, ${country}`);
        } catch {
          setLocationLabel(`${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`);
        }
      },
      () => {
        // Fallback
        setUserPos({ lat: 24.8607, lng: 67.0011 });
        setLocationLabel("Karachi, PK");
      }
    );
  }, []);

  // Configure auto-rotation and initial camera position.
  // Guarded because the globe instance methods (controls/pointOfView) may not
  // exist yet on the first effect run — refs don't trigger re-renders, so this
  // can fire before react-globe.gl has attached its imperative API.
  useEffect(() => {
    const globe = globeEl.current;
    if (!globe || dimensions.width === 0) return;
    try {
      if (typeof globe.controls === "function") {
        const controls = globe.controls();
        if (controls) {
          controls.autoRotate = true;
          controls.autoRotateSpeed = 0.8;
          controls.enableZoom = false;
        }
      }
      if (typeof globe.pointOfView === "function") {
        // Position the camera slightly further back
        globe.pointOfView({ altitude: 2.2 }, 0);
      }
    } catch (e) {
      console.warn("HeroGlobe: controls/pointOfView setup skipped:", e);
    }
  }, [dimensions.width]);

  const threatSources = [
    { lat: 55.7558, lng: 37.6173, color: "#ffa500", name: "Moscow" },
    { lat: 39.9042, lng: 116.4074, color: "#ff3366", name: "Beijing" },
    { lat: 35.6762, lng: 139.6503, color: "#ff0066", name: "Tokyo" },
    { lat: -23.5505, lng: -46.6333, color: "#ff4400", name: "São Paulo" },
  ];

  // Arcs from attackers to user
  const arcsData = userPos ? threatSources.map(src => ({
    startLat: src.lat,
    startLng: src.lng,
    endLat: userPos.lat,
    endLng: userPos.lng,
    color: [src.color, "#00ff88"]
  })) : [];

  // Points on the globe (attackers + user)
  const pointsData = [
    ...threatSources.map(src => ({ lat: src.lat, lng: src.lng, size: 0.15, color: src.color, isUser: false })),
    ...(userPos ? [{ lat: userPos.lat, lng: userPos.lng, size: 0.25, color: "#00ff88", isUser: true }] : [])
  ];

  // Radar/Ping ring around the user
  const ringsData = userPos ? [{ lat: userPos.lat, lng: userPos.lng }] : [];

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1.5, ease: "easeOut" }}
      style={{ width: "100%", height: "100%", position: "relative" }}
    >
      {dimensions.width > 0 && typeof window !== "undefined" && (
        <Globe
          ref={globeEl}
          width={dimensions.width}
          height={dimensions.height}
          
          // Base globe without image texture (solid dark color).
          // Dark cyberpunk core supplied via the supported material prop.
          showGlobe={true}
          globeMaterial={globeMaterial}
          backgroundColor="rgba(0,0,0,0)"

          // Continental Hex Outlines
          hexPolygonsData={countries.features}
          hexPolygonResolution={3}
          hexPolygonMargin={0.3}
          hexPolygonColor={() => "#00d4ff"}
          hexPolygonAltitude={0.015}

          // Neon Glow Atmosphere
          atmosphereColor="#00d4ff"
          atmosphereAltitude={0.2}

          // Attackers & User points
          pointsData={pointsData}
          pointLat="lat"
          pointLng="lng"
          pointColor="color"
          pointAltitude="size"
          pointRadius={d => (d as any).isUser ? 0.8 : 0.4}
          pointsMerge={false}

          // User ping rings
          ringsData={ringsData}
          ringColor={() => "#00ff88"}
          ringMaxRadius={6}
          ringPropagationSpeed={2}
          ringRepeatPeriod={1500}

          // Attack arcs
          arcsData={arcsData}
          arcStartLat="startLat"
          arcStartLng="startLng"
          arcEndLat="endLat"
          arcEndLng="endLng"
          arcColor="color"
          arcDashLength={0.4}
          arcDashGap={0.2}
          arcDashAnimateTime={2000}
        />
      )}

      {/* Location HUD overlay */}
      <div style={{
        position: "absolute", bottom: 16, right: 24,
        background: "rgba(0,18,42,0.8)", border: "1px solid rgba(0,255,136,0.4)",
        borderRadius: 6, padding: "6px 12px", backdropFilter: "blur(8px)",
        fontFamily: "monospace", fontSize: 11, color: "#00ff88",
        display: "flex", alignItems: "center", gap: 6, zIndex: 10
      }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#00ff88", display: "inline-block", boxShadow: "0 0 8px #00ff88", animation: "pulse-dot 1.5s infinite" }} />
        {locationLabel}
      </div>
    </motion.div>
  );
}
