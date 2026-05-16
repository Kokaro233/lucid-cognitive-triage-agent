import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: __dirname,
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.100.21"]
};

export default nextConfig;
