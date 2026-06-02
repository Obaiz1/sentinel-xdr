import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow all cross-origin requests for the dev environment
  async rewrites() {
    return [
      {
        source: "/api/proxy/:path*",
        destination: "http://localhost:8000/:path*",
      },
    ];
  },
  // Transpile Three.js and R3F packages
  transpilePackages: ["three", "@react-three/fiber", "@react-three/drei"],
};

export default nextConfig;
