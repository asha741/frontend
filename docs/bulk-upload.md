Business Objective

The Bulk Upload module enables organizations to efficiently process large batches of compliance documents by automatically extracting patient-provider relationships, identifying document types using AI, validating required master data, and forwarding valid claim records into the Claim Analyst module for compliance validation.

The system minimizes manual effort while ensuring data accuracy, scalability, and traceability for high-volume document processing.

Functional Flow

Bulk Upload Listing

The Bulk Upload module is accessible from the Organization Admin side navigation menu.

The listing page displays all previously uploaded bulk processing batches.

Screen Components

Button - Bulk Upload

Search (Keyword based Search of the Table Column Data).

Table 

Sr. No.

Batch ID

Treatment Plan

Progress / Clinical Notes

DLA 20

File Size

Uploaded Date

Status (Processing/Pending Verification/Completed/Failed)

Action (View – The View Page will be Shown Conditional like is the Extracting is in Processing then the Bulk Upload page will be Shown and If the Extraction is done and the User has Already Submitted for Claim Validation then the Bulk Detail Page will be Shown.)

Pagination

10 

25 

50 Rows 

Previous / Next

Bulk Upload Button 
User Flow

When the user clicks Bulk Upload System opens the Bulk Upload page.

The page contains:

Upload Documents section

Extract button

Documents Tab

Extract Data Tab

Submit

Cancel

Upload Documents

Supports

Drag & Drop

Browse Files

Supports multiple document upload.

Supported formats

PDF

DOCX

JPG

JPEG

PNG

The uploaded documents are displayed below the upload area.

Each uploaded document can be removed before extraction.

Extract Button

When clicked the system Reads every uploaded document Performs OCR:

Detects document type

Detects patient

Detects provider

Detects visit information

Groups related documents

Populates both tables

If the User has uploaded multi document and click on Extract Button, then the Process will be Start and if the User go back then the Batch will be Shown in the Table List with the Status (Processing) and the User click on the View Icon then the Bulk Upload Screen will open with the Table Tabs and Buttons - (Submit (Only Accessible after the Extraction will Done) & Cancel).
Documents Tab

Sr. No.

Document Name

Status (Processing, Completed, Failed)

Pages Processed

Pages Failed

Failed Reason (View – Clicking on it then the Failed Pages Reason Detail screen will open. In there will be table list with the Sr. No., Page No., Reason)

Pagination Support

Extract Data Tab

Sr. No.

Patient Name (Client ID) (If the Same Patient will have Different Provider, then the Patient Data Row will be Merge and Align to Different Provider.) 

Provider Name (License)

Treatment Plan (Total Notes)

Progress / Clinical Notes (Total Notes)

DLA-20 (Total Notes)

Pagination Support

Example


Patient 

Provider 

Treatment Plan  

Progress / Clinical Notes 

DLA 20 

Alice Monroe (5465) 

 

Dr. Sarah Johnson (LCSW) 

3 

8 

3 

Dr. Michael Brown (LCSW) 

2 

6 

3 

Carol Stevens (4512) 

Dr. Emily Martinez (LPC) 

3 

8 

3 


Buttons

Submit

When user clicks Submit

System Sends records to the Claim Analyst module.

Starts

OCR Processing

AI Validation

Rule Engine Validation

Compliance Scoring

Creates Claim records.

Redirects user back to the Bulk Upload listing.

A new Bulk Upload record is added to the listing.

Cancel

Redirects user back to the Bulk Upload listing without saving.

Bulk Upload Detail Page

Selecting View from the listing opens the Bulk Upload Detail page.

Batch Information
Batch ID
Treatment Plan
Progress / Clinical Notes
DLA 20
Size
Status
Documents Tabs

Sr. No.
Document Name
Status (Processing, Completed, Failed)
Pages Processed
Pages Failed
Failed Reason (View – Clicking on it then the Failed Pages Reason Detail screen will open. In there will be table list with the Sr. No., Page No., Reason)
Pagination Support
Extract Data

Sr. No.
Patient Name (Client ID) (If the Same Patient will have Different Provider, then the Patient Data Row will be Merge and Align to Different Provider.) 
Provider Name (License)
Treatment Plan (Total Notes)
Progress / Clinical Notes (Total Notes)
DLA-20 (Total Notes)
Pagination Support
Claims 
Sr. No.
Claim ID
Patient Name
Provider Name
Documents
AI Status
Compliance Score
Review Status
Upload Date
Action (View)
Claim Details
Access
Claim Listing → View 
Header
Back
Claim Detail — Claim ID
Section 1 – Process Timeline
Displays current stage:
Uploaded
OCR Processed
AI Validated
Reviewer Pending
Pass
Failed
Completed stages shall be visually highlighted.
Section 2 – Patient Information
Patient Name
Provider Name
Claim ID
Review Status
AI Status
Section 3 – Uploaded Documents
Treatment Plan
Document Viewer
Progress / Clinical Notes
Document Viewer
DLA-20
Document Viewer
Section 4 – AI Findings & Analysis
Compliance Score
Example: 92%
Rule Validation Results Table Column
Rule ID
Rule Name
Status
Red Flags
Recommended 
Failed Notes (View – Clicking on it then the Failed Reason Detail Page will open.)
Flag Summary KPIs
High-Priority Flags (Count)
Medium Priority Flags (Count)
Low-Priority Flags (Count)
Section 5 – Reviewer Actions
Reviewer Notes
Type: Text Area
Action: Save Notes
Review Status
Dropdown Options:
Pass
Failed
Business Rule:
Reviewer status is independent from AI Compliance Score.
Reviewer has final authority.
Approve Claim
Initial State: Disabled
Enabled When:
AI Validation Completed
Review Status Selected
Action:
Finalizes claim review.
Stores review decision.
Updates reporting and provider analytics.
Read-only information.

Acceptance Criteria

Upload

The system shall support uploading multiple documents in a single batch.

The system shall support Drag & Drop and Browse File upload methods.

The system shall accept PDF, DOCX, JPG, JPEG, and PNG formats.

Users may upload individual documents or mixed document sets.

Supported Upload Combinations

The system shall correctly process all document combinations including:

One Patient → One Provider

One Patient → Multiple Providers

Multiple Patients → Multiple Providers

Mixed Patient and Provider combinations

The AI shall not assume one patient or one provider per uploaded file.

Document Extraction

The AI engine shall extract document information from document content rather than filenames.

The extracted information includes:

Patient Name

Provider Name

Provider License

Client ID 

Visit ID

Document Type

Service Type

Treatment Plan

Progress / Clinical Notes

DLA-20

Document Mapping Validation

The system shall validate that every document belongs to the correct:

Patient

Provider

Visit ID

Incorrect mappings shall be marked as validation failures.

Required Document Validation

Each extracted patient-provider record shall contain the mandatory compliance documents.

Required documents include:

Treatment Plan

Progress / Clinical Notes

DLA 20

If mandatory documents are missing:

The record shall fail validation.

The failure reason shall be recorded.

Compliance validation shall not execute for that record.

Compliance Validation

Compliance validation shall begin only after:

Patient validation passes.

Provider validation passes.

Required documents are available.

Document mapping is successful.

The Rule Engine shall execute only for eligible records.

Batch Processing

The system shall process uploads asynchronously.

Recommended processing capacity 500–1,000 pages per upload batch.

Processing status shall be displayed as:

Processing

Completed

Failed

Partial Failure Handling

If some records fail validation, the system shall continue processing valid records.

Example:

Total Records: 100

Valid: 98

Failed: 2

The completed records shall proceed to Claim Analyst, while failed records shall remain isolated with clear failure reasons.

Submission

Upon successful submission:

Claim records shall be created in the Claim Analyst module.

OCR processing shall begin.

AI validation shall begin.

Rule Engine validation shall execute.

Compliance scores shall be generated.

Provider and Patient data shall be updated.

Reports and Analytics shall reflect the processed records.

Compliance Scoring

Compliance scores shall be calculated at the Provider level.

Each provider shall receive an independent compliance score based on the Rule Engine, regardless of shared patients.

Business Rules

Bulk Upload supports both individual and consolidated compliance documents. 

Users can Upload other Document before Submit for AI Claim Validation.

AI shall identify document types using document content, not filenames.

The Document will have Client ID that will be Mentioned in all the Documents “Treatment Plan, Clinical Notes, DLA 20”, So based on these Client ID the AI should Map the Documents with the Patient.

Provider information is extracted automatically from the uploaded documents. 

Provider License is displayed alongside the Provider Name in the extracted mapping. 

Claims are created only after the user clicks Submit. 

AI Claim validation begins only after successful submission. 

The Rule Engine shall execute only after mandatory validations are completed.

Records with missing mandatory documents shall not receive compliance scores.

Invalid records shall not prevent valid records from being processed.

Claim validation follows the existing AI Rule Engine and Compliance Score logic implemented in the Claim Analyst module. 

Each generated claim is independently processed through OCR, AI extraction, rule validation, and compliance scoring.

Bulk Upload serves only as an ingestion and extraction module; detailed AI validation, reviewer actions, and compliance decisions are performed within the Claim Analyst module.

Business Logic 

The Bulk Upload module acts as the entry point for high-volume claim document ingestion. 

AI performs OCR, document classification, patient-provider mapping, and document grouping before submission. 

Only successfully extracted and validated records are submitted to the Claim Analyst module for Rule Engine validation and compliance scoring. 

Failed records are isolated with detailed validation reasons while allowing the remaining records in the batch to continue processing. 

All successfully processed records automatically update the Provider Management, Claim Analyst, and Reporting modules, ensuring synchronized data across the platform.

Wireframe : https://rank-surly-40098189.figma.site/