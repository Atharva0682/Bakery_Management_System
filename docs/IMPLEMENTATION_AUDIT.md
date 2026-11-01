# Crumb & Co. audit — 28 October 2026

## Existing architecture and baseline

Existing React 19/Vite SPA with customer, worker and owner routes; Axios services call an Express/CommonJS API. Controllers call services/repositories. PostgreSQL DDL and a separate SQLite runtime schema have diverged. `config/db.js` starts SQLite immediately, probes PostgreSQL asynchronously and silently retries PostgreSQL errors in SQLite. This can split transactions and tenant records across databases. No new application or database is proposed.

The existing local SQLite database contains 24 products, 25 recipes, 30 raw materials, 16 orders, 19 batches, 11 users and 1 wastage record. These are persisted records; their provenance as actual business transactions is unverified. A SQLite online backup was saved as `backend/bakery.pre-audit.sqlite` before implementation. Do not distribute that backup: it contains private operational data.

## Issues identified before implementation

1. CRITICAL: password comparison accepts demo passwords for unrelated bcrypt hashes. User repositories can authenticate hardcoded fallback users after database errors.
2. CRITICAL: recipe updates lack business scope; deletion removes ingredient rows before checking recipe ownership. Referenced products/materials are not consistently tenant validated.
3. CRITICAL: automatic database failover, pool queries without pinned transactions, swallowed SQL errors, memory fallback writes, and schema drift can report success without persistence.
4. HIGH: recipe ingredient edits are ignored; recipe creation discards costing rates; zero values are replaced with defaults. Incompatible units silently use factor 1. Availability compares grams with kilograms. Labour duration is guessed. Frontend independently calculates costs, double counts packaging as overhead and stores financial overrides in localStorage.
5. HIGH: order creation, status changes, payments, stock dispatch and wastage are not atomic. Production does not reserve/consume ingredients reliably. Repeated transitions can duplicate effects. Stock deductions clamp to zero instead of rejecting shortages.
6. HIGH: order GST is fixed at 5%, delivery fees are hardcoded, historical costs/tax rates are not snapshotted. Analytics revalue old orders using current recipes and substitute benchmark percentages for missing costs. Tax-inclusive receipts are treated as profit revenue.
7. HIGH: wastage uses a fixed cost of 85 per item and does not reliably reduce raw or finished goods stock. No dependable reconciliation or loss deduplication exists.
8. HIGH: CORS permits every origin with credentials. Deployed API requests force HTTP port 5000, overriding configuration and causing HTTPS mixed content.
9. MEDIUM: worker production station includes a staged ingredient checklist; owner low-stock fields are inconsistent. Dashboard periods and complete business metrics are incomplete.
10. MEDIUM: service worker has a Promise fallback bug, caches non-GET/cross-origin requests, and deletes caches belonging to unrelated apps. Installation icons and offline asset coverage require verification.
11. RELEASE BLOCKER: README claims production readiness and 38 passing integration tests without current evidence. No deployment, physical Android/iOS installation, backup restoration, tax-policy signoff or client acceptance evidence is available. Existing test scripts can mutate live records and often swallow failures or use static assertions.

## Implementation order

Security and deterministic database access; atomic recipe editing and canonical costing; inventory/production/wastage consistency; historical order pricing and analytics; worker simplification; HTTPS/PWA compatibility; production build and tests against isolated copies of the existing records; release/handover documentation. Features remain incomplete until their entire workflow is verified.

## Scope of audit

Inventory reviewed across all runtime folders, route wiring, controllers, services, repositories, schema/migrations, frontend modules, manifests/service worker and test entry points. This is a static architecture and risk audit, not a certification that every branch has executed. Detailed verification and remaining limitations are recorded in `VERIFICATION_REPORT.md`.
