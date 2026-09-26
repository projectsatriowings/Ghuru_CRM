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
