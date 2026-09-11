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





