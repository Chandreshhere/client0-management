import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
    // This project lives on an exFAT volume where macOS writes AppleDouble "._*" files next to
    // every cache entry; Turbopack's persistent cache cannot parse them. Keep caches in memory.
    turbopackFileSystemCacheForDev: false,
    turbopackFileSystemCacheForBuild: false,
  },
};

export default nextConfig;
