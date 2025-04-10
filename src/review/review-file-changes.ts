import { FileDiffResult, MRFileVersions } from '@/gitlab/file-versions';
import completion from '@/reviewer/index';
import { matchComments } from './fuzzy-match-comments';
import { sum } from 'lodash';
import outdent from 'outdent';
import { getLineNumber, getLineNumbers } from './locate-in-source';
import { Hunk } from '@/gitlab/parse-diff';
import { ReviewComment, Severity } from './review-comment';
import { isSameIssue } from './is-same-issue';
import { LANGUAGE } from '@/config/env';

export async function reviewFile(
  paths: FileDiffResult,
  versions: MRFileVersions,
  minSeverity: Severity = Severity.low
): Promise<FinalReviewComment[]> {
  let query = `I am reviewing a merge request. Please review the changes to the file '${paths.newPath}':\n\n`;

  if (versions.oldFile) {
    query += outdent`
    The previous version of the file is:

    \`\`\`
    ${versions.oldFile}
    \`\`\`


    `;
  }

  query += outdent`
  The diff of the file is:

  \`\`\`diff
  ${paths.gitDiff}
  \`\`\`


  `;

  query += outdent`
    Please create a list of any issues you see with the code. and output the following format:

    [
      {
        "comment": "This is the first comment",
        "details": "This is the details of the first comment",
        "severity": "medium",
        "startLine": 52,
        "endLine": 53,
        "refersTo": "  foo = bar[baz];"
      },
      {
        "comment": "This is the second comment",
        "details": "This is the details of the second comment",
        "severity": "high",
        "startLine": 52,
        "endLine": 53,
        "refersTo": "for (const foo of bar) {\\n  baz();\\n}"
      }
    ]

    Format details:
    - The comment should be a short description of the issue
    - The severity should be one of the following: low, medium, high
    - The startLine and endLine should be the line numbers of the code that after patch the diff.
    - The refersTo should be the code that the comment refers to
    - The comment should be in ${LANGUAGE}

    You should check the code for any potential issues, such as:
    - Bugs
    - Performance issues
    - Security vulnerabilities
    - Logic errors
    - Potential improvements
    - Any other issues that you think are important

    But you must to pay attention:
    - Follow the best practices of the programming language
    - Only include issues where you are really confident
    - Ignore any issues related to imports from other files
    - If the code is already perfect, please return an empty list
    - If no such issues exist or you don't know the contents of the file, please return an empty list
    - If you don't know how to answer or are missing key information, please return an empty list
    - You need to answer me in ${LANGUAGE}
    - In any case, only the above format is output, and don't explanation of this output is ignored
    - it's fine to create multiple comments on the same line
  `;

  const responses = await completion.getCompletionMultiple(query, 5);

  const parsedComments = responses.flatMap(response => {
    try {
      return [parseComments(response)];
    } catch (error) {
      return [];
    }
  });

  const finalComments = await getCombinedReviewComments(
    parsedComments,
    versions.newFile,
    paths.hunks,
    minSeverity
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
    console.error('Failed to parse JSON: ', jsonString);
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

export async function getCombinedReviewComments(
  commentsByReview: ReviewComment[][],
  fileContent: string,
  hunks: Hunk[],
  minSeverity: Severity
): Promise<FinalReviewComment[]> {
  // Remove comments that don't apply to changed ranges.
  commentsByReview = commentsByReview.map(reviewComments =>
    reviewComments.filter(comment => {
      const range = getLineNumbers(fileContent, comment.refersTo);
      if (!range) {
        return false;
      }

      for (const hunk of hunks) {
        if (hunk.newStart <= range[0] && hunk.newEnd >= range[1]) {
          return true;
        }
      }

      return false;
    })
  );

  const commentGroups = await matchComments(
    fileContent,
    commentsByReview,
    isSameIssue(fileContent),
    minSeverity
  );

  const finalComments: ReviewCommentOnLine[] = [];
  for (const commentGroup of commentGroups) {
    const severityNumber = sum(
      commentGroup.map(comment => Severity[comment.severity] || 0)
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
