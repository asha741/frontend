/**
 * Flat API route constants (mirrors the reference app's structure).
 *
 * ⚠️ PLACEHOLDERS — these PascalCase `.NET`-style paths are scaffolded from the
 * current feature set. Replace each value with the real backend controller/action
 * path. IDs are passed in the request body (POST-reads), not in the URL.
 */
export const API_ROUTES = {
  // ── Auth — Organization/Tenant admin (FastAPI — base URL already includes /api/v1) ──
  LOGIN: '/organization/auth/login',
  LOGOUT: '/organization/auth/logout',
  FORGOT_PASSWORD: '/organization/auth/forgot-password',
  RESET_PASSWORD: '/organization/auth/reset-password',
  VERIFY_RESET_TOKEN: '/organization/auth/reset-password/verify',
  VERIFY_INVITE_TOKEN: '/organization/auth/invite/verify',
  MFA_VERIFY: '/organization/auth/mfa/verify',
  MFA_RESEND: '/organization/auth/mfa/resend',

  // ── Users ──
  GET_USERS_KPIS: '/organization/users/kpis',
  GET_USERS: '/organization/users/list',
  GET_USER_BY_ID: '/organization/users/detail',
  ADD_USER: '/organization/users',
  UPDATE_USER: '/organization/users',
  DELETE_USER: '/organization/users',
  DELETE_USER_PERMANENT: '/organization/users/permanent',
  RESEND_INVITATION_LINK: '/organization/users/resend-invite',

  // ── Roles & permissions ──
  GET_ROLES: '/organization/roles/list',
  GET_ROLE_BY_ID: '/organization/roles/detail',
  GET_ROLES_DROPDOWN: '/organization/roles/dropdown',
  GET_PERMISSIONS: '/organization/roles/permissions',
  ADD_ROLE: '/organization/roles',
  UPDATE_ROLE: '/organization/roles',
  DELETE_ROLE: '/organization/roles',
  UPDATE_ROLE_STATUS: '/organization/roles/status',

  // ── Organizations ──
  // NOTE: these still hit the legacy .NET-style controller/action paths
  // (PascalCase, verb-in-path) rather than the newer /organization/* REST
  // paths used elsewhere in this file — not yet migrated to the FastAPI backend.
  GET_ORGANIZATIONS: '/AdminManageOrganization/GetOrganizationList',
  GET_ORGANIZATION_BY_ID: '/AdminManageOrganization/GetOrganizationById',
  ADD_ORGANIZATION: '/AdminManageOrganization/AddOrganization',
  UPDATE_ORGANIZATION: '/AdminManageOrganization/UpdateOrganization',
  DELETE_ORGANIZATION: '/AdminManageOrganization/DeleteOrganization',

  // ── Providers ──
  GET_PROVIDERS: '/organization/providers/list',
  GET_PROVIDER_BY_ID: '/organization/providers/detail',
  ADD_PROVIDER: '/organization/providers/create',
  UPDATE_PROVIDER: '/organization/providers/update',
  DELETE_PROVIDER: '/organization/providers/delete',
  EXPORT_PROVIDERS: '/organization/providers/export',
  IMPORT_PROVIDERS: '/organization/providers/import',
  DOWNLOAD_PROVIDERS_SAMPLE: '/organization/providers/sample-file',
  GET_PROVIDER_CLAIMS: '/organization/providers/claims',
  GET_PROVIDER_CLAIM_DETAIL: '/organization/providers/claims/detail',
  GET_PROVIDER_POWERBI_EMBED: '/organization/providers/powerbi-embed',

  // ── Patients ──
  GET_PATIENTS: '/organization/patients/list',
  GET_PATIENT_BY_ID: '/organization/patients/detail',
  ADD_PATIENT: '/organization/patients/create',
  UPDATE_PATIENT: '/organization/patients/update',
  DELETE_PATIENT: '/organization/patients/delete',
  IMPORT_PATIENTS: '/organization/patients/import',
  EXPORT_PATIENTS: '/organization/patients/export',
  DOWNLOAD_PATIENTS_SAMPLE: '/organization/patients/sample-file',
  GET_PATIENT_DOCUMENT_TYPES: '/organization/patients/document-types',
  GET_PATIENT_DOCUMENTS: '/organization/patients/documents',
  GET_PATIENT_CLAIMS: '/organization/patients/claims',
  GET_PATIENT_CLAIM_DETAIL: '/organization/patients/claims/detail',
  GET_PATIENT_POWERBI_EMBED: '/organization/patients/powerbi-embed',

  // ── Claims ──
  GET_CLAIMS: '/organization/claims/list',
  SUBMIT_CLAIM: '/organization/claims/submit',
  GET_PROVIDER_LOOKUP: '/organization/providers/lookup',
  GET_PATIENT_LOOKUP: '/organization/patients/lookup',
  GET_CLAIM_DETAIL: '/organization/claims/detail',
  GET_CLAIM_STATUS: '/organization/claims/status',
  REVIEW_CLAIM: '/organization/claims/review',
  DELETE_CLAIM: '/organization/claims/delete',
  EXPORT_CLAIM_AUDIT_REPORT: '/organization/claims/audit-report/export',

  // ── Claim Data Analytics ──
  GET_CLAIM_BATCHES: '/organization/claims/batches',
  IMPORT_CLAIM_DATA: '/organization/claims/import',
  DOWNLOAD_CLAIM_IMPORT_TEMPLATE: '/organization/claims/import-template',
  GET_CLAIM_ANALYTICS: '/organization/claims/analytics',
  GET_CLAIM_RECORDS: '/organization/claims/claim-data',
  GET_CLAIM_RECORD_DETAIL: '/organization/claims/claim-records/detail',
  UPDATE_CLAIM_PAYMENT_STATUS: '/organization/claims/claim-records/payment-status',
  GET_CONSECUTIVE_DAYS: '/organization/claims/consecutive-days',
  EXPORT_CONSECUTIVE_DAYS: '/organization/claims/consecutive-days/export',
  EXPORT_CLAIM_DATA: '/organization/claims/claim-data/export',

  // ── Bulk Upload ──
  GET_BULK_UPLOAD_BATCHES: '/organization/bulk-upload/batches/list',
  BULK_UPLOAD_PARSE: '/organization/bulk-upload/parse',
  BULK_UPLOAD_STATUS: '/organization/bulk-upload/status',
  BULK_UPLOAD_SUBMIT_VALIDATION: '/organization/bulk-upload/submit-validation',
  GET_BULK_UPLOAD_BATCH_DETAIL: '/organization/bulk-upload/batches/detail',

  // ── Travel Time ──
  TRAVEL_TIME_UPLOAD_PROCESS: '/organization/travel-time/upload-process',
  TRAVEL_TIME_STATUS: '/organization/travel-time/status',
  GET_TRAVEL_TIME_BATCHES: '/organization/travel-time/batches',
  GET_TRAVEL_TIME_DETAIL: '/organization/travel-time/detail',
  GET_TRAVEL_TIME_PROVIDER_RESULTS: '/organization/travel-time/provider-results',
  // NOTE: the spec's "Submit for Travel Time Validation" step (Pending → Processing)
  // has no confirmed backend endpoint yet — this path is a best-guess placeholder
  // following the section's naming convention; confirm with backend before relying on it.
  TRAVEL_TIME_SUBMIT: '/organization/travel-time/submit',

  // ── Clone Notes ──
  CLONE_NOTES_UPLOAD_PROCESS: '/organization/clone-notes/upload-process',
  CLONE_NOTES_STATUS: '/organization/clone-notes/status',
  GET_CLONE_NOTES_BATCHES: '/organization/clone-notes/batches',
  GET_CLONE_NOTES_DETAIL: '/organization/clone-notes/detail',
  GET_CLONE_NOTES_PROVIDER_RESULTS: '/organization/clone-notes/provider-results',

  // ── Masters ──
  GET_MASTERS_LIST: '/organization/masters/list',
  GET_MASTERS_DETAIL: '/organization/masters/detail',
  CREATE_MASTERS: '/organization/masters/create',
  UPDATE_MASTERS: '/organization/masters/update',
  DELETE_MASTERS: '/organization/masters/delete',
  IMPORT_MASTERS: '/organization/masters/import',
  EXPORT_MASTERS: '/organization/masters/export',
  DOWNLOAD_MASTERS_SAMPLE: '/organization/masters/sample-file',

  // ── Masters — CPT to Credential ──
  GET_CPT_MASTERS_LIST: '/organization/masters/cpt-credentials/list',
  GET_CPT_MASTERS_DETAIL: '/organization/masters/cpt-credentials/detail',
  CREATE_CPT_MASTERS: '/organization/masters/cpt-credentials/create',
  UPDATE_CPT_MASTERS: '/organization/masters/cpt-credentials/update',
  DELETE_CPT_MASTERS: '/organization/masters/cpt-credentials/delete',
  IMPORT_CPT_MASTERS: '/organization/masters/cpt/import',
  EXPORT_CPT_MASTERS: '/organization/masters/cpt/export',
  DOWNLOAD_CPT_MASTERS_SAMPLE: '/organization/masters/cpt/sample-file',

  // ── Reports & Analytics ──
  GET_ORGANIZATION_SUMMARY: '/organization/reports-analytics/organization-summary',
  EXPORT_ORGANIZATION_SUMMARY: '/organization/reports-analytics/organization-summary/export',
  GET_EMPLOYEE_PERFORMANCE: '/organization/reports-analytics/employee-performance',
  EXPORT_EMPLOYEE_PERFORMANCE: '/organization/reports-analytics/employee-performance/export',
  GET_RULE_FAILURE_ANALYSIS: '/organization/reports-analytics/rule-failure-analysis',
  EXPORT_RULE_FAILURE_ANALYSIS: '/organization/reports-analytics/rule-failure-analysis/export',

  // ── Power BI analytics — embedded reports ──
  // Returns { accessToken, embedToken, embedUrl, reportId } for one dashboard
  // type: client | employee | organization | supervisor.
  GET_POWERBI_EMBED_INFO: '/organization/powerbi/embed-info',

  // ── Power BI analytics — uploads ──
  // IMPORT_POWERBI is JSON, not multipart: the file goes to Azure Blob first
  // (FileUploadService) and only its blob name is posted here.
  GET_POWERBI_UPLOADS: '/organization/powerbi/list',
  IMPORT_POWERBI: '/organization/powerbi/import',
  DOWNLOAD_POWERBI_SAMPLE: '/organization/powerbi/download-sample-file',
  DOWNLOAD_POWERBI_FILE: '/organization/powerbi/download-file',
  GET_POWERBI_RESULT: '/organization/powerbi/result',

  // ── Power BI analytics — analytic rules ──
  GET_ANALYTIC_WORKLOAD_RULES: '/organization/powerbi/analytic-rules/workload/list',
  ADD_ANALYTIC_WORKLOAD_RULE: '/organization/powerbi/analytic-rules/workload/',
  UPDATE_ANALYTIC_WORKLOAD_RULE: '/organization/powerbi/analytic-rules/workload/',
  GET_ANALYTIC_SUPERVISORS: '/organization/powerbi/analytic-rules/teams/supervisors',
  GET_ANALYTIC_TEAM_OPTIONS: '/organization/powerbi/analytic-rules/teams/team-options',
  GET_ANALYTIC_TEAMS:'/organization/powerbi/analytic-rules/teams/list',
  ADD_ANALYTIC_TEAM: '/organization/powerbi/analytic-rules/teams/create',
  GET_ANALYTIC_TEAM_DETAIL: '/organization/powerbi/analytic-rules/teams/detail',
  DELETE_ANALYTIC_TEAM: '/organization/powerbi/analytic-rules/teams/',

  // ── Audit logs ──
  GET_AUDIT_LOGS: '/organization/audit/list',
  GET_AUDIT_LOG_FILTERS: '/organization/audit/filters',
  EXPORT_AUDIT_LOGS: '/organization/audit/export',
  VERIFY_AUDIT_LOGS: '/organization/audit/verify',

  // ── Dashboard ──
  // GET_DASHBOARD_STATS/ACTIVITY are also legacy .NET-style paths (see note above);
  // the metrics/profile routes below are the newer FastAPI equivalents.
  GET_DASHBOARD_STATS: '/AdminDashboard/GetDashboardStats',
  GET_DASHBOARD_ACTIVITY: '/AdminDashboard/GetRecentActivity',
  GET_DASHBOARD_METRICS: '/organization/dashboard/metrics',
  GET_ORGANIZATION_PROFILE: '/organization/dashboard/profile',
  UPDATE_ORGANIZATION_PROFILE: '/organization/dashboard/profile',

  // ── Profile ──
  GET_PROFILE: '/organization/auth/profile',
  CHANGE_PASSWORD: '/organization/auth/update-password',
  UPDATE_PROFILE: '/organization/users/profile',
  UPDATE_PROFILE_PICTURE: '/organization/users/profile-picture',

  // ── Settings ──
  GET_CONSECUTIVE_DAYS_THRESHOLD: '/organization/settings/consecutive-days-threshold',
  UPDATE_CONSECUTIVE_DAYS_THRESHOLD: '/organization/settings/consecutive-days-threshold',

  // ── Notifications ──
  GET_NOTIFICATIONS_LIST: '/organization/notifications/list',
  GET_NOTIFICATIONS_COUNT: '/organization/notifications/count',
  MARK_NOTIFICATION_READ: '/organization/notifications/read',
  MARK_ALL_NOTIFICATIONS_READ: '/organization/notifications/read-all',

  // ── Common / masters lookups ──
  GET_COMMON_LIST: '/Common/GetAllMasterStatusList', // legacy .NET-style path (see note above)
  GET_MASTER_LIST: '/meta/enums', // generic dropdown/enum lookups (statuses, types, etc.) from the newer backend
} as const;
