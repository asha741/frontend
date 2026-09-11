/**
 * Filter operator enum matching the backend's `.NET` FilterOperatorType, plus a
 * mapper from Kendo Grid operator strings. Ported from the reference app.
 */
export enum FilterOperatorType {
  IsLessThan = 0,
  IsLessThanOrEqualTo = 1,
  IsEqualTo = 2,
  IsNotEqualTo = 3,
  IsGreaterThanOrEqualTo = 4,
  IsGreaterThan = 5,
  StartsWith = 6,
  EndsWith = 7,
  Contains = 8,
  IsContainedIn = 9,
  DoesNotContain = 10,
  IsNull = 11,
  IsNotNull = 12,
  IsEmpty = 13,
  IsNotEmpty = 14,
  IsNullOrEmpty = 15,
  IsNotNullOrEmpty = 16,
}

/**
 * Maps a Kendo Grid filter operator string (e.g. 'eq', 'gte', 'contains') to
 * the matching backend `FilterOperatorType`.
 * @param operator Kendo operator string; case-insensitive.
 * @returns The matching enum value, or `undefined` if the operator has no backend equivalent (e.g. 'isnullorempty').
 */
export function mapOperatorToEnum(operator: string): FilterOperatorType | undefined {
  switch ((operator ?? '').toLowerCase()) {
    case 'lt':
      return FilterOperatorType.IsLessThan;
    case 'lte':
      return FilterOperatorType.IsLessThanOrEqualTo;
    case 'eq':
      return FilterOperatorType.IsEqualTo;
    case 'neq':
      return FilterOperatorType.IsNotEqualTo;
    case 'gte':
      return FilterOperatorType.IsGreaterThanOrEqualTo;
    case 'gt':
      return FilterOperatorType.IsGreaterThan;
    case 'startswith':
      return FilterOperatorType.StartsWith;
    case 'endswith':
      return FilterOperatorType.EndsWith;
    case 'contains':
      return FilterOperatorType.Contains;
    case 'doesnotcontain':
      return FilterOperatorType.DoesNotContain;
    case 'isnull':
      return FilterOperatorType.IsNull;
    case 'isnotnull':
      return FilterOperatorType.IsNotNull;
    case 'isempty':
      return FilterOperatorType.IsEmpty;
    case 'isnotempty':
      return FilterOperatorType.IsNotEmpty;
    default:
      return undefined;
  }
}
