# Backend API

## Run

1. Install backend dependencies:
   - `npm --prefix backend install`
2. Rebuild native sqlite module for Node runtime:
   - `npm run backend:rebuild-native`
3. Start development server:
   - `npm run backend:dev`
4. Run compatibility check:
   - `npm run backend:check`

Default server URL: `http://localhost:4000`

## Current Endpoints

- `GET /` simple service info
- `GET /api/health` health + compatibility report
- `GET /api/channels` public channels exposed by desktop preload contract
- `GET /api/compatibility` exact compatibility summary
- `POST /api/rpc/:channel` invoke any public desktop channel remotely

## Separation Notes

- Backend does not load files from `frontend-desktop` at runtime.
- Backend owns its compatibility layer under:
  - `backend/src/desktop-compat`
- Backend owns the public channel contract under:
  - `backend/src/contracts/public-channels.json`

## Config

Environment variables:

- `PORT` default `4000`
- `API_PREFIX` default `/api`
- `CORS_ORIGIN` default `*`
- `BACKEND_DATA_DIR` default `./data`
- `BACKEND_RPC_TOKEN` optional shared token for RPC protection
