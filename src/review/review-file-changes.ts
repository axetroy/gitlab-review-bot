import { FileDiffResult, MRFileVersions } from '@/gitlab/file-versions';
import completion from '@/reviewer/index';
import { matchComments } from './fuzzy-match-comments';
import { sum } from 'lodash';
import { getLineNumber, getLineNumbers } from './locate-in-source';
import { LineRange } from '@/gitlab/parse-diff';
import { ReviewComment, Severity } from './review-comment';
import { isSameIssue } from './is-same-issue';

export async function reviewFile(
  paths: FileDiffResult,
  versions: MRFileVersions,
  minSeverity: Severity = Severity.low
): Promise<FinalReviewComment[]> {
  let query = `我正在审核一个合并请求。请检查对文件 ${paths.newPath} 的更改:\n\n`;

  if (versions.oldFile) {
    query += `旧版本:\n\n${versions.oldFile}\n\n`;
    query += `新版本:\n\n${versions.newFile}\n\n`;
  } else {
    query += `新文件:\n\n${versions.newFile}\n\n`;
  }

  query += `请列出你在代码中发现的任何问题。仅包含那些你非常确定需要改进的问题。如果没有这样的问题，请保持列表为空。忽略与从其他文件导入相关的问题。问题列表应采用以下格式（同一行上可以有多个评论）:\n\n`;

  query += `[
    {
      "comment": "这是第一个评论",
      "severity": "medium",
      "refersTo": "  foo = bar[baz];"
    },
    {
      "comment": "这个是第个评论",
      "severity": "high",
      "refersTo": "for (const foo of bar) {\\n  baz();\\n}"
    }
  ]`;

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
    paths.changedRanges,
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
  ranges: LineRange[]
): boolean {
  for (const range of ranges) {
    let [rangeStart, rangeEnd] = range;
    rangeEnd = rangeEnd > rangeStart ? rangeEnd : rangeStart;
    rangeStart = rangeStart < rangeEnd ? rangeStart : rangeEnd;
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
  minSeverity: Severity
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
