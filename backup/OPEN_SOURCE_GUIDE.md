# ConnectGlobal Open Source Integration Guide

## Overview
ConnectGlobal dating app has been architected to use open source components wherever possible, reducing costs and improving transparency. This guide documents the complete open source stack and setup process.

## Open Source Stack

### Core Services
| Service | Open Source Alternative | Purpose | Port |
|---------|------------------------|---------|------|
| **Authentication** | Supabase Auth | User registration, login, social auth | 3001 |
| **Database** | PostgreSQL 15 | Primary data storage with RLS | 5432 |
| **API Layer** | PostgREST | Auto-generated REST API from schema | 8000 |
| **File Storage** | MinIO | S3-compatible object storage | 9000/9001 |
| **Caching** | Redis | Session storage, rate limiting | 6379 |
| **Search** | MeiliSearch | User search, content discovery | 7700 |
| **Analytics** | Plausible Analytics | Privacy-focused usage analytics | 8001 |
| **Monitoring** | Grafana + Prometheus | System metrics and dashboards | 3002/9090 |
| **Video Calls** | Jitsi Meet | WebRTC video conferencing | 8080 |

### Mobile Development
- **React Native** - Cross-platform mobile framework
- **TypeScript** - Type-safe JavaScript
- **Redux Toolkit** - State management
- **Supabase Client** - Real-time database client

### Backend Services
- **Node.js + Express** - API server
- **Socket.io** - Real-time messaging
- **Docker Compose** - Container orchestration

## Setup Instructions

### Prerequisites
1. **Install Docker Desktop**
   - Download: https://www.docker.com/products/docker-desktop
   - Ensure Docker and Docker Compose are available

### Quick Start
1. **Clone and Navigate**
   ```bash
   cd C:\Users\joerg\OneDrive\Dokumente\DatingApp
   ```

2. **Start Open Source Stack**
   ```bash
   # Option 1: Use setup script
   node setup-open-source.js
   
   # Option 2: Manual Docker Compose
   docker-compose up -d
   ```

3. **Wait for Services** (30 seconds)
   ```bash
   docker-compose logs -f
   ```

4. **Configure MinIO Buckets**
   ```bash
   docker-compose exec minio mc alias set local http://localhost:9000 minioadmin minioadmin123
   docker-compose exec minio mc mb local/user-photos
   docker-compose exec minio mc mb local/user-videos
   docker-compose exec minio mc mb local/app-assets
   ```

### Service URLs
- **Supabase Studio**: http://localhost:3001 (Database admin)
- **MinIO Console**: http://localhost:9001 (File storage admin)
- **Grafana**: http://localhost:3002 (admin/admin123)
- **PostgREST API**: http://localhost:8000 (Auto-generated API)
- **Jitsi Meet**: http://localhost:8080 (Video calls)
- **MeiliSearch**: http://localhost:7700 (Search engine)
- **Plausible**: http://localhost:8001 (Analytics)

## Database Schema
The complete schema is defined in `supabase/schema.sql` with:
- User profiles with GDP-based pricing tiers
- Matching system with preferences
- Real-time messaging
- Subscription management
- Row Level Security (RLS) policies

## Authentication Integration
Using Supabase Auth (`src/services/auth/SupabaseAuthService.ts`):
- Email/password registration
- Social login (Google, Facebook)
- Phone verification
- JWT session management
- Real-time auth state changes

## File Storage
MinIO provides S3-compatible storage:
- User photos: `user-photos` bucket
- User videos: `user-videos` bucket
- App assets: `app-assets` bucket

## Development Workflow

### Starting Development
```bash
# 1. Start open source services
docker-compose up -d

# 2. Start backend API
npm run backend:dev

# 3. Start React Native
npm start
```

### Environment Configuration
The `.env` file is pre-configured for local development with:
- Supabase local endpoints
- MinIO credentials
- PostgreSQL connection
- Redis configuration

### Database Migrations
1. Access Supabase Studio: http://localhost:3001
2. Navigate to SQL Editor
3. Run schema from `supabase/schema.sql`
4. Enable RLS policies

## Cost Benefits
| Traditional Service | Open Source Alternative | Annual Savings |
|-------------------|------------------------|----------------|
| Firebase | Supabase | $5,000+ |
| AWS S3 | MinIO | $2,000+ |
| Google Analytics | Plausible | $1,200+ |
| Zoom API | Jitsi Meet | $3,600+ |
| Elasticsearch | MeiliSearch | $4,800+ |
| **Total Savings** | | **$16,600+** |

## Monitoring & Analytics
- **Prometheus** collects metrics from all services
- **Grafana** provides dashboards and alerts
- **Plausible** tracks user behavior without cookies
- **Docker health checks** ensure service availability

## Security Features
- Row Level Security on all database tables
- JWT authentication with refresh tokens
- CORS protection
- Rate limiting with Redis
- Input sanitization and validation

## Scaling Considerations
The open source stack can scale horizontally:
- PostgreSQL read replicas
- Redis cluster for sessions
- MinIO distributed mode
- Multiple PostgREST instances
- Load balancer integration

## Backup Strategy
```bash
# Database backup
docker-compose exec postgres pg_dump -U postgres connectglobal_dev > backup.sql

# MinIO backup
docker-compose exec minio mc mirror local/user-photos ./backup/photos/

# Configuration backup
cp docker-compose.yml backup/
cp -r monitoring/ backup/
```

## Next Steps
1. Install Docker Desktop if not available
2. Run `docker-compose up -d` to start services
3. Access Supabase Studio to initialize database
4. Configure MinIO buckets for file storage
5. Start backend API server
6. Begin React Native development

This open source architecture provides enterprise-grade capabilities while maintaining full control over data and costs.