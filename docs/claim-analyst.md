The system shall:

Allow users to upload claim documents.

Perform OCR and AI-based extraction.

Execute all configured compliance validation rules.

Calculate Compliance Score.

Display AI findings and rule results.

Allow manual reviewer decisions.

Store finalized claim validation results.

Associate claims with Patients and Providers.

Make validated claim information available within Provider Management reporting.

Access

Side Menu → Claim Analyst

Screen Components

Search & Filters

Keyword-based search across

Claim ID

Patient Name

Provider Name

Filters

Provider Dropdown:

All

Provider List

Review Status Dropdown:

All

Pending

Pass

Failed

AI Status Dropdown:

All

Pending

Validated

Validate Claim

Form Fields

Provider Name *

Type: Dropdown

Source: Provider Management Module

Selection: Single Select

Business Rule: Selected Provider becomes associated with the claim and subsequent analytics.

Treatment Plan Documents *

Upload Methods:

Browse Files

Drag & Drop

Supported Formats:

PDF

DOCX

JPG

JPEG

PNG

Features:

Multiple Upload

Remove Uploaded Document

Progress / Clinical Notes Documents *

Upload Methods:

Browse Files

Drag & Drop

Supported Formats:

PDF

DOCX

JPG

JPEG

PNG

Features:

Multiple Upload

Remove Uploaded Document

DLA-20 Documents *

Upload Methods:

Browse Files

Drag & Drop

Supported Formats:

PDF

DOCX

JPG

JPEG

PNG

Features:

Multiple Upload

Remove Uploaded Document

Patient *

Type: Dropdown

Source: Patient Management Module

Selection: Single Select

Business Rule: Selected Patient becomes associated with the claim.

Buttons - Submit & Cancel

Claim Validation Processing Workflow

Step 1 – Claim Submission

User submits claim.

System generates: Claim ID

Status: Uploaded

Step 2 – OCR Processing

System extracts content from uploaded files.

Status: OCR Processed

Step 3 – AI Extraction

Azure OpenAI extracts:

Patient Information

Provider Information

Service Information

CPT Codes

Diagnosis Codes

Clinical Narrative

Treatment Goals

DLA-20 Deficiencies

Status: AI Processing

Step 4 – Rule Engine Execution

System executes all configured validation rules.

Validation Sources:

Treatment Plan

Progress / Clinical Notes

DLA-20

DBH Claims Audit Tool

Executed Rules:

TP Rules

Authorization Rules

CPT Rules

Modifier Rules

POS Rules

Diagnosis Rules

Billing Rules

Documentation Rules

Travel Feasibility Rules

Fraud Detection Rules

Step 5 – Compliance Score Calculation

System calculates score based on:

Rule Priority

Rule Result

Compliance Scoring Framework

Status: Validated

Step 6 – AI Findings Generation

System generates:

Passed Rules

Failed Rules

Red Flags

Claim Listing Table

Sr. No.

Claim ID

Patient Name

Provider Name

Documents

AI Status

Compliance Score

Review Status

Upload Date

Action (View Details, Delete)

Pagination

Rows Per Page

10

25

50

Page Navigation

Previous

Next

Page Numbers

Claim Details

Access

Claim Listing → View Details

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

Delete Claim

Confirmation Popup Message

Are you sure you want to delete this claim?

Buttons

Delete

Cancel

Business Rule

Deleted claims shall be permanently removed from Claim Listing.

Associated analytics shall be recalculated.

Audit Log entry shall be created.

Provider Management Integration

Validated claims shall automatically populate:

Provider Management → Patient Attended

Provider Management → Claim Details

Conditions

Only claims with: AI Status = Validated

AND

Review Status = Pass or Failed

shall be visible.

Business Rules

Provider selection is mandatory.

Patient selection is mandatory.

At least one document must be uploaded in each required document category:

Treatment Plan

Progress / Clinical Notes

DLA-20

Unsupported file formats shall be rejected.

AI Validation cannot start until all mandatory documents are uploaded.

Compliance Score shall be generated only after successful Rule Engine execution.

Reviewer decision shall override AI recommendation.

Approve Claim shall remain disabled until reviewer status is selected.

Approved claims become available for:

Provider Analytics

Reports & Analytics

Audit Logs

All validation activities shall be auditable.


Wireframe Link - https://rank-surly-40098189.figma.site/