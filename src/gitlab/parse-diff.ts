import _ from 'lodash';

/** This type represents a range of lines within a diff */
export type LineRange = [number, number];

/**
 * Parses a diff string and extracts line number ranges that were added or modified.
 * @param {string} diff - The diff string to be parsed
 * @returns {LineRange[]} An array of line number ranges
 */
export function parseDiff(diff: string): LineRange[] {
  // Split the diff string into separate lines
  const lines = diff.split('\n');

  // Define a regex pattern for matching hunk headers in the diff
  const pattern = /^@@ -\d+,\d+ \+(\d+),\d+ @@/;

  // Define variables for storing the current line number and the start line number of the current interval
  let lineNumber: number | null = null;
  let currentIntervalStart: number | null = null;

  // Define an array to store the resulting line number ranges
  const lineRanges: LineRange[] = [];

  // Iterate over each line in the diff
  for (const [index, line] of lines.entries()) {
    // Check if the line matches the hunk header pattern
    const match = line.match(pattern);
    if (match) {
      // If we're currently tracking a range, add it to the result array
      if (currentIntervalStart !== null) {
        lineRanges.push([currentIntervalStart, lineNumber! - 1]);
        currentIntervalStart = null;
      }
      // Start tracking a new range starting from the line number in the hunk header
      lineNumber = parseInt(match[1]);
    } else if (lineNumber !== null) {
      // Check if the line indicates an addition, deletion, or no change
      const lineStartsWithPlus = line.startsWith('+');
      const lineStartsWithMinus = line.startsWith('-');
      const lineStartsWithSpace = line.startsWith(' ');

      // If the line indicates an addition or deletion, start tracking a range if not already doing so
      if (
        (lineStartsWithPlus || lineStartsWithMinus) &&
        currentIntervalStart === null
      ) {
        currentIntervalStart = lineNumber;
      }

      // If the line indicates no change or we're at the last line, end the current range and add it to the result array
      if (
        currentIntervalStart !== null &&
        (lineStartsWithSpace || index === lines.length - 1)
      ) {
        lineRanges.push([currentIntervalStart, lineNumber - 1]);
        currentIntervalStart = null;
      }

      // If the line indicates an addition or no change, increment the current line number
      if (lineStartsWithPlus || lineStartsWithSpace) {
        lineNumber += 1;
      }
    }
  }

  // Return the resulting line number ranges
  return lineRanges;
}
