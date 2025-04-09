import { api } from './gitlab-api';
import { FinalReviewComment, reviewFile } from '@/review/review-file-changes';
import { Severity, SeverityLevel } from '@/review/review-comment';
import {
  FileDiffResult,
  getChangedFiles,
  getOldAndNewFileVersions,
} from './file-versions';

export async function reviewMergeRequest(
  projectId: number,
  mergeRequestId: number,
  minSeverity: SeverityLevel = 'low'
): Promise<void> {
  const changedFiles = await getChangedFiles(projectId, mergeRequestId);

  for (const paths of changedFiles) {
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
        hunks: paths.hunks,
      },
      Severity[minSeverity]
    );

    try {
      await placeComments(projectId, mergeRequestId, comments, paths);
    } catch (error) {
      console.error(error);
    }
  }
}

export async function placeComments(
  projectId: number,
  mergeRequestId: number,
  comments: FinalReviewComment[],
  file: FileDiffResult
): Promise<void> {
  console.log('Placing comments on merge request:', mergeRequestId);

  // Fetch the specific merge request using the GitLab API
  const mergeRequest = await api.MergeRequests.show(projectId, mergeRequestId);

  // Get the target branch (typically 'master' or 'main') SHA
  const targetBranch = await api.Branches.show(
    projectId,
    mergeRequest.target_branch
  );
  const base_sha = targetBranch.commit.id;

  console.log('Base SHA:', base_sha);

  // Get source branch SHA
  const sourceBranch = await api.Branches.show(
    projectId,
    mergeRequest.source_branch
  );
  const head_sha = sourceBranch.commit.id;

  console.log('Head SHA:', head_sha);

  // In this case, as you want start_sha to be equal to base_sha
  const start_sha = base_sha;

  console.log(JSON.stringify(comments, null, 2));

  // Iterate over each comment to be placed
  for (const comment of comments) {
    // Use the GitLab API to create the comment on the merge request

    console.log('Comment to file:', file.newPath);
    console.log('Commenting on line:', comment.line);
    console.log('Comment:', comment.comment);

    const hunk = file.hunks.find(
      hunk => hunk.newStart < comment.line && hunk.newEnd > comment.line
    );

    if (!hunk) {
      console.warn(
        `No hunk found for line ${comment.line} in file ${file.newPath}`
      );
      continue;
    }

    const change =
      hunk.changes.find(v => v.newLineNumber === comment.line) ||
      hunk.changes.find(v => v.oldLineNumber === comment.line) ||
      hunk.changes.find(v => v.lineNumber === comment.line);

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
}
