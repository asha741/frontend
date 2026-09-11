import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Requires an uppercase letter, a lowercase letter, a number, a special
 * character and a minimum length of 8.
 */
export function passwordStrengthValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as string;
    if (!value) return null;
    const hasUpper = /[A-Z]/.test(value);
    const hasLower = /[a-z]/.test(value);
    const hasNumber = /\d/.test(value);
    const hasSpecial = /[^A-Za-z0-9]/.test(value);
    const isLongEnough = value.length >= 8;
    const valid = hasUpper && hasLower && hasNumber && hasSpecial && isLongEnough;
    return valid
      ? null
      : { passwordStrength: { hasUpper, hasLower, hasNumber, hasSpecial, isLongEnough } };
  };
}

/**
 * Enforces the account password policy: 8–12 characters with at least one
 * uppercase letter, one lowercase letter, one special character and one number.
 * Returns the FIRST failing rule as a granular error key so the template can
 * surface a specific message:
 *   required | minLength | maxLength | upperCase | lowerCase | specialChar | number
 */
export function passwordPolicyValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: string = control.value || '';
    const minLength = 8;
    const maxLength = 12;
    if (!value) return { required: true };
    if (value.length < minLength) return { minLength: true };
    if (value.length > maxLength) return { maxLength: true };
    if (!/[A-Z]/.test(value)) return { upperCase: true };
    if (!/[a-z]/.test(value)) return { lowerCase: true };
    if (!/[!@#$%^&*(),.?":{}|<>_-]/.test(value)) return { specialChar: true };
    if (!/[0-9]/.test(value)) return { number: true };
    return null;
  };
}

/** Confirms this control's value matches the sibling control named `fieldName`. */
export function matchFieldValidator(fieldName: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const other = control.parent?.get(fieldName);
    if (!other) return null;
    return control.value === other.value ? null : { fieldMismatch: true };
  };
}

/**
 * Fails when this control's value equals the sibling control named `fieldName`
 * (e.g. the new password must differ from the current password). Skips the
 * check while either value is empty so other validators own the empty state.
 */
export function differentFieldValidator(fieldName: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const other = control.parent?.get(fieldName);
    if (!other) return null;
    if (!control.value || !other.value) return null;
    return control.value === other.value ? { sameAsCurrent: true } : null;
  };
}

/** Rejects values that are only whitespace. */
export function noWhitespaceValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value == null || value === '') return null;
    return String(value).trim().length === 0 ? { whitespace: true } : null;
  };
}

/** Validates a 10-digit (US) phone number, ignoring formatting characters. */
export function phoneValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as string;
    if (!value) return null;
    const digits = value.replace(/\D/g, '');
    return digits.length === 10 ? null : { phone: true };
  };
}
