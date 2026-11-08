# Shared Customer & Staff Backend Integration Contract
**Universal Multi-Tenant Bakery Management Platform**  
**Document Version:** 1.0.0 (Authoritative)  
**Target Teams:** Team 1 (Customer Frontend / PWA) & Team 2 (Staff Operations & Owner Portal)

---

## 1. Executive Summary & Architectural Foundation

This document defines the strict, authoritative integration contract between the **Customer Portal (Team 1)** and the **Staff Operations & Owner Portal (Team 2)**. Both teams operate against the **exact same backend application, REST APIs, and database schema**.

### Core Guarantees:
1. **Single Backend Instance**: There is only ONE backend (`backend/src/`). Team 2 must NOT create a separate backend server or separate microservice for staff.
2. **Unified Data Entities**: Orders, payments, catalog products, QR codes, and customer feedback are shared real-time entities. An order created by a customer in Checkout is the exact same record that appears on the Staff Kitchen Display System (KDS) and Cashier POS.
3. **Strict Multi-Tenant Scoping**: The platform is multi-client white-label SaaS. Every operational entity has a non-nullable `business_id`. Data from Business A (e.g. Crumb & Co.) must NEVER leak to or be modifiable by Business B (e.g. French Loaf).
4. **Server-Authoritative Pricing & Logic**: The backend calculates all item prices, taxes (5% GST), delivery fees, and order totals. Client-submitted prices or payment totals are strictly discarded.

---

## 2. Unified Request/Response Protocol & Status Codes

All API endpoints across Customer, Staff, and Owner portals strictly adhere to the unified envelope.

### 2.1 Standard Success Envelope
```json
{
  "success": true,
  "data": { ... }
}
```

### 2.2 Standard Error Envelope
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE_STRING",
    "message": "Human-readable description without internal database traces."
  }
}
```

### 2.3 Standard HTTP Status Codes
| HTTP Status | Meaning | Typical Usage |
|---|---|---|
| `200 OK` | Request succeeded | Catalog fetches, profile updates, order queries, payment verification |
| `201 Created` | Entity successfully created | User registration, order placement, address creation, batch creation |
| `400 Bad Request` | Validation failure | Missing fields, non-positive quantities, invalid status transition |
| `401 Unauthorized` | Missing / invalid token | Missing `Authorization: Bearer <token>`, expired JWT |
| `403 Forbidden` | Access denied / cross-tenant violation | Customer accessing staff route, Staff from Business A accessing Business B data |
| `404 Not Found` | Entity does not exist | Invalid business slug, unknown order ID, missing product |
| `409 Conflict` | Unique constraint violation | Duplicate email/phone, duplicate order feedback submission |
| `500 Server Error` | Unhandled backend exception | Internal processing failure |

---

## 3. Authentication & Role-Based Access Control (RBAC)

### 3.1 Unified JWT Authentication
All authenticated endpoints require an HTTP header:
```http
Authorization: Bearer <jwt_token>
```
The JWT payload is signed with `JWT_SECRET` (HMAC-SHA256) and contains:
```json
{
  "id": 4,
  "email": "ananya.customer@gmail.com",
  "phone": "+91-98201-54321",
  "role": "customer",
  "business_id": 1,
  "iat": 1772522814,
  "exp": 1773127614
}
```

### 3.2 Role Hierarchy & Matrix
The system enforces 5 distinct roles:
1. `customer`: Regular customer patronizing a specific bakery.
2. `staff`: Counter, cashier, or delivery runner staff.
3. `baker`: Head baker or kitchen assistant responsible for batch production and inventory.
4. `manager`: Operations manager overseeing orders, stock, recipes, and complaints.
5. `owner`: Bakery owner with complete tenant administrative privileges.

| Functional Area | `customer` | `staff` | `baker` | `manager` | `owner` |
|---|:---:|:---:|:---:|:---:|:---:|
| Browse Public Catalog & Categories | Allowed | Allowed | Allowed | Allowed | Allowed |
| Place Order & Confirm UPI Payment | **Own Only** | Allowed | — | Allowed | Allowed |
| View Own Customer Orders | **Own Only** | — | — | — | — |
| View All Business Orders (KDS/POS) | Denied | **Tenant** | **Tenant** | **Tenant** | **Tenant** |
| Update Order Lifecycle Status | Denied | **Tenant** | **Tenant** | **Tenant** | **Tenant** |
| Verify Incoming UPI Payment | Denied | **Tenant** | — | **Tenant** | **Tenant** |
| Create / Edit Products & Categories | Denied | — | — | **Tenant** | **Tenant** |
| Log Raw Material Procurement (FIFO) | Denied | — | **Tenant** | **Tenant** | **Tenant** |
| Execute Production Batches & Deduct FIFO | Denied | — | **Tenant** | **Tenant** | **Tenant** |
| Log Wastage & Spoilage | Denied | **Tenant** | **Tenant** | **Tenant** | **Tenant** |
| Manage QR Codes | Denied | — | — | **Tenant** | **Tenant** |
| View Customer Feedback & Complaints | Own Only | **Tenant** | **Tenant** | **Tenant** | **Tenant** |

---

## 4. Multi-Tenant Scoping Rules (CRITICAL SECURITY)

### 4.1 Non-Negotiable Tenant Rules
1. **Zero Cross-Tenant Leakage**: Every query for orders, products, inventory, production batches, payments, and customers must filter by `business_id`.
2. **Context Resolution**:
   - For authenticated users: `req.user.business_id` is the **sole authoritative business ID**. Client headers cannot override this.
   - For unauthenticated customer browsing: The business is resolved via URL slug (`/api/business/:slug`, `/b/:slug`), `X-Business-Slug` header, or `?businessSlug=` query parameter.
3. **Cross-Tenant Attack Rejections**:
   - Customer from Business 1 attempting to order a product from Business 2: Returns `403 CROSS_TENANT_PRODUCT`.
   - Staff from Business 2 attempting to view Order #1 from Business 1: Returns `404 ORDER_NOT_FOUND` (or `403 FORBIDDEN_RESOURCE`).
   - Staff from Business 1 attempting to verify Payment #10 from Business 2: Returns `404 PAYMENT_NOT_FOUND`.
   - Baker from Business 1 attempting to deduct raw materials from Business 2: Returns `403 CROSS_TENANT_INVENTORY`.

---

## 5. Authoritative API Contracts

### 5.1 Authentication API

#### `POST /api/auth/register`
- **Access**: Public
- **Allowed Roles**: Any (creates `customer` by default)
- **Request Body**:
  ```json
  {
    "businessSlug": "crumbandco",
    "name": "Ananya Nair",
    "email": "ananya.customer@gmail.com",
    "phone": "+91-98201-54321",
    "password": "Password@123"
  }
  ```
- **Response (201 Created)**: Returns `{ token, user, business }`.
- **Database Entities**: `users`, `businesses`.

#### `POST /api/auth/login`
- **Access**: Public
- **Allowed Roles**: All (`customer`, `staff`, `baker`, `manager`, `owner`)
- **Request Body**:
  ```json
  {
    "businessSlug": "crumbandco",
    "identifier": "ananya.customer@gmail.com",
    "password": "Password@123"
  }
  ```
- **Response (200 OK)**: Returns `{ token, user, business }`.
- **Database Entities**: `users`, `businesses`.

#### `GET /api/auth/me`
- **Access**: Authenticated (`Bearer <token>`)
- **Allowed Roles**: All
- **Response (200 OK)**: Returns current authenticated user and business context.

---

### 5.2 Business & Branding API

#### `GET /api/business/:slug`
- **Access**: Public
- **Allowed Roles**: All
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "id": 1,
      "name": "Crumb & Co.",
      "slug": "crumbandco",
      "logo_url": "/assets/logos/crumbandco.svg",
      "branding": {
        "primary_color": "#5A3825",
        "secondary_color": "#8B5A2B",
        "accent_color": "#D96C8A"
      },
      "currency": "INR",
      "currency_symbol": "₹",
      "timezone": "Asia/Kolkata",
      "contact_phone": "+91 98765 43210",
      "contact_email": "order@crumbandco.in",
      "address_line1": "Flat 402, Sea Breeze, Carter Road, Bandra West",
      "city": "Mumbai",
      "postal_code": "400050",
      "fssai_license": "12245087001234",
      "upi_vpa": "crumbandco@hdfcbank",
      "is_active": true
    }
  }
  ```
- **Security Rule**: Sensitive fields (`password_hash`, internal notes, secret keys) are NEVER returned.
- **Database Entities**: `businesses`.

---

### 5.3 Universal QR Resolution API

#### `GET /api/qr/:uniqueCode`
- **Access**: Public
- **Allowed Roles**: All
- **Request Parameters**: `:uniqueCode` (e.g., `QR-CRUMB-TBL-01`, `QR-CRUMB-PAY-COUNTER`)
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "uniqueCode": "QR-CRUMB-TBL-01",
      "qrType": "table_order",
      "locationTag": "Table 1 (Indoor)",
      "targetUrl": "/b/crumbandco?table=1",
      "isActive": true,
      "business": {
        "id": 1,
        "name": "Crumb & Co.",
        "slug": "crumbandco",
        "currency": "INR"
      }
    }
  }
  ```
- **Error Codes**: `404 QR_NOT_FOUND`, `400 QR_INACTIVE`, `404 BUSINESS_NOT_FOUND`.
- **Database Entities**: `qr_codes`, `businesses`.

---

### 5.4 Catalog & Categories API

#### `GET /api/categories`
- **Access**: Public (Business-Scoped)
- **Query Params**: `?businessSlug=crumbandco` or `X-Business-Slug`
- **Response (200 OK)**: Array of categories belonging to `business_id`.
- **Database Entities**: `categories`.

#### `GET /api/products`
- **Access**: Public (Business-Scoped)
- **Query Params**: `categoryId`, `isAvailable`, `isFeatured`, `businessSlug`
- **Response (200 OK)**: Array of products with nested variants.
- **Database Entities**: `products`, `product_variants`.

#### `GET /api/products/:id`
- **Access**: Public (Business-Scoped)
- **Response (200 OK)**: Single product with variants, descriptions, allergens, and shelf life.
- **Error Codes**: `404 PRODUCT_NOT_FOUND`.
- **Database Entities**: `products`, `product_variants`.

---

### 5.5 Orders & Checkout API (Shared Customer & Staff)

#### `POST /api/orders` (Order Placement)
- **Access**: Authenticated (`Bearer <token>`)
- **Allowed Roles**: `customer` (or staff on behalf of customer)
- **Request Body**:
  ```json
  {
    "order_type": "delivery",
    "address_id": 1,
    "delivery_time_slot": "Now (30-45 mins)",
    "payment_method": "QR_UPI",
    "special_instructions": "Pack warm please",
    "table_tag": null,
    "qr_code": null,
    "items": [
      {
        "product_id": 2,
        "product_variant_id": 2,
        "quantity": 2
      }
    ]
  }
  ```
- **Server Responsibilities**:
  1. Validates that every `product_id` belongs to `req.user.business_id`.
  2. Queries authoritative unit prices from repository/database.
  3. Calculates `subtotal`, `delivery_fee` (₹40 for delivery, ₹0 for pickup/dine_in), `tax_amount` (5% GST), and `total_amount`.
  4. Generates unique order number: `ORD-<business_id>-<seq>-<hash>`.
  5. Sets initial `order_status = 'Order Placed'`.
  6. Sets initial `payment_status = 'Pending Verification'` (for UPI/Online) or `'Unpaid'` (for Cash on Delivery).
  7. Inserts initial history row in `order_status_history`.
  8. Creates linked `payments` record with `status = 'Pending Verification'` or `'Initiated'`.
- **Response (201 Created)**: Returns authoritative order with items and payment stub.
- **Database Entities**: `orders`, `order_items`, `payments`, `order_status_history`.

#### `GET /api/orders` (Order Listing)
- **Access**: Authenticated (`Bearer <token>`)
- **Role-Aware Behavior**:
  - If `role === 'customer'`: Returns ONLY orders where `customer_id = req.user.id AND business_id = req.user.business_id`.
  - If `role IN ('staff', 'baker', 'manager', 'owner')`: Returns ALL orders where `business_id = req.user.business_id`.
- **Response (200 OK)**: Array of orders with items, current payment status, and table tags.

#### `GET /api/orders/:id` (Order Details & Tracking)
- **Access**: Authenticated (`Bearer <token>`)
- **Authorization**:
  - Customer can ONLY access order if `order.customer_id === req.user.id AND order.business_id === req.user.business_id`.
  - Staff/Owner can access any order where `order.business_id === req.user.business_id`.
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "id": 1,
      "order_no": "ORD-CRUMB-1001",
      "business_id": 1,
      "customer_id": 4,
      "order_type": "delivery",
      "order_status": "In Production",
      "payment_status": "Paid",
      "payment_method": "QR_UPI",
      "subtotal": 360.00,
      "delivery_fee": 40.00,
      "tax_amount": 18.00,
      "total_amount": 418.00,
      "table_tag": null,
      "items": [
        {
          "id": 1,
          "product_id": 2,
          "name": "Butter Croissant",
          "quantity": 2,
          "unit_price": 180.00,
          "subtotal": 360.00,
          "batch_id": 1
        }
      ],
      "payment": {
        "id": 1,
        "payment_mode": "QR_UPI",
        "qr_reference_code": "UPI-UTR-CRUMB-99120",
        "amount_paid": 418.00,
        "status": "Verified"
      },
      "trackingHistory": [
        { "id": 1, "status": "Order Placed", "notes": "Customer placed order", "timestamp": "2026-10-04T10:00:00Z" },
        { "id": 2, "status": "Accepted", "notes": "Baker accepted", "timestamp": "2026-10-04T10:05:00Z" },
        { "id": 3, "status": "In Production", "notes": "Baking in deck ovens", "timestamp": "2026-10-04T10:15:00Z" }
      ]
    }
  }
  ```

#### `PATCH /api/orders/:id/status` (Staff Order State Transition)
- **Access**: Authenticated (`Bearer <token>`)
- **Allowed Roles**: `staff`, `baker`, `manager`, `owner`
- **Request Body**:
  ```json
  {
    "status": "In Production",
    "notes": "Croissants proofed and entered deck oven 2"
  }
  ```
- **Validation Rules**:
  - `status` must be one of the standard 8 lifecycle stages.
  - Order must belong to `req.user.business_id`.
  - Appends record to `order_status_history` with `updated_by = req.user.id`.
- **Response (200 OK)**: Returns updated order with new status.
- **Database Entities**: `orders`, `order_status_history`.

---

### 5.6 Payments & Verification API

#### `POST /api/payments/confirm` (Customer "I've Paid")
- **Access**: Authenticated (`Bearer <token>`)
- **Allowed Roles**: `customer`
- **Request Body**:
  ```json
  {
    "order_id": 2,
    "payment_mode": "QR_UPI",
    "qr_reference_code": "UPI-UTR-982103445"
  }
  ```
- **Behavior**:
  - Amount is locked to `order.total_amount`.
  - Sets `payment.status = 'Pending Verification'`.
  - Sets `order.payment_status = 'Pending Verification'`.
  - Customer CANNOT set status to `'Paid'` or `'Verified'`.
- **Response (200 OK)**: Returns updated payment and order summary.
- **Database Entities**: `payments`, `orders`.

#### `PUT /api/payments/:paymentId/verify` (Staff Payment Verification)
- **Access**: Authenticated (`Bearer <token>`)
- **Allowed Roles**: `staff`, `manager`, `owner`
- **Request Body**:
  ```json
  {
    "notes": "Verified incoming transfer in HDFC merchant portal"
  }
  ```
- **Behavior**:
  - Validates `payment.business_id === req.user.business_id`.
  - Updates `payments.status = 'Verified'`.
  - Updates parent `orders.payment_status = 'Paid'`.
- **Response (200 OK)**: Returns verified payment and updated order.
- **Database Entities**: `payments`, `orders`.

#### `GET /api/payments/order/:orderId`
- **Access**: Authenticated (`Bearer <token>`)
- **Allowed Roles**: Order owner customer, or staff/owner of same business.
- **Response (200 OK)**: Returns all payment attempts/records for the order.
- **Database Entities**: `payments`.

---

### 5.7 Customer Profile & Saved Addresses API

#### `GET /api/customers/me`
- **Access**: Authenticated (`Bearer <token>`)
- **Response (200 OK)**: Customer profile details, loyalty points (`crumbPoints`).
- **Database Entities**: `users`.

#### `GET /api/customers/me/addresses` & `POST /api/customers/me/addresses`
- **Access**: Authenticated (`Bearer <token>`)
- **Tenant Rules**: Filtered by `user_id = req.user.id AND business_id = req.user.business_id`.
- **Database Entities**: `customer_addresses`.

---

### 5.8 Customer Feedback & Quality Audit API

#### `POST /api/feedback`
- **Access**: Authenticated (`Bearer <token>`)
- **Allowed Roles**: `customer`
- **Request Body**:
  ```json
  {
    "orderId": 1,
    "rating": 5,
    "tasteRating": 5,
    "packagingRating": 5,
    "deliveryRating": 5,
    "comment": "Exceptionally flaky croissant and warm sourdough.",
    "batchId": 1
  }
  ```
- **Integrity Rules**:
  - Customer must own the order.
  - One review per order (prevents duplicate spam).
  - Optional `batchId` links review to `production_batches` for food safety root-cause analysis.
- **Response (201 Created)**: Returns saved feedback.
- **Database Entities**: `customer_feedback`, `orders`, `production_batches`.

#### `GET /api/feedback` (Staff/Owner Review Feed)
- **Access**: Authenticated (`Bearer <token>`)
- **Allowed Roles**: `staff`, `baker`, `manager`, `owner`
- **Tenant Rules**: Scoped strictly to `business_id = req.user.business_id`.
- **Response (200 OK)**: List of customer reviews and complaints.
- **Database Entities**: `customer_feedback`.

---

## 6. Staff & Owner Operational Contracts (Team 2 Direct Scope)

To ensure Team 2 builds clean, non-conflicting operational modules, the following endpoints are authoritatively mapped to existing database schema entities:

### 6.1 Inventory & FIFO Raw Materials
- `GET /api/inventory/raw-materials` (List materials, units, current stock, reorder levels).
- `POST /api/inventory/raw-materials` (Create new ingredient/packaging material).
- `POST /api/inventory/lots` (Receive supplier shipment, record vendor lot number, expiry date, initial quantity, unit cost).
- `GET /api/inventory/alerts` (List ingredients where `current_stock <= min_reorder_level` or lots near expiry).
- **Database Entities**: `raw_materials`, `raw_material_lots`, `suppliers`.

### 6.2 Recipes & Bill of Materials (BOM)
- `GET /api/recipes` (List recipes for business products).
- `POST /api/recipes` (Create recipe with scaling yield, bake time, proof time, and ingredient list).
- `GET /api/recipes/:id` (Full BOM with required ingredient quantities and scaling loss %).
- **Database Entities**: `recipes`, `recipe_ingredients`, `products`.

### 6.3 Production Batches & Baker Workflow
- `GET /api/production/batches` (List planned and active baking batches).
- `POST /api/production/batches` (Schedule batch: `batch_no`, `recipe_id`, `planned_quantity`, `scheduled_start`).
- `PATCH /api/production/batches/:id/status` (Transitions: `Planned` -> `In Production` -> `Completed` -> `Packaged`).
- `POST /api/production/batches/:id/consume-materials` (Consumes ingredients from oldest unexpired `raw_material_lots` via FIFO, records `unit_cost_at_time`, logs to `batch_materials_consumed`).
- `POST /api/production/batches/:id/log-labor` (Records baker user ID, hours spent, hourly rate, logs to `batch_workers`).
- **Database Entities**: `production_batches`, `batch_materials_consumed`, `batch_workers`, `raw_material_lots`.

### 6.4 Wastage & Spoilage Auditing
- `GET /api/wastage` (List all logged wastage with reasons and cost losses).
- `POST /api/wastage` (Log burnt bake, damaged pastry, or expired ingredient: `batch_id`, `material_id`, `wastage_type`, `quantity`, `estimated_cost_loss`, `reason`).
- **Database Entities**: `wastage_logs`.

---

## 7. Unified Order & Payment Lifecycles

### 7.1 Order Lifecycle State Machine
```text
           [Customer Checkout]
                    │
                    ▼
             1. Order Placed ─────────────┐
                    │                      │
                    ▼                      │
               2. Accepted                 │
                    │                      │
                    ▼                      │
             3. In Production              │ (Customer or Staff Cancellation)
                    │                      │
                    ▼                      │
             4. Quality Check              │
                    │                      │
                    ▼                      │
               5. Packaged                 │
                    │                      │
                    ▼                      ▼
           6. Out for Delivery       8. Cancelled
                    │
                    ▼
              7. Delivered
```

### 7.2 Payment Lifecycle State Machine
```text
     Customer Places Order (QR_UPI / Online)
                     │
                     ▼
         Order Payment: Pending Verification
         Payment Record: Pending Verification
                     │
                     │ (Customer transfers via GPay/PhonePe/Paytm)
                     ▼
         Customer clicks "I've Paid"
         (Sends qr_reference_code / UTR)
                     │
                     ▼
         Staff checks bakery bank/UPI app
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
    [Payment Matches]     [Payment Fails/Missing]
          │                     │
          ▼                     ▼
   Staff clicks "Verify"    Staff flags "Failed"
   Payment: Verified        Payment: Failed
   Order: Paid              Order: Unpaid
```

### 7.3 Universal QR Lifecycle
```text
  Physical Acrylic QR Code (e.g. Table 1 Indoor)
                     │
                     ▼ (Camera Scan)
          Route: /q/QR-CRUMB-TBL-01
                     │
                     ▼
       Backend: GET /api/qr/QR-CRUMB-TBL-01
                     │
                     ▼
       Returns: { business: Crumb & Co., locationTag: "Table 1 (Indoor)", qrType: "table_order" }
                     │
                     ▼
       Customer Browser lands on /b/crumbandco?table=1
                     │
                     ▼
       Header shows "Table 1 (Indoor)" station badge
                     │
                     ▼
       Checkout automatically pre-fills "dine_in" and attaches table context to Order
```

---

## 8. Single Source of Truth & Repository Audit

| Business Domain | Authoritative Model / File | Database Table | Status | In-Memory Fallback Behavior |
|---|---|---|---|---|
| **Tenants / Bakeries** | `businessRepository.js` | `businesses` | **Verified** | In-memory `memoryBusinesses` used when DB offline |
| **Users & Roles** | `userRepository.js` | `users` | **Verified** | In-memory `memoryUsers` used when DB offline |
| **Catalog & Products** | `catalogRepository.js` | `categories`, `products`, `product_variants` | **Verified** | In-memory `memoryProducts`, `memoryCategories` |
| **Universal QR Codes** | `qrRepository.js` | `qr_codes` | **Verified** | In-memory `memoryQrCodes` |
| **Orders & Items** | `orderRepository.js` | `orders`, `order_items`, `order_status_history` | **Verified** | In-memory `memoryOrders`, `memoryOrderItems` |
| **Payments** | `paymentRepository.js` | `payments` | **Verified** | In-memory `memoryPayments` |
| **Customer Addresses** | `addressRepository.js` | `customer_addresses` | **Verified** | In-memory `memoryAddresses` |
| **Customer Feedback** | `feedbackRepository.js` | `customer_feedback` | **Verified** | In-memory `memoryFeedback` |
| **Raw Materials & FIFO** | Defined in Schema | `raw_materials`, `raw_material_lots` | **Schema Ready** | Dedicated repository to be added by Team 2 |
| **Recipes & BOM** | Defined in Schema | `recipes`, `recipe_ingredients` | **Schema Ready** | Dedicated repository to be added by Team 2 |
| **Production Batches** | Defined in Schema | `production_batches`, `batch_materials_consumed`, `batch_workers` | **Schema Ready** | Dedicated repository to be added by Team 2 |
| **Wastage & Spoilage** | Defined in Schema | `wastage_logs` | **Schema Ready** | Dedicated repository to be added by Team 2 |

### Seamless PostgreSQL Transition
Every repository in `backend/src/models/` implements the dual-mode pattern:
```javascript
try {
  const res = await db.query('SELECT ... FROM table WHERE business_id = $1', [businessId]);
  return res.rows;
} catch (err) {
  if (process.env.NODE_ENV === 'test' || err.code === 'ECONNREFUSED' || !err.code) {
    // In-memory fallback allows tests and UI development without local PostgreSQL server running
    return memoryStore.filter(...);
  }
  throw err;
}
```
When PostgreSQL credentials are provided via `.env` (`DATABASE_URL` or `PGUSER`/`PGPASSWORD`), all repositories immediately and automatically execute against PostgreSQL with zero code changes!

---

## 9. Food Safety & FIFO Batch Traceability Bridge

The backend schema provides complete bi-directional traceability between Customer Orders and Kitchen Production:

```text
[Supplier Shipment]
       │
       ▼ (supplier_lot_no, expiry_date)
[raw_material_lots]
       │
       ▼ (FIFO Consumption in batch_materials_consumed)
[production_batches] (batch_no)
       │
       ├─────────────────────────────────┐
       ▼                                 ▼
[order_items.batch_id]         [customer_feedback.batch_id]
 (Customer buys item)           (Customer reviews item / complaint)
```

If a customer logs a quality complaint ("Sour smell in sourdough"), the kitchen can immediately trace from `customer_feedback.batch_id` -> `production_batches` -> `batch_materials_consumed` -> `raw_material_lots` -> `suppliers` to recall affected batches or hold contaminated flour lots.

---

## 10. Database Schema Blocker Audit & Resolution

### Resolved Blocker: `orders.order_type` Constraint
- **Issue Discovered**: In `database/schema.md`, the `orders.order_type` check constraint was originally defined as:
  ```sql
  CHECK (order_type IN ('pickup', 'delivery'))
  ```
  However, Customer QR Table Ordering requires `order_type = 'dine_in'`.
- **Resolution Applied**: The contract and schema definition were updated to:
  ```sql
  CHECK (order_type IN ('pickup', 'delivery', 'dine_in'))
  ```
  This ensures that connecting PostgreSQL will not reject table orders created via QR codes.

### Foreign Key & Integrity Checklist
- [x] All operational tables contain `business_id` referencing `businesses(id) ON DELETE CASCADE`.
- [x] `orders` references `users(id)` and `customer_addresses(id)`.
- [x] `order_items` references `orders(id)`, `product_variants(id)`, and nullable `production_batches(id)`.
- [x] `payments` references `businesses(id)` and `orders(id)`.
- [x] `customer_feedback` references `businesses(id)`, `orders(id)`, `users(id)`, and nullable `production_batches(id)`.
- [x] `production_batches` contains unique scoped constraint: `UNIQUE(business_id, batch_no)`.
- [x] `orders` contains unique scoped constraint: `UNIQUE(business_id, order_no)`.
- [x] `categories` contains unique scoped constraint: `UNIQUE(business_id, slug)`.
- [x] `products` contains unique scoped constraint: `UNIQUE(business_id, slug)`.

---

## 11. Team 2 Checklist for Integration

When Team 2 commences building the Staff Operations (KDS, Inventory, Recipes, Batches) and Owner Portals:
1. **Reuse Existing Route Handlers**: Use the existing `orderRoutes.js` and `paymentRoutes.js` endpoints rather than creating duplicate order paths.
2. **Mount Staff Endpoints Under Scoped Middleware**: Ensure all new staff routes use `requireAuth` and `requireRole('staff', 'baker', 'manager', 'owner')`.
3. **Always Scope by `req.user.business_id`**: Never accept `business_id` from client request bodies for authenticated operations.
4. **Preserve Status Strings**: Use the exact case-sensitive status strings defined in this contract (`Order Placed`, `Accepted`, `In Production`, `Quality Check`, `Packaged`, `Out for Delivery`, `Delivered`, `Cancelled`).
5. **No Second Payment System**: Verification MUST update the existing `payments` and `orders` tables via `paymentRepository.updatePaymentStatus` and `orderRepository.updateOrderStatus`.
