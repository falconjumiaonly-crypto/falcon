import type { NextConfig } from "next";
import { initOpenNextCloudflare } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
};

initOpenNextCloudflare();

export default nextConfig;
