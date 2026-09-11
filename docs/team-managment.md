The Team Management module shall allow Organization Admins to:

Create and manage custom roles.

Configure module-level permissions.

Add and manage organization users.

Invite users to access the platform.

Track invitation status.

Control user activation status.

Assign users to roles.

Manage user lifecycle within the organization.



Roles & Permissions

Flow

Organization Admin navigates to Team Management.

System opens the Roles & Permissions tab.

System displays all available roles.

User may search, filter, create, edit, or delete roles.

Search & Filter

Keyword Search

Role Name

Description

Filter

Created Date: Date Range (From-To)

Table Columns

Sr. No.

Role Name

Description

Assigned Users

Status (Active/Inactive)

Created Date

Actions (Edit Role, Delete)

Pagination

Rows Per Page

10

25

50

Page Navigation

Previous

Next

Page Numbers

Business Rules

Role Name must be unique.

System roles cannot be duplicated.

Search shall apply across all searchable columns.

Filters shall refresh listing data.

Business Logic

Retrieve role data.

Apply search criteria.

Apply date filters.

Display user assignment count.

Paginate results.

Create Role

Flow

User clicks Create Role.

System opens Create Role screen.

User enters role details.

User selects permissions.

User clicks Create Role.

System validates data.

Role is created successfully.

Success toaster message displayed.

User redirected to Roles & Permissions listing.

Screen Components

Header

Back Arrow

Page Title: Create Role

Fields

Role Name*

Description

Status*

Permissions Section

Each module shall support:

All

View

Add

Edit

Delete

Permissions shall be displayed using checkboxes.

Buttons

Create Role

Cancel

Validation Message

Validation 

Message 

Blank Role Name 

Role Name is required. 

Duplicate Role Name 

Role Name already exists. 

No Permission Selected 

Please select at least one permission. 

Business Rules

Role Name must be unique.

At least one permission must be selected.

Status defaults to Active.

Role can be created as Active or Inactive.

Business Logic

Validate uniqueness.

Save permission mapping.

Create role.

Maintain audit log.

Edit Role

Flow

User selects Edit Role.

System loads role details.

Existing data is pre-filled.

User updates details.

User clicks Update Role.

System validates updates.

Role is updated successfully.

Success toaster displayed.

User redirected to listing.

Editable Fields

Role Name

Description

Permissions

Status

Buttons

Update Role

Cancel

Business Rules

Role Name must remain unique.

Assigned permissions update immediately.

Inactive roles cannot be assigned to new users.

Business Logic

Update role details.

Update permission mapping.

Update audit history.

Delete Role

Flow

User selects Delete.

Confirmation popup displayed.

User clicks Delete.

System validates role assignment.

Role deleted successfully.

Confirmation Message

"Are you sure you want to delete this role?"

Buttons

Delete

Cancel

Validation Message

Role Assigned to Users Role cannot be deleted because it is assigned to one or more users.

Business Rules

Assigned roles cannot be deleted.

Unassigned roles can be deleted.

Business Logic

Validate role assignments.

Delete role.

Log deletion activity.



Users

Flow

User navigates to Users tab.

System displays KPI cards.

System displays user listing.

User may search, filter, add, edit, or delete users.

KPI Cards

Total Users

Active Users

Pending Invitations

Search & Filters

Keyword Search

Searchable Fields:

Admin ID

Name

Email Address

Contact Number

Role

Filters

Role: Roles

Status: Active / Inactive

Invitation Status:  Pending / Accepted

Created Date: From - To

Default Value = All

Table Columns

Sr. No.

Admin ID

Name

Email Address

Contact Number

Role

Status

Invitation Status

Created Date

Actions (Resend Invite, Edit User, Delete)

Pagination

Rows Per Page
10

25

50

Page Navigation

Previous

Next

Page Numbers

Business Logic

Display user data.

Apply filters.

Apply keyword search.

Paginate results.

Add User

Flow

User clicks Add User.

Add User form opens.

User enters details.

User selects role.

User clicks Add User.

System validates data.

User account created.

Invitation email sent.

Success toaster displayed.

User redirected to listing.

Screen Components

Header

Back Arrow

Page Title: Add User

Fields

First Name*

Last Name*

Email Address*

Contact Number*

Role* (Dropdown)

Informational Message: "An invitation email will be sent with login credentials and a portal access link."

Buttons

Add User

Cancel

Validation Message

Validation 

Message 

First Name Blank 

First Name is required. 

Last Name Blank 

Last Name is required. 

Invalid Email 

Please enter a valid email address. 

Duplicate Email 

Email address already exists. 

Role Not Selected 

Please select a role. 

Business Rules

Email Address must be unique.

Role selection is mandatory.

Invitation email shall be sent automatically.

Initial User Status = Inactive.

Initial Invitation Status = Pending.

Business Logic

Generate Admin ID.

Create user record.

Send invitation email.

Create audit log.

Resend Invitation

Flow

User clicks Action Menu.

User selects Resend Invite.

System validates invitation status.

Invitation email is resent.

Success toaster message displayed.

Business Rules

Resend Invite available only when Invitation Status = Pending.

Resend Invite hidden/disabled when Invitation Status = Accepted.

New email contains latest portal access details.

Business Logic

Verify invitation status.

Generate fresh invitation token.

Send invitation email.

Record resends activity in audit log.

Edit User

Flow

User selects Edit User.

Existing details are loaded.

User updates permitted fields.

User clicks Update User.

System saves changes.

Success toaster displayed.

Editable Fields

Role

Status

Buttons

Update User

Cancel

Business Rules

Email Address cannot be modified.

Status can be changed manually.

Role can be reassigned.

Business Logic

Update user details.

Maintain change history.

Delete User

Flow

User selects Delete.

Confirmation popup displayed.

User clicks Delete.

User account removed.

Success toaster displayed.

Confirmation Message

"Are you sure you want to delete this user?"

Buttons

Delete

Cancel

Business Logic

Delete user record.

Maintain audit log.



Invitation Acceptance Flow

Flow

Organization Admin creates user.
Invitation email is sent.
User receives: Login URL
System redirects user to First-Time Password Setup page.
User enters:
New Password
Confirm Password
User clicks Update Password.
Password is updated.
Invitation Status changes to Accepted.
User Status automatically changes to Active.
User Login: 
User accesses Login page.
User enters credentials.
MFA verification is initiated.
User enters verification code.
MFA validation succeeds.
User is redirected to Dashboard.
Business Rules

First login requires password change.

Invitation remains Pending until password is updated.

User remains Inactive until invitation acceptance.

MFA verification is mandatory.

Business Logic

Validate MFA.

Force password update.

Activate account.

Update invitation status.

Redirect to dashboard.

Invitation Email Template

 

Subject: Welcome to AI-Powered Healthcare Compliance & Audit Platform

 

Email Body

Hello (User Name)

 

You have been invited to access the AI-Powered Healthcare Compliance & Audit Platform.

Please use the following link to access the platform:

Portal Login Link: {{Portal URL}}

You will be required to verify your identity using MFA and update your password during first login.

Thank You,

{{Organization Name}}



Wireframe Link - https://rank-surly-40098189.figma.site/