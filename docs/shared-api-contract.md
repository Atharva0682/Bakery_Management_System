# Shared REST API Contract Specification
**Universal Multi-Tenant Bakery Management Platform**

---

## 1. Unified Response Envelope

All API endpoints across Customer, Staff, and Owner portals adhere strictly to the standardized JSON envelope.

### Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE_STRING",
    "message": "Human-readable description without database traces."
  }
}
```

---

## 2. Standard HTTP Status Codes

| Code | Meaning | Example Trigger |
|---|---|---|
| `200 OK` | Request succeeded | Login, profile fetch, catalog query |
| `201 Created` | Entity created | Customer registered, order placed, address created |
| `400 Bad Request` | Missing or invalid request payload | Negative quantity, invalid body parameters |
| `401 Unauthorized` | Missing, expired, or invalid token | Bearer token absent or invalid signature |
| `403 Forbidden` | Valid token, but role or tenant violation | Customer accessing owner route; cross-tenant query |
| `404 Not Found` | Target entity does not exist | Bakery slug not found, product ID does not exist |
| `409 Conflict` | Unique constraint violation | Phone number or email already in use, duplicate review |
| `500 Server Error` | Unhandled backend exception | Infrastructure or unhandled logic error |

---

## 3. Implemented Authentication Endpoints

### `POST /api/auth/register`
Creates a new customer account attached to a specific bakery.

- **Authentication**: None (Public)
- **Role**: Any
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "businessSlug": "crumbandco",
    "name": "Ananya Nair",
    "email": "ananya.nair@gmail.com",
    "phone": "+91 98201 54321",
    "password": "Password@123"
  }
  ```
- **Success Response (201)**:
  ```json
  {
    "success": true,
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI...",
      "user": {
        "id": 4,
        "business_id": 1,
        "name": "Ananya Nair",
        "email": "ananya.nair@gmail.com",
        "phone": "+91 98201 54321",
        "role": "customer"
      },
      "business": {
        "id": 1,
        "name": "Crumb & Co.",
        "slug": "crumbandco",
        "currency": "INR"
      }
    }
  }
  ```

---

### `POST /api/auth/login`
Authenticates an existing user across any role (`customer`, `staff`, `baker`, `manager`, `owner`).

- **Authentication**: None (Public)
- **Role**: Any
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "businessSlug": "crumbandco",
    "identifier": "ananya.nair@gmail.com",
    "password": "Password@123"
  }
  ```
- **Success Response (200)**:
  ```json
  {
    "success": true,
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI...",
      "user": {
        "id": 4,
        "business_id": 1,
        "name": "Ananya Nair",
        "email": "ananya.nair@gmail.com",
        "phone": "+91 98201 54321",
        "role": "customer"
      },
      "business": {
        "id": 1,
        "name": "Crumb & Co.",
        "slug": "crumbandco",
        "currency": "INR"
      }
    }
  }
  ```

---

### `GET /api/auth/me`
Retrieves the verified user profile for the current bearer token.

- **Authentication**: Required (`Bearer <token>`)
- **Role**: Any
- **Success Response (200)**:
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": 4,
        "business_id": 1,
        "name": "Ananya Nair",
        "email": "ananya.nair@gmail.com",
        "phone": "+91 98201 54321",
        "role": "customer"
      },
      "business": {
        "id": 1,
        "name": "Crumb & Co.",
        "slug": "crumbandco",
        "currency": "INR"
      }
    }
  }
  ```

---

## 4. Customer API Foundation Endpoints

### 4.1 Business API

#### `GET /api/business/:slug`
Fetches sanitized public branding and metadata for a bakery by its URL slug.
- **Authentication**: Public
- **Role**: Any
- **Tenant Rules**: Resolves business by `:slug`. Only returns safe public fields. Never exposes credentials, hashes, or internal secrets.
- **Success Response (200)**:
  ```json
  {
    "success": true,
    "data": {
      "id": 1,
      "name": "Crumb & Co.",
      "slug": "crumbandco",
      "logo_url": "/assets/brand/crumb-logo.svg",
      "branding": {
        "primary_color": "#D97706",
        "secondary_color": "#78350F",
        "font_family": "Plus Jakarta Sans"
      },
      "currency": "INR",
      "currency_symbol": "₹",
      "timezone": "Asia/Kolkata",
      "contact_phone": "+91 98765 43210",
      "contact_email": "hello@crumbandco.in",
      "address": "12, Baker Street, Indiranagar, Bengaluru, Karnataka 560038",
      "is_active": true
    }
  }
  ```
- **Error Codes**:
  - `404 BUSINESS_NOT_FOUND`: Business with the provided slug does not exist or is inactive.

---

### 4.2 Customer Catalog APIs

#### `GET /api/categories`
Fetches active categories for the resolved business tenant.
- **Authentication**: Public / Business-aware
- **Role**: Any
- **Tenant Rules**: Scoped via `X-Business-Slug`, query param `?businessSlug=`, or authenticated user. Products/categories never cross businesses.
- **Success Response (200)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 1,
        "business_id": 1,
        "name": "Sourdough & Artisanal Breads",
        "slug": "sourdough-artisanal",
        "description": "Slow-fermented wild yeast loaves baked daily.",
        "display_order": 1,
        "is_active": true
      }
    ]
  }
  ```

#### `GET /api/products`
Fetches products for the resolved business with optional category and availability filtering.
- **Authentication**: Public / Business-aware
- **Role**: Any
- **Query Parameters**:
  - `categoryId` (optional): Filter products by category ID.
  - `isAvailable` (optional): Filter by stock availability (`true`/`false`).
  - `isFeatured` (optional): Filter featured items (`true`/`false`).
- **Success Response (200)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 1,
        "business_id": 1,
        "category_id": 1,
        "name": "Rustic Country Sourdough",
        "slug": "rustic-country-sourdough",
        "base_price": 280,
        "description": "36-hour slow fermented artisanal sourdough loaf with crispy blistered crust.",
        "image_url": "/assets/products/sourdough.jpg",
        "is_available": true,
        "is_featured": true,
        "variants": [
          { "id": 1, "name": "500g Loaf", "price": 280, "sku": "CRUMB-SD-500", "is_available": true },
          { "id": 2, "name": "800g Boule", "price": 420, "sku": "CRUMB-SD-800", "is_available": true }
        ]
      }
    ]
  }
  ```

#### `GET /api/products/:id`
Fetches complete product details including variants and dietary attributes.
- **Authentication**: Public / Business-aware
- **Tenant Rules**: Product must belong to resolved business.
- **Success Response (200)**:
  ```json
  {
    "success": true,
    "data": {
      "id": 1,
      "business_id": 1,
      "name": "Rustic Country Sourdough",
      "base_price": 280,
      "variants": [...]
    }
  }
  ```
- **Error Codes**:
  - `404 PRODUCT_NOT_FOUND`: Product does not exist or belongs to another business.

---

### 4.3 Customer Profile & Addresses

#### `GET /api/customers/me`
Retrieves authenticated customer profile.
- **Authentication**: Required (`Bearer <token>`)
- **Role**: `customer` (or staff/owner acting for customer)
- **Success Response (200)**:
  ```json
  {
    "success": true,
    "data": {
      "id": 4,
      "business_id": 1,
      "name": "Ananya Nair",
      "email": "ananya.nair@gmail.com",
      "phone": "+91 98201 54321",
      "role": "customer",
      "crumbPoints": 1240
    }
  }
  ```

#### `PUT /api/customers/me`
Updates customer personal profile details.
- **Authentication**: Required (`Bearer <token>`)
- **Role**: `customer`
- **Request Body**:
  ```json
  {
    "name": "Ananya Nair",
    "phone": "+91 98201 54321"
  }
  ```

#### `GET /api/customers/me/addresses`
Retrieves all delivery addresses saved by the customer for this business.
- **Authentication**: Required (`Bearer <token>`)
- **Role**: `customer`
- **Tenant Rules**: Scoped to `user.id` AND `user.business_id`. Customer A cannot access Customer B's addresses.
- **Success Response (200)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 1,
        "customer_id": 4,
        "business_id": 1,
        "label": "Home",
        "address_line1": "Flat 402, Sunshine Heights",
        "address_line2": "12th Main, HAL 2nd Stage",
        "city": "Bengaluru",
        "postal_code": "560038",
        "is_default": true
      }
    ]
  }
  ```

#### `POST /api/customers/me/addresses`
Adds a new delivery address for the authenticated customer.
- **Authentication**: Required (`Bearer <token>`)
- **Role**: `customer`
- **Request Body**:
  ```json
  {
    "label": "Office",
    "address_line1": "Tower B, Prestige Tech Park",
    "city": "Bengaluru",
    "postal_code": "560103",
    "is_default": false
  }
  ```

#### `PUT /api/customers/me/addresses/:id`
Updates an existing address owned by the authenticated customer.
- **Authentication**: Required (`Bearer <token>`)
- **Role**: `customer`

#### `DELETE /api/customers/me/addresses/:id`
Deletes an address owned by the authenticated customer.
- **Authentication**: Required (`Bearer <token>`)
- **Role**: `customer`
- **Error Codes**:
  - `404 ADDRESS_NOT_FOUND`: Target address does not exist or belongs to another customer.

---

### 4.4 Orders & Lifecycle

#### `POST /api/orders`
Creates and places a new customer order.
- **Authentication**: Required (`Bearer <token>`)
- **Role**: `customer`
- **Security & Integrity Rules**:
  - Backend recalculates trusted unit price and total from database/repository.
  - Client-submitted totals or unit prices are completely ignored.
  - Cross-tenant product items are strictly rejected (`403 CROSS_TENANT_PRODUCT`).
  - Items with invalid/out-of-stock products or non-positive quantities are rejected.
- **Request Body**:
  ```json
  {
    "orderType": "delivery",
    "deliveryAddressId": 1,
    "deliveryNotes": "Leave at front door",
    "items": [
      {
        "productId": 1,
        "variantId": 1,
        "quantity": 2
      }
    ]
  }
  ```
- **Success Response (201)**:
  ```json
  {
    "success": true,
    "data": {
      "id": 101,
      "order_number": "ORD-1772522814881-866",
      "business_id": 1,
      "customer_id": 4,
      "status": "ORDER_PLACED",
      "order_type": "delivery",
      "subtotal": 560,
      "tax_amount": 28,
      "delivery_fee": 50,
      "total_amount": 638,
      "items": [
        {
          "product_id": 1,
          "variant_id": 1,
          "name": "Rustic Country Sourdough",
          "unit_price": 280,
          "quantity": 2,
          "subtotal": 560
        }
      ],
      "created_at": "2026-10-03T12:46:54.881Z"
    }
  }
  ```
- **Order Lifecycle Statuses**:
  - `ORDER_PLACED` (Initial status upon creation)
  - `ACCEPTED`
  - `IN_PRODUCTION`
  - `QUALITY_CHECK`
  - `PACKAGED`
  - `OUT_FOR_DELIVERY`
  - `DELIVERED`
  - `CANCELLED`

#### `GET /api/orders`
Retrieves customer's own order history.
- **Authentication**: Required (`Bearer <token>`)
- **Role**: `customer`
- **Tenant Rules**: Returns orders matching `customer_id = user.id` AND `business_id = user.business_id`.

#### `GET /api/orders/:id`
Retrieves single order details and tracking status.
- **Authentication**: Required (`Bearer <token>`)
- **Role**: `customer` (or authorized staff/owner)
- **Security Rules**:
  - Customer A cannot access Customer B's order (`403 FORBIDDEN_ORDER_ACCESS`).
  - Order must belong to the active business tenant.

---

### 4.5 Customer Feedback API

#### `POST /api/feedback`
Submits product and experience review for a completed order.
- **Authentication**: Required (`Bearer <token>`)
- **Role**: `customer`
- **Validation Rules**:
  - Customer must own the order referenced by `orderId`.
  - Order must belong to customer's active business.
  - Duplicate reviews for the same order are rejected (`409 DUPLICATE_FEEDBACK`).
  - Awards 50 loyalty points upon verified feedback submission.
- **Request Body**:
  ```json
  {
    "orderId": 101,
    "rating": 5,
    "tasteRating": 5,
    "packagingRating": 5,
    "deliveryRating": 5,
    "comment": "Super fresh and aromatic sourdough bread!"
  }
  ```
- **Success Response (201)**:
  ```json
  {
    "success": true,
    "data": {
      "id": 1,
      "order_id": 101,
      "customer_id": 4,
      "business_id": 1,
      "rating": 5,
      "points_awarded": 50,
      "created_at": "2026-10-03T12:46:55.100Z"
    }
  }
  ```

#### `GET /api/feedback/mine`
Retrieves all feedback submitted by the authenticated customer.
- **Authentication**: Required (`Bearer <token>`)
- **Role**: `customer`

---

### 4.6 Universal QR Code & Routing Engine

#### `GET /api/qr/:uniqueCode`
Resolves universal bakery QR codes to active business and table/station ordering context.
- **Authentication**: Public
- **Role**: Any
- **Supported QR Types**:
  - `table_order` (Customer sitting at a physical table with `locationTag` e.g. "Table 1 (Indoor)")
  - `counter_pickup` (Express pickup station / counter)
  - `direct_payment` (Cashier billing counter QR)
  - `digital_menu` (View-only contactless catalog)
  - `custom`
- **Security Validation Rules**:
  - Validates `uniqueCode` exists in database/repository.
  - Rejects deactivated QR codes (`400 QR_INACTIVE`).
  - Rejects inactive or missing businesses (`404 BUSINESS_NOT_FOUND`).
  - Increments scan telemetry counter in backend.
  - Returns parent business tenant metadata so frontend binds strictly to the authentic business.
- **Success Response (200)**:
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
        "logoUrl": "/assets/logos/crumbandco.svg",
        "branding": {
          "primaryColor": "#5A3825",
          "secondaryColor": "#8B5A2B",
          "accentColor": "#D96C8A"
        },
        "currency": "INR",
        "currencySymbol": "₹",
        "timezone": "Asia/Kolkata"
      }
    }
  }
  ```
- **Error Codes**:
  - `404 QR_NOT_FOUND`: Target QR code does not exist.
  - `400 QR_INACTIVE`: QR code has been disabled by bakery management.
  - `400 INVALID_QR_TYPE`: QR type is unrecognized.
  - `404 BUSINESS_NOT_FOUND`: Associated bakery is unlisted or deactivated.

