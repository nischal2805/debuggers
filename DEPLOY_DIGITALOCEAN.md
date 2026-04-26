
# NeuralDSA — DigitalOcean Deployment Guide

## Prerequisites
- DigitalOcean account with $200 credits
- Docker & Docker Compose installed on your droplet
- Firebase project with Firestore database
- Gemini API key from Google AI Studio
- Domain name (optional)

## Step 1: Create DigitalOcean Droplet

1. Create a Droplet with **Ubuntu 22.04 LTS** (or latest)
2. Choose plan: **Basic ($6-12/month)** is sufficient for demo
3. Enable **IPv6** (recommended)
4. Add SSH key or set password
5. Note your droplet IP: `YOUR_DROPLET_IP`

## Step 2: SSH into Droplet

```bash
ssh root@YOUR_DROPLET_IP
```

## Step 3: Install Docker & Docker Compose

```bash
apt update && apt upgrade -y
apt install -y docker.io docker-compose git curl

# Start Docker
systemctl start docker
systemctl enable docker

# Add current user to docker group (optional)
usermod -aG docker root
```

## Step 4: Clone Repository

```bash
cd /opt
git clone https://github.com/nischal2805/debuggers.git neuraldsa
cd neuraldsa
```

## Step 5: Set Up Environment Variables

### Create `.env` file at root level for docker-compose

```bash
cat > .env << 'EOF'
# Frontend (Vite bakes these into the build)
VITE_FIREBASE_API_KEY=YOUR_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=YOUR_FIREBASE_PROJECT.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID
VITE_FIREBASE_APP_ID=YOUR_FIREBASE_APP_ID
VITE_BACKEND_URL=http://YOUR_DROPLET_IP:8000

# Backend
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"YOUR_PROJECT_ID",...}
ALLOWED_ORIGINS=http://YOUR_DROPLET_IP,http://YOUR_DROPLET_IP:80,http://localhost
LLM_PROVIDER=gemini
DEMO_MODE=false
EOF
```

### Replace placeholders:
- `YOUR_FIREBASE_API_KEY` — from Firebase console → Project Settings
- `YOUR_FIREBASE_PROJECT_ID` — from Firebase console
- `YOUR_FIREBASE_APP_ID` — from Firebase console → Web app config
- `YOUR_GEMINI_API_KEY` — from Google AI Studio (aistudio.google.com)
- `YOUR_DROPLET_IP` — your actual droplet IP
- `YOUR_PROJECT_ID` — in the serviceAccount.json

### For FIREBASE_SERVICE_ACCOUNT_JSON:

Get the full service account JSON:
1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate New Private Key"
3. Copy the entire JSON content
4. Set as single-line JSON in `.env`:

```bash
cat > .env << 'EOF'
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"dsaagent",...entire JSON...}
EOF
```

## Step 6: Create serviceAccount.json file

The backend also reads from `backend/serviceAccount.json`. Create it:

```bash
cat > backend/serviceAccount.json << 'EOF'
{
  "type": "service_account",
  "project_id": "YOUR_PROJECT_ID",
  ...entire service account JSON...
}
EOF
chmod 600 backend/serviceAccount.json
```

## Step 7: Build and Deploy with Docker Compose

```bash
cd /opt/neuraldsa
docker-compose up -d --build
```

This will:
- Build backend image
- Build frontend image (with env vars baked in)
- Start both containers
- Wait for backend health check before starting frontend

## Step 8: Verify Deployment

```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Test backend
curl http://localhost:8000/health

# Test frontend
curl http://localhost
```

Frontend should be accessible at `http://YOUR_DROPLET_IP`

## Step 9: (Optional) Set Up Domain & HTTPS

### Using Nginx reverse proxy + Let's Encrypt:

```bash
apt install -y nginx certbot python3-certbot-nginx

# Create nginx config
cat > /etc/nginx/sites-available/neuraldsa << 'EOF'
server {
    listen 80;
    server_name YOUR_DOMAIN.com;

    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://localhost:8000/;
        proxy_set_header Host $host;
    }
}
EOF

# Enable the config
ln -s /etc/nginx/sites-available/neuraldsa /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx

# Get SSL certificate
certbot --nginx -d YOUR_DOMAIN.com
```

Then update `.env`:
```bash
VITE_BACKEND_URL=https://YOUR_DOMAIN.com/api
ALLOWED_ORIGINS=https://YOUR_DOMAIN.com
```

Rebuild containers:
```bash
docker-compose up -d --build
```

## Step 10: Monitor & Maintain

### View logs
```bash
docker-compose logs -f
```

### Restart services
```bash
docker-compose restart backend
docker-compose restart frontend
```

### Rebuild after code changes
```bash
git pull
docker-compose up -d --build
```

### Stop all services
```bash
docker-compose down
```

## Troubleshooting

### Backend won't start
```bash
docker-compose logs backend
```
Check:
- GEMINI_API_KEY is set and valid
- FIREBASE_SERVICE_ACCOUNT_JSON is valid JSON (not wrapped in extra quotes)
- Port 8000 is not in use

### Frontend shows blank page
```bash
docker-compose logs frontend
```
Check:
- VITE_BACKEND_URL matches the backend IP/domain
- VITE_FIREBASE_API_KEY is correct

### CORS errors
Update `ALLOWED_ORIGINS` in `.env` to include your domain:
```bash
ALLOWED_ORIGINS=http://YOUR_DROPLET_IP:80,http://YOUR_DOMAIN.com,https://YOUR_DOMAIN.com
```

Then rebuild:
```bash
docker-compose up -d --build
```

## Performance Tuning

For production use:
1. Add rate limiting to backend
2. Enable gzip compression in nginx
3. Use Redis for session caching (optional)
4. Monitor memory usage: `docker stats`
5. Set resource limits in docker-compose:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 1G
```

## Cost Estimate

- Droplet: $6-12/month
- Database (Firebase Spark Plan): Free
- API calls:
  - Gemini: Free tier (20 req/day) or pay-as-you-go after
  - Firebase: Free tier sufficient for demo
- Total: ~$10/month for basic setup
