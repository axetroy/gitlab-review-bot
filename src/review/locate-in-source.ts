import _ from 'lodash';

function normalizeWhitespace(str: string): string {
  // remove all whitespace characters, including newlines
  return str.replace(/\s+/g, '');
}

function reconstructOriginalLocation(
  source: string,
  normalizedStart: number,
  normalizedEnd: number,
): [number, number] {
  let originalStart = 0;
  let originalEnd = 0;
  let nonWhitespaceCharsCount = 0;

  for (let i = 0; i < source.length; i++) {
    if (/\s/.test(source[i])) {
      continue; // skip whitespace
    }

    if (nonWhitespaceCharsCount === normalizedStart) {
      originalStart = i;
    }

    if (nonWhitespaceCharsCount === normalizedEnd - 1) {
      originalEnd = i + 1; // end is exclusive
      break;
    }

    nonWhitespaceCharsCount++;
  }

  return [originalStart, originalEnd];
}

export function locateInSource(
  source: string,
  quote: string,
): [number, number] | null {
  // remove all whitespace from both source and quote
  const normalizedSource = normalizeWhitespace(source);
  const normalizedQuote = normalizeWhitespace(quote);

  const normalizedStart = normalizedSource.indexOf(normalizedQuote);
  if (normalizedStart === -1) {
    return null;
  }

  const normalizedEnd = normalizedStart + normalizedQuote.length;

  return reconstructOriginalLocation(source, normalizedStart, normalizedEnd);
}

// The sigmoid function provides an 'S' curve.
// We shift and stretch it to get the desired behaviour.
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-0.15 * (x - 15)));
}

function calculateSubstringScore(quote1: string, quote2: string): number {
  let score = 0;

  for (let len = quote1.length; len >= 5; len--) {
    for (let start = 0; start <= quote1.length - len; start++) {
      const substring = quote1.substr(start, len);
      if (quote2.includes(substring)) {
        return sigmoid(len);
      }
    }
  }

  return score;
}

export function calculateSimilarity(
  comment1: string,
  comment2: string,
): number {
  // normalize the whitespace
  const normalizedComment1 = normalizeWhitespace(comment1);
  const normalizedComment2 = normalizeWhitespace(comment2);

  // if the full strings match, return 1
  if (normalizedComment1 === normalizedComment2) {
    return 1;
  }

  // if only substrings match, calculate the score
  return calculateSubstringScore(normalizedComment1, normalizedComment2);
}

export function getLineNumbers(
  source: string,
  quote: string,
): [number, number] | null {
  const location = locateInSource(source, quote);
  if (location === null) {
    return null;
  }

  // count the number of newline characters up to the start index
  const [start, end] = location;
  const beforeQuote = source.slice(0, start);
  const afterQuote = source.slice(0, end);
  const lineNumberStart = (beforeQuote.match(/\n/g) || []).length + 1;
  const lineNumberEnd = (afterQuote.match(/\n/g) || []).length + 1;

  return [lineNumberStart, lineNumberEnd];
}

export function getLineNumber(source: string, quote: string): number | null {
  const lineNumbers = getLineNumbers(source, quote);
  if (lineNumbers === null) {
    return null;
  } else {
    return lineNumbers[0];
  }
}
