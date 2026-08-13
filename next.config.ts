import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "30mb",
    },
  },
  reactCompiler: true,
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
