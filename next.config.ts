import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone', // Enable standalone build for Docker
  typescript:{
    ignoreBuildErrors:true
  },
  // Disable Sharp image optimization to prevent Bus error on Azure
  images: {
    unoptimized: true
  }
};

export default nextConfig;
