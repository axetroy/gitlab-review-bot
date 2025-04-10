import { FileDiffResult, MRFileVersions } from '@/gitlab/file-versions';
import completion from '@/reviewer/index';
import outdent from 'outdent';
import { ReviewComment } from './review-comment';
import { LANGUAGE } from '@/config/env';

export async function reviewFile(
  paths: FileDiffResult,
  versions: MRFileVersions
): Promise<FinalReviewComment[]> {
  let query = `I am reviewing a merge request. Please review the changes to the file '${paths.newPath}':\n\n`;

  if (versions.oldFile) {
    query += outdent`
    The previous version of the file is the following code block:
    \`\`\`
    ${versions.oldFile}
    \`\`\`

    `;
  }

  query += outdent`
  The diff of the file is the following code block:
  \`\`\`diff
  ${paths.gitDiff}
  \`\`\`

  `;

  query += outdent`
    Please create a list of any issues you see with the code which your are very confident that this is a problem.

    Please output the result in the following format:

    [
      {
        "comment": "This is the first comment",
        "severity": "medium",
        "lineNumber": "+204",
        "line": "  foo = bar[baz];",
        "refersTo": "  foo = bar[baz];"
      },
      {
        "comment": "This is the second comment",
        "severity": "high",
        "lineNumber": "-197",
        "line": "for (const foo of bar) {"
        "refersTo": "for (const foo of bar) {\\n  baz();\\n}"
      }
    ]

    Field explanation:
    - comment: comment is the description of the issue and suggestion to fix it
    - severity: it should be one of the following: low, medium, high
    - lineNumber: the line number of the code that is being commented on, it should be in the format of +N or -N, where N is the line number.
    - line: the line of code that is being commented on
    - refersTo: the line of code that is being commented on, including the context of the code

    In addition, you need to pay attention to the following:
    - Please do not include any comments that are not related to the code
    - Follow the best practices of the programming language
    - Only include issues where you are really confident
    - Ignore any issues related to imports from other files
    - If the code is already perfect, please return an empty list
    - If no such issues exist or you don't know the contents of the file, please return an empty list
    - If you don't know how to answer or are missing key information, please return an empty list
    - You need to answer me in ${LANGUAGE}
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

  console.log('parsedComments-->', JSON.stringify(parsedComments, null, 2));

  const finalComments: FinalReviewComment[] = [];

  for (const comments of parsedComments) {
    for (const comment of comments) {
      if (comment.lineNumber.startsWith('+')) {
        const range = locateRefersTo(
          versions.newFile,
          comment.refersTo,
          Math.abs(parseInt(comment.lineNumber))
        );

        finalComments.push({
          newFile: true,
          range: range,
          comment: comment.comment,
          severity: comment.severity,
        });
      } else if (versions.oldFile && comment.lineNumber.startsWith('-')) {
        const loc = locateRefersTo(
          versions.oldFile,
          comment.refersTo,
          Math.abs(parseInt(comment.lineNumber))
        );

        finalComments.push({
          oldFile: true,
          range: loc,
          comment: comment.comment,
          severity: comment.severity,
        });
      } else {
        const loc = locateRefersTo(
          versions.newFile,
          comment.refersTo,
          Math.abs(parseInt(comment.lineNumber))
        );

        finalComments.push({
          range: loc,
          comment: comment.comment,
          severity: comment.severity,
        });
      }
    }
  }

  return finalComments
    .filter(comment => comment.range !== null)
    .filter(comment => {
      const [start, end] = comment.range!;
      const { oldFile, newFile } = comment;

      // Check if the comment is within the range of any hunk
      return paths.hunks.some(hunk => {
        if (oldFile && hunk.oldStart <= start && hunk.oldEnd >= end) {
          return true;
        }

        if (newFile && hunk.newStart <= start && hunk.newEnd >= end) {
          return true;
        }

        return false;
      });
    });
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

export interface ReviewCommentOnLine {
  line: number;
  comment: string;
  severity: 'low' | 'medium' | 'high';
}

export interface FinalReviewComment {
  oldFile?: boolean;
  newFile?: boolean;
  range: [number, number] | null;
  comment: string;
  severity: 'low' | 'medium' | 'high';
}

/**
 *
 * @param fileContent - 文件内容
 * @param refersTo - 引用的代码
 * @param startLine - 开始行
 * @returns
 */
function locateRefersTo(
  fileContent: string,
  refersTo: string,
  startLine: number
): [number, number] | null {
  const lines = fileContent.split('\n');
  const refersToLines = refersTo.split('\n');

  for (let i = startLine; i < lines.length; i++) {
    if (lines[i] === refersToLines[0]) {
      let j = 0;
      while (j < refersToLines.length && lines[i + j] === refersToLines[j]) {
        j++;
      }
      if (j === refersToLines.length) {
        return [i + 1, i + j];
      }
    }
  }

  return null;
}
