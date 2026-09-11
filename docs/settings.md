The Organization Admin shall be able to:

Access the Settings module from the Organization Admin Portal.

Configure the organization's Consecutive Days Threshold.

Update the threshold at any time.

Save the updated threshold.

View the configured threshold in the Consecutive Day Analysis detail screen as a read-only value.

Have the configured threshold automatically applied during Consecutive Day Analysis processing.

Flow

Configure Consecutive Days Threshold

Organization Admin navigates to Settings from the left-side navigation menu.

The system opens the Settings page.

The page displays the section Consecutive Days Configuration.

The Organization Admin enters or updates the Consecutive Days Threshold.

The user clicks Save Settings.

The system validates the entered value.

Upon successful validation:

The threshold value is saved.

A success toaster message is displayed.

The configured threshold becomes the organization's active configuration.

During future Claim Data Analytics processing, the system uses this threshold to evaluate provider consecutive working days.

The configured threshold is displayed as a Read-Only value in the Consecutive Day Analysis detail screen.

Validation

Consecutive Days Threshold

Mandatory field.

Accepts numeric values only.

Integer values only (no decimals).

Minimum value: 1

Maximum value: 31

Values outside the allowed range display an inline validation message.

Blank values are not permitted.

Sample Validation Messages

"Consecutive Days Threshold is required."

"Only numeric values are allowed."

"Threshold must be between 1 and 31 days."

Business Rules

Each Organization maintains its own Consecutive Days Threshold configuration.

Only users with appropriate administrative permissions can modify the threshold.

The latest saved threshold becomes the active configuration immediately.

The configured threshold is referenced during every Claim Data Analytics processing cycle.

Providers whose consecutive working days exceed the configured threshold shall be automatically marked as ⚠ Flagged.

Providers whose consecutive working days are within the configured threshold shall be marked as Within Acceptable Range.

The threshold displayed on the Consecutive Day Analysis page is read-only and cannot be modified from that screen.

Any modification to the threshold configuration shall be recorded in the Audit Logs.

Business Logic

Retrieve the organization's current Consecutive Days Threshold during page load.

Validate the user-entered threshold before saving.

Store the threshold as an organization-level configuration.

During Claim Data Analytics processing:

Retrieve the configured threshold.

Calculate each provider's consecutive working day streak.

Compare the calculated streak against the configured threshold.

Automatically assign the provider status:

Within Acceptable Range (≤ configured threshold)

⚠ Flagged (> configured threshold)

Display the configured threshold in the Consecutive Day Analysis detail page as a read-only reference.


Wireframe Link - https://rank-surly-40098189.figma.site/