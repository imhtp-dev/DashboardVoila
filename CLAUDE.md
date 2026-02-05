# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Install dependencies
npm install

# Run development server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Start production server (after build)
npm start

# Lint code
npm run lint
```

## Deploying
Don't need to build docker images locally commit the code and push it in github repo it will CI/CD will itself build the image and push to docker hub and run the container on azure app service



## Project Architecture

### Tech Stack
- **Framework:** Next.js 16.0.2 (App Router)
- **Language:** TypeScript (strict mode enabled, but `ignoreBuildErrors: true` in production)
- **Styling:** Tailwind CSS 4
- **UI Components:** Shadcn UI (Radix primitives)
- **Charts:** Recharts
- **Backend:** Supabase (database + Edge Functions)
- **Real-time Chat:** Dual provider support (Pipecat WebSocket / Vapi API)
- **Deployment:** Azure Web App (Docker Hub: rudyimhtpdev/voilavoicedashboard)

### Directory Structure

```
app/
├── (auth)/login/              # Login page - accepts any credentials in demo mode
├── (dashboard)/               # Protected dashboard routes with shared layout
│   ├── layout.tsx             # Dashboard layout with Sidebar + Navbar
│   └── dashboard/
│       ├── page.tsx           # Main dashboard (stats, charts, calls table)
│       ├── conoscenza/        # Q&A knowledge management per region
│       ├── kpi/               # KPI graphs
│       ├── utenti/            # User management (CRUD operations)
│       ├── verifica-conoscenza/  # Chat interface for testing voice agent
│       └── voiceagent/        # Voice agent control panel by region
├── api/
│   └── vapi-chat/             # Server-side Vapi API route handler
├── layout.tsx                 # Root layout
├── page.tsx                   # Landing page (auto-redirects to /login)
└── globals.css                # Global styles + Tailwind imports

components/
├── layout/                    # Sidebar, Navbar
├── dashboard/                 # Dashboard-specific components (pipecat-chat.tsx, etc)
└── ui/                        # Shadcn UI primitives (button, card, dialog, etc)

lib/
├── api-client.ts              # API client for Supabase Edge Functions
├── dashboard-service.ts       # Direct Supabase database queries
├── dummy-data.ts              # Mock data for all pages
├── pipecat-chat-client.ts     # WebSocket client for Pipecat chat service
├── vapi-chat-client.ts        # HTTP client for Vapi chat API
├── supabase-client.ts         # Supabase client initialization
└── utils.ts                   # cn() helper for Tailwind class merging

hooks/
└── use-chat.ts                # Universal chat hook (supports both Pipecat/Vapi)

types/
└── index.ts                   # Shared TypeScript types
```

### Key Architectural Patterns

#### 1. Dual Chat Provider System
The application supports two chat backends via environment variable selection:
- **Pipecat:** WebSocket-based streaming chat (default)
- **Vapi:** REST API-based chat

Controlled by `NEXT_PUBLIC_CHAT_PROVIDER` env var (values: `pipecat` | `vapi`).

The [use-chat.ts](hooks/use-chat.ts) hook abstracts the provider logic:
```typescript
const provider = process.env.NEXT_PUBLIC_CHAT_PROVIDER || 'pipecat';
```

**Pipecat Flow:**
1. Client calls [pipecat-chat-client.ts](lib/pipecat-chat-client.ts:39) `connect()` → creates session via REST API
2. Opens WebSocket connection to `wss://20.199.66.239.nip.io/ws/{session_id}`
3. Streams messages in real-time with chunks and function call events

**Vapi Flow:**
1. Client calls `/api/vapi-chat` Next.js API route (server-side proxy)
2. Server posts to Vapi API with assistant ID
3. Returns full response (no streaming)

#### 2. Backend Data Layer Architecture

The app has **dual data access patterns**:

**Pattern A: Supabase Edge Functions** ([api-client.ts](lib/api-client.ts))
- Used for: Authentication, Q&A management, user CRUD
- Endpoints: `${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/{function-name}`
- Functions call MySQL database on backend via Edge Functions

**Pattern B: Direct Supabase Queries** ([dashboard-service.ts](lib/dashboard-service.ts))
- Used for: Dashboard statistics, call lists, trends
- Direct PostgreSQL queries via Supabase JS SDK
- Translates original FastAPI SQL queries to Supabase syntax
- See comments in [dashboard-service.ts](lib/dashboard-service.ts:36) for SQL mapping

**Note:** The application originally connected to a FastAPI backend (`../app.py` on port 8745 with MySQL). This has been migrated to Supabase.

### Supabase Edge Functions

Edge Functions are located in `supabase/functions/` directory. **When adding new database filters or query parameters, you must update both:**

1. **Frontend** (`lib/api-client.ts`) - Add parameter to API client
2. **Edge Function** (`supabase/functions/{function-name}/index.ts`) - Add filter logic to queries

**Structure:**
```
supabase/functions/
├── dashboard-stats/          # Dashboard statistics (calls, revenue, minutes)
├── dashboard-calls/          # Call list with pagination
├── dashboard-call-summary/   # Single call details
├── dashboard-regions/        # Available regions
├── auth-login/               # Authentication
├── users-list/               # User management
├── qa-list-by-region/        # Q&A entries
└── _shared/                  # Shared utilities (cors, auth, supabase client)
```

**Deploying Edge Functions:**
```bash
# Deploy a single function (--no-verify-jwt required for public access)
supabase functions deploy dashboard-stats --no-verify-jwt

# Deploy all functions
supabase functions deploy --no-verify-jwt
```

**Example: Adding a new filter parameter**

1. Update `api-client.ts`:
```typescript
async getStats(params?: { region?: string; call_type?: string | string[] }) {
  if (params?.call_type) {
    const types = Array.isArray(params.call_type) ? params.call_type.join(',') : params.call_type;
    queryParams.append('call_type', types);
  }
}
```

2. Update Edge Function `index.ts`:
```typescript
const callTypeParam = url.searchParams.get('call_type');
const callTypes = callTypeParam ? callTypeParam.split(',') : null;

if (callTypes && callTypes.length > 0) {
  query = query.in('call_type', callTypes);
}
```

#### 3. Route Groups with Shared Layouts

Next.js App Router uses route groups for layout sharing:
- `(auth)` group: Login page (no sidebar/navbar)
- `(dashboard)` group: All dashboard pages share [layout.tsx](app/(dashboard)/layout.tsx) with Sidebar + Navbar

The dashboard layout is responsive:
- Desktop: Sidebar fixed at 16rem width (`lg:pl-64`)
- Mobile: Sidebar becomes hamburger menu

#### 4. Environment-Based Configuration

The app uses different URLs for development vs production:

**Development:** Can use localhost fallbacks
**Production:** Uses nip.io SSL-enabled URLs for Pipecat
```typescript
// From pipecat-chat-client.ts
this.apiBaseUrl = process.env.NEXT_PUBLIC_PIPECAT_CHAT_API_URL || 'https://20.199.66.239.nip.io/api';
this.wsBaseUrl = process.env.NEXT_PUBLIC_PIPECAT_CHAT_WS_URL || 'wss://20.199.66.239.nip.io/ws';
```

#### 5. Function Call Badge System

The chat interface displays badges for different backend function calls. See [pipecat-chat.tsx](components/dashboard/pipecat-chat.tsx:15) for the `BADGE_CONFIG` mapping:

```typescript
const BADGE_CONFIG = {
  knowledge_base_lombardia: { label: 'RAG', className: '...', icon: Database },
  get_price_agonistic_visit_lombardia: { label: 'Agonistic Pricing', ... },
  // etc
}
```

These badges appear when the backend calls specific functions during conversation, allowing users to see which data sources/APIs are being invoked.

## Important Configuration Notes

### TypeScript Build Configuration
- `ignoreBuildErrors: true` is set in [next.config.ts](next.config.ts:7) to allow deployment despite type errors
- When fixing type issues, this should eventually be set to `false`

### Image Optimization
- Sharp image optimization is disabled (`unoptimized: true`) to prevent "Bus error" crashes on Azure
- See [next.config.ts](next.config.ts:11)

### Docker Standalone Build
- Next.js uses `standalone` output mode for optimized Docker images
- Build produces `.next/standalone` with minimal dependencies
- See [Dockerfile](Dockerfile) for multi-stage build process

### Path Aliases
All imports use `@/*` alias pointing to root directory:
```typescript
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase-client"
```

## Deployment

The app auto-deploys to Azure Web App via GitHub Actions on push to `main` branch.

See [.github/workflows/main_voilavoicedashboardcerba.yml](.github/workflows/main_voilavoicedashboardcerba.yml) for:
- Docker build with build args (Supabase URL, chat provider, etc)
- Push to Docker Hub: `rudyimhtpdev/voilavoicedashboard`
- Azure Web App deployment: `voilavoicedashboardcerba1`
- Production URL: https://voilavoicedashboardcerba1-gaafdfhpawcwa5ek.francecentral-01.azurewebsites.net/login

**Build Args Required:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_CHAT_PROVIDER`
- `VAPI_API_KEY` (for Vapi mode)
- `VAPI_ASSISTANT_ID` (for Vapi mode)

## Regional Architecture

The application is **region-aware**. Most features filter by region (Piemonte, Lombardia, Veneto):
- Q&A knowledge base is region-specific
- Voice agents can be toggled per region
- Dashboard stats can be filtered by region
- Users are assigned to specific regions

Backend function names include region suffixes:
- `knowledge_base_lombardia`
- `get_price_agonistic_visit_lombardia`
- `call_graph_lombardia`

## Authentication Flow

**Current (Demo):**
- Login accepts ANY email/password combination
- See [app/(auth)/login/page.tsx](app/(auth)/login/page.tsx) for demo auth logic
- No real JWT validation

**Production Path:**
- The [api-client.ts](lib/api-client.ts:10) has proper `LoginRequest`/`LoginResponse` types
- Backend should return JWT tokens via Supabase Edge Functions
- Frontend should store tokens and attach to authenticated requests

## Data Migration Note

Dummy data in [lib/dummy-data.ts](lib/dummy-data.ts) is used as fallback. The production app should:
1. Remove dummy data imports
2. Replace with [api-client.ts](lib/api-client.ts) and [dashboard-service.ts](lib/dashboard-service.ts) calls
3. Add proper error handling and loading states

## Performance Guidelines for Dashboard/KPI Features

When adding new stats, graphs, or data visualizations to the dashboard or KPI pages, follow these rules:

### Rule 1: Use Postgres RPC Functions (NOT pagination loops)

**NEVER** fetch all rows and aggregate in JavaScript. This causes slow loading (60s+).

**BAD - Pagination loop in Edge Function:**
```typescript
// DON'T DO THIS
let allData = [];
while (true) {
  const { data } = await supabase.from('tb_stat')
    .select('*')
    .range(offset, offset + 1000);
  allData = allData.concat(data);
  if (data.length < 1000) break;
  offset += 1000;
}
// Then aggregate in JS...
```

**GOOD - Postgres RPC function:**
```sql
-- Create in supabase/rls-policies.sql
CREATE OR REPLACE FUNCTION get_my_stats(p_region text, p_start_date text, p_end_date text)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Do GROUP BY, COUNT, SUM, AVG in SQL
  SELECT jsonb_agg(row_to_json(t))
  FROM (
    SELECT column, COUNT(*) as count
    FROM tb_stat
    WHERE started_at >= p_start_date::timestamp
    GROUP BY column
  ) t;
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_stats(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION get_my_stats(text, text, text) TO authenticated;
```

```typescript
// Edge Function calls RPC
const { data } = await supabase.rpc('get_my_stats', {
  p_region: region,
  p_start_date: startDate,
  p_end_date: endDate
});
```

### Rule 2: Parallelize Frontend API Calls

**NEVER** use sequential `await` calls. Use `Promise.all()` for parallel execution.

**BAD - Sequential:**
```typescript
const stats1 = await dashboardApi.getStats1();
const stats2 = await dashboardApi.getStats2();
const stats3 = await dashboardApi.getStats3();
// Total time = sum of all three
```

**GOOD - Parallel:**
```typescript
const [stats1, stats2, stats3] = await Promise.all([
  dashboardApi.getStats1(),
  dashboardApi.getStats2(),
  dashboardApi.getStats3(),
]);
// Total time = slowest one
```

### Rule 3: Standard Filter Parameters

All dashboard RPC functions should accept these parameters:
- `p_region text` - "All Region" or specific region name
- `p_start_date text` - ISO date string (defaults to '2024-12-01')
- `p_end_date text` - ISO date string (defaults to today)
- `p_call_types text[]` - Optional array for call type filtering

### Rule 4: Region Filter Logic

Use this pattern in all queries:
```sql
AND (
  (p_region = 'All Region' AND region IS NOT NULL AND region != 'N/A')
  OR (p_region != 'All Region' AND region = p_region)
)
```

### Rule 5: Exclude Invalid Data

Always filter out N/A, NULL, empty values:
```sql
AND sentiment IS NOT NULL
AND UPPER(TRIM(sentiment)) NOT IN ('N/A', 'NULL', '')
```

### Existing RPC Functions (reference)

| Function | Purpose | Location |
|----------|---------|----------|
| `get_dashboard_stats()` | Main dashboard stats + chart data | `supabase/rls-policies.sql` |
| `get_outcome_trend()` | Esito chiamata trend over time | `supabase/rls-policies.sql` |
| `get_sentiment_trend()` | Sentiment trend over time | `supabase/rls-policies.sql` |
| `get_outcome_stats()` | Pie chart stats (esito + motivazione) | `supabase/rls-policies.sql` |

### Deployment Checklist for New Stats

1. Create RPC function in `supabase/rls-policies.sql`
2. Run SQL in Supabase SQL Editor
3. Create/update Edge Function to call RPC
4. Deploy: `supabase functions deploy function-name --no-verify-jwt`
5. Add API method in `lib/api-client.ts`
6. Use `Promise.all()` in frontend page
