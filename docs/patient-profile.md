Access Patient Profile

In the Patient Management listing, the existing Edit Patient action in the Action dropdown shall be renamed to Patient Profile.

Clicking Patient Profile shall open the Patient Profile page.

The Patient Profile page shall contain the following tabs:

Edit Patient

Patient Documents

Patient Claims

Edit Patient Tab

Flow

The Edit Patient tab shall contain the existing Patient Edit form.

The existing patient information and functionality shall remain unchanged.

The current patient data shall be displayed as pre-filled.

The user shall be able to update the available patient information.

Existing Update and Cancel functionality shall be retained.

On successful update, a toaster message shall be displayed.

Business Rules

Only authorized Organization Admin users shall be able to access the Patient Profile.

The existing Patient Management validation rules shall continue to apply.

Patient Documents Tab

Flow

The Patient Documents tab shall display all documents associated with the selected patient.

Search & Filters

The page shall provide:

Search Bar – Keyword-based search against available table data.

Document Type Filter

Treatment Plan

Progress / Clinical Notes

DLA 20

Upload Date Filter

From Date

To Date

Documents Table Column

Sr. No.

Document Type (Treatment Plan, Progress / Clinical Note, DLA 20)

Document Name

Upload Date

Action (View)

View Document

The View action shall open the selected document in the document viewer.

The document shall be available in view-only mode.

Business Rules

Only documents associated with the selected patient shall be displayed.

Document Type and Upload Date filters shall return matching records.

Search shall operate on the available document table data.

Pagination shall be applied when the document list exceeds the configured page size.

Patient Claims Tab

Flow

The Patient Claims tab shall display claim information associated with the selected patient.

KPI Cards

The following KPIs shall be displayed:

Total Claims

Total Treatment Plans

Progress / Clinical Notes

DLA 20 Notes

Failed Claims

Valid Claims

The KPI values shall represent the claim/document data associated with the selected patient.

Claims Table Column

Sr. No.

Claim ID

Provider Name

Documents

AI Status

Compliance Score

Review Status

Upload Date

Action (View)

View Claim

The View action shall open the Claim Detail page.

The Claim Detail page shall be Read Only.

The Claim Detail shall follow the existing read-only Claim Detail functionality currently available from Provider Management.

The user shall be able to review the claim's processing status, patient/provider information, uploaded documents, AI findings, compliance score, rule validation results, and reviewer information as applicable.

Business Rules

Only claims associated with the selected patient shall be displayed.

The Compliance Score shall reflect the score generated during Claim Validation.

AI Status and Review Status shall reflect the status of the associated claim.

Claim information shall remain synchronized with the Claim Analyst module.

No claim information shall be editable from the Patient Claims tab.

Wireframe Link - https://rank-surly-40098189.figma.site/