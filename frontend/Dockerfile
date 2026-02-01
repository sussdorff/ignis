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

# Copy built standalone app and static assets
# Next.js standalone output includes the full path structure, find and copy the server.js location
COPY --from=builder /app/.next/standalone ./standalone-tmp
COPY --from=builder /app/.next/static ./static-tmp
COPY --from=builder /app/public ./public

# Flatten the standalone directory structure to find server.js
# The standalone output contains its own .next with build files
# Then merge static assets into the .next directory
RUN SERVERJS_DIR=$(find ./standalone-tmp -name "server.js" -type f | head -1 | xargs dirname) && \
    cp -r "$SERVERJS_DIR"/* . && \
    rm -rf ./standalone-tmp && \
    cp -r ./static-tmp/* ./.next/static/ && \
    rm -rf ./static-tmp

# Set ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["bun", "run", "server.js"]
