import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Puts the (small) stylesheet in the HTML so it does not block the first paint on slow phones.
  experimental: { inlineCss: true },
  /* config options here */
};

export default nextConfig;
