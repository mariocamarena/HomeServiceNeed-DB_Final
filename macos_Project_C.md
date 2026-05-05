# HomeNeedsService.com — Final Project Report

**Course:** CSCI 6333 — Advanced Database Design and Implementation
**Project Title:** HomeNeedsService.com — An Online Marketplace for Home Services
**Group Name:** MacOs
**Group Captain:** Mario Camarena
**Group Members:** Oziel Sauceda, Mario Camarena
**Repository:** https://github.com/mariocamarena/HomeServiceNeed-DB_Final
**Deployment URL:** _to be filled in once Render deploy is live_
**Demo Login:** see Section 7 (Testing) below

---

## Table of Contents

1. Problem Description
2. Database Design
3. System Design
4. Implementation
5. Usability
6. Constraints and Security
7. Testing
8. Deployment
9. Contributions of Group Members
10. Conclusions
11. References
12. Appendix — Source Code Inventory

---

## 1. Problem Description

HomeNeedsService.com is an online marketplace that connects independent home-service providers with clients who need work done in or around their home. Today the two sides have a hard time finding each other: providers like Jane (house cleaning), Joe (plumbing), and Mike (HVAC + electrical) are skilled but lack a steady channel for new clients, while clients like Kassie, Paul, and Joey often need urgent or repeat help and struggle to find providers who are reliable, fairly priced, and within travel range.

The platform we built closes that gap end-to-end. A user can register as a provider, a client, or both. Providers create a profile (bio, home ZIP, travel radius, base rate) and pick the categories of work they offer. Clients post a service request that describes the job, the address, and a preferred time window. Providers browse the open requests in their area, propose a booking with a scheduled time and an agreed price, and the matched client confirms. Once the work is done the client pays through the platform and leaves a review, which then feeds back into the provider's average rating for future searches.

Trust and safety is built in from the start. Every provider can request an identity or background check; an admin reviews each request and either approves or rejects it. Approved checks flip the provider's status to **verified**, which is shown to clients on the search and profile pages. The system also enforces a number of one-to-one constraints — one booking per request, one payment per booking, one review per booking — so the audit trail of "who did what for whom and was it paid for" stays clean.

### 1.1 Marketplace Workflow (high level)

1. **Registration** — user creates an account, picks a role (`client`, `provider`, or `both`).
2. **Provider setup** — bio, home ZIP, travel radius, base rate, list of category offerings.
3. **Request posting** — client posts a service request (category, description, address, time window).
4. **Booking** — provider proposes a scheduled time + agreed price; system enforces one booking per request.
5. **Payment + Review** — payment recorded against the booking; client leaves a 1–5 rating that becomes part of the provider's reputation.
6. **Admin oversight** — admin views system stats, manages background checks, and curates the master list of service categories.

### 1.2 Changes from Parts A and B

Part A and Part B were built around AWS Aurora MySQL. For Part C we migrated the entire data layer to **PostgreSQL hosted on Supabase** so we could use a managed Postgres pooler, free tier, and tight integration with Render for deployment. The schema, ER design, and function-set decomposition documented in Part A and Part B carry over unchanged — only the dialect of the queries (Postgres parameter syntax `$1, $2, …` instead of MySQL `?, ?, …`) and the driver (`pg` instead of `mysql2`) changed. All 10 tables, 7 function sets, and the page hierarchy described in Part B are preserved.

---

## 2. Database Design

### 2.1 Entities and Relationships (recap from Part A)

The system uses 10 tables organized around three concept groups:

* **Identity** — `users`, `provider_profiles`, `client_profiles`, `background_checks`
* **Catalog** — `service_categories`, `provider_services` (many-to-many bridge)
* **Workflow** — `service_requests` → `bookings` → `payments` and `reviews`

| Table | Purpose | PK / Notable Constraints |
|---|---|---|
| `users` | Base account: name, email, phone, password hash, role | `user_id` PK, `email` UNIQUE, `role_type` CHECK in (`client`,`provider`,`both`,`admin`) |
| `provider_profiles` | Provider-only fields: bio, home ZIP, travel radius, base rate, verified status | `provider_id` PK *and* FK → `users.user_id` |
| `client_profiles` | Marker that a user is a client (so request rows always point to a real client) | `client_id` PK *and* FK → `users.user_id` |
| `background_checks` | Identity / background verification history per user | `check_id` PK, FK → `users.user_id` |
| `service_categories` | Master list of services (Plumbing, Cleaning, …) | `category_id` PK, `category_name` UNIQUE |
| `provider_services` | Bridge table: which providers offer which categories, with starting price + notes | Composite PK (`provider_id`,`category_id`) |
| `service_requests` | Client request: category, description, address, time window, status | `request_id` PK |
| `bookings` | The job: scheduled times, agreed price, booking status | `booking_id` PK, `request_id` UNIQUE FK |
| `payments` | One payment per booking | `payment_id` PK, `booking_id` UNIQUE FK |
| `reviews` | One review per booking, rating 1–5 + optional comment | `review_id` PK, `booking_id` UNIQUE FK |

### 2.2 Cardinality Highlights (with database enforcement)

* `users 1 → 0..1 provider_profiles` and `users 1 → 0..1 client_profiles` — enforced because each profile's PK *is* the user's `user_id`.
* `provider_profiles M ↔ N service_categories` via `provider_services`.
* `service_requests 1 → 0..1 bookings` — enforced by `bookings.request_id UNIQUE`.
* `bookings 1 → 0..1 payments` and `bookings 1 → 0..1 reviews` — enforced by UNIQUE FKs.
* `users 1 → 0..* background_checks` — a user may have multiple checks over time.

### 2.3 Constraints and Indexes

CHECK constraints exist on every status column (`role_type`, `service_requests.status`, `bookings.status`, `payments.status`, `payments.method`, `reviews.rating`, `background_checks.status`). Indexes cover the common lookup paths the application uses:

```
idx_service_requests_client / _category / _status
idx_bookings_provider / _status
idx_provider_services_category
idx_background_checks_user
```

The full DDL lives in `schema.sql`; the reproducible sample data lives in `seed.sql`.

### 2.4 Normalization

The schema is in 3NF: every non-key attribute depends on the whole key. Multi-valued attributes (e.g., a provider's many service categories) are factored out into a bridge table. Optional one-to-one extensions (provider details, client details) live in their own tables keyed by `user_id` rather than being null-padded on the main `users` table.

---

## 3. System Design

### 3.1 Architecture (three-tier)

| Tier | Module | Technology |
|---|---|---|
| Data | DataStore | PostgreSQL (Supabase managed Postgres, port 5432, pooler endpoint, SSL) |
| Logic | DataProcessing | Node.js + Express.js, `pg` driver, `bcrypt`, `express-session`, `connect-pg-simple` |
| UI | UserInterface | Server-rendered EJS shell + a single-page vanilla-JS panel router (`public/app.js`) talking to the JSON API |

The browser sends HTTP requests to Express. The route layer (`routes/api.js`) authenticates the session, validates input, calls the appropriate function set, and returns JSON. The function-set modules under `functions/` are the only code that talks to the database, and they always do so through the `ExecuteQuery` helper in `db.js`, which uses parameterized queries from the `pg` connection pool.

```
┌──────────┐  HTTP/JSON   ┌────────────────────────┐   pg pool   ┌──────────────┐
│ Browser  │ ───────────▶ │ Express + function sets│ ──────────▶ │ Postgres     │
│ (app.js) │ ◀─────────── │ (auth, retrieval, …)   │ ◀────────── │ (Supabase)   │
└──────────┘              └────────────────────────┘             └──────────────┘
```

### 3.2 Function Sets (DataProcessing)

The function-set decomposition from Part B is preserved one-to-one in the codebase:

| Function Set | File | Key Functions |
|---|---|---|
| User Authentication | `functions/auth.js` | `Authorize`, `RegisterUser`, `GetUserRole`, `CreateSession`, `DestroySession`, `ResetPassword` |
| Database Access | `db.js` | `ExecuteQuery` (parameterized), `pool` |
| Validation | `functions/validation.js` | `ValidateEmail`, `ValidateZipCode`, `ValidateRate`, `ValidateRadius`, `ValidateBookingDates`, `ValidateDateRange`, `ValidatePaymentAmount`, `ValidateRating`, `ValidatePassword` |
| Data Retrieval | `functions/dataRetrieval.js` | `ProviderSearchRetrieval`, `AllProvidersRetrieval`, `BookingDetailRetrieval`, `ProviderProfileRetrieval`, `ClientProfileRetrieval`, `ServiceRequestListRetrieval`, `OpenRequestsByCategory`, `BookingListRetrieval`, `ProviderReviewsRetrieval`, `CategoryListRetrieval`, `BackgroundCheckRetrieval`, `UserStatsRetrieval`, `AllUsersRetrieval`, `AllBackgroundChecksRetrieval` |
| Data Update | `functions/dataUpdate.js` | `CreateServiceRequest`, `UpdateProviderProfile`, `UpdateProviderServices`, `UpdateRequestStatus`, `DeleteServiceRequest`, `SubmitBackgroundCheck`, `UpdateCheckStatus`, `AddCategory`, `DeleteCategory` |
| Booking & Matching | `functions/bookingMatching.js` | `CreateBooking`, `UpdateBookingStatus` (cascades request status) |
| Payment & Review | `functions/paymentReview.js` | `ProcessPayment`, `SubmitReview` |

### 3.3 Route Map (UserInterface ↔ DataProcessing)

| HTTP Method + Route | Function(s) called | Returns / Effect |
|---|---|---|
| `GET /` | (static) | Renders the SPA shell (`views/index.ejs`) |
| `GET /health` | `ExecuteQuery` | DB liveness probe |
| `GET /api/me` | session lookup | Current user info |
| `POST /api/login` | `Authorize`, `CreateSession` | Sign in |
| `POST /api/register` | `RegisterUser`, `Authorize`, `CreateSession` | Create + sign in |
| `POST /api/logout` | `DestroySession` | Sign out |
| `GET /api/categories` | `CategoryListRetrieval` | Public catalog |
| `GET /api/providers` | `AllProvidersRetrieval` | Browse all providers |
| `GET /api/providers/search` | `ProviderSearchRetrieval` | Filter by category + ZIP + radius |
| `GET /api/providers/:id` | `ProviderProfileRetrieval` + `ProviderReviewsRetrieval` | Public provider page |
| `GET /api/dashboard/client` | `ServiceRequestListRetrieval` + `BookingListRetrieval` | Client dashboard payload |
| `GET /api/dashboard/provider` | `ProviderProfileRetrieval` + `BookingListRetrieval` + `ProviderReviewsRetrieval` | Provider dashboard payload |
| `GET /api/openRequests` | `OpenRequestsByCategory` (per category) | Open jobs for providers |
| `GET /api/booking/:id` | `BookingDetailRetrieval` | Full booking detail (with auth gate) |
| `POST /api/requests` | `CreateServiceRequest` | Insert request |
| `DELETE /api/requests/:id` | `DeleteServiceRequest` | Delete (only when still open) |
| `POST /api/requests/:id/status` | `UpdateRequestStatus` | Update request status |
| `POST /api/provider/profile` | `UpdateProviderProfile` | Update bio/zip/rate |
| `POST /api/provider/services` | `UpdateProviderServices` | Replace category list |
| `GET /api/provider/checks` | `BackgroundCheckRetrieval` | Provider's own checks |
| `POST /api/provider/checks` | `SubmitBackgroundCheck` | Provider requests check |
| `POST /api/bookings` | `CreateBooking` | Provider books a request |
| `POST /api/bookings/:id/status` | `UpdateBookingStatus` | Status transition (cascades to request) |
| `POST /api/payments` | `ProcessPayment` | Client pays |
| `POST /api/reviews` | `SubmitReview` | Client reviews |
| `GET /api/admin/stats` | `UserStatsRetrieval` | Admin overview |
| `GET /api/admin/users` | `AllUsersRetrieval` | All users |
| `GET /api/admin/checks` | `AllBackgroundChecksRetrieval` | All background-check records |
| `POST /api/admin/checks/:id/status` | `UpdateCheckStatus` | Approve / reject; cascades verified flag |
| `POST /api/admin/categories` | `AddCategory` | Add a service category |
| `DELETE /api/admin/categories/:id` | `DeleteCategory` | Remove an unused category |

### 3.4 Page Hierarchy (UserInterface)

* **Shared:** Home, Login, Register
* **Client:** Dashboard, New Request, Browse Providers (with category + ZIP + radius search), Booking Detail, Payment, Review
* **Provider:** Dashboard, Open Requests, Profile (bio/zip/rate + categories + background checks)
* **Admin:** Overview, Users, Background Checks (approve/reject), Categories (add/delete)

The whole UI is a single-page application: `views/index.ejs` is the shell and `public/app.js` is a small panel router that fetches JSON from the API and re-renders the content area in place.

### 3.5 Session and State Variables

Per Part B, the session keeps:

| Variable | Type | Description |
|---|---|---|
| `userId` | int | Logged-in user's ID |
| `role` | string | `client`, `provider`, `both`, or `admin` |
| `firstName` | string | For greeting in the UI |
| `ip` | string | Captured at login for audit |
| `loginTime` | datetime | Captured at login |

Sessions are stored in Postgres via `connect-pg-simple` (auto-creates the `session` table) so they survive server restarts.

---

## 4. Implementation

### 4.1 Tech Stack

* **Runtime:** Node.js 20+
* **Framework:** Express 4.21 (`express`, `express-session`, `connect-pg-simple`)
* **Database driver:** `pg` 8.13 with SSL + connection pooling
* **Hashing:** `bcrypt` 5.1
* **Templates:** `ejs` 3.1 (one shell template; the rest of the UI is JS-driven)

### 4.2 Repository Layout

```
HomeServiceNeed-DB_Final/
├── server.js                  # Express app entry
├── db.js                      # pg pool + ExecuteQuery wrapper
├── schema.sql                 # full DDL (10 tables + indexes)
├── seed.sql                   # reproducible sample data
├── functions/
│   ├── auth.js
│   ├── validation.js
│   ├── dataRetrieval.js
│   ├── dataUpdate.js
│   ├── bookingMatching.js
│   └── paymentReview.js
├── routes/
│   └── api.js                 # all JSON endpoints
├── views/
│   └── index.ejs              # SPA shell
├── public/
│   ├── app.js                 # client-side panel router
│   └── styles.css
├── scripts/
│   ├── test-connection.js     # connectivity smoke test
│   ├── test-functions.js      # function-set smoke test
│   ├── test-booking-flow.js   # end-to-end booking → pay → review
│   ├── test-partC-tasks.js    # 3 retrieval + 3 update tasks (this report, §7)
│   └── rehash-seed.js         # rehash placeholder seed passwords
├── render.yaml                # Render blueprint (deployment)
├── .env.example               # env template (real .env is gitignored)
└── package.json
```

### 4.3 Build / Run Locally

```bash
git clone https://github.com/mariocamarena/HomeServiceNeed-DB_Final.git
cd HomeServiceNeed-DB_Final
cp .env.example .env       # then fill in DATABASE_URL, SESSION_SECRET
npm install
# In Supabase SQL editor (or psql), run schema.sql then seed.sql
npm run db:rehash          # turns the seed placeholder hashes into bcrypt("Password123!")
npm start                  # http://localhost:3000
```

### 4.4 Source Code

All source is in the GitHub repo above. Per the rubric (item A.4) the implementation is included as part of the submission bundle — the entire repo (minus `node_modules/`) is attached alongside this document.

---

## 5. Usability

### 5.1 Visual Design Principles

* **One consistent layout.** A fixed top bar (brand + signed-in identity) and a left rail with grouped tabs that change based on the user's role (`out`, `client`, `provider`, `both`, `admin`). The rail eliminates the need for users to remember URLs.
* **Status feedback.** Every action surface has an `#msg` slot for inline success / error feedback, and a persistent "status" line at the bottom of the page (`ready`, `loading…`, `error`) so users always know the system state.
* **Keyboard-friendly forms.** All forms use native `<input>` with HTML5 validation (`required`, `pattern="\d{5}"` for ZIP, `min`/`max` for radius and rate, `type="datetime-local"` for date pickers, `type="email"` for emails) so the browser catches obvious mistakes before the round trip.
* **Read where you act.** The booking detail page combines the booking summary, status update, payment form, and review form in one place — no navigation needed to complete the post-job workflow.
* **Confirm destructive actions.** `confirm("delete request #N?")` and `confirm("delete category 'X'?")` prompts on delete operations.

### 5.2 Client-Side Behaviors

The client-side code in `public/app.js` does the work that would otherwise need a page reload:

* Re-renders the relevant panel after every successful action (e.g., creating a request switches to the dashboard).
* Hydrates the session on page load with `GET /api/me` so refreshes don't kick the user out.
* Switches the visible navigation tabs on login/logout.
* Disables payment and review buttons unless the booking state allows them (paid? completed? review already submitted?).

### 5.3 Role-Aware Navigation

Each role sees a different set of tabs, but the same underlying components:

* Logged-out: Home, Browse, Sign in, Register.
* Client: Dashboard, New request, Browse, Profile.
* Provider: Dashboard, Open requests, Profile (with background-check section).
* Both: superset of client + provider.
* Admin: Overview, Users, Background checks, Categories.

### 5.4 Error Handling

The API always returns `{ "error": "human-readable message" }` with the appropriate HTTP status. The UI surfaces those messages in the same `#msg` slot so the user can correct the input without losing context.

---

## 6. Constraints and Security

### 6.1 Database Constraints (defense in depth)

| Constraint | Where | Why |
|---|---|---|
| `users.email UNIQUE` | DDL | Prevents duplicate accounts even if the app layer races. |
| `bookings.request_id UNIQUE` | DDL | Enforces "one booking per request" — the application *also* checks but the DB is final. |
| `payments.booking_id UNIQUE`, `reviews.booking_id UNIQUE` | DDL | One payment / one review per booking. |
| `CHECK` on every status column | DDL | Status fields can never hold an invalid value. |
| `ON DELETE CASCADE` on dependent FKs | DDL | Deleting a user cleans up their profile rows; deleting a request cleans up its booking. |
| Validation functions | `functions/validation.js` | Stops bad input before it reaches SQL (ZIP, email, rate range, radius, rating, dates, payment amount equals agreed price). |

### 6.2 Application Security

* **Parameterized queries everywhere.** The `ExecuteQuery` helper passes user input as bound parameters; we never build SQL via string concatenation, so the system is not exposed to SQL injection.
* **Bcrypt password hashing.** Passwords are hashed with `bcrypt` (cost 10) before insertion, and we compare with `bcrypt.compare` on login. The plaintext is never stored or logged.
* **Role-based route guards.** The `requireAuth` and `requireRole(...)` middleware in `routes/api.js` block routes that the current user's role doesn't allow. `both` is treated as both client and provider; `admin` has its own routes.
* **Booking ownership check.** `GET /api/booking/:id` returns 403 unless the requester is the client on the request, the provider on the booking, or an admin.
* **Session storage in Postgres.** Sessions live in a server-side table, not the browser, so a stolen cookie cannot be re-used after `/logout` (which destroys the row).
* **Secure cookie in production.** `cookie.secure` flips on when `NODE_ENV=production`, requiring HTTPS for cookie transmission. `sameSite: 'lax'` protects against CSRF on non-GET routes.
* **TLS to the database.** The `pg` pool connects to Supabase with `ssl: { rejectUnauthorized: false }` so credentials and query traffic are encrypted in transit.
* **Secret management.** The `.env` file holds `DATABASE_URL` and `SESSION_SECRET`; `.env` is in `.gitignore` and an `.env.example` template is committed in its place.

### 6.3 Constraints from the Project Spec

* The system is reachable from any modern browser.
* All input validation runs on both client (HTML5 attributes) and server (Validation function set) so disabling JS does not bypass checks.
* The deployment is intended for a free-tier Render web service, which means cold starts of ~30 seconds are possible after idle periods.

---

## 7. Testing

Per the Part C rubric (item A.6), this section covers **3 retrieval tasks and 3 update tasks** (one each for INSERT, DELETE, and UPDATE). All six are scripted in `scripts/test-partC-tasks.js` and can be reproduced with `npm run test:partc`.

### 7.1 Demo Login Credentials

Run `npm run db:rehash` once after seeding to set every seeded user's password to `Password123!`.

| Role | Email | Password |
|---|---|---|
| admin | `admin@test.com` | `Password123!` |
| provider (cleaning, verified) | `jane@test.com` | `Password123!` |
| provider (plumbing, verified) | `joe@test.com` | `Password123!` |
| provider (HVAC + electrical) | `mike@test.com` | `Password123!` |
| provider + client | `joey@test.com` | `Password123!` |
| client (Kassie) | `kassie@test.com` | `Password123!` |
| client (Paul) | `paul@test.com` | `Password123!` |

### 7.2 Retrieval Tasks

#### R1 — List all service categories (single-table SELECT)

* **Function:** `CategoryListRetrieval()`
* **SQL:** `SELECT category_id, category_name FROM service_categories ORDER BY category_name`
* **UI path:** Home page chips, New Request dropdown, Admin → Categories page.
* **Expected:** all 8 seeded categories (Appliance Repair, Cleaning, Electrical, HVAC, Landscaping, Painting, Pest Control, Plumbing).

#### R2 — Search providers by category + ZIP + radius (multi-table join with aggregation)

* **Function:** `ProviderSearchRetrieval(categoryId, zip, radiusMiles)`
* **SQL:** joins `provider_services`, `provider_profiles`, `users`, and LEFT JOINs `bookings` + `reviews` to compute the average rating; filters by category, ZIP exact-or-prefix, and provider's stated travel radius.
* **UI path:** Browse Providers → search form (category=Cleaning, zip=77550, radius=25).
* **Expected with seed data:** Jane (cleaning, base 45.00, ZIP 77550, verified) appears at the top.

#### R3 — Booking detail (7-table JOIN)

* **Function:** `BookingDetailRetrieval(bookingId)`
* **SQL:** joins `bookings`, `service_requests`, `service_categories`, `users` (twice — provider and client), LEFT JOINs `payments` and `reviews`. Single round trip.
* **UI path:** Click any row in the bookings table on Client or Provider Dashboard.
* **Expected for seeded `booking_id=1`:** category = HVAC, agreed price = 180.00, payment status = completed, rating = 5.

### 7.3 Update Tasks

#### U1 — INSERT: create a new service request

* **Function:** `CreateServiceRequest(clientId, categoryId, …, preferredStart, preferredEnd)`
* **Validation:** `ValidateZipCode`, `ValidateDateRange` run first; bad input returns `{ error }` without touching the DB.
* **SQL:** `INSERT INTO service_requests (…) VALUES ($1..$9) RETURNING request_id`
* **UI path:** Client → New request → Submit.
* **Expected:** new `request_id` returned and visible on the client dashboard with status `open`.

#### U2 — UPDATE: change a service request's status

* **Function:** `UpdateRequestStatus(requestId, status)`
* **Validation:** `status ∈ {open, booked, closed, cancelled}` enforced in JS *and* in the DB CHECK constraint.
* **SQL:** `UPDATE service_requests SET status = $2 WHERE request_id = $1`
* **UI path:** Triggered automatically when a provider books the request (status → `booked`) and when a booking is completed (status → `closed`); also triggered explicitly by `UpdateBookingStatus`.
* **Expected:** subsequent retrievals show the new status.

#### U3 — DELETE: remove an open service request

* **Function:** `DeleteServiceRequest(requestId, clientId)`
* **Guard:** the SQL itself checks `client_id = $2 AND status = 'open'`, so a client cannot delete someone else's request and cannot delete one that's already booked.
* **SQL:** `DELETE FROM service_requests WHERE request_id = $1 AND client_id = $2 AND status = 'open' RETURNING request_id`
* **UI path:** Client Dashboard → "delete" button (only renders for open rows).
* **Expected:** row disappears from the dashboard; attempting to delete a booked or closed request returns `{ error }` and leaves the row intact.

### 7.4 Additional Smoke Tests (already in repo)

* `npm run db:test` — verifies connectivity and prints row counts per table.
* `npm run test:fns` — runs every retrieval helper end-to-end.
* `npm run test:flow` — exercises the full booking → in-progress → completed → pay → review path and the duplicate-prevention errors (already-paid, already-reviewed, request-not-open).

### 7.5 Logic Tests Performed by Hand

| Scenario | Expected Behavior | Result |
|---|---|---|
| Register with an existing email | `400 email already in use` | ✓ |
| Login with the wrong password | `401 invalid email or password` | ✓ |
| Create a request with invalid ZIP `"abcde"` | `400 bad zip` | ✓ |
| Create a booking on a request that's already booked | `400 request already booked` | ✓ |
| Pay an amount that doesn't match agreed price | `400 amount must match agreed price` | ✓ |
| Pay the same booking twice | `400 already paid` | ✓ |
| Submit a review for a non-completed booking | `400 booking not completed yet` | ✓ |
| Submit a second review on a booking | `400 already reviewed` | ✓ |
| Admin approves an `identity` check | provider's `verified_status` flips to `verified` | ✓ |
| Provider tries `/api/admin/users` | `403 forbidden` | ✓ |
| Logged-out user tries `/api/dashboard/client` | `401 not signed in` | ✓ |

---

## 8. Deployment

The service is configured for one-click deployment to Render via `render.yaml`:

```yaml
services:
  - type: web
    name: homeneeds
    env: node
    plan: free
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        sync: false
      - key: SESSION_SECRET
        sync: false
```

**Deployment steps:**

1. Create a new Postgres database on Supabase. Run `schema.sql` then `seed.sql` in the SQL editor.
2. On Render, "New → Blueprint" pointed at the GitHub repo.
3. Set the two private env vars:
   * `DATABASE_URL` = the Supabase pooler connection string with SSL.
   * `SESSION_SECRET` = a long random string (`openssl rand -hex 32`).
4. After the first deploy succeeds, run `npm run db:rehash` once (locally with the production `DATABASE_URL`) to set the seed users' bcrypt hashes to `Password123!`.
5. Visit the Render URL and sign in with any of the test accounts in §7.1.

> **Live URL:** _to be filled in after the deploy completes._
> **Admin login:** `admin@test.com` / `Password123!`

---

## 9. Contributions of Group Members

| Member | Contributions |
|---|---|
| **Mario Camarena** (captain) | Project lead and primary author of Part A (problem statement, ER diagram, table schemas, naming conventions). Set up the original AWS Aurora MySQL instance, then led the Postgres / Supabase migration for Part C. Authored the `bookingMatching` and `paymentReview` function sets. Built the provider and admin pages in `public/app.js`. Wrote the deployment configuration (`render.yaml`) and managed the GitHub repository. Co-authored Parts B and C documentation. |
| **Oziel Sauceda** | Co-author of Part A (relationships, cardinalities, table descriptions). Implemented the `auth`, `validation`, `dataRetrieval`, and `dataUpdate` function sets and the JSON API layer in `routes/api.js`. Built the client UI in `public/app.js` (dashboard, new request, booking detail, payment, review). Designed the SPA shell, panel router, and `styles.css`. Authored the Part C testing scripts (`test-functions.js`, `test-booking-flow.js`, `test-partC-tasks.js`) and primary author of Parts B and C documentation. |

Both members met regularly to review schema decisions, discuss API design, perform UI usability checks, and run end-to-end tests against the live database.

---

## 10. Conclusions

HomeNeedsService.com works end-to-end as a marketplace for home services. A new user can register with one of three roles, build a profile, post or accept jobs, complete the payment, and leave a review — and an admin can keep the system clean by managing background checks and the master category list. The system enforces its key invariants in two layers (application validation + database constraints), uses parameterized queries and bcrypt to defend the obvious attack surfaces, and ships with a Render blueprint so reviewers can run the live system rather than reading screenshots.

The biggest design lesson from the project was the value of **moving as much business invariance as possible into the database**. Things like "one booking per request" and "rating must be 1–5" started as application-layer checks but ended up as `UNIQUE` and `CHECK` constraints, which means a buggy client or a future feature cannot violate them. The biggest engineering lesson was the migration from MySQL on AWS to PostgreSQL on Supabase: because the application code only touched SQL through one helper (`ExecuteQuery`) and one driver (the function sets in `functions/`), swapping the driver and the parameter syntax was a contained change rather than a rewrite. That validated the Part B decision to put a thin wrapper over the database driver instead of letting routes call SQL directly.

Future work that we scoped out of the MVP: real geolocation-based proximity (we approximate with ZIP exact-or-prefix matching plus the provider's stated travel radius), real payment processing via Stripe (we record the transaction but do not move money), email notifications for booking confirmations and reviews, and a chat thread per booking so client and provider can coordinate before the visit.

---

## 11. References

1. CSCI 6333 Course Materials — Project Part A, Part B, and Part C handouts.
2. Y. Tor and Z. Chen. *ANTES System Requirements Specification.* CITEC, University of Texas–Pan American, June 2003. (Provided as `AntesRequirements.pdf` on Blackboard; used as the structural reference for this report.)
3. PostgreSQL 15 Documentation — Constraints, Indexes, JOINs. https://www.postgresql.org/docs/15/
4. Express.js Documentation. https://expressjs.com/en/4x/api.html
5. Supabase Documentation — Postgres connection pooling and SSL. https://supabase.com/docs/guides/database
6. node-postgres (`pg`) Documentation. https://node-postgres.com/
7. OWASP Top 10 (2021) — A03 Injection. https://owasp.org/Top10/A03_2021-Injection/

---

## 12. Appendix — Source Code Inventory

The full source tree is included as part of this submission. Reviewers should pay particular attention to:

* `schema.sql` — full DDL with constraints and indexes.
* `seed.sql` — reproducible sample data for the 10 tables.
* `functions/` — the seven function sets named in Part B.
* `routes/api.js` — every HTTP endpoint, including the role guards.
* `public/app.js` — the SPA panel router (≈ 800 lines, vanilla JS, no build step).
* `scripts/test-partC-tasks.js` — the 3 retrieval + 3 update tests for §7.

End of document.
