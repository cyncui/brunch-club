import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Are.na serves covers from these two hosts (permissive CORS, WebP-negotiated).
    remotePatterns: [
      { protocol: "https", hostname: "images.are.na" },
      { protocol: "https", hostname: "d2w9rnfcy7mm78.cloudfront.net" },
      { protocol: "https", hostname: "static.avatars.are.na" },
    ],
  },
};

export default nextConfig;
