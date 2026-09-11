Travel Time Module – Listing

The Organization Admin shall be able to access the Travel Time module from the Side Hamburger Menu, positioned below the Clone Notes module.

The module shall provide:

Search Bar – keyword-based search across applicable table column data. 

Uploaded Date – From/To date filter. 

Extraction Status filter: 

All 

Processing 

Completed 

Failed 

Travel Time Status filter: 

All 

Pending 

Processing 

Completed 

Validate Notes button. 

Travel Time Batch Listing table.



Travel Time Batch Listing

Column 

Description 

Sr. No. 

Sequential record number 

Travel Batch ID 

Unique identifier generated for each Travel Time batch 

Progress Notes 

Total number of Progress Notes included in the batch 

Total Provider 

Number of Providers identified in the batch 

Total Patient 

Number of Patients identified in the batch 

File Size 

Size of uploaded document/file 

Uploaded Date 

Date/time the batch was uploaded 

Extraction Status 

Processing / Completed / Failed 

Travel Time Status 

Pending / Processing / Completed 

Action 

View icon based on extraction/validation status 

Pagination shall be provided for large datasets with configurable rows per page and page navigation.



Validate Notes – Upload & Extraction Flow

Flow

Travel Time Listing → Validate Notes → Upload Notes → Extract → Review Extracted Data → Submit → AI Travel Time Validation → Travel Time Result

When the Organization Admin clicks Validate Notes, the system shall open the Upload Notes page.



Upload Notes

The page shall contain:

Back option to return to the Travel Time listing. 

Upload Documents section. 

Drag & Drop upload area. 

Browse option. 

Supported format: PDF. 

Maximum file size: 2 GB. 

Upload Progress Notes documents. 

After the document is uploaded, the Extract button shall be available.



Extract

When the user clicks Extract:

The system shall process the uploaded document. 

AI shall extract the relevant information from the Progress Notes. 

AI shall identify and map: 

Provider Name 

Patient Name (ID)

Visit Date 

Visit ID 

Visit Time 

Location 

Address 

The system shall generate the Extract Data table.



Extract Data Table

Column 

Description 

Sr. No. 

Sequential number 

Provider Name (License) 

Extracted and mapped Provider and License 

Total Patient 

Total Patients identified for the Provider 

Total Progress Notes 

Total Progress Notes extracted 

Flag Notes 

Number of notes identified/flagged during Travel Time validation 

Action 

View icon 

Initially, the Flag Notes will be “-” & Action/View icon shall remain disabled because Travel Time validation has not yet been completed.



Submit for Travel Time Validation

After successful extraction, the user shall be able to click Submit.

On clicking Submit:

The extracted Provider, Patient, and Progress Note data shall be submitted for Travel Time validation. 

Travel Time Status shall change from Pending → Processing. 

AI shall perform Travel Time validation. 

The user shall be redirected to the Travel Time listing. 

Once processing is completed, the Travel Time Status shall become Completed. 

The View action shall become accessible. 

If extraction fails, the batch shall display Extraction Status = Failed, and the appropriate error status shall be retained for the batch.



Extraction Status

Status 

Description 

Processing 

AI Extraction is in progress 

Completed 

AI Extraction has completed 

Failed 

Like If the AI Credit Limit Executed,  

When a document has a Failed status, an Info icon should be displayed next to the status. Clicking or hovering over the icon should display the specific reason for the failure. 

Possible failure messages include: 

Required document missing: The Progress Note document(s) are missing; therefore, AI validation cannot be performed. 

Patient not found: The Patient is not available in the system; therefore, validation cannot be processed. 

Provider not found: The Provider is not available in the system; therefore, validation cannot be processed. 

Patient and Provider not found: Both the Patient and Provider are not available in the system; therefore, validation cannot be processed. 



Travel Time Validation Logic

The system shall analyse consecutive visits for the same Provider and determine whether the documented travel time is sufficient compared with the estimated actual travel time between the two visit locations.

For each consecutive visit pair:

Identify Visit 1 and Visit 2. 

Extract the visit date and visit time. 

Identify the Patient associated with each visit. 

Extract the location and address for both visits. 

Calculate the Travel Time Taken based on the time difference between: 

End time of Visit 1 

Start time of Visit 2 

Determine the Actual Time required to travel between the two addresses using the google map/distance service. 

Compare the documented Travel Time Taken against the Actual Time. 

If the Travel Time Taken is less than the Actual Time, the visit pair shall be flagged as Invalid Travel Time. 

Example

Visit 1 ends: 10:00 AM 

Visit 2 starts: 10:15 AM 

Travel Time Taken: 15 minutes 

Actual estimated travel time: 25 minutes 

Since 15 minutes < 25 minutes, the system shall flag the record as: Invalid Travel Time

Travel Time Result Page

Once the Travel Time Status = Completed, clicking the View icon shall open the Travel Time Justification – Result page.

The page shall contain:

Header Information

Back button – returns to the Travel Time extraction/result listing. 

Heading: Travel Time Justification – Result 

Travel Batch ID 

Provider Name 

KPI Cards

Total Notes – Total Progress Notes analysed. 

Invalid Travel Time – Total visit pairs flagged because the documented travel time is less than the Actual Time.

Travel Time Result Table

Column 

Description 

Sr. No. 

Sequential number 

Visit Date 

Date of the visits 

Visit ID's 

Both Visit IDs displayed comma-separated 

Patient Name's 

Patients associated with the two visits 

Visit 1 

Time, Patient Name/ID, Location and Address 

Visit 2 

Time, Patient Name/ID, Location and Address 

Travel Time Taken 

Time available between Visit 1 and Visit 2 

Actual Time 

Estimated travel time between the two addresses 

Result 

Validation result 



Visit 1 / Visit 2 Display

The information shall be displayed vertically within the respective table cell:

Time: 9:00 AM – 10:00 AM 
Patient: Patient Name (ID) 
Location: Home12 
Address: 850 Oak Avenue, Baltimore, MD

The same structure shall be followed for Visit 2.



Result Logic

The system shall apply the following comparison:

Travel Time Taken ≥ Actual Time → Travel time is acceptable. 

Travel Time Taken < Actual Time → Invalid Travel Time and the record shall be flagged. 

The Invalid Travel Time result shall be clearly indicated to the Organization Admin/Users.

The Flag Notes count in the Provider-level Extract Data table shall represent the number of visit pairs identified as having invalid travel time for that Provider.


Wireframe Link - https://claude.ai/public/artifacts/6ead97ae-ece0-4d3a-878b-0266b2b66a84