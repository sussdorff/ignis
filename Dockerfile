# Dockerfile for Ignis App (Bun backend + React frontend)
# Multi-stage build: 1) Build frontend, 2) Run backend serving static files

FROM oven/bun:1 AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package.json frontend/bun.lock* ./

# Install frontend dependencies
RUN bun install --frozen-lockfile

# Copy frontend source
COPY frontend/ ./

# Build frontend for production
RUN bun run build

# ============================================
# Stage 2: Backend + serve frontend
# ============================================
FROM oven/bun:1

WORKDIR /app

# Copy backend package files
COPY package.json bun.lock* ./

# Install backend dependencies
RUN bun install --frozen-lockfile --production

# Copy backend source
COPY src/ ./src/
COPY tsconfig.json ./

# Copy built frontend from previous stage
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD bun run -e 'fetch("http://localhost:3000/health").then(r => r.ok ? process.exit(0) : process.exit(1))'

# Start backend server
CMD ["bun", "run", "src/index.ts"]
