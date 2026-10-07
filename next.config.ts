import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  agentRules: false,
  // Pin the app root so a lockfile elsewhere in the repo can't confuse Turbopack.
  turbopack: { root: path.resolve(__dirname) },
};

export default nextConfig;
