The Patient Management module shall allow Organization Admins to:

Create patient records.

Manage patient information.

Activate or deactivate patients.

Import patient data in bulk.

Export patient data.

Search and filter patient records.

Maintain a patient repository for claim validation workflows.

Flow

User navigates to Patient Management.

System loads Patient Listing.

User may search patients.

User may apply filters.

User may add, edit, delete, import, or export patients.

Search & Filters

Keyword-based search across:

Patient Name

Patient ID

Email Address

Contact Number

City

State

Filters

Status Values:

All (Default)

Active

Inactive

Created Date

From Date

To Date

Buttons

Import

Used for bulk patient import.

Export

Used for exporting patient records.

Add Patient

Opens Add Patient screen.

Add Patient

Flow

User clicks Add Patient.

Add Patient screen opens.

User enters patient information.

User clicks Add Patient.

System validates data.

Patient record created.

Success toaster displayed.

User redirected to Patient Listing.

Screen Components

Navigation

Back Arrow (Return to Patient Listing)

Section 1 – Basic Information

First Name

Last Name

Email Address

Contact Number

Section 2 – Additional Details

State

City

Pin Code

Address

Status

Toggle: Active / Inactive

Buttons

Add Patient

Cancel

Validation Message

Validation 

Message 

First Name Blank 

First Name is required. 

Last Name Blank 

Last Name is required. 

Invalid Email 

Please enter a valid Email Address. 

Contact Number Blank 

Contact Number is required. 

State Blank 

State is required. 

City Blank 

City is required. 

Pin Code Blank 

Pin Code is required. 

Address Blank 

Address is required. 

Business Rules

Patient ID shall be generated automatically.

Active patients shall be available within Claim Analyst patient selection dropdown.

Inactive patients shall not be available for new claim validation activities.

Business Logic

Generate unique Patient ID.

Create patient record.

Store patient information.

Make patient available in Claim Analyst module.

Table Columns

Sr. No.

Patient ID

Patient Name

Email Address

Contact Number

Status (Active/Inactive)

Created Date

Actions (Edit Patient, Delete)

Pagination

Rows Per Page

10

25

50

Page Navigation

Previous

Next

Page Numbers

Edit Patient

Flow

User clicks Actions → Edit Patient.

Edit Patient screen opens.

Existing information displayed.

User updates details.

User clicks Update.

System saves changes.

Success toaster displayed.

User redirected to listing.

Editable Fields

Basic Information

First Name

Last Name

Email Address

Contact Number

Additional Details

State

City

Pin Code

Address

Status

Active

Inactive

Buttons

Update

Cancel

Business Rules 

Patient ID remains non-editable. 

Status changes take effect immediately. 

Inactive patients shall not appear for new claim creation. 

Business Logic 

Update patient information. 

Refresh patient availability across the platform.

Delete Patient

Flow

User clicks Actions → Delete.

Confirmation popup displayed.

User confirms deletion.

Confirmation Message

Are you sure you want to delete this patient?

Buttons

Delete

Cancel

Business Rules

Deleted patients shall not appear in Claim Analyst dropdowns.

Historical validated claims shall retain patient references.

System shall maintain claim audit history.

Business Logic

Remove patient from active patient repository.

Preserve historical claim relationships.

Import Patients

Flow

User clicks Import.

Import popup opens.

User uploads Excel or CSV file.

System validates uploaded data.

Import summary displayed.

Records imported successfully.

Supported Formats

Excel (.xlsx)

CSV (.csv)

Required Import Fields

First Name

Last Name

Contact Number

State

City

Pin Code

Address

Validation Rules

Mandatory fields required.

Duplicate patient records flagged.

Invalid email formats flagged.

Invalid contact numbers flagged.

Business Logic

Validate uploaded file.

Create patient records.

Generate Patient IDs automatically.

Export Patients

Export Formats

Excel (.xlsx)

CSV (.csv)

Export Columns

Patient ID

First Name

Last Name

Email Address

Contact Number

State

City

Pin Code

Address

Status

Created Date

Business Logic

Apply active filters.

Generate export file.

Download file securely.

Integration with Claim Analyst Module

Patient records maintained within Patient Management shall be utilized in:

Claim Analyst

Patient Selection Dropdown

Conditions

Active Patient - Available for selection.

Inactive Patient - Hidden from new claim creation.

Deleted Patient - Unavailable for future claim creation.

Historical Claims - Previously validated claims shall continue displaying associated patient details regardless of current patient status.


Wireframe Link - https://rank-surly-40098189.figma.site/