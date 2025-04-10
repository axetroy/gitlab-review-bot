import { api } from './gitlab-api';
import { FinalReviewComment, reviewFile } from '@/review/review-file-changes';
import {
  FileDiffResult,
  getChangedFiles,
  getOldAndNewFileVersions,
} from './file-versions';

async function getCommentsFromFile(
  projectId: number,
  mergeRequestId: number,
  paths: FileDiffResult
) {
  const { oldFile, newFile } = await getOldAndNewFileVersions(
    projectId,
    mergeRequestId,
    paths
  );

  const comments = await reviewFile(paths, {
    oldFile,
    newFile,
    oldPath: paths.oldPath,
    newPath: paths.newPath,
    hunks: paths.hunks,
  });

  return comments;
}

export async function reviewMergeRequest(
  projectId: number,
  mergeRequestId: number,
  onProgress: (
    index: number,
    total: number,
    file: FileDiffResult
  ) => Promise<void>
): Promise<number> {
  const changedFiles = await getChangedFiles(projectId, mergeRequestId);

  let commentCount = 0;

  let index = 1;

  for (const paths of changedFiles) {
    console.log(`Reviewing file: ${paths.newPath}`);

    await onProgress(index++, changedFiles.length, paths);

    const comments = await getCommentsFromFile(
      projectId,
      mergeRequestId,
      paths
    ).catch(async error => {
      console.error('Error during review:', error);

      await api.MergeRequestNotes.create(
        projectId,
        mergeRequestId,
        `Error during review the file ${paths.newPath}: ${error.message}`
      );

      return [];
    });

    commentCount += await placeComments(
      projectId,
      mergeRequestId,
      comments,
      paths
    ).catch(error => {
      console.error('Error placing comments:', error);
      return 0;
    });
  }

  console.log('Review complete. Comments placed:', commentCount);

  return commentCount;
}

export async function placeComments(
  projectId: number,
  mergeRequestId: number,
  comments: FinalReviewComment[],
  file: FileDiffResult
): Promise<number> {
  // Fetch the specific merge request using the GitLab API
  const mergeRequest = await api.MergeRequests.show(projectId, mergeRequestId);

  // Get the target branch (typically 'master' or 'main') SHA
  const targetBranch = await api.Branches.show(
    projectId,
    mergeRequest.target_branch
  );
  const base_sha = targetBranch.commit.id;

  // Get source branch SHA
  const sourceBranch = await api.Branches.show(
    projectId,
    mergeRequest.source_branch
  );
  const head_sha = sourceBranch.commit.id;

  // In this case, as you want start_sha to be equal to base_sha
  const start_sha = base_sha;

  console.log('comment-->', JSON.stringify(comments, null, 2));

  // Iterate over each comment to be placed
  for (const comment of comments) {
    // Use the GitLab API to create the comment on the merge request

    if (comment.newFile) {
      await api.MergeRequestDiscussions.create(
        projectId,
        mergeRequestId,
        comment.comment,
        {
          position: {
            baseSha: base_sha,
            headSha: head_sha,
            startSha: start_sha,
            newPath: file.newPath,
            positionType: 'text',
            newLine: String(comment.range?.at(0)),
          },
        }
      );
    } else if (comment.oldFile) {
      await api.MergeRequestDiscussions.create(
        projectId,
        mergeRequestId,
        comment.comment,
        {
          position: {
            baseSha: base_sha,
            headSha: head_sha,
            startSha: start_sha,
            oldPath: file.oldPath,
            positionType: 'text',
            oldLine: String(comment.range?.at(0)),
          },
        }
      );
    } else {
      await api.MergeRequestDiscussions.create(
        projectId,
        mergeRequestId,
        comment.comment,
        {
          position: {
            baseSha: base_sha,
            headSha: head_sha,
            startSha: start_sha,
            newPath: file.newPath,
            oldPath: file.oldPath,
            positionType: 'text',
            newLine: String(comment.range?.at(0)),
            oldLine: String(comment.range?.at(0)),
          },
        }
      );
    }
  }

  return comments.length;
}
