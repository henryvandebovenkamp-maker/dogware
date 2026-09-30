import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * De demo-PDF draait een headless Chromium (@sparticuz/chromium). Die
   * binaries en het logo worden tijdens het maken van de PDF van schijf
   * gelezen, dus ze moeten expliciet mee in de functiebundel van die route.
   */
  outputFileTracingIncludes: {
    "/api/admin/leads/\\[id\\]/demo-afronden": [
      "./node_modules/@sparticuz/chromium/bin/**/*",
      "./public/brand/logo.png",
    ],
  },
  images: {
    remotePatterns: [
      // UploadThing (v7) serveert bestanden vanaf ufs.sh en utfs.io
      { protocol: "https", hostname: "*.ufs.sh" },
      { protocol: "https", hostname: "utfs.io" },
    ],
  },
};

export default nextConfig;
