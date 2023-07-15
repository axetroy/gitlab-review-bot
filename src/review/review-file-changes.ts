import { FileDiffResult, MRFileVersions } from '@/gitlab/file-versions';
import { getChatCompletionMulti } from '@/gpt/gpt';
import { matchComments } from './fuzzy-match-comments';
import { sum } from 'lodash';
import { getLineNumber, getLineNumbers } from './locate-in-source';
import { LineRange } from '@/gitlab/parse-diff';
import { ReviewComment, Severity } from './review-comment';
import { isSameIssue } from './is-same-issue';

export async function reviewFile(
  paths: FileDiffResult,
  versions: MRFileVersions,
  minSeverity: Severity = Severity.low,
): Promise<FinalReviewComment[]> {
  let query = `I am reviewing a merge request. Please review the changes to the file ${paths.newPath}:\n\n`;

  if (versions.oldFile) {
    query += `Old version:\n\n${versions.oldFile}\n\n`;
    query += `New version:\n\n${versions.newFile}\n\n`;
  } else {
    query += `New file:\n\n${versions.newFile}\n\n`;
  }

  query += `Please create a list of any issues you see with the code. Only include issues where you are really confident that they should be improved. If no such issues exist, leave the list empty. Ignore any issues related to imports from other files. The issues should have the following format (it's fine to create multiple comments on the same line):\n\n`;

  query += `[
    {
      "comment": "This is the first comment",
      "severity": "medium",
      "refersTo": "  foo = bar[baz];"
    },
    {
      "comment": "This is the second comment",
      "severity": "high",
      "refersTo": "for (const foo of bar) {\\n  baz();\\n}"
    }
  ]`;

  const responses = await getChatCompletionMulti(query, true, 5, 'gpt-4');

  const parsedComments = responses.map(response => parseComments(response));

  const finalComments = await getCombinedReviewComments(
    parsedComments,
    versions.newFile,
    paths.changedRanges,
    minSeverity,
  );
  return finalComments;
}

const parseComments = (input: string): ReviewComment[] => {
  // Find the first [ and the last ]
  const start = input.indexOf('[');
  const end = input.lastIndexOf(']');

  // Check if both [ and ] were found
  if (start === -1 || end === -1) {
    throw new Error('Invalid input');
  }

  // Extract the JSON string
  const jsonString = input.slice(start, end + 1);

  try {
    // Parse the JSON string into an array of ReviewComment objects
    const parsed: ReviewComment[] = JSON.parse(jsonString);
    return parsed;
  } catch (err) {
    console.error('Failed to parse JSON: ', err);
    throw new Error('Invalid input');
  }
};

const numberToSeverity: Record<number, 'low' | 'medium' | 'high'> = {
  1: 'low',
  2: 'low',
  3: 'medium',
  4: 'high',
  5: 'high',
};

export interface ReviewCommentOnLine {
  line: number;
  comment: string;
  severity: 'low' | 'medium' | 'high';
}

export interface FinalReviewComment {
  line: number;
  comment: string;
  severity: 'low' | 'medium' | 'high';
}

function checkIntersection(
  startLine: number,
  endLine: number,
  ranges: LineRange[],
): boolean {
  for (const range of ranges) {
    const [rangeStart, rangeEnd] = range;
    if (Math.max(startLine, rangeStart) <= Math.min(endLine, rangeEnd)) {
      return true;
    }
  }
  return false;
}

export async function getCombinedReviewComments(
  commentsByReview: ReviewComment[][],
  fileContent: string,
  changedRanges: LineRange[],
  minSeverity: Severity,
): Promise<FinalReviewComment[]> {
  // Remove comments that don't apply to changed ranges.
  commentsByReview = commentsByReview.map(reviewComments =>
    reviewComments.filter(comment => {
      const range = getLineNumbers(fileContent, comment.refersTo);
      if (!range) {
        return false;
      }

      const [startLine, endLine] = range;
      return checkIntersection(startLine, endLine, changedRanges);
    }),
  );

  const commentGroups = await matchComments(
    fileContent,
    commentsByReview,
    isSameIssue(fileContent),
    minSeverity,
  );

  const finalComments: ReviewCommentOnLine[] = [];
  for (const commentGroup of commentGroups) {
    const severityNumber = sum(
      commentGroup.map(comment => Severity[comment.severity] || 0),
    );

    // Compute the severity as average of each comment in the group
    const severity = numberToSeverity[Math.round(severityNumber)];
    const comment = commentGroup[0];

    finalComments.push({
      comment: comment.comment,
      line: getLineNumber(fileContent, comment.refersTo) || 1,
      severity,
    });
  }

  return finalComments;
}
