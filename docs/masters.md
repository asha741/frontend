The Masters module shall be accessible from the left navigation menu and shall contain the following tabs:

BHS Matrix

CPT to Credential

The master data maintained in this module shall be utilized during claim validation, compliance review, and rule engine execution.



BHS Matrix

Flow

User navigates to Masters Module.

System opens the BHS Matrix tab.

System loads BHS Matrix records.

User can search, import, export, edit, or delete records.

Screen Components

Search

Keyword-based search across:

BHS ID

Service Category

Service

Proc-Code

ICD-10

Place of Service

Buttons

Sample File

Import

Export

Table Columns

Sr. No.

Action

BHS ID

Service Category

Service

Proc-Code

Mod1

Mod2

Mod3

Mod4

Place(s)-of-Service Allowed

ICD-10

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

Search shall apply across all searchable columns.

Latest imported data shall be reflected immediately.

Export shall include currently displayed dataset.

Pagination shall be applied for large datasets.

Business Logic

Retrieve BHS Matrix records.

Apply search criteria.

Support data pagination.

Enable import/export operations.

Sample File Download

Flow

User clicks Sample File.

System downloads sample template.

File is downloaded in CSV/XLSX format.

Business Rules

Template shall follow import structure.

Template shall contain column headers only.

Business Logic

Generate downloadable template.

Support CSV and Excel formats.

Import BHS Matrix

Flow

User clicks Import.

Upload popup opens.

User selects file.

User clicks Upload.

System validates file structure.

System validates mandatory fields.

Records are imported successfully.

Success toaster displayed.

Listing refreshes automatically.

Supported Formats

CSV

XLSX

Validation Message

Validation 

Message 

Invalid Format 

Unsupported file format. 

Missing Columns 

Required columns are missing from uploaded file. 

Duplicate BHS ID 

Duplicate BHS ID found. 

Empty Mandatory Data 

Mandatory fields cannot be blank. 

Business Rules

Only valid templates may be imported.

Duplicate BHS IDs shall not be allowed.

Invalid rows shall be rejected.

Business Logic

Validate structure.

Validate mandatory fields.

Import records.

Log import activity.

Export BHS Matrix

Flow

User clicks Export.

System generates file.

Data downloaded in CSV/XLSX format.

Business Logic

Export complete dataset.

Apply active search/filter conditions if applicable.

Edit BHS Matrix

Flow

User clicks Edit icon.

Edit screen opens.

Existing data is pre-filled.

User updates values.

User clicks Update.

Record updated successfully.

Success toaster displayed.

User redirected to listing.

Header

Back Arrow

Edit BHS Matrix

Buttons

Update

Cancel

Business Rules

BHS ID remains unique.

Mandatory fields cannot be blank.

Business Logic

Update selected record.

Save audit history.

Delete BHS Matrix Record

Flow

User clicks Delete icon.

Confirmation popup appears.

User clicks Delete.

Record removed successfully.

Success toaster displayed.

Confirmation Message

"Are you sure you want to delete this BHS Matrix record?"

Buttons

Delete

Cancel

Business Logic

Delete selected record.

Record deletion in audit logs.


CPT to Credential

Flow

User opens CPT to Credential tab.

System loads credential mappings.

User may search, filter, add, edit, or delete records.

Screen Components

Search & Filter

Search Bar

Keyword-based search across:

License

CPT Code

Filter

License (Dropdown with the Data)

Table Columns

Sr. No.

Action

License

CPT Code

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

Retrieve mappings.

Apply search.

Apply license filters.

Paginate results.

Add CPT to Credential Mapping

Flow

User clicks Add.

Add Mapping screen opens.

User enters required information.

User clicks Add.

System validates data.

Mapping created successfully.

Success toaster displayed.

User redirected to listing.

Header

Back Arrow

Add CPT to Credential Mapping

Fields

License* 

(Dropdown with Data:

Psychiatrists

Psychologists

Licensed Independent Clinical Social Workers (LICSW)

APRNs

Licensed Professional Counsellor (LPC)

Licensed Marriage and Family Therapist (LMFT)

Licensed Graduate Professional Counsellor (LGPC)

Licensed Graduate Social Worker (LGSW)

Physician Assistants (PAs))

Allowed CPT Codes*

Service Description

Allowed CPT Codes Field

Features:

Numeric Only

Maximum 5 Digits

Multi-Value Entry

Add Button

Enter Key Support

Remove CPT Code Option

Buttons

Add

Cancel

Validation Message

Validation 

Message 

License Blank 

License is required. 

CPT Code Blank 

At least one CPT Code is required. 

Duplicate CPT Code 

CPT Code already exists for selected License. 

Business Rules

License selection is mandatory.

At least one CPT Code must be added.

CPT Codes must contain exactly 5 digits.

Business Logic

Validate CPT code structure.

Save mapping.

Create audit history.

Edit CPT to Credential Mapping

Flow

User clicks Edit icon.

System opens Edit screen.

Existing values are displayed.

User updates mapping.

User clicks Update.

Mapping updated successfully.

Success toaster displayed.

User redirected to listing.

Buttons

Update

Cancel

Business Rules

License remains valid.

CPT Codes must follow format validation.

Business Logic

Update mapping.

Record modification history.

Delete CPT to Credential Mapping

Flow

User clicks Delete icon.

Confirmation popup displayed.

User clicks Delete.

Mapping removed successfully.

Success toaster displayed.

Confirmation Message

"Are you sure you want to delete this CPT to Credential mapping?"

Buttons

Delete

Cancel

Business Logic

Delete selected mapping.

Record deletion activity in audit logs.


Rule Engine Integration

BHS Matrix Usage

The following Rule Engines shall utilize BHS Matrix Master Data:

POS Rules Engine

Coding Rules Engine

Diagnosis Rules Engine

Billing Rules Engine

Medical Necessity Engine

CPT to Credential Usage

The following Rule Engine shall utilize CPT to Credential Master Data: Provider Credential Validation Engine



Wireframe Link - https://rank-surly-40098189.figma.site/