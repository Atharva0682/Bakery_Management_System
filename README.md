# Crumb & Co. — existing application

This is the existing React/Vite + Express bakery system, with customer, worker and owner portals. Reliability improvements were made in place on 28 October 2026. It is **not approved for client handover or production deployment yet**.

- [Initial architecture and issue audit](docs/IMPLEMENTATION_AUDIT.md)
- [Verification results and remaining release blockers](docs/VERIFICATION_REPORT.md)
- [Draft client and operator handover](docs/CLIENT_HANDOVER.md)

## Local development

Use Node.js 22 and the existing database. In separate terminals:

```powershell
npm.cmd run start:backend
npm.cmd run start:frontend
```

The API runs on port 5000 and Vite on 5173. The runtime now selects **one database** using `DB_CLIENT=sqlite` (default for this existing installation) or `DB_CLIENT=postgres`. It never switches databases after an error. PostgreSQL is currently unavailable and its legacy schema needs reconciliation before use.

Keep backend configuration in `backend/.env`; supply a strong JWT secret. Production requires at least 32 characters. The application no longer accepts demo-password bypasses or automatically restores demo accounts. Existing credentials must be verified by the owner; do not use the old launcher’s printed demo-password claims as authentication documentation.

Do not initialize or reseed an existing client database. The legacy `init-db.bat` and PostgreSQL `schema.sql` include destructive reset operations. SQLite applies additive runtime migrations transactionally when started; demo initialization is opt-in with `ALLOW_DEMO_SEED=true` and is not a production setup procedure.

## Production build and local smoke verification

```powershell
npm.cmd run build:frontend
npm.cmd run lint --prefix frontend
node backend/scripts/verify_reliability.js
```

The reliability script creates an isolated copy of `backend/bakery.pre-audit.sqlite`. It does not test by mutating the live database. The backup and generated verification databases contain private data and must not be published. The HTTP portion needs local socket access; restricted execution environments may block it.

For an isolated browser preview of the actual build:


```powershell
node backend/scripts/preview_verification.js
```

This runs at `http://127.0.0.1:5501`, using a separate database and disposable verification credentials printed by the script. It is a test server, not production hosting.

For actual production hosting, configure `NODE_ENV=production`, `SERVE_FRONTEND=true`, `DB_CLIENT=sqlite`, an absolute `SQLITE_DB_PATH`, a strong `JWT_SECRET`, and the HTTPS `FRONTEND_URL`. Start from `backend` with `npm.cmd start`, behind an HTTPS reverse proxy. The frontend production build uses `/api` on the same origin. Hosting, TLS, real device installation and client acceptance have not been performed.



all servers are running correctly
hosting remain
frontend - vercel
backend - railways

