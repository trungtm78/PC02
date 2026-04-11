# PC02 Case Management System

## Project Overview
Internal case management system (NestJS backend + React frontend) for managing legal cases, petitions, incidents.

## Testing
- Backend tests: `cd backend && npx jest --no-coverage`
- Full test suite: `cd backend && npm test`

## Deploy Configuration (configured by /setup-deploy)
- Platform: Render
- Production URL: TBD (update after first deploy)
- Deploy workflow: auto-deploy on push to main
- Deploy status command: HTTP health check
- Merge method: squash
- Project type: web app (NestJS API + React SPA)
- Post-deploy health check: {PRODUCTION_URL}/api/v1/health

### Custom deploy hooks
- Pre-merge: `cd backend && npm test`
- Deploy trigger: automatic on push to main (Render auto-deploy)
- Deploy status: poll production URL
- Health check: {PRODUCTION_URL}/api/v1/health

### Setup instructions
1. Create Render Web Service connected to this repo
2. Set build command: `cd backend && npm install && npm run build`
3. Set start command: `cd backend && npm run start:prod`
4. Add environment variables (DATABASE_URL, JWT_SECRET, etc.)
5. After deploy, replace `TBD` and `{PRODUCTION_URL}` above with actual URL
