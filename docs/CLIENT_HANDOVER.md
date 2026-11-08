# Client and operator handover — draft

Release status: NOT APPROVED. Read `VERIFICATION_REPORT.md` for executed checks and outstanding work.

## Operating policy

- Maintain one authoritative database. This installation uses the existing SQLite file; never fail over to a different database after a write error.
- Owners/managers edit recipes and prices. Choose the active formula for future orders where legacy products have multiple formulas. Save real active labour and powered-oven durations; inherited preparation times may include passive fermentation and need review.
- Recipe ingredient quantities are per batch. Inventory costs are per inventory unit; only mass-to-mass, volume-to-volume and count-to-count conversions are accepted. Mass-to-volume conversion requires a separately justified density model and is not supported.
- Cost = ingredient + active labour + oven power + packaging + other batch costs. Margin divides profit by selling price; markup divides it by cost. Product GST and delivery GST are separate configuration. Have the owner/accountant approve the rates before use.
- Accepting production reserves ingredients. Starting production consumes them once for the order; the policy consumes the order’s aggregate recipe requirements when its production starts. A low-stock alert alone does not reject a sufficient order. Replenish shortages through Restock, then retry acceptance.
- A kitchen floor transfer does not remove stock from the bakery’s total. Restock records goods actually received, a purchase lot and a stock movement. Supplier dispatch is not implemented.
- Record ingredient loss in its inventory unit and finished loss against the actual batch. The API converts compatible ingredient units. Finished loss requires a batch cost snapshot and adequate usable quantity. Do not use a made-up item name to bypass reconciliation.
- Completing an order records its finished output; marking it delivered deducts usable finished goods once. Record full cash collection from the owner order detail when money is actually received. Retried completion/delivery/collection must not duplicate effects.
- New orders snapshot price, GST and estimated production costs. Recipe edits do not overwrite completed transactions. Reporting excludes GST from business revenue, separates delivery and flags incomplete historical cost data. Current recipe estimates are not reconstructed historical accounts.
- Online access is required for authentication, live records and business changes. The PWA caches the application shell; it does not cache private API responses or pretend offline writes succeeded.

## Configuration and startup

Backend: `DB_CLIENT=sqlite`, `SQLITE_DB_PATH` set to the absolute client database path, `JWT_SECRET` at least 32 characters, `NODE_ENV=production`, `SERVE_FRONTEND=true`, `FRONTEND_URL` set to the public HTTPS origin and `PORT` matching the reverse proxy. Supply configuration securely; do not commit `.env` or database/backup files. PostgreSQL selection is blocked by the current connection/schema verification gap.

Build with `npm.cmd run build --prefix frontend`. Start the backend from its directory using `npm.cmd start`. Serve the site behind HTTPS with `/api` routed to that backend. Keep HTML and `sw.js` revalidated and retain versioned assets throughout a rollout. Do not expose SQLite files or local verification credentials through hosting.

Owner settings include delivery charge, the subtotal for free delivery and delivery GST. Product pricing and GST are edited through Recipes & Pricing. Configure ingredient thresholds under Stock & Suppliers. Percentage thresholds use an explicit fixed reference stock; absolute zero is valid.

For development use the root `start:backend` and `start:frontend` npm scripts. A disposable preview is available through `node backend/scripts/preview_verification.js` on port 5501. Credentials printed there belong only to its isolated copy and are not the client’s credentials.

## Backup and recovery

Take SQLite online backups so WAL contents are included. `backend/bakery.pre-audit.sqlite` is the pre-change backup made during this task. Keep encrypted off-machine backups with restricted access and retention agreed by the client. Existing payment screenshot retention is 30 days; confirm this policy before release.

For recovery, stop every process using the database, preserve the current file and journal state, restore a consistent SQLite backup under controlled maintenance, run integrity/foreign-key checks, verify counts and representative orders, and restart only after acceptance. Do not replace just the main database file while an old WAL connection is running. The test suite repeatedly restores the backup into isolated copies; no live disaster-recovery exercise was performed.

Never run the legacy destructive PostgreSQL initialization scripts against client data. New SQLite schema additions are implemented in `backend/src/config/sqliteDb.js` and run transactionally. Preserve the pre-migration backup.

## Verification commands

- Frontend production build: `npm.cmd run build --prefix frontend`
- Lint: `npm.cmd run lint --prefix frontend`
- Existing-record regression suite: `node backend/scripts/verify_reliability.js`
- Isolated production preview: `node backend/scripts/preview_verification.js`
- Production-mode smoke against the preview copy: `node backend/scripts/verify_production.js`
- Read-only PostgreSQL availability: `node backend/scripts/verify_postgres_connection.js`

The reliability script requires the pre-audit backup. It generates private test copies and prints their paths. Local network restrictions must allow its temporary HTTP listener. Read the logs; a successful build alone does not establish workflow correctness.

## Release acceptance still required

Confirm the authoritative client dataset and reconcile historic orders/costs, lots, physical stock, surplus and finished goods. Verify every old worker/owner UI path, UPI screenshot lifecycle, partial batches, quality checks, grouped orders, cancellation/refund, stock expiry and recovery. Complete a security/dependency review and credential recovery process.

On an actual Android phone, install from the HTTPS site, launch standalone, sign in as customer/worker/owner as applicable, exercise a complete order and production flow, test navigation/back, keyboard and safe areas, background/resume, offline notice, reconnect and an application update. Record device, OS, browser, build/cache version, date and result.

Repeat on an actual iPhone (and iPad if supported) using Safari Add to Home Screen. Verify the icon, standalone scope, authentication persistence, safe areas, numeric keyboard, form dialogs, uploads, background/resume, offline/reconnect and upgrade behavior. Record evidence separately from desktop viewport checks.

Final handover must include the HTTPS URL, release identifier, verified individual credentials delivered securely, backup ownership/restore drill, operational training, known limitations, support owner and signed client acceptance. None of these is implied by this draft.
