# Shared Components, Directives & Pipes

Catalog of `src/app/shared/` — reusable UI pieces used across multiple
feature screens. All are standalone. For app-wide services/guards see
`core-services.md`; for how routing/auth/permissions fit together see
`architecture.md`.

## `shared/components/`

| Component | Selector | Purpose |
|---|---|---|
| `back-button` | `app-back-button` | Navigates to the previous location (`Location.back()`). |
| `breadcrumb` | (see component) | Renders the crumb trail from each route's `data.title`, re-rendering when `BreadcrumbService` publishes a fetched label (e.g. a batch code) for the current URL. |
| `delete-confirmation` | `app-delete-confirmation` | Generic destructive-action confirmation modal. Open with `NgbModal.open(DeleteConfirmationComponent)`; `modalRef.result` resolves to `'confirmed' \| 'canceled' \| 'closed'`. |
| `empty-state` | `app-empty-state` | Presentational placeholder shown in an empty list/table/grid. No state, no API calls. |
| `header` | `app-header` (assumed) | Top app bar — notification bell, profile menu — used by `AdminLayoutComponent`. |
| `import-file-modal` | (see component) | Modal wrapper around a bulk-import flow: shows import errors (`ImportErrorRow[]`) and confirms overwrite/delete via `DeleteConfirmationComponent`. |
| `loader` | `app-loader` | Loading spinner overlay (full-screen or `inline`), driven by `LoaderService.loading`. |
| `media-preview-modal` | (see component) | Large carousel modal for previewing image/video attachments (`MediaAttachment[]`). |
| `pagination` | `app-pagination` | Presentational page-number strip; renders from a `Pagination` object (`core/services/api.service.ts`) handed in by the parent, which owns the actual data-fetch. |
| `search-autocomplete` | (see component) | `ControlValueAccessor`-based autocomplete input, typically backed by `LookupService`. |
| `sidebar` | `app-sidebar` | Left nav — renders `PermissionService.menu`, handles logout (via `DeleteConfirmationComponent`-style confirm) and collapse/drawer state driven by `AdminLayoutComponent`. |
| `status-confirmation` | (see component) | Status-change confirmation modal with an optional (optionally required) reason field. Open with `NgbModal.open(StatusConfirmationComponent)`; read `modalRef.componentInstance.reason` when confirmed. |

Modal components (`delete-confirmation`, `status-confirmation`,
`media-preview-modal`) all follow the same pattern: open via
`NgbModal.open(Component)`, set `@Input()`s on `modalRef.componentInstance`,
and await `modalRef.result`.

## `shared/directives/`

| File | Selector | Purpose |
|---|---|---|
| `phone-mask.directive.ts` | `[appPhoneMask]` | Live US phone mask `(123) 456-7890`, capped at 10 digits; reformats on input, paste, and programmatic control-value changes (e.g. an edit-form patch). |
| `trim-whitespace.directive.ts` | `[appTrimWhitespace]` | Trims leading/trailing whitespace from a text field on blur; works with both `formControlName` and `[(ngModel)]`. |

`core/services/focusFirstInput.directive.ts` (`[appFocusFirstInput]`) also
exists but is physically located under `core/services/`, not
`shared/directives/` — attach it to a `<form>` to auto-focus its first input
and to re-focus the first invalid field on a failed submit.

## `shared/pipes/`

| Pipe | Name | Purpose |
|---|---|---|
| `badge-class.pipe.ts` | `badgeClass` | Resolves a status/priority value to its `ma-badge--*` CSS class through `core/utils/badge.util.ts` — the single source of truth for badge colors. |
| `markdown.pipe.ts` | (see file) | Renders markdown (used for AI-written failure reasons/recommendations) to HTML for `[innerHTML]`; raw HTML in the source is escaped (`html: false`), and Angular's sanitizer still runs on the output. |
| `phone-format.pipe.ts` | `phoneFormat` | Formats a 10-digit US phone number via `libphonenumber-js`; anything not exactly 10 characters passes through unchanged. |
| `time-ago.pipe.ts` | `timeAgo` | Formats an ISO timestamp as a relative string (e.g. "30 minutes ago") via `core/utils/date.util.ts`. |
| `us-phone.pipe.ts` | `usPhone` | Formats a 10-digit value as `(123) 456-7890` without external dependencies; falls back to the original value if it isn't exactly 10 digits. |

Two phone-formatting pipes exist (`phone-format.pipe.ts` using
`libphonenumber-js`, `us-phone.pipe.ts` with no dependency) — check which one
a given screen already uses before adding a new phone field, rather than
assuming either is the canonical one.

## Conventions

- Prefer these shared pieces over re-implementing a modal, badge color, or
  phone mask locally in a feature component.
- New badge/status colors are added to `core/utils/badge.util.ts`, then
  consumed through the `badgeClass` pipe — not hard-coded per template.
