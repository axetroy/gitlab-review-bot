import { api } from './gitlab-api';
import { FinalReviewComment, reviewFile } from '@/review/review-file-changes';
import { Severity, SeverityLevel } from '@/review/review-comment';
import {
  FileDiffResult,
  getChangedFiles,
  getOldAndNewFileVersions,
} from './file-versions';
import { Change } from './parse-diff';

async function getCommentsFromFile(
  projectId: number,
  mergeRequestId: number,
  minSeverity: SeverityLevel,
  paths: FileDiffResult
) {
  const { oldFile, newFile } = await getOldAndNewFileVersions(
    projectId,
    mergeRequestId,
    paths
  );

  const comments = await reviewFile(
    paths,
    {
      oldFile,
      newFile,
      oldPath: paths.oldPath,
      newPath: paths.newPath,
      hunks: paths.hunks,
    },
    Severity[minSeverity]
  );

  return comments;
}

export async function reviewMergeRequest(
  projectId: number,
  mergeRequestId: number,
  minSeverity: SeverityLevel = 'low',
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
      minSeverity,
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

    console.log('Comment to file:', file.newPath);
    console.log('Commenting on line:', comment.line);
    console.log('Comment:', comment.comment);

    let change: Change | undefined;

    while (!change) {
      for (const hunk of file.hunks) {
        if (hunk.newStart <= comment.line && hunk.newEnd >= comment.line) {
          change =
            hunk.changes.find(v => v.newLineNumber === comment.line) ||
            hunk.changes.find(v => v.oldLineNumber === comment.line) ||
            hunk.changes.find(v => v.lineNumber === comment.line);

          if (change) {
            break;
          }
        }
      }
    }

    if (!change) {
      console.warn(
        `No change found for line ${comment.line} in file ${file.newPath}`
      );
      continue;
    }

    if (change.isInsert) {
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
            newLine: String(comment.line),
          },
        }
      );
    } else if (change.isDelete) {
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
            oldLine: String(comment.line),
          },
        }
      );
    } else if (change.isNormal) {
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
            newLine: String(comment.line),
            oldLine: String(comment.line),
          },
        }
      );
    }
  }

  return comments.length;
}
