The Organizations module shall provide:

Listing, searching, creating, editing and deleting organizations.

Organization Status lookup for the org form.

Route: `/organizations` (no `menuType` guard — unlike most other sections,
this route is not gated by `PermissionGuard`/`data.menuType`, so it is
reachable by any authenticated user; it does not appear in the left
navigation menu either, since it has no `NAV_ITEMS` entry).

Component: `OrganizationsComponent` (`src/app/features/organizations/`).



Organizations List Flow

User navigates to `/organizations`.

`ngOnInit` loads the Organization Status options (`GET_MASTER_LIST`, typeId
5) used by the status dropdown in the form.

`ngOnInit` then loads the first page of organizations.

Screen Components

Search box — keyword search across organizations; typing resets to page 1
and reloads (`onSearch`).

Organizations list/table — bound to the `organizations` signal.

Pagination — bound to the `pagination` signal (`currentPage`/`pageSize`
10/`totalItems`/`totalPages`), page changes trigger `onPageChange` → reload.

Add / Edit form — a reactive form (`name`, `type`, `email`, `phone`, all
required; `email` additionally validated as an email address) shown/hidden
via the `showForm` signal.

Business Rules

Name, Type, Email and Phone are all required to save an organization.

Email must be a valid email address.

An organization record carries an optional `status` field, populated from
the org-status enum lookup.

Business Logic

Load: `GET_ORGANIZATIONS` (POST) with `{ page, pageSize: 10, search }` →
paginated `{ data, pagination }`.

Create: `ADD_ORGANIZATION` (POST) with the form value.

Update: `UPDATE_ORGANIZATION` (POST) with `{ id, ...form value }`, when
`editingId` is set.

Delete: `DELETE_ORGANIZATION` (POST) with `{ requestId: id }`, after a native
`confirm()` prompt (this screen does not use the shared
`DeleteConfirmationComponent` modal used elsewhere in the app).

Edit Flow

User clicks Edit on an organization row.

`editOrg` sets `editingId`, patches the form with the row's `name`/`type`/
`email`/`phone`, and opens the form.

User updates fields and submits.

`onSubmit` validates the form (touches all fields and aborts if invalid),
then calls `UPDATE_ORGANIZATION`.

On success, the form is closed/reset (`cancelForm`) and the list reloads.

Delete Flow

User clicks Delete on an organization row.

Browser `confirm()` dialog appears.

On confirm, `DELETE_ORGANIZATION` is called and the list reloads on success.

Notes for maintainers

Unlike the rest of the app's list/detail screens, all state (list, paging,
form, editing) lives directly on `OrganizationsComponent` rather than being
split into a list + separate form-route pair — there is no `organization-form`
route; add/edit happens inline via `showForm`.

The list-load call passes `showLoader: false` because the component's own
`loading` signal already drives the UI's loading state; the enum lookup and
create/update/delete calls also suppress the loader for the same reason (or,
for the enum lookup, run silently as a background fetch).
