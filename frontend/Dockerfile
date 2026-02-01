# Dockerfile for Ignis Frontend (Next.js with Bun)
# Multi-stage build for optimal image size

FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Build Next.js app
RUN bun run build

# ============================================
# Production runner
# ============================================
FROM oven/bun:1 AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Add non-root user (Debian-style commands for oven/bun image)
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nextjs

# Copy built standalone app
# Next.js standalone output includes the full path structure, find and copy the server.js location
COPY --from=builder /app/.next/standalone ./standalone-tmp
COPY --from=builder /app/public ./public

# Flatten the standalone directory structure to find server.js, then add static assets
RUN find ./standalone-tmp -name "server.js" -type f | head -1 | xargs -I{} dirname {} | xargs -I{} sh -c 'cp -r {}/* . && rm -rf ./standalone-tmp'

# Copy static assets into the standalone .next directory
COPY --from=builder /app/.next/static ./.next/static

# Set ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["bun", "run", "server.js"]
