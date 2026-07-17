import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // UploadThing (v7) serveert bestanden vanaf ufs.sh en utfs.io
      { protocol: "https", hostname: "*.ufs.sh" },
      { protocol: "https", hostname: "utfs.io" },
    ],
  },
};

export default nextConfig;
