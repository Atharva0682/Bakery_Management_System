# Owner workspace UI refinement

## Follow-up — 29 October 2026

The earlier restrained presentation below has been revised following feedback that pages felt too minimal and repetitive.

- Dashboard now has an editorial welcome, a dark kitchen summary using actual planned output, operational shortcuts, and a compact daily summary.
- Orders uses a service-desk header, a continuous amber status counter, filters and a bordered order ledger.
- Stock uses a sage pantry treatment, a stock summary ledger, ingredient tables, supplier records and kitchen requests.
- Production uses a dark espresso kitchen header, a compact production pulse and differentiated three-stage lanes.
- Products & Recipes now has a photo-led product collection with search/category filtering, price editing, archive actions and links into the matching formula. The recipe book includes image thumbnails, a selected formula cover, quantity scaling, ingredient costs, a cost composition chart, pricing and target-margin controls, GST preview and saved instructions. Existing create, edit, delete, active-formula and bulk-costing APIs are retained. Product creation, recipe creation and recipe editing now use accessible shared dialogs with phone layouts.
- Reports no longer has a row of sub-tabs. A report library opens dedicated Sales, Costing, Wastage and Traceability views via `?report=...`, with a back link. Costing now has a formula ledger; Wastage has recorded-loss totals, a stock-connected entry form, grouped losses and an audit timeline.

Presentation files added: `frontend/src/components/owner/OwnerCatalogWorkspace.jsx`, `frontend/src/styles/owner-catalog.css`, and `frontend/src/styles/owner-reports.css`. Updated the owner dashboard, orders, stock, production, products/recipes, analytics, reports, costing and wastage pages; shared `OwnerUI.jsx` and `owner-workspace.css`.

Small catalog fixes: category lookup uses the loaded categories instead of the removed constant; fetch failures are displayed; ingredient line estimates use canonical saved costs without a made-up fallback rate; scaled quantities retain precision; a zero target margin is accepted; the retired worker simulator was removed. No backend, schema, migration or live database records were changed in this follow-up.

Executed after the follow-up:

- Actual Vite production build passed; lint exited 0 with remaining project warnings.
- Reliability suite passed all 26 checks against its isolated existing-record database copy, including product/recipe CRUD, zero rates, ingredient edits and bulk-update rollback.
- Browser checked the 24-product / 25-recipe catalog, category and text filtering, inline price editor, product-to-formula navigation, batch scaling and cost recomputation, and the recipe/product dialogs. Verified the mango formula scaled from 2 to 4 items: ingredients ₹595.02, total cost ₹1,046.02 and unit cost ₹261.51. No live records were saved during UI review.
- Opened all four reports through the new library and verified back navigation. Yearly sales showed ₹5,030 revenue with missing historical costs explicitly marked; yearly wastage showed the saved ₹170 loss and audit entry. Opened the stock-connected wastage form without submitting it.
- Inspected distinct desktop Dashboard, Orders, Stock, Products, Production and Reports views. Phone-width browser checks covered the recipe workspace, recipe editor, new-product dialog and production board. Fixed a product-form ingredient-row overflow found during review. These are browser viewport checks, not installed-device tests.
- Final captured browser errors: none.

Screenshots and logs are in `docs/verification/ui-refinement/`. Deployment remains local development; no production deployment or physical Android/iOS PWA test was performed. Client handover documentation exists in `docs/CLIENT_HANDOVER.md`; the broader release limitations in the implementation audit still apply.

## Initial refinement — 28 October 2026

## Delivered

- Dashboard now focuses on open orders, kitchen progress, inventory alerts and production readiness. The reporting-period and full financial summary requested in the screenshot have moved to Reports.
- Reports uses a period selector, four key figures, revenue chart, production-cost statement, separate sales/tax/delivery statement and product profitability table. Missing historical costs remain explicit rather than becoming estimated profit.
- Orders has compact filters/search, a readable order table, focused details dialog, payment proof view, rejection form, cash collection and fulfilment controls. Links from the dashboard open the selected order directly.
- Stock has ingredient/category/shortage filters, physical/reserved/available quantities, supplier history, kitchen requests, goods-receipt and threshold dialogs. Existing receipt and request APIs are retained.
- Production has a three-stage batch board, demand from saved accepted orders, searchable/filterable batch history, a recipe-based batch planner and actual-output/packing dialogs. The previous hardcoded demand, stock and worker examples were removed.
- Shared warm cream/brown styling, original sidebar theme, restrained badges, lighter borders, consistent spacing and responsive layouts. Dialogs support Escape, focus containment and focus return.

## Supporting fixes

`usePolling` no longer immediately restarts its fetching effect whenever data changes. Batch creation now honours an owner/manager's selected `baker_id` and continues to validate the worker's tenant through the existing repository. UI action results come from refreshed server records.

## Files

Main pages: `OwnerDashboardPage.jsx`, `OwnerAnalyticsPage.jsx`, `OwnerOrdersPage.jsx`, `OwnerProductionWorkspacePage.jsx`, `OwnerStockSuppliersPage.jsx`, and report navigation in `OwnerReportsWorkspacePage.jsx`.

Shared presentation: `frontend/src/components/owner/OwnerUI.jsx` and `frontend/src/styles/owner-workspace.css`.

Supporting changes: `frontend/src/hooks/usePolling.js`, `backend/src/controllers/batchController.js`, and the added baker-assignment regression in `backend/scripts/verify_reliability.js`.

## Executed checks

- Production frontend build: passed.
- Frontend lint: exit 0; the project still has warnings.
- Existing-record API/database regression suite: **26 checks passed** on an isolated copy, including saved baker assignment and rejection of cross-tenant workers.
- Browser: signed in to the running application and inspected dashboard, production, orders, stock and reports with the existing records. Verified order detail, batch planner and recipe estimates, goods-receipt dialog, threshold dialog, stock category filtering and yearly reporting.
- Phone-width browser: checked Reports, Production, Orders and Stock at a 390px viewport. Document content stayed within the viewport (382px content/client area); wide tables scroll inside their panels. Checked the mobile order detail and threshold dialogs. Viewport override was reset afterward.
- Browser console check: no captured errors in the final check.
- Final health: backend 200, SQLite connected, frontend 200. Project remains running on backend port 5000 and frontend port 5173.

Browser review did not approve real payments, start real batches or record stock changes. Workflow write tests used an isolated database. Phone-width checks are desktop-browser checks and do not certify physical Android/iOS installation.

Logs and screenshots: `docs/verification/ui-refinement/`.
