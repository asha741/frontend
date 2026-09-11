import { Pipe, PipeTransform } from '@angular/core';
import { parsePhoneNumber } from 'libphonenumber-js';

/**
 * Formats a 10-digit US phone number for display using `libphonenumber-js`.
 * Any value that isn't exactly 10 characters (including already-formatted
 * strings, empty strings, or non-US-length numbers) is passed through as-is.
 */
@Pipe({
    name: 'phoneFormat',
    standalone: false
})
export class PhoneFormatPipe implements PipeTransform {

  /**
   * @param number raw phone value (expected to be 10 digits, no formatting)
   * @returns the nationally formatted US phone string, e.g. `(123) 456-7890`,
   *   or the original `number` unchanged if it isn't 10 characters long
   */
  transform(number:any) {
    if(number != '' && number?.length == 10){
    const stringPhone = number + '';
    // Delegate to libphonenumber-js rather than manual slicing (see the
    // commented-out fallback below) so formatting stays correct for edge cases.
    const phoneNumber = parsePhoneNumber(stringPhone, 'US');
    const formatted = phoneNumber.formatNational();
    return formatted;
    // return "("+stringPhone.slice(0,3)+") "+ stringPhone.slice(3,6)+"-"+stringPhone.slice(6,10)
    }else{
        return number
    }

  }

}
