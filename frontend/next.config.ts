import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    cpus: 1,
  },
  // Uploaded accommodation images are served by the FastAPI backend as
  // `/uploads/<file>`. Proxying that path keeps stored URLs relative, so they
  // work in <img> tags everywhere without rewriting every render site.
  async rewrites() {
    const backend = (process.env.BACKEND_ORIGIN || "http://127.0.0.1:8000").replace(
      /\/+$/,
      ""
    )
    return [{ source: "/uploads/:path*", destination: `${backend}/uploads/:path*` }]
  },
};

export default nextConfig;
