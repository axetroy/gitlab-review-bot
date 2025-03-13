import _, { isFinite, isNumber, sum, sumBy } from 'lodash';
import { calculateSimilarity, locateInSource } from './locate-in-source';
import { ReviewComment, Severity } from './review-comment';

export type Review = ReviewComment[];

/**
 * Find intersection size between two line ranges.
 * @param comment1 The first review comment.
 * @param comment2 The second review comment.
 * @returns The intersection size.
 */
function findIntersection(
  comment1: { start: number; end: number },
  comment2: { start: number; end: number },
): number {
  return Math.max(
    0,
    Math.min(comment1.end, comment2.end) -
      Math.max(comment1.start, comment2.start),
  );
}

interface CommentInfo {
  start: number;
  end: number;
}

interface ReviewCommentWithId extends ReviewComment {
  id: string;
}

export function getCommentInfo(
  code: string,
  comment: ReviewComment,
): CommentInfo | null {
  const result = locateInSource(code, comment.refersTo);
  if (!result) return null;
  const [start, end] = result;
  return {
    start,
    end,
  };
}

export function averageSeverity(comments: ReviewComment[]): Severity {
  return (
    sumBy(comments, comment => Severity[comment.severity] || 0) /
    comments.length
  );
}

export function commentDistance(
  code: string,
  comment1: ReviewComment,
  comment2: ReviewComment,
): number {
  const comment1Info = getCommentInfo(code, comment1);
  const comment2Info = getCommentInfo(code, comment2);

  if (!comment1Info || !comment2Info) {
    return Infinity;
  }

  // If the quotes don't intersect, the distance is Infinity
  const intersection = findIntersection(comment1Info, comment2Info);
  if (intersection === 0) {
    return Infinity;
  }

  // Now we compute the similarity of the quotes between 0 and 1
  const quoteSimilarity = calculateSimilarity(
    comment1.refersTo,
    comment2.refersTo,
  );

  return 1 - quoteSimilarity;
}

function generateCombinations(
  code: string,
  reviews: ReviewComment[][],
): ReviewCommentWithId[][] {
  const threshold = Math.ceil(reviews.length / 2);

  // Add ids to each comment
  const reviewsWithId = reviews.map((review, reviewIndex) =>
    review.map((comment, commentIndex) => ({
      ...comment,
      id: `${reviewIndex}-${commentIndex}`,
    })),
  );

  // Flatten the list of comments
  const allComments = _.flatten(reviewsWithId);

  const validCombinations: ReviewCommentWithId[][] = [];
  const distanceMatrix: Record<string, number> = {};

  const combinations = (combination: ReviewCommentWithId[], index: number) => {
    for (let i = index; i < allComments.length; i++) {
      const newCombination = [...combination, allComments[i]];

      // if the combination length is 2 or more, calculate distance
      if (newCombination.length > 1) {
        let sumDistance = 0;
        for (let j = 0; j < newCombination.length - 1; j++) {
          const comment1 = newCombination[j];
          const comment2 = newCombination[newCombination.length - 1]; // the newly added comment

          const distanceKey = `${comment1.id}-${comment2.id}`;
          if (!(distanceKey in distanceMatrix)) {
            distanceMatrix[distanceKey] = commentDistance(
              code,
              comment1,
              comment2,
            );
          }

          sumDistance += distanceMatrix[distanceKey];
        }
        sumDistance /= newCombination.length;

        if (isFinite(sumDistance) && sumDistance <= 1) {
          validCombinations.push(newCombination);
          combinations(newCombination, i + 1);
        }
      } else {
        validCombinations.push(newCombination);
        combinations(newCombination, i + 1);
      }
    }
  };

  combinations([], 0);

  // Filter valid combinations to only include groups meeting the threshold
  const validGroups = validCombinations.filter(group => {
    const reviewIndices = _.uniq(
      group.map(comment => comment.id.split('-')[0]),
    );
    return reviewIndices.length >= threshold;
  });

  return validGroups;
}

function calculateSumDistance(code: string, group: ReviewComment[]): number {
  let sum = 0;

  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      sum += commentDistance(code, group[i], group[j]);
    }
  }

  // Larger groups are better, so we divide by the group size
  return sum / group.length;
}

export type IsSameIssueFunc = (
  comment1: ReviewComment,
  comment2: ReviewComment,
) => Promise<boolean>;

async function filterValidGroups(
  isSameIssue: IsSameIssueFunc,
  groups: ReviewCommentWithId[][],
): Promise<ReviewCommentWithId[][]> {
  const comparisonCache = new Map<string, boolean>();
  const validGroups: ReviewCommentWithId[][] = [];
  const invalidCommentIds = new Set<string>();
  let comparisonCount = 0;

  for (const group of groups) {
    if (comparisonCount >= 10) break;

    let validGroup = true;

    for (let i = 0; i < group.length - 1; i++) {
      const comment1 = group[i];
      const comment2 = group[i + 1];

      if (
        invalidCommentIds.has(comment1.id) ||
        invalidCommentIds.has(comment2.id)
      ) {
        validGroup = false;
        break;
      }

      const cacheKey = `${comment1.id}-${comment2.id}`;

      if (!comparisonCache.has(cacheKey)) {
        comparisonCount++;
        const sameIssue = await isSameIssue(comment1, comment2);
        comparisonCache.set(cacheKey, sameIssue);
      }

      if (!comparisonCache.get(cacheKey)) {
        validGroup = false;
        break;
      }
    }

    if (validGroup) {
      validGroups.push(group);
      group.forEach(comment => invalidCommentIds.add(comment.id));
    }
  }

  return validGroups;
}

export async function matchComments(
  code: string,
  reviews: Review[],
  isSameIssue: IsSameIssueFunc,
  minSeverity: Severity,
): Promise<ReviewCommentWithId[][]> {
  let combinations = generateCombinations(code, reviews).filter(combination => {
    const distance = calculateSumDistance(code, combination);
    return isFinite(distance) && distance <= 1;
  });

  // We don't even need to consider groups that don't match the min severity
  combinations = combinations.filter(
    group => averageSeverity(group) >= minSeverity,
  );

  const sortedCombinations = combinations.sort((group1, group2) => {
    // Check group sizes
    if (group1.length > group2.length) {
      return -1;
    }
    if (group1.length < group2.length) {
      return 1;
    }

    // If sizes are equal, then compare sum of distances
    const sum1 = calculateSumDistance(code, group1);
    const sum2 = calculateSumDistance(code, group2);

    return sum1 - sum2;
  });

  const validGroups = await filterValidGroups(isSameIssue, sortedCombinations);

  return validGroups;
}
