<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Security response headers

The CSP lives in one place: `frontend/next.config.ts` (`securityHeaders`).
`script-src` currently requires `'unsafe-inline'` because Next.js ships
per-page inline Flight bootstrap scripts (`self.__next_f.push(...)`)
beside the inline ThemeScript; a hash-based `script-src` was tried and
blocked them (hydration failure), and nonces require a middleware/proxy
workflow. Tightening further is a follow-up: add a nonce via proxy and
drop `'unsafe-inline'`.
