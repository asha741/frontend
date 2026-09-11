The Dashboard module shall provide:

Organization-level performance overview.

Upload activity monitoring.

Compliance score monitoring.

Team activity visibility.

Quick access to platform modules.

Notification management.

Profile management.

Global dashboard filtering.



Dashboard Access & Navigation

Dashboard Access Flow

User successfully completes Login and MFA Authentication.

System redirects user to Dashboard.

Dashboard loads organization-specific information.

User can access portal modules through the side navigation menu.

Dashboard Components

Left Navigation Menu

The system shall display a collapsible Hamburger Navigation Menu containing:

Dashboard

Team Management

Provider Management

Patient Management

Claim Analyst

Reports & Analytics

Audit Logs

Menu Features:

Collapse Navigation Menu

Expand Navigation Menu

Active Menu Highlight

Responsive Navigation

Logout Flow

User clicks Logout.

System terminates active session.

Authentication tokens are invalidated.

User is redirected to Login page.

Business Rules

Only authenticated users can access the dashboard.

Navigation visibility shall be controlled through Role-Based Access Control (RBAC).

Logout shall invalidate all active session tokens.

Business Logic

Load role-specific navigation.

Load organization-specific dashboard data.

Maintain session validation.



Dashboard Header

Header Components

 

Notification Bell:

System shall display Notification Bell icon on the top-right corner.

Features:

Notification Count Badge

Notification List

Notification Timestamp

Mark All as Read

Scrollable Notification Panel

Notification Flow:

New notification is generated.

Notification count increases.

Notification is highlighted as unread.

User clicks Notification Bell.

Notification list opens.

User clicks a notification status change to Read.

Highlight is removed.

Notification Types Examples:

Claim Validation Completed

OCR Processing Completed

AI Validation Completed

Report Generated

Team User Added

Provider Added

Patient Added

Upload Processing Failed

Business Rules

Latest notifications displayed first.

Notification count reflects unread records only.

Mark All as Read updates all unread notifications.

Business Logic

Store notification records.

Track read/unread state.

Update notification counters dynamically.



Profile Management



Profile Menu

The system shall display:

Profile Image

Username

Upon clicking Profile section, a dropdown shall display:

Profile Settings

Logout

Profile Settings Navigation: 

User clicks Profile Settings. 

System redirects to Profile Management screen.

Profile Management Screen

Back Arrow

Page Title: Profile Management

Tabs: 

Profile Details

Change Password



Profile Details

Fields:

Organization Details Section

Organization Name

Organization Logo

Contact Person Details

Profile Photo

First Name

Last Name

Email Address (Read-only)

Contact Number

Buttons: Update Profile & Cancel



Update Profile Flow

User updates profile information.

User clicks Update Profile.

System validates entered data.

Profile is updated successfully.

Success toaster message is displayed.

Cancel Flow

User clicks Cancel.

User is redirected to Dashboard.

Business Rules

First Name is mandatory.

Last Name is mandatory.

Email Address is non-editable.

Contact Number must contain valid phone number format.

Supported logo/image formats:

JPG

PNG

JPEG

Business Logic

Update profile information.

Update organization logo.

Update contact person details.

Validation Messages

Scenario 

Message 

First Name blank 

First Name is required. 

Last Name blank 

Last Name is required. 

Invalid Contact Number 

Please enter a valid contact number. 

Invalid Profile Image 

Unsupported image format. 

Successful Update 

Profile updated successfully. 



Change Password

Fields:

Field 

Type 

Current Password 

Password 

New Password 

Password 

Confirm New Password 

Password 

All password fields shall support:

Show Password Icon

Hide Password Icon

Buttons:

Change Password

Cancel

Change Password Flow

User enters Current Password.

User enters New Password.

User enters Confirm New Password.

User clicks Change Password.

System validates all fields.

System updates password.

User session is terminated.

Success message displayed.

User redirected to Login page.

Cancel Flow

User clicks Cancel.

User redirected to Dashboard.

Password must contain:

Minimum 8 Characters

At least 1 Uppercase Character

At least 1 Lowercase Character

At least 1 Numeric Character

At least 1 Special Character

Business Rules

Current Password must match existing password.

New Password must satisfy password policy.

Confirm Password must match New Password.

New Password cannot be same as Current Password.

User shall be logged out after successful password change.

Business Logic

Validate current password.

Validate password complexity.

Encrypt new password.

Update password.

Invalidate active session.

Redirect to Login page.

Validation Messages

Scenario 

Message 

Current Password blank 

Current Password is required. 

New Password blank 

New Password is required. 

Confirm New Password blank 

Confirm New Password is required. 

Incorrect Current Password 

Current Password is incorrect. 

Password policy failure 

Password does not meet required security criteria. 

Password mismatch 

Confirm Password must match New Password. 

Same as current password 

New Password cannot be the same as Current Password. 

Successful password change 

Password changed successfully. Please login again. 





Dashboard 



Day's & Custom Filter (Applicable only for KPI's)

The Dashboard shall provide the following filter options:

Today

Last 7 Days

Last 15 Days

Last 30 Days

Last 60 Days

Last 90 Days

Alongside these filters, there will be a Custom Date Filter (From–To).

If the user selects a Custom Date range, the KPI data will be displayed based on the selected custom date range.
If the user selects one of the predefined Day filters, the KPI data will be displayed based on the selected day filter, and the Custom Date filter will not be applicable.
Business Rules
Selected filter shall update: KPI Cards

Business Logic

Apply selected date range.

Refresh dashboard data.

Recalculate KPIs.

KPI Summary Cards

KPI Features:

Icon Display

Count Display

Responsive Layout

Real-time Calculation

The Dashboard shall display the following KPI cards:

Total Team Users (Total active admin users within the organization.)

Total Uploads (Total uploaded claim/document batches.)

OCR Processed (Total uploaded files successfully processed by OCR.)

AI Validation Completed (Total claims successfully validated through AI Rule Engine.)

Claims Pending Review (Claims awaiting manual review.)

Human-Based Claims Approved (Claims manually approved by reviewers.)

Total Providers (Total providers registered under organization.)

Total Patients (Total patients available in-patient master.)

Upload Trends Line Graph

Months (X-Axis):

Jan

Feb

Mar

Apr

May

Jun

Jul

Aug

Sep

Oct

Nov

Dec

Upload Volume Example (Y-Axis):

0

75

150

225

300

A Year Filter will be available in the graph section. Based on the selected year, the graph will display data corresponding to that year.
Business Logic

Display uploaded document trends.

Respect selected filter.

Show monthly aggregation.

Compliance Score Trends Line Graph

Months (X-Axis):

Jan

Feb

Mar

Apr

May

Jun

Jul

Aug

Sep

Oct

Nov

Dec

Compliance Score Example (Y-Axis):

80

85

90

95

100

A Year Filter will be available in the graph section. Based on the selected year, the graph will display data corresponding to that year.
Score Calculation Source

Generated from:

Rule Engine Validation Results

Compliance Score Engine

Approved Claim Reviews

Business Logic

Calculate average compliance score.

Display score trends over time.

Respect selected filter.


Wireframe Link - https://rank-surly-40098189.figma.site/