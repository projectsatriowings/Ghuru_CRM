# Ghuru CRM - SaaS Foundation

A standalone, multi-tenant, customizable SaaS CRM platform built from the ground up.

## Product Architecture

Ghuru CRM is designed with a strict **multi-tenant hierarchy**:

```text
Organization
    ↓
  Users
    ↓
  Roles
    ↓
Permissions
```

Every organization-owned record is strictly associated with a tenant (`organizationId`), and isolation is enforced server-side.

### Core Architectural Principles

1. **Multi-tenant from day one**: Built with tenant boundaries at the database and server layer. No single-tenant assumptions.
2. **Server-side Tenant Isolation**: Tenant context and access verification are always verified on the server via `requireOrganization()` and `requirePermission()`. No client-only filtering.
3. **Role-Based Access Control (RBAC)**: Fine-grained permissions per organization. The creator automatically receives the **Organization Admin** role with full administrative privileges.
4. **Clean Decoupled Domain Architecture**: Generic SaaS core with zero customer-specific hardcoding. External customers and integrations integrate cleanly via versioned REST APIs (`/api/v1/...`).

---

## Technology Stack

* **Framework**: Next.js 16 (App Router)
* **Language**: TypeScript (Strict Mode)
* **Styling & UI**: Tailwind CSS v4 & shadcn/ui
* **Database**: Neon PostgreSQL
* **ORM**: Drizzle ORM + Drizzle Kit
* **Authentication**: Better Auth
* **Validation**: Zod
* **Testing**: Vitest + PGlite

---

## Project Structure

```text
src/
├── app/
│   ├── (auth)/                  # Public auth route group
│   │   ├── login/               # Sign In page
│   │   └── signup/              # Sign Up page
│   ├── (dashboard)/             # Protected tenant application shell
│   │   ├── dashboard/           # Main tenant dashboard
│   │   └── settings/            # Settings foundation
│   │       ├── organization/    # Organization details & slug
│   │       ├── users/           # User & membership management
│   │       └── roles/           # Custom roles & permissions
│   ├── onboarding/              # Organization creation onboarding
│   └── api/
│       ├── auth/[...all]/       # Better Auth API endpoints
│       └── v1/                  # Versioned REST API foundation
│           ├── organizations/   # Organizations API
│           ├── users/           # Tenant members API
│           ├── roles/           # Roles and RBAC API
│           └── permissions/     # Available system permissions
├── components/
│   ├── ui/                      # shadcn/ui base components
│   ├── auth/                    # LoginForm, SignupForm
│   ├── layout/                  # Sidebar, Topbar, UserMenu, OrgSwitcher
│   ├── organization/            # CreateOrgForm, OrgSettingsForm
│   ├── users/                   # UsersTable, AddUserDialog, EditRoleDialog
│   └── roles/                   # RolesList, CreateRoleDialog, EditRoleDialog
├── db/
│   ├── index.ts                 # Neon PostgreSQL Drizzle connection
│   ├── migrate.ts               # Programmatic migration runner
│   ├── seed.ts                  # Idempotent permissions seeder
│   └── schema/                  # Drizzle ORM database schemas
│       ├── users.ts             # users, sessions, accounts, verifications
│       ├── organizations.ts     # organizations, organization_members
│       └── rbac.ts              # roles, permissions, role_permissions
├── lib/
│   ├── auth/                    # Better Auth server and client setup
│   ├── context/                 # Server-side tenant isolation & RBAC
│   ├── services/                # Organization, User, and Role domain services
│   ├── validations/             # Zod validation schemas
│   └── errors.ts                # Application error classes
└── config/
    └── navigation.ts            # Dynamic navigation structure
```

---

## Local Development Setup

### 1. Clone & Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Fill in your Neon PostgreSQL database URL and Better Auth secret:

```env
DATABASE_URL="postgresql://neondb_owner:password@ep-sample.neon.tech/neondb?sslmode=require"
BETTER_AUTH_SECRET="your-32-character-secret-key-goes-here-min-length"
BETTER_AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 3. Database Migrations

Generate migrations from schema changes:
```bash
npm run db:generate
```

Apply migrations to your Neon database:
```bash
npm run db:migrate
```

Seed initial system permissions:
```bash
npm run db:seed
```

Launch Drizzle Studio for visual database inspection:
```bash
npm run db:studio
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Verification & Testing

Run unit & integration test suite:
```bash
npm test
```

Run TypeScript strict type-check:
```bash
npm run type-check
```

Run ESLint:
```bash
npm run lint
```

Build for production:
```bash
npm run build
```

---

## Milestone 2.7 — CRM Dashboard & Intelligence Foundation

Milestone 2.7 introduces a high-performance, tenant-isolated operational CRM dashboard designed to answer critical day-to-day sales and management questions without artificial AI or predictive black boxes.

### Core Architecture
- **Tenant Isolation**: Every aggregation query enforces `organizationId` from authenticated server session context. Client query parameters (`assigneeId`, `pipelineId`) are strictly verified to belong to the active tenant.
- **PostgreSQL Server Aggregations**: Uses grouped SQL queries (`COUNT`, `FILTER`, `CASE WHEN`, `GROUP BY`) rather than hydrating thousands of rows into JavaScript memory.
- **Parallel Query Execution**: All widget metrics execute concurrently via `Promise.all` in `dashboard.service.ts`.
- **Role-Aware Widget Arrangement**: Adapts layout ordering between administrative oversight (funnel & channel breakdown first) and sales/counsellor operations (My Work & Needs Attention first).

### Available Widgets
1. **Metric Cards**: Total Leads (in-range & all-time), Conversions with Rate badge, Follow-Ups (overdue count in warning red, due today), and Activities logged today.
2. **Needs Attention**: Urgent bottleneck queue highlighting overdue follow-ups, past-due activities, and active leads with no next action scheduled. Direct deep-links to CRM entities.
3. **My Work**: Personalized operational workspace for the logged-in user displaying assigned leads, overdue follow-ups, follow-ups due today, and recent activities.
4. **Lead Status Funnel**: Distribution and percentages across all lead lifecycle statuses (`new`, `contacted`, `qualified`, `unqualified`, `converted`, `lost`).
5. **Lead Sources**: Distribution and percentages across acquisition channels (`website`, `meta_ads`, `google_ads`, `walk_in`, etc.).
6. **Pipeline Progression**: Dynamic multi-stage funnel showing lead counts and progress bars per configured stage across active organization pipelines.
7. **Follow-ups & Next Actions**: Operational follow-ups breakdown (Overdue, Due Today, Due This Week, Completed, Assigned to Me vs Others).
8. **Activity Breakdown**: 10-type unified activity distribution (`call`, `email`, `meeting`, `note`, `task`, `follow_up`, `status_change`, `assignment_change`, `conversion`, `relationship_change`).
9. **Conversion Intelligence**: Deterministic conversion metrics including overall conversion rate, top converting channels, and top performer conversion rates.

### Metric Semantics & Conversion Formula
- **Leads Range vs All-Time**: `total` represents leads created within the selected date boundary; `totalAllTime` preserves current organization inventory regardless of creation date.
- **Conversion Rate Formula**:
  $$\text{Conversion Rate} = \left(\frac{\text{Converted Leads}}{\text{Total Eligible Leads}}\right) \times 100$$
  where eligible leads are active non-archived leads in the organization scope.
- **Follow-up Overdue Rule**: A follow-up is overdue if `status = 'pending'`, `dueDate < CURRENT_DATE`, and `archivedAt IS NULL`.
- **Needs Attention Rule**: Deterministic checks for (1) overdue follow-ups, (2) pending activities with `dueAt < NOW()`, and (3) active leads (`status NOT IN ('converted', 'lost')`) that have no pending follow-up scheduled.

### Date Range Presets
Supported presets: `today`, `yesterday`, `last_7_days`, `last_30_days` (default), `this_month`, `last_month`, and `custom` (with explicit `from` and `to` ISO date boundaries).

### RBAC & Security
- Permission key: `dashboard.view` (with fallback to `organization.view` for administrative compatibility).
- Automatically granted to `Organization Admin` and configurable for custom roles.
- Cross-tenant user or pipeline filter IDs return `404 Not Found`.

### REST API
- `GET /api/v1/dashboard`: Returns complete JSON summary matching typed `DashboardData`.
  - Query parameters: `preset`, `from`, `to`, `assigneeId`, `pipelineId`.

