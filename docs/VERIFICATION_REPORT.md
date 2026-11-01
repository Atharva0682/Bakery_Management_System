# Verification report — 28 October 2026

Status: substantial in-place repairs implemented; **release and client handover remain blocked**. No production deployment was performed. No Android or iOS installed-PWA pass is claimed.

## Features fixed and implemented

- Removed password bypass and database-error fallback authentication. Recipe and product writes validate bakery ownership; recipe changes and pricing are transactional. Unauthorized recipe write roles are rejected. CORS no longer grants every origin credentialed access.
- Deterministic database selection; no asynchronous engine switching or replay of failed PostgreSQL writes against SQLite. Transactions pin a PostgreSQL connection or serialize SQLite work, including concurrent reservation tests. Startup seeding requires explicit opt-in. SQLite migrations are additive and transactional.
- Existing product/recipe CRUD repaired, including ingredient replacement, unit validation/conversion, batch yields, saved labour/power/packaging rates, other cost, GST, margin versus markup, batch scaling, active-formula selection and controlled bulk costing edits. Product deletion archives the product to preserve historical links.
- Order totals use stored prices and product tax rates; order delivery fees, free-delivery threshold and delivery GST are configurable. Product delivery is charged once per order. New order items retain price, tax and cost snapshots. Guests receive separate inactive records rather than sharing another customer’s account.
- Acceptance reserves recipe-scaled ingredient quantities. Production consumes reservations once. Stock changes, purchase lots, internal floor transfers and movements are recorded consistently. Internal transfers do not reduce total bakery stock. Negative-stock attempts and invalid quantities are rejected. Absolute and fixed-reference percentage safety thresholds are editable.
- Order completion records usable finished goods, delivery records a unique finished-goods sale movement, and repeated calls do not deduct twice. Full cash collection can be recorded by owner/manager and feeds revenue once.
- Ingredient wastage deducts stock at stored cost; finished wastage deducts usable batch stock at its saved cost. Idempotency keys protect retries. Owner wastage reports distinguish ingredients from finished products and support daily through yearly periods. Historical batches without a cost snapshot require reconciliation rather than a fabricated loss cost.
- Dashboard/report periods cover weekly, monthly, quarterly, half-yearly and yearly records; reports separate sales, tax, delivery, production components and wastage. Missing historical cost/item data makes profit unavailable. Pending production shows actual ingredient shortages. The Reports workspace now mounts the existing canonical report components instead of maintaining copied implementations.
- Removed the worker ingredient checklist while retaining production controls. Fixed product-detail conditional hooks, owner phone navigation and recipe layout. Production pages load in separate bundles; largest final chunk is about 413 kB rather than a single 1.1 MB bundle.
- HTTPS-compatible same-origin API configuration; corrected service-worker navigation fallback, cache ownership and request filtering. Production builds precache their actual generated scripts/styles and use versioned caches. Existing logo rendered as 180/192/512 PNG icons; Apple touch icon and portal start URLs corrected. Offline service failures display a connection notice; business writes are not queued or fabricated.
- Removed fabricated traceability matches and safety-certification claims. Supplier comparisons use recorded purchases; simulated supplier dispatch is disabled and directs the operator to record actual goods receipts through Restock.

## Changed files and database components

Backend core: `src/config/db.js`, `src/config/sqliteDb.js`, `src/server.js`, `src/utils/security.js`, `src/utils/costing.js`, `src/utils/revenueRules.js`.

Backend modules: recipe/catalog/inventory/wastage/batch/owner/user/worker/vendor/quality repositories; order/catalog/analytics/production-inventory services; recipe/catalog/order/owner/wastage/ingredient controllers and relevant routes. Conditional database-error memory fallbacks were removed from address, business, feedback, order, payment, QR and other repositories as part of the audit cleanup. Legacy test-only memory helpers still exist and are not a production data source.

Frontend: API client; App/auth/cart contexts; routing; owner layout; product detail; owner dashboard, recipes, orders, branding, stock, analytics, costing, wastage, traceability and reports workspace; worker production station and login pages; Vite configuration, service worker, manifests, entry point, CSS and icon assets. Root README, `.gitignore`, verification scripts and this documentation were added/updated.

SQLite runtime migrations add `inventory_reservations` and `finished_goods_movements`; active recipe and GST product configuration; recipe other cost; raw-material threshold configuration; item tax/cost snapshots; batch cost snapshot; wastage material reference/idempotency key and unique index; business delivery pricing. Existing `stock_movements`, lots, production logs, order status history and payment records are used. Historical cost snapshots are intentionally not invented or backfilled.

Original database was backed up with SQLite’s online backup API to `backend/bakery.pre-audit.sqlite`. Its original business records were not used for test mutations. Test copies received the migrations and workflow writes; the original receives additive migrations on application startup. Pre-existing database integrity check returned `ok`, foreign-key check returned no violations; original counts remained 24 products, 16 orders and 30 materials. Baseline also had 25 recipes and 19 batches. PostgreSQL schema has not been migrated or certified.

## Executed verification

| Verification | Actual result |
| --- | --- |
| Production frontend `npm.cmd run build --prefix frontend` | Passed; build log saved. Route splitting removed the earlier >500 kB chunk warning. |
| Frontend `npm.cmd run lint --prefix frontend` | Exit 0. Warnings remain, including pre-existing unused state/imports and hook-dependency warnings; this is not a warning-free codebase. |
| Backend source syntax | Checked separately across source JS files; result recorded in the execution transcript. |
| `node backend/scripts/verify_reliability.js` | **25 checks passed** on an isolated copy of existing persisted records. Includes HTTP role/tenant checks, complete product/recipe CRUD, invalid-write rollback, bulk rollback, concurrent reservation shortage, consumption retries, finished stock/delivery retries, cash collection, immutable history, GST/delivery totals, wastage, thresholds and reporting. |
| Production backend smoke | Passed actual production-mode startup, DB health, SPA route fallback, generated service-worker asset list and PNG manifest checks. |
| Browser | Verified owner login, period changes, loaded recipes, a saved recipe cost change and recalculated cost, reports/wastage screens and phone viewport layout. Saved recipe cost was separately read back from the verification database. |
| Desktop browser offline reload | Initial attempt failed during service-worker update testing. Subsequent final-shell test with the local server stopped loaded the cached application and login screen; live requests remained unavailable. This is shell/offline-error verification, not installed-device testing. |
| Configured PostgreSQL | Read-only connection attempt failed with `ECONNREFUSED`; no PostgreSQL data or schema changed. |
| Android installed PWA | **Not executed**; no device/HTTPS test environment supplied. |
| iOS installed PWA | **Not executed**; no device/HTTPS test environment supplied. |
| Production deployment | **Not performed**. Local build/preview and smoke tests only. |

Evidence is in `docs/verification/`: production build, lint, reliability and production-smoke logs, PostgreSQL connection result, phone-layout screenshot and offline screenshot. These records contain local verification data and should be reviewed before external distribution. Historical client provenance of the existing database is unverified; some records are explicitly demo/test records. This is not validation against a confirmed production client dataset.

## Remaining issues and limitations

1. Actual Android Chrome and iPhone/iPad Safari installation, standalone launch, background/resume, service-worker upgrade, offline/reconnect and device layout tests still require physical devices and an HTTPS deployment. The browser viewport check is not a substitute.
2. PostgreSQL is unavailable and its legacy DDL differs substantially from the verified SQLite runtime. Reconcile and migrate that schema, then rerun all transaction/concurrency workflows before selecting PostgreSQL for production.
3. Historical paid orders lack item/cost records; batches lack cost snapshots; one product has two legacy formulas. Active-formula selection now resolves future production explicitly, but the owner must reconcile historic costs, quantities, provenance, active formula choices and actual labour/oven times. Annual profit cannot be certified from incomplete records.
4. Inventory aggregates, physical counts, expiry handling, legacy lot balances, full FEFO/recall linkage, finished-goods reconciliation and surplus/buffer production need a client reconciliation and additional end-to-end coverage. A lot balance being reduced does not establish missing historic supplier/batch links. Finished wastage without a real batch/cost cannot be accepted as a fabricated product loss.
5. All legacy staff per-item local-state workflows, manual batch grouping/partial completion and quality/packing/dispatch propagation have not been exhaustively verified. The regression suite covers the repaired API/service path, not every old UI branch. UPI screenshots, replacement uploads, refunds, large uploads, delivery-slot contention and multi-process load need further tests.
6. Supplier dispatch integration is not configured; it now returns an explicit error instead of simulated success. Last-purchase prices are not current vendor quotations. Restock records actual received inventory.
7. GST rates and transaction policy require owner/accountant signoff. Existing rates were preserved as configuration, not legally certified. Discount campaigns are disabled until server-side rules exist. Wastage percentage is unavailable without a complete production denominator.
8. Complete security review, dependency vulnerability scanning, rate limiting, credential rotation/recovery, deployment secret management, monitoring, performance/load tests and disaster-recovery drill remain release work. JWT storage remains in localStorage. Local SQLite concurrency checks do not establish multi-host production scalability.
9. No Git repository was present in this workspace; there is no reviewed commit/PR or code rollback release tag. Dependency installation/reproducibility on a clean machine has not been verified. No production business data was deleted to make tests pass.

## Handover status

`docs/CLIENT_HANDOVER.md` is an operator/client draft describing configuration, policy, verification and release acceptance. It has not received client signoff, device evidence, a final production URL, verified credentials, training acceptance or support ownership. **Do not represent this work as a completed client-ready delivery.**
