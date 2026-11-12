import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  logging: { incomingRequests: false }, // the page polls every 2.5s; this keeps the terminal readable
  serverExternalPackages: ["better-sqlite3", "playwright"],
  experimental: { serverActions: { bodySizeLimit: "50mb" } },
};
export default nextConfig;
