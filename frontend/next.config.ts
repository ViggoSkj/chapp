import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const backend = process.env.CHAP_BACKEND_ORIGIN;
    if (!backend) return [];
    const origin = new URL(backend);
    if (!["http:", "https:"].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
      throw new Error("CHAP_BACKEND_ORIGIN must be an HTTP(S) origin without a path or credentials.");
    }
    return [{ source: "/chapbackend-api/:path*", destination: `${origin.origin}/chapbackend-api/:path*` }];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "globals.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
