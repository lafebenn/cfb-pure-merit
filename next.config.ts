import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "a.espncdn.com",
      },
      {
        protocol: "https",
        hostname: "**.espncdn.com",
      },
      {
        protocol: "https",
        hostname: "collegefootballdata.com",
      },
      {
        protocol: "https",
        hostname: "**.collegefootballdata.com",
      },
    ],
  },
};

export default nextConfig;
