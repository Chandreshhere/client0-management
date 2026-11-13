import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Organ renders and avatars never change between deploys of the same name: cache them hard.
  async headers() {
    const longCache = [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }];
    return [
      { source: "/organs/:path*", headers: longCache },
      { source: "/avatars/:path*", headers: longCache },
    ];
  },
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
    // This project lives on an exFAT volume where macOS writes AppleDouble "._*" files next to
    // every cache entry; Turbopack's persistent cache cannot parse them. Keep caches in memory.
    turbopackFileSystemCacheForDev: false,
    turbopackFileSystemCacheForBuild: false,
  },
};

export default nextConfig;
