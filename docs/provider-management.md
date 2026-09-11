The Provider Management module shall allow Organization Admins to:

Create and manage provider records.

Activate or deactivate providers.

Import and export provider data.

View provider performance metrics.

Monitor provider-related claims.

Access claim-level validation results.

Review AI findings and reviewer outcomes.



Providers

Flow

User navigates to Provider Management.

System loads Provider Listing.

User may search providers.

User may apply filters.

User may add, edit, delete, import, or export providers.

User may view provider claim performance.

Screen Components

Search & Filters 

Keyword Search

Searchable Fields:

Provider Name

Provider ID

Email Address

License

Contact Number

Filters

Status: Active / Inactive

Created Date: From - To

Default Value = All

Buttons

Import - Used for bulk provider import through Excel/CSV.

Export - Used for exporting provider records.

Add Provider - Opens Add Provider screen.

Add Provider

Flow

User clicks Add Provider.

Add Provider form opens.

User enters provider information.

User clicks Add Provider.

System validates information.

Provider created successfully.

Success toaster displayed.

User redirected to listing.

Screen Components

Header

Back Arrow

Page Title: Add Provider

Fields

Section 1 – Provider Information

First Name*

Last Name*

Email Address*

Contact Number*

Section 2 – Professional Details

Designation

License

Dropdown populated from master license data example:

Psychiatrist

Psychologist

Licensed Clinical Social Worker (LCSW)

Licensed Professional Counsellor (LPC)

Status

Toggle: Active/ Inactive

Buttons

Add Provider

Cancel

Validation Message

Validation 

Message 

First Name Blank 

First Name is required. 

Last Name Blank 

Last Name is required. 

Email Blank 

Email Address is required. 

Invalid Email 

Please enter a valid Email Address. 

Duplicate Email 

Email Address already exists. 

Contact Number Blank 

Contact Number is required. 

Designation Blank 

Designation is required. 

License Not Selected 

Please select a License. 

Business Rules

Provider Email must be unique within organization.

Active providers shall be available in Claim Analyst dropdown selections.

Inactive providers shall not be available during claim validation.

Business Logic

Create provider record.

Generate unique Provider ID.

Make provider available to Claim Analyst module.

Table Columns

Sr. No.

Provider ID

Provider Name

License

Email Address

Contact Number

Patient Attended 

Performance Score

Status

Created Date

Actions (Edit, Delete)

Pagination

Rows Per Page

10

25

50

Page Navigation

Previous

Next

Page Numbers

Patient Attended

Total number of patients associated with validated claims.

Clickable Count Value.

Performance Score

Overall provider compliance score calculated from validated claims.

Formula: Average Compliance Score across validated claims.

Example: 92%

Edit Provider

Flow

User clicks Actions → Edit.

Edit Provider screen opens.

Existing data displayed.

User updates information.

User clicks Update.

Success toaster displayed.

User redirected to listing.

Editable Fields

First Name

Last Name

Contact Number

Designation

License

Status (Active/Inactive)

Buttons

Update 

Cancel

Business Rules

Email Address remains unique.

Inactive provider will be not in the claim validated form

Status changes take effect immediately.

Business Logic

Update provider information.

Refresh provider availability.

Maintain audit trail.

Delete Provider

Flow

User selects Delete.

Confirmation popup displayed.

User clicks Delete.

System validates deletion criteria.

Provider removed.

Success toaster displayed.

Confirmation Message

"Are you sure you want to delete this provider?"

Buttons

Delete

Cancel

Business Rules

Deleted providers shall no longer appear in Claim Analyst dropdowns.

Historical claim data remains preserved.

Business Logic
Remove provider from active provider directory.

Record deletion activity in audit log.

Import Providers

Flow

User clicks Import.

Upload popup opens.

User uploads Excel/CSV file.

System validates data.

Import summary displayed.

Records created successfully.

Supported Formats

CSV

XLSX

Validation

Required fields present.

Duplicate emails identified.

Invalid licenses flagged.

Export Providers

Export Format

Excel (.xlsx)

CSV (.csv)

Export Columns

Provider ID

Provider Name

License

Email Address

Contact Number

Patient Attended

Performance Score

Status

Created Date



Provider Patient Claims

Access Flow

User clicks Patient Attended count.

Provider Patient Claims screen opens.

Screen Header

Navigation

Back Arrow

Heading

Provider Patient Claims

Provider Details Section

Provider Name

Provider ID

License

KPI Cards

Total Claims

Total Claims Passed

Total Claims Failed

Provider Claim Performance Trend

Graph Type

Multi-Line Graph

X-Axis

Months (Jan – Dec)

Y-Axis

Performance Score

Lines

Claims

Passed

Failed

Claims List Section 

Search

Keyword-based search of the table column data.

Filters

AI Status

All

Pending

Validated

Review Status

All

Pending

Pass

Failed

Upload Date

From Date

To Date

Table Columns

Claim ID

Patient Name

Total Documents

Compliance Score

AI Status

Upload Date

Review Status

Action (View Details)

Empty State

If no validated claims exist Display message: "No validated claims are available for this provider."

Business Rules

Claims displayed only after validation within Claim Analyst module.

Pending uploads shall not appear.

Business Logic

Retrieve validated claims linked to provider.

Aggregate performance metrics.



Claim Detail

Access Flow

User clicks View Details.

Claim Detail screen opens.

Header Components

Back Button

Back to Provider Patient Claims

Heading

Claim Detail – [Claim ID]

Section 1 – Process Status

Displays claim progress stages:

Uploaded

OCR Processed

AI Validated

Reviewer Pending

Pass / Failed

Current step highlighted.

Section 2 – Patient Information

Patient Name

Provider Name

Claim ID

Review Status

AI Status

Section 3 – Uploaded Documents List

Documents Type

Treatment Plan 

Progress / Clinical Notes 

DLA 20 

Document Actions

View Document

Download Document

Section 4 – AI Findings & Analysis

Compliance Score Example: 92%

Rule Validation Results

Rule ID

Rule Name

Status

Red Flags

Flag Summary KPIs

High-Priority Flags (Count)

Medium Priority Flags (Count)

Low-Priority Flags (Count)

Section 5 – Reviewer Action

Reviewer Notes (Read-only)

Displays reviewer comments entered during review process.

Business Rules

Claim Detail screen is View Only.

No editing permitted.

Displays final validation output.

Displays latest reviewer comments.

Business Logic

Retrieve claim validation data.

Retrieve AI findings.

Retrieve reviewer notes.

Display compliance score calculations.


Wireframe Link - https://rank-surly-40098189.figma.site/