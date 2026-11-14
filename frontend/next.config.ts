import type { NextConfig } from "next";

// Origin of the API the browser fetches at runtime. lib/api-client.ts builds
// every request URL from NEXT_PUBLIC_API_URL (default http://localhost:8000/api/v1),
// so cross-origin API calls need that origin listed in connect-src.
const apiOrigin = (() => {
  try {
    return new URL(
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"
    ).origin
  } catch {
    return undefined
  }
})()

// In development React needs eval() for debugging features (error overlay,
// callstack reconstruction), so the CSP gains 'unsafe-eval' there only.
// Production React never uses eval — the header below stays strict.
const isDev = process.env.NODE_ENV === "development"
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'"
// Dev-only: allow same-origin framing so a local phone-size preview harness
// (iframe at 390px) can render the real responsive layout. Production stays
// unframeable everywhere.
const frameAncestors = isDev ? "frame-ancestors 'self'" : "frame-ancestors 'none'"
const xfoValue = isDev ? "SAMEORIGIN" : "DENY"

const securityHeaders = [
  { key: "X-Frame-Options", value: xfoValue },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // 'unsafe-inline' is required by Next's own inline bootstrap scripts
      // (self.__next_f.push Flight payload, per-page varying content) and the
      // inline ThemeScript in <head>. A hash-based script-src was tried
      // (ThemeScript alone hashes to sha256-de3/Q/9pz2eCMxFHziBN86qAu2sSL7ulIcSPQU0qaqU=)
      // but the Flight scripts are blocked and hydration fails (React #412);
      // a nonce workflow via middleware/proxy is the follow-up (see
      // frontend/AGENTS.md). The inline ThemeScript is a compile-time
      // constant, so it cannot drift into unvetted code.
      scriptSrc,
      // Next's inline style bootstrapping and the invoice modal's inline
      // <style> need 'unsafe-inline' for styles.
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "connect-src 'self'" + (apiOrigin ? ` ${apiOrigin}` : ""),
      "font-src 'self' data:",
      frameAncestors,
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
]

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    cpus: 1,
  },
  // Uploaded accommodation images are served by the FastAPI backend as
  // `/uploads/<file>`. Proxying that path keeps stored URLs relative, so they
  // work in <img> tags everywhere without rewriting every render site.
  // The backend generates flat ASCII names (`uuid4().hex` + `.jpg/.png/.webp`),
  // so the source matches exactly one such filename segment — no `:path*`,
  // slashes, or percent-encoded traversal forms are relayed to the backend.
  async rewrites() {
    const backend = (process.env.BACKEND_ORIGIN || "http://127.0.0.1:8000").replace(
      /\/+$/,
      ""
    )
    return [
      {
        source: "/uploads/:file([A-Za-z0-9._-]+)",
        destination: `${backend}/uploads/:file`,
      },
    ]
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
};

export default nextConfig;
