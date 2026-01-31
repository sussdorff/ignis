# Deployment Guide

## Architecture

```
Internet
   ↓
Nginx (Docker, port 80/443)
   ├─→ / → Ignis App (systemd, port 3000)
   ├─→ /aidbox/ → Aidbox (Docker, port 8080)
   ├─→ /fhir/ → Aidbox FHIR API
   └─→ /n8n/ → n8n (Docker, port 5678)
```

**Why this hybrid approach?**
- **Docker**: Infrastructure services (Aidbox, n8n, nginx) - complex dependencies
- **Systemd**: Our app (Bun backend + React frontend) - simple, fast iteration

## Initial Deployment (Fresh Server)

```bash
# 1. Provision server (creates VM on Hetzner)
./infra/provision.sh

# 2. Setup everything
./infra/setup-remote.sh 167.235.236.238
```

**What happens:**
1. Copies your GitHub SSH key to server
2. Clones repo to `/opt/ignis`
3. Installs Bun runtime
4. Installs backend dependencies (`bun install`)
5. Installs frontend dependencies (`cd frontend && bun install`)
6. Builds frontend for production (`bun run build`)
7. Creates systemd service (`/etc/systemd/system/ignis-app.service`)
8. Starts the app service
9. Starts Docker services (Aidbox, n8n, nginx)

## Updating After Code Changes

```bash
# Quick update (rebuilds frontend, restarts service)
./infra/update-server.sh [server-ip]
```

**What happens:**
1. SSH into server
2. `git pull origin main`
3. Runs `./infra/deploy-app.sh --restart`
   - Reinstalls dependencies if package.json changed
   - Rebuilds frontend
   - Restarts systemd service
4. Restarts nginx

## Manual Operations

### On the Server

```bash
ssh hackathon@167.235.236.238
cd /opt/ignis

# Pull latest code
git pull origin main

# Full rebuild and restart
./infra/deploy-app.sh

# Quick restart (no rebuild)
./infra/deploy-app.sh --restart

# Check service status
sudo systemctl status ignis-app

# View logs
sudo journalctl -u ignis-app -f

# Restart service
sudo systemctl restart ignis-app
```

### Docker Services

```bash
# All services
docker compose up -d
docker compose ps
docker compose logs -f

# Specific service
docker compose restart nginx
docker compose logs aidbox
```

## Service Management

### Ignis App (Systemd)

```bash
sudo systemctl status ignis-app    # Check status
sudo systemctl start ignis-app     # Start
sudo systemctl stop ignis-app      # Stop
sudo systemctl restart ignis-app   # Restart
sudo journalctl -u ignis-app -f    # Live logs
```

### Docker Services

```bash
docker compose ps                   # List services
docker compose up -d                # Start all
docker compose down                 # Stop all
docker compose restart nginx        # Restart specific service
docker compose logs -f aidbox       # View logs
```

## Troubleshooting

### App won't start

```bash
# Check service status
sudo systemctl status ignis-app

# Check logs
sudo journalctl -u ignis-app -n 50

# Check if port is already in use
sudo lsof -i :3000

# Restart service
sudo systemctl restart ignis-app
```

### Frontend not loading

```bash
# Check if frontend was built
ls -la /opt/ignis/frontend/dist/

# Rebuild frontend
cd /opt/ignis/frontend
~/.bun/bin/bun run build

# Restart app
sudo systemctl restart ignis-app
```

### Can't access via browser

```bash
# Check nginx is running
docker compose ps nginx

# Check nginx logs
docker compose logs nginx

# Test locally
curl http://localhost/health
curl http://localhost:3000/health

# Restart nginx
docker compose restart nginx
```

### After git pull, changes not reflected

```bash
# Did you rebuild?
./infra/deploy-app.sh

# Or use the update script
./infra/update-server.sh
```

## File Locations

- **Project**: `/opt/ignis`
- **Systemd service**: `/etc/systemd/system/ignis-app.service`
- **Logs**: `sudo journalctl -u ignis-app`
- **Environment**: `/opt/ignis/.env`
- **Built frontend**: `/opt/ignis/frontend/dist/`

## Development Workflow

1. **Develop locally**
   ```bash
   # Terminal 1: Backend
   bun run dev
   
   # Terminal 2: Frontend
   cd frontend && bun run dev
   ```

2. **Test changes locally** at http://localhost:5173

3. **Commit and push**
   ```bash
   git add .
   git commit -m "feature: add patient lookup"
   git push origin main
   ```

4. **Deploy to server**
   ```bash
   ./infra/update-server.sh
   ```

5. **Verify** at http://167.235.236.238 or https://ignis.cognovis.de

## Environment Variables

The app reads from `/opt/ignis/.env`:

```bash
# Aidbox
AIDBOX_LICENSE_KEY=xxx
AIDBOX_ADMIN_ID=admin
AIDBOX_ADMIN_PASSWORD=ignis2026

# APIs
ELEVENLABS_API_KEY=xxx
OPENAI_API_KEY=xxx
GOOGLE_AI_API_KEY=xxx

# etc.
```

The systemd service automatically loads these variables.
