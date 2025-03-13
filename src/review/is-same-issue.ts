import completion from '@/reviewer/index';
import { ReviewComment } from './review-comment';

export function isSameIssue(fileContent: string) {
  return async (
    comment1: ReviewComment,
    comment2: ReviewComment
  ): Promise<boolean> => {
    let query = `Do the following two comments describe the same issue on the following file?\n`;

    query += `File content:\n${fileContent}\n`;

    function commentToQuery(comment: ReviewComment): string {
      return `On \`${comment.refersTo}\`: ${comment.comment}\n`;
    }

    query += commentToQuery(comment1);
    query += commentToQuery(comment2);

    const response = await completion.getCompletion(query);
    return response.startsWith('Yes');
  };
}
