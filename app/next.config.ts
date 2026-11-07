import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Self-contained output for the Docker image (D10). */
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
