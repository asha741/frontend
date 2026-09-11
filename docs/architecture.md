# Architecture Overview

Technical/architectural reference for `agency-admin`. The other docs in this
folder describe end-user flows per feature screen; this one describes how the
app itself is wired together, for a developer (human or AI) making a change.

## Stack & bootstrap

Angular (standalone components, no `NgModule`s), bootstrapped via
`bootstrapApplication` using `src/app/app.config.ts` (`appConfig`). Key
providers registered there:

- `provideRouter(routes, withPreloading(PreloadAllModules), withComponentInputBinding(), withViewTransitions(), withInMemoryScrolling(...))`
  — the router, with all lazy chunks preloaded after the initial navigation,
  route params bindable straight to component `@Input()`s, and scroll reset
  to top on every navigation.
- `provideHttpClient()` — `HttpClient`, used everywhere through `ApiService`.
  **No `HttpInterceptor` is registered.** Token attachment, request/response
  encryption, and 401 handling all live inside `ApiService` itself (see
  below) rather than in an interceptor.
- `provideAppInitializer(() => inject(PermissionService).ensureLoaded())` —
  decrypts the cached permission list from `localStorage` before the first
  route resolves, so a hard refresh doesn't gate the sidebar/guards against
  an empty permission set.
- `NgbTooltipConfig` override (`triggers: 'hover'`) and
  `NgbDateParserFormatter` override (`NgbDateMMDDYYYYParserFormatter`) —
  app-wide UI conventions, not just one screen's.

Runtime config (API base URL, encryption key, Azure storage settings, portal
role) is compiled in from `src/environments/environment*.ts` and read
everywhere through `ConfigService` (`core/config/config.service.ts`) rather
than importing `environment` directly.

## Routing (`app.routes.ts`)

Two top-level branches:

- `auth/*` — guest-only pages (login, forgot/reset password, accept
  invitation, OTP verification), rendered inside `AuthLayoutComponent`
  (`layouts/auth-layout`), gated by `LoginGuard`.
- `''` (everything else) — protected pages rendered inside
  `AdminLayoutComponent` (`layouts/admin-layout`, sidebar + header), gated by
  `AuthGuard`, with most feature sections additionally gated per-route by
  `PermissionGuard` via `data.menuType`.

Every route uses `loadComponent` (standalone lazy-loading — no lazy
`NgModule`s in this app). Multi-page features (e.g. `bulk-upload`,
`claim-analyst`, `patient-management`) nest their sub-pages as `children` of
a parent path so shared route params (`:id`) flow down without repeating
them.

`data.menuType` on a route is a `MenuType` (or an array of them, e.g. Masters
covers both `Bhs` and `Cpt`) — it is the only wiring between a route and the
permission system; `PermissionGuard` reads it to decide whether the route may
activate.

## Guards (`core/guards/`)

| Guard | Applies to | Behavior |
|---|---|---|
| `AuthGuard` | admin routes (`''` branch) | Redirects to `/auth/login` unless `AuthService.isLoggedIn()`. |
| `LoginGuard` | `auth/*` routes | Redirects an already-authenticated user to `/dashboard`, **except** deep links into `accept-invitation` / `reset-password`, which log the current session out (without redirecting) and let the link's page load logged-out. |
| `PermissionGuard` | individual admin routes via `data.menuType` | Awaits `PermissionService.ensureLoaded()` (covers a hard refresh racing the app initializer), then allows the route only if `PermissionService.canAccessMenu(menuType)`; otherwise redirects to `PermissionService.landingRoute()`. |

Guard order on a protected route is effectively `AuthGuard` → (layout) →
`PermissionGuard` on the child route, so `PermissionGuard` can assume a
session already exists.

## The API layer

**`ApiService`** (`core/services/api.service.ts`) is the single entry point
every feature/service uses to talk to the backend — there is no
`HttpInterceptor`, so this is where cross-cutting HTTP concerns live:

- `request(method, endpoint, body?, apiOptions?)` — JSON calls. AES-GCM
  encrypts the outgoing body (`CryptoService`) as `{ data: <cipher> }`,
  attaches `Authorization: Bearer <token>` (token itself is decrypted from
  `localStorage` just-in-time), decrypts the response envelope
  (`{ data, error, meta, message }`), drives the global loader
  (`LoaderService`) and toast (`ToastService`) unless `apiOptions` opts out,
  and forces `AuthService.logout()` on a 401 from an authenticated call
  (`useToken: true`) — a 401 on an unauthenticated call, e.g. bad login
  credentials, is surfaced as a normal error instead.
- `uploadFile(endpoint, file, fieldName?, apiOptions?)` — multipart
  `FormData` posts (can't be AES-GCM-JSON-encrypted), same token/loader/toast
  handling and 401 behavior as `request`.
- Returns a normalized `ApiResponse<T>` (`message`, `code`, `status`,
  `data`, `error`) either way, or `null` when the call was rejected due to
  session expiry (caller should treat `null` as "navigation is happening,
  stop").

**`DataService`** (`core/services/data.service.ts`) fetches and caches the
app-wide "common lists" (statuses, roles, countries, etc.) used to populate
dropdowns, via one batched call (`GET_COMMON_LIST` with all `typeId`s) rather
than one request per dropdown. Exposed as `commonList$`.

**`CryptoService`** (`core/services/crypto.service.ts`) — client-side
AES-GCM (Web Crypto API) used by `ApiService` for request/response bodies, by
`AuthService`/`PermissionService` for what they cache in `localStorage`
(token, profile, permissions), and via `encryptId`/`decryptId` (URL-safe
base64 variant) for encrypting record ids that appear in the URL.

**`API_ROUTES`** (`core/constants/api-routes.ts`) — the endpoint-path
constants passed as `ApiService`'s `endpoint` argument; add new endpoints
here rather than inlining path strings in a feature service.

## Auth & permissions

**`AuthService`** (`core/services/auth.service.ts`) owns the session: a
`currentUser` signal (with `userFullName`/`userInitials`/`userAvatarUrl`/
`isOrgAdmin` computed off it), `startSession()` (persists the encrypted
token + permissions after login/MFA, then loads the profile),
`loadProfile()` (the one place that fetches and caches the profile — call it
after login and after any profile/avatar change), and `logout()` /
`logoutWithoutRedirect()`. `isLoggedIn()` only checks that a token is cached,
not that it hasn't expired server-side — the 401 handling in `ApiService` is
what actually reacts to expiry.

**`PermissionService`** (`core/services/permission.service.ts`) is the
central authority for what the logged-in user may do. Permissions arrive as
`MenuPermission[]` (`module` + `name` + `menuType`) alongside the access
token at login and are cached encrypted in `localStorage`. Exposes:

- `can(module, action)` / `canAny(module, ...actions)` — what templates use
  to show/hide UI (`*ngIf`/`@if`), typed against the `PERMISSION_MODULE`/
  `PERMISSION_ACTION` constants (`core/constants/permissions.ts`) so a typo
  is a compile error, not a silently-false check.
- `canAccessMenu(menuType)` — what `PermissionGuard` and the sidebar
  (`menu` computed, filtering `NAV_ITEMS` from `core/constants/navigation.ts`)
  use; a user with only `Role` permissions still sees/reaches
  `MenuType.User` (Team Management) since roles are managed on that page.
- `landingRoute()` — first menu item the user can actually open; guards
  redirect here instead of somewhere the user can't reach.
- `ensureLoaded()` — memoized restore-from-cache, awaited by the app
  initializer and by `PermissionGuard` so a hard refresh never gates against
  a still-empty signal.

## Layouts

- `AdminLayoutComponent` (`layouts/admin-layout`) — composes
  `SidebarComponent` + `HeaderComponent` + `<router-outlet>`, and owns
  responsive sidebar state (collapsible desktop rail vs. mobile slide-in
  drawer, breakpoint at 1200px).
- `AuthLayoutComponent` (`layouts/auth-layout`) — no logic, just hosts the
  routed auth page inside the auth page chrome.

## Conventions for new contributors

- Never call `HttpClient` directly from a feature — go through `ApiService`
  so encryption, auth headers, loader/toast, and 401 handling stay
  consistent.
- Add new backend paths to `API_ROUTES`, not inline strings.
- Gate a new route's visibility with `data.menuType` (`PermissionGuard`) and
  add the matching entry (if it belongs in the sidebar) to `NAV_ITEMS`
  (`core/constants/navigation.ts`); gate in-page actions with
  `PermissionService.can()`/`canAny()`.
- Anything cached client-side that is sensitive (token, profile,
  permissions) goes through `CryptoService`, not raw `localStorage.setItem`.
- Feature pages are standalone components loaded via `loadComponent`; there
  are no feature `NgModule`s to register into.
