import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Self-contained output for the Docker image (D10). */
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  // Next blocks dev-only resources for origins other than `localhost`; the app
  // is routinely opened at 127.0.0.1 (and preview tooling), which otherwise
  // breaks the HMR WebSocket, surfacing as the dev overlay's "1 Issue".
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
