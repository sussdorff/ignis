# Ignis

Hackathon project by Team Ignis.

## Infrastructure

See `infra/` directory for server provisioning:

```bash
# Provision Hetzner server
./infra/provision.sh

# Setup after provisioning
./infra/setup-remote.sh <server-ip>

# Add team member SSH keys
./infra/user-setup.sh <server-ip>

# Teardown when done
./infra/teardown.sh
```

## Server Access

```bash
ssh hackathon@<server-ip>
```

## Services

- **Aidbox** (FHIR Server): port 8080
- **OpenClaw** (AI Agent): port 3000
- **n8n** (Workflows): port 5678
