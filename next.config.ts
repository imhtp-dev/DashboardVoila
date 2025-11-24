import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript:{
    ignoreBuildErrors:true
  },
  experimental: {
    // Disable server-side image optimization to avoid Sharp
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  images: {
    unoptimized: true, // Disable image optimization completely
  }
};

export default nextConfig;
