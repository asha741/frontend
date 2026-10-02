import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { LoginGuard } from './core/guards/login.guard';
import { PermissionGuard } from './core/guards/permission.guard';
import { MenuType } from './core/constants/permissions';

/**
 * Top-level route table for the admin app. Split into two branches:
 * - `auth` — guest-only pages (login, password reset, invitations) rendered
 *   inside the bare auth layout, gated by `LoginGuard` (redirects already
 *   authenticated users away).
 * - `''` (admin) — protected pages rendered inside the admin layout
 *   (sidebar + header), gated by `AuthGuard`, with most feature sections
 *   further gated per-route by `PermissionGuard` using `data.menuType` to
 *   look up the required permission.
 * Feature pages are lazy-loaded via `loadComponent` so they are only
 * fetched when navigated to.
 */
export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

  // Auth routes (guest only, no admin layout)
  {
    path: 'auth',
    canActivate: [LoginGuard],
    loadComponent: () =>
      import('./layouts/auth-layout/auth-layout.component').then(m => m.AuthLayoutComponent),
    children: [
      { path: '', redirectTo: 'login', pathMatch: 'full' },
      {
        path: 'login',
        loadComponent: () => import('./features/authentication/login/login.component').then(m => m.LoginComponent),
        title: 'Sign In — MediAudit',
      },
      {
        path: 'forgot-password',
        loadComponent: () => import('./features/authentication/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent),
        title: 'Forgot Password — MediAudit',
      },
      {
        path: 'reset-password',
        loadComponent: () => import('./features/authentication/reset-password/reset-password.component').then(m => m.ResetPasswordComponent),
        title: 'Reset Password — MediAudit',
      },
      {
        path: 'accept-invitation',
        loadComponent: () => import('./features/authentication/accept-invitation/accept-invitation.component').then(m => m.AcceptInvitationComponent),
        title: 'Accept Invitation — MediAudit',
      },
      {
        path: 'otp-verification',
        loadComponent: () => import('./features/authentication/otp-verification/otp-verification.component').then(m => m.OtpVerificationComponent),
        title: 'OTP Verification — MediAudit',
      },
    ],
  },

  // Admin routes (protected, inside admin layout with sidebar + header)
  {
    path: '',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./layouts/admin-layout/admin-layout.component').then(m => m.AdminLayoutComponent),
    children: [
      {
        path: 'dashboard',
        canActivate: [PermissionGuard],
        children: [
          {
            path: '',
            loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
            title: 'Dashboard — MediAudit',
          },
          {
            path: 'org-analytic',
            loadComponent: () => import('./features/org-analytic/org-analytic').then(m => m.OrgAnalytic),
            title: 'Org Analytic Dashboard — MediAudit',
            data: { title: 'Org Analytic Dashboard', subtitle: '', dashboardType: 'organization' },
          },
        ],
        data: { title: 'Dashboard', subtitle: '', menuType: MenuType.Dashboard },
      },
      {
        path: 'team-management',
        canActivate: [PermissionGuard],
        children: [
          {
            path: '',
            loadComponent: () => import('./features/users/users-list/users-list.component').then(m => m.UsersListComponent),
            title: 'Team Management — MediAudit',
            data: { title: 'Team Management', subtitle: '' },
          },
          {
            path: 'user-form',
            loadComponent: () => import('./features/users/users-list/user-form/user-form.component').then(m => m.UserFormComponent),
            title: 'Add User — MediAudit',
            data: { title: 'Add User', subtitle: '' },
          },
          {
            path: 'user-form/:id',
            loadComponent: () => import('./features/users/users-list/user-form/user-form.component').then(m => m.UserFormComponent),
            title: 'Edit User — MediAudit',
            data: { title: 'Edit User', subtitle: '' },
          },
          {
            path: 'role-form',
            loadComponent: () => import('./features/users/roles-list/role-form/role-form.component').then(m => m.RoleFormComponent),
            title: 'Add Role — MediAudit',
            data: { title: 'Add Role', subtitle: '' },
          },
          {
            path: 'role-form/:id',
            loadComponent: () => import('./features/users/roles-list/role-form/role-form.component').then(m => m.RoleFormComponent),
            title: 'Edit Role — MediAudit',
            data: { title: 'Edit Role', subtitle: '' },
          },
        ],
        data: { title: 'Team Management', subtitle: '', menuType: MenuType.User },
      },
      {
        path: 'provider-management',
        canActivate: [PermissionGuard],
        children: [
          {
            path: '',
            loadComponent: () => import('./features/provider-management/provider-management').then(m => m.ProviderManagement),
            title: 'Provider Management — MediAudit',
            data: { title: 'Provider Management', subtitle: '' },
          },
          {
            path: 'add-provider',
            loadComponent: () => import('./features/provider-management/provider-form/provider-form').then(m => m.ProviderForm),
            title: 'Add Provider — MediAudit',
            data: { title: 'Add Provider', subtitle: '' },
          },
          {
            path: 'edit-provider/:id',
            loadComponent: () => import('./features/provider-management/provider-form/provider-form').then(m => m.ProviderForm),
            title: 'Edit Provider — MediAudit',
            data: { title: 'Edit Provider', subtitle: '' },
          },
          {
            path: 'view/:id',
            loadComponent: () => import('./features/provider-management/provider-view/provider-view').then(m => m.ProviderView),
            title: 'View Provider — MediAudit',
            data: { title: 'View Provider', subtitle: '' },
          },
          {
            path: ':id/patients',
            loadComponent: () => import('./features/provider-management/provider-patients/provider-patients.component').then(m => m.ProviderPatientsComponent),
            title: 'Provider Patients — MediAudit',
            data: { title: 'Provider Patients', subtitle: '' },
          },
          {
            path: 'patients/:providerId/claim/:id',
            loadComponent: () => import('./features/claim-analyst/view-claim-analyst/view-claim-analyst').then(m => m.ViewClaimAnalyst),
            title: 'View Claim — MediAudit',
            data: { title: 'View Claim', subtitle: '' },
          },
          {
            path: 'provider-analytic/:providerId',
            loadComponent: () => import('./features/provider-management/provider-analytic/provider-analytic').then(m => m.ProviderAnalytic),
            title: 'Provider Analytics — MediAudit',
            data: { title: 'Provider Analytics', subtitle: '' },
          },
        ],
        data: { title: 'Provider Management', subtitle: '', menuType: MenuType.Provider },
      },
      {
        path: 'patient-management',
        canActivate: [PermissionGuard],
        children: [
          {
            path: '',
            loadComponent: () => import('./features/patient-management/patient-management').then(m => m.PatientManagement),
            title: 'Patient Management — MediAudit',
            data: { title: 'Patient Management', subtitle: '' },
          },
          {
            path: 'add-patient',
            loadComponent: () => import('./features/patient-management/patient-form/patient-form').then(m => m.PatientForm),
            title: 'Add Patient — MediAudit',
            data: { title: 'Add Patient', subtitle: '' },
          },
          {
            path: 'edit-patient/:id',
            loadComponent: () => import('./features/patient-management/patient-form/patient-form').then(m => m.PatientForm),
            title: 'Edit Patient — MediAudit',
            data: { title: 'Edit Patient', subtitle: '' },
          },
          {
            path: 'view/:id',
            loadComponent: () => import('./features/patient-management/patient-view/patient-view').then(m => m.PatientView),
            title: 'View Patient — MediAudit',
            data: { title: 'View Patient', subtitle: '' },
          },
          {
            path: 'profile/:patientId',
            data: { title: 'Patient Profile', subtitle: '' },
            children: [
              {
                path: '',
                loadComponent: () => import('./features/patient-management/patient-profile/patient-profile').then(m => m.PatientProfile),
                title: 'Patient Profile — MediAudit',
              },
              {
                path: 'claim/:id',
                loadComponent: () => import('./features/claim-analyst/view-claim-analyst/view-claim-analyst').then(m => m.ViewClaimAnalyst),
                title: 'View Claim — MediAudit',
                data: { title: 'View Claim', subtitle: '' },
              },
            ],
          },
          {
            path: 'org-analytic',
            loadComponent: () => import('./features/org-analytic/org-analytic').then(m => m.OrgAnalytic),
            title: 'Org Analytic Dashboard — MediAudit',
            data: { title: 'Org Analytic Dashboard', subtitle: '', dashboardType: 'client' },
          },
          {
            path: 'patient-analytic/:patientId',
            loadComponent: () => import('./features/patient-management/patient-analytic/patient-analytic').then(m => m.PatientAnalytic),
            title: 'Patient Analytics — MediAudit',
            data: { title: 'Patient Analytics', subtitle: '' },
          },
        ],
        data: { title: 'Patient Management', subtitle: '', menuType: MenuType.Patient },
      },
      {
        path: 'claim-analyst',
        canActivate: [PermissionGuard],
        children: [
          {
            path: '',
            loadComponent: () => import('./features/claim-analyst/claim-analyst').then(m => m.ClaimAnalyst),
            title: 'Claim Analyst — MediAudit',
            data: { title: 'Claim Analyst', subtitle: '' },
          },
          {
            path: 'validate-claim',
            loadComponent: () => import('./features/claim-analyst/validate-claim/validate-claim').then(m => m.ValidateClaim),
            title: 'Validate Claim — MediAudit',
            data: { title: 'Validate Claim', subtitle: '' },
          },
          {
            path: 'view/:id',
            data: { title: 'View Claim', subtitle: '' },
            children: [
              {
                path: '',
                loadComponent: () => import('./features/claim-analyst/view-claim-analyst/view-claim-analyst').then(m => m.ViewClaimAnalyst),
                title: 'View Claim — MediAudit',
              },
              {
                path: 'failed-notes/:ruleId',
                loadComponent: () => import('./features/claim-analyst/failed-notes/failed-notes').then(m => m.FailedNotes),
                title: 'Failed Notes — MediAudit',
                data: { title: 'Failed Notes', subtitle: '' },
              },
            ]
          },
          {
            path: 'org-analytic',
            loadComponent: () => import('./features/org-analytic/org-analytic').then(m => m.OrgAnalytic),
            title: 'Org Analytic Dashboard — MediAudit',
            data: { title: 'Org Analytic Dashboard', subtitle: '', dashboardType: 'supervisor' },
          },
        ],
        data: { title: 'Claim Analyst', subtitle: '', menuType: MenuType.Claim },
      },
      {
        path: 'bulk-upload',
        canActivate: [PermissionGuard],
        children: [
          {
            path: '',
            loadComponent: () => import('./features/bulk-upload/bulk-upload').then(m => m.BulkUpload),
            title: 'Bulk Upload — MediAudit',
            data: { title: 'Bulk Upload', subtitle: '' },
          },
          {
            path: 'upload',
            loadComponent: () => import('./features/bulk-upload/bulk-upload-form/bulk-upload-form').then(m => m.BulkUploadForm),
            title: 'Bulk Upload — MediAudit',
            data: { title: 'Bulk Upload', subtitle: '' },
          },
          {
            // Read-only view of a batch that has been submitted for validation.
            // Componentless, so the child pages inherit the `:id` param.
            path: ':id/detail',
            data: { title: 'Batch Detail', subtitle: '' },
            children: [
              {
                path: '',
                loadComponent: () => import('./features/bulk-upload/bulk-upload-detail/bulk-upload-detail').then(m => m.BulkUploadDetail),
                title: 'Batch Detail — MediAudit',
              },
              {
                // Per-page failure breakdown for one document of the batch.
                path: 'failed-pages/:docId',
                loadComponent: () => import('./features/bulk-upload/bulk-upload-detail/failed-pages/failed-pages').then(m => m.FailedPages),
                title: 'Failed Pages Reason — MediAudit',
                data: { title: 'Failed Pages Reason', subtitle: '', source: 'detail' },
              },
            ],
          },
          {
            // Same page, resumed from a batch id: Extract navigates here once
            // parsing starts, and the listing's View opens it for a batch that
            // is still processing. Declared after 'upload' and ':id/detail' so
            // those paths win. Componentless, so children inherit `:id`.
            path: ':id',
            data: { title: 'Bulk Upload', subtitle: '' },
            children: [
              {
                path: '',
                loadComponent: () => import('./features/bulk-upload/bulk-upload-form/bulk-upload-form').then(m => m.BulkUploadForm),
                title: 'Bulk Upload — MediAudit',
              },
              {
                // Per-page failure breakdown for one document of a batch that
                // is still being extracted — so it reads the status endpoint.
                path: 'failed-pages/:docId',
                loadComponent: () => import('./features/bulk-upload/bulk-upload-detail/failed-pages/failed-pages').then(m => m.FailedPages),
                title: 'Failed Pages Reason — MediAudit',
                data: { title: 'Failed Pages Reason', subtitle: '', source: 'status' },
              },
            ],
          },
        ],
        data: { title: 'Bulk Upload', subtitle: '', menuType: MenuType.BulkUpload },
      },
      {
        path: 'travel-time',
        canActivate: [PermissionGuard],
        children: [
          {
            path: '',
            loadComponent: () => import('./features/travel-time/travel-time').then(m => m.TravelTime),
            title: 'Travel Time — MediAudit',
            data: { title: 'Travel Time', subtitle: '' },
          },
          {
            path: 'upload',
            loadComponent: () => import('./features/travel-time/travel-time-form/travel-time-form').then(m => m.TravelTimeForm),
            title: 'Travel Time — MediAudit',
            // Names the page itself, not the module — the breadcrumb de-dupes
            // by URL, so repeating the parent's "Travel Time" here rendered
            // the trail as "Travel Time > Travel Time".
            data: { title: 'Validate Notes', subtitle: '' },
          },
          {
            // Read-only view of a batch that has finished extracting: header info
            // + per-provider Extract Data table. Componentless, so the result
            // sub-page inherits the `:id` param.
            path: ':id/detail',
            data: { title: 'Batch Detail', subtitle: '' },
            children: [
              {
                path: '',
                loadComponent: () => import('./features/travel-time/travel-time-detail/travel-time-detail').then(m => m.TravelTimeDetail),
                title: 'Batch Detail — MediAudit',
              },
              {
                // Travel Time Justification – Result page for one provider in the batch.
                path: 'result/:providerId',
                loadComponent: () => import('./features/travel-time/travel-time-result/travel-time-result').then(m => m.TravelTimeResult),
                title: 'Travel Time Result — MediAudit',
                data: { title: 'Travel Time Result', subtitle: '' },
              },
            ],
          },
          {
            // Same upload/extract page, resumed from a batch id: Extract navigates
            // here once processing starts, and the listing's View opens it for a
            // batch that is still extracting. Declared after 'upload' and
            // ':id/detail' so those paths win. Componentless, so children inherit `:id`.
            path: ':id',
            // Same page as 'upload' (resumed for an existing batch), so it
            // carries the same crumb rather than repeating the module name.
            data: { title: 'Validate Notes', subtitle: '' },
            children: [
              {
                path: '',
                loadComponent: () => import('./features/travel-time/travel-time-form/travel-time-form').then(m => m.TravelTimeForm),
                title: 'Travel Time — MediAudit',
              },
            ],
          },
        ],
        data: { title: 'Travel Time', subtitle: '', menuType: MenuType.TravelTime },
      },
      {
        path: 'clone-notes',
        canActivate: [PermissionGuard],
        children: [
          {
            path: '',
            loadComponent: () => import('./features/clone-notes/clone-notes').then(m => m.CloneNotes),
            title: 'Clone Notes — MediAudit',
            data: { title: 'Clone Notes', subtitle: '' },
          },
          {
            path: 'upload',
            loadComponent: () => import('./features/clone-notes/clone-notes-form/clone-notes-form').then(m => m.CloneNotesForm),
            title: 'Clone Notes — MediAudit',
            // Names the page itself, not the module — see the Travel Time
            // equivalent above.
            data: { title: 'Validate Notes', subtitle: '' },
          },
          {
            // Read-only view of a batch that has finished extracting: header info
            // + per-provider Extract Data table. Componentless, so the result
            // sub-page inherits the `:id` param.
            path: ':id/detail',
            data: { title: 'Batch Detail', subtitle: '' },
            children: [
              {
                path: '',
                loadComponent: () => import('./features/clone-notes/clone-notes-detail/clone-notes-detail').then(m => m.CloneNotesDetail),
                title: 'Batch Detail — MediAudit',
              },
              {
                // Clone Notes – Result page for one provider in the batch.
                path: 'result/:providerId',
                loadComponent: () => import('./features/clone-notes/clone-notes-result/clone-notes-result').then(m => m.CloneNotesResult),
                title: 'Clone Notes Result — MediAudit',
                data: { title: 'Clone Notes Result', subtitle: '' },
              },
            ],
          },
          {
            // Same upload/extract page, resumed from a batch id. Declared after
            // 'upload' and ':id/detail' so those paths win. Componentless, so
            // children inherit `:id`.
            path: ':id',
            // Same page as 'upload' (resumed for an existing batch), so it
            // carries the same crumb rather than repeating the module name.
            data: { title: 'Validate Notes', subtitle: '' },
            children: [
              {
                path: '',
                loadComponent: () => import('./features/clone-notes/clone-notes-form/clone-notes-form').then(m => m.CloneNotesForm),
                title: 'Clone Notes — MediAudit',
              },
            ],
          },
        ],
        data: { title: 'Clone Notes', subtitle: '', menuType: MenuType.CloneNotes },
      },
      // {
      //   path: 'claim-data-list',
      //   canActivate: [PermissionGuard],
      //   children: [
      //     {
      //       path: '',
      //       loadComponent: () => import('./features/claim-data-list/claim-data-list').then(m => m.ClaimDataList),
      //       title: 'Claim\'s Data List — MediAudit',
      //       data: { title: 'Claim\'s Data List', subtitle: '' },
      //     },
      //     {
      //       path: 'import',
      //       loadComponent: () => import('./features/claim-data-list/claim-import/claim-import').then(m => m.ClaimImport),
      //       title: 'Import Claim Data — MediAudit',
      //       data: { title: 'Import Claim Data', subtitle: '' },
      //     },
      //     {
      //       path: ':id',
      //       loadComponent: () => import('./features/claim-data-list/claim-batch-detail/claim-batch-detail').then(m => m.ClaimBatchDetail),
      //       title: 'Claim Data Analysis — MediAudit',
      //       data: { title: 'Claim Data Analysis', subtitle: '' },
      //     },
      //     {
      //       path: ':id/claim-records/:recordId',
      //       loadComponent: () => import('./features/claim-data-list/claim-record-detail/claim-record-detail').then(m => m.ClaimRecordDetail),
      //       title: 'Claim Detail — MediAudit',
      //       data: { title: 'Claim Detail', subtitle: '' },
      //     },
      //   ],
      //   data: { title: 'Claim\'s Data List', subtitle: '', menuType: MenuType.Claimdata },
      // },
      {
        path: 'analytic-upload',
        canActivate: [PermissionGuard],
        children: [
          {
            path: '',
            loadComponent: () => import('./features/analytic-upload/analytic-upload').then(m => m.AnalyticUpload),
            title: 'Claim Analytic Upload — MediAudit',
          },
          {
            path: 'result/:id',
            loadComponent: () => import('./features/analytic-upload/analytic-upload-result/analytic-upload-result').then(m => m.AnalyticUploadResult),
            title: 'Import Result — MediAudit',
            data: { title: 'Import Result', subtitle: '' },
          },
        ],
        data: { title: 'Claim Analytic Upload', subtitle: '', menuType: MenuType.AnalyticUpload },
      },
      {
        path: 'analytic-rules',
        canActivate: [PermissionGuard],
        children: [
          {
            path: '',
            loadComponent: () => import('./features/analytic-rules/analytic-rules').then(m => m.AnalyticRules),
            title: 'Threshold Configuration — MediAudit',
            data: { title: 'Threshold Configuration', subtitle: '' },
          },
          {
            path: 'teams/add',
            loadComponent: () => import('./features/analytic-rules/analytic-teams/team-form/team-form').then(m => m.TeamForm),
            title: 'Add Team — MediAudit',
            data: { title: 'Add Team', subtitle: '' },
          },
          {
            // Read-only: the API has no team update endpoint. Declared after
            // 'teams/add' so that path wins.
            path: 'teams/:id',
            loadComponent: () => import('./features/analytic-rules/analytic-teams/team-detail/team-detail').then(m => m.TeamDetail),
            title: 'Team Detail — MediAudit',
            data: { title: 'Team Detail', subtitle: '' },
          },
        ],
        // Either tab's Read permission opens the page; the tabs gate themselves.
        data: { title: 'Threshold Configuration', subtitle: '', menuType: [MenuType.AnalyticTeam, MenuType.AnalyticWorkload] },
      },
      {
        path: 'reports-analytics',
        canActivate: [PermissionGuard],
        loadComponent: () => import('./features/reports-analytics/reports-analytics').then(m => m.ReportsAnalytics),
        title: 'Reports & Analytics — MediAudit',
        data: { title: 'Reports & Analytics', subtitle: '', menuType: MenuType.Reports },
      },
      {
        path: 'organizations',
        loadComponent: () => import('./features/organizations/organizations.component').then(m => m.OrganizationsComponent),
        title: 'Organizations — MediAudit',
        data: { title: 'Organizations', subtitle: '' },
      },
      // Masters disabled for now — backend hasn't deployed its menu permissions yet.
      // {
      //   path: 'masters',
      //   canActivate: [PermissionGuard],
      //   children: [
      //     {
      //       path: '',
      //       loadComponent: () => import('./features/masters/masters.component').then(m => m.MastersComponent),
      //       title: 'Masters — MediAudit',
      //       data: { title: 'Masters', subtitle: '' },
      //     },
      //     {
      //       path: 'bhs-form',
      //       loadComponent: () => import('./features/masters/bhs-matrix/bhs-matrix-form/bhs-matrix-form.component').then(m => m.BhsMatrixFormComponent),
      //       title: 'Add BHS Matrix — MediAudit',
      //       data: { title: 'Add BHS Matrix', subtitle: '' },
      //     },
      //     {
      //       path: 'bhs-form/:id',
      //       loadComponent: () => import('./features/masters/bhs-matrix/bhs-matrix-form/bhs-matrix-form.component').then(m => m.BhsMatrixFormComponent),
      //       title: 'Edit BHS Matrix — MediAudit',
      //       data: { title: 'Edit BHS Matrix', subtitle: '' },
      //     },
      //     {
      //       path: 'cpt-form',
      //       loadComponent: () => import('./features/masters/cpt-credentials/cpt-credentials-form/cpt-credentials-form.component').then(m => m.CptCredentialsFormComponent),
      //       title: 'Add CPT to Credential Mapping — MediAudit',
      //       data: { title: 'Add CPT to Credential Mapping', subtitle: '' },
      //     },
      //     {
      //       path: 'cpt-form/:id',
      //       loadComponent: () => import('./features/masters/cpt-credentials/cpt-credentials-form/cpt-credentials-form.component').then(m => m.CptCredentialsFormComponent),
      //       title: 'Edit CPT to Credential Mapping — MediAudit',
      //       data: { title: 'Edit CPT to Credential Mapping', subtitle: '' },
      //     },
      //   ],
      //   data: { title: 'Masters', subtitle: '', menuType: [MenuType.Bhs, MenuType.Cpt] },
      // },
      {
        path: 'audit-logs',
        canActivate: [PermissionGuard],
        loadComponent: () => import('./features/audit-logs/audit-logs.component').then(m => m.AuditLogsComponent),
        title: 'Audit Logs — MediAudit',
        data: { title: 'Audit Logs', subtitle: '', menuType: MenuType.Audit },
      },
      // {
      //   path: 'settings',
      //   canActivate: [PermissionGuard],
      //   loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent),
      //   title: 'Settings — MediAudit',
      //   data: { title: 'Settings', subtitle: '', menuType: MenuType.Settings },
      // },
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent),
        title: 'My Profile — MediAudit',
        data: { title: 'My Profile', subtitle: '' },
      },
    ],
  },

  // 404
  {
    path: '**',
    redirectTo: 'dashboard',
  },
  // {
  //   path: '**',
  //   loadComponent: () => import('./features/not-found/not-found.component').then(m => m.NotFoundComponent),
  //   title: '404 — MediAudit',
  // },
];
