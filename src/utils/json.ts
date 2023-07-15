/** Simple wrapper for JSON.stringify with formatting */
export function toJSON(data: any): string {
  return JSON.stringify(data, null, ' ');
}
