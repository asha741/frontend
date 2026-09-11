# Core Services, Guards & Utils

Reference for what lives under `src/app/core/` and its public API. See
`architecture.md` for how these pieces connect at the app level (routing,
auth flow, API layer). This doc is the flat catalog.

## `core/guards/`

| File | Export | Purpose |
|---|---|---|
| `auth.guard.ts` | `AuthGuard` | Blocks protected routes unless `AuthService.isLoggedIn()`; redirects to `/auth/login`. |
| `login.guard.ts` | `LoginGuard` | Keeps a logged-in user off the guest auth pages (redirects to `/dashboard`), except deep links to `accept-invitation`/`reset-password`, which force-logout (no redirect) so the link loads logged-out. |
| `permission.guard.ts` | `PermissionGuard` | Awaits `PermissionService.ensureLoaded()`, then allows a route only if the user holds `Read` on its `data.menuType`; otherwise redirects to `PermissionService.landingRoute()`. |

## `core/services/`

| File | Export(s) | Purpose |
|---|---|---|
| `api.service.ts` | `ApiService`, `ApiResponse<T>`, `Pagination`, `PaginatedData<T>` | Central HTTP gateway — `request()` (JSON, AES-GCM encrypted) and `uploadFile()` (multipart); attaches the bearer token, drives loader/toast, force-logs-out on an authenticated 401. See `architecture.md`. |
| `auth.service.ts` | `AuthService`, `AuthUser` | Session lifecycle — `currentUser` signal, `startSession()`, `loadProfile()`, `isLoggedIn()`, `logout()` / `logoutWithoutRedirect()`. |
| `permission.service.ts` | `PermissionService`, `MenuPermission` | Permission checks (`can`, `canAny`, `canAccessMenu`), the filtered sidebar `menu`, and `landingRoute()`. |
| `data.service.ts` | `DataService`, `ICommonList` | Fetches and caches the shared dropdown lookup lists (`commonList$`) in one batched call. |
| `crypto.service.ts` | `CryptoService` | AES-GCM encrypt/decrypt for `localStorage` payloads and request/response bodies; `encryptId`/`decryptId` for URL-safe id encryption. |
| `storage.service.ts` | `StorageService` | Thin JSON-aware wrapper over `localStorage` (`get<T>`/`set`/etc.), swallows parse errors instead of throwing. |
| `loader.service.ts` | `LoaderService` | Reference-counted global loading overlay (`show()`/`hide()`, `loading` signal) — stays visible while any overlapping request is in flight. |
| `toast.service.ts` | `ToastService`, `ToastInfo` | App-wide toast queue (`success`/`error`/`info`/`warning`); the toast container component renders `toasts` and is notified of changes via `registerChangeDetector`. |
| `notification.service.ts` | `NotificationService`, `NotificationItem` | Bell-icon notifications — polls the backend for unread count/list; `startPolling()`/`stopPolling()` are called from `AuthService` on session start/end. |
| `breadcrumb.service.ts` | `BreadcrumbService` | Lets a page override its route-derived breadcrumb label once a fetched name is known (e.g. a batch code), keyed by URL so records never cross-contaminate labels. |
| `mfa-session.service.ts` | `MfaSessionService` | Holds the login `temp_token` + email in memory only (not persisted) between the login step and the OTP screen, so refreshing the OTP page abandons the MFA attempt. |
| `lookup.service.ts` | `LookupService` (assumed), `LookupOption`, `LOOKUP_DEBOUNCE_MS`, `LOOKUP_MIN_CHARS` | Debounced (300ms), min-3-char server-side lookup used by autocomplete-style fields; normalizes results to `{ value, label }`. |
| `fileUpload.service.ts` | `FileUploadService` | Uploads/deletes files directly to Azure Blob Storage via a SAS token (account/token from `ConfigService`); renames blobs `<baseName>_<timestamp>.<ext>`. |
| `filter-sort.service.ts` | `FilterAndSortingService`-style helpers, `SortDescriptor`, `FilterDescriptor` | Builds backend-shaped sort/filter query params from Kendo Grid state. |
| `common-filter-sort.service.ts` | `FilterAndSortingService`, `BuildQueryParamsOptions` | Kendo `State`/`CompositeFilterDescriptor`-aware variant of the above (`buildQueryParams`), with an `extra` override bag for top-bar search/date/dropdown filters that win over grid-derived params. |
| `dropdownfilter.component.ts` | (Kendo dropdown filter helper component) | Wires a Kendo autocomplete/dropdown to the grid's `FilterService`. |
| `focusFirstInput.directive.ts` | `FocusFirstInputDirective` | Note: lives in `services/` despite the name — see Directives below. |

`core/config/config.service.ts` — **`ConfigService`**: typed facade over
`src/environments/environment.ts` (swapped per build via `fileReplacements`).
Read `production`, `name`, `apiUrl`, `encryptionKey`, `usaCountryId`,
`portalRole`/`portalUrls`, and the various Azure Blob container/account
settings through this instead of importing `environment` directly.

## `core/constants/`

| File | Purpose |
|---|---|
| `api-routes.ts` | `API_ROUTES` — every backend endpoint path `ApiService` calls are made against. Add new endpoints here. |
| `permissions.ts` | `MenuType` enum (route/menu ids), `PERMISSION_MODULE`/`PERMISSION_ACTION` constants — the vocabulary permissions are issued and checked against. |
| `navigation.ts` | `NAV_ITEMS` — the sidebar menu and the single source of truth for which `MenuType` each route belongs to; `FALLBACK_ROUTE` for a user with no accessible menu. |

## `core/utils/`

| File | Purpose |
|---|---|
| `badge.util.ts` | `BADGE_CLASS`, `getBadgeClass()` — the one place a status/priority value maps to a `ma-badge--*` CSS modifier; consumed via the `badgeClass` pipe rather than hard-coded in templates. |
| `date.util.ts` | `getViewerTimezone()`, `timeAgo()` and other `dayjs`-based date helpers (UTC/timezone/relative-time plugins pre-registered). |
| `countdown.util.ts` | Wall-clock-deadline-based countdown signal that survives background-tab timer throttling (recomputes remainder from the clock rather than decrementing on each tick). |
| `filter.enum.ts` | `FilterOperatorType` enum mirroring the backend's `.NET` operator type, plus `mapOperatorToEnum()` mapping Kendo Grid operator strings onto it. |
| `ngb-date-mmddyyyy.formatter.ts` | `NgbDateMMDDYYYYParserFormatter` — app-wide override so every `ngbDatepicker` displays/parses `MM-DD-YYYY` instead of ISO. Registered in `app.config.ts`. |
| `validators.util.ts` | Reactive-forms validators, e.g. `passwordStrengthValidator()` (upper/lower/number/special/length-8 rule). |

## Conventions

- **No `HttpInterceptor`** in this app — all cross-cutting HTTP behavior
  (auth header, encryption, loader/toast, 401 handling) is inside
  `ApiService`. Don't add a parallel interceptor; extend `ApiService`
  instead.
- Anything persisted to `localStorage` that is sensitive (token, profile,
  permissions) is encrypted via `CryptoService` first — never
  `localStorage.setItem` directly for those.
- Badge/status colors are added to `badge.util.ts`, never hard-coded as a
  CSS class in a template.
