import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Allow both the sandbox preview domain and local network IPs.
  allowedDevOrigins: [
    "*.space-z.ai",
    "192.168.1.24",
    "localhost",
    "127.0.0.1",
  ],
};

export default nextConfig;
