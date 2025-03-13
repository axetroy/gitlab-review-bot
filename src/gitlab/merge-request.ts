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
    const { oldFile, newFile, changedRanges } = await getOldAndNewFileVersions(
      projectId,
      mergeRequestId,
      paths
    );
    const comments = await reviewFile(
      paths,
      {
        oldFile,
        newFile,
        changedRanges,
      },
      Severity[minSeverity]
    );
    await placeComments(projectId, mergeRequestId, comments, paths);
  }
}

export async function placeComments(
  projectId: number,
  mergeRequestId: number,
  comments: FinalReviewComment[],
  file: FileDiffResult
): Promise<void> {
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

  // Iterate over each comment to be placed
  for (const comment of comments) {
    console.log(comment.comment);
    // Use the GitLab API to create the comment on the merge request

    // FIXME: The position object is not being created correctly
    // refs: https://stackoverflow.com/questions/65926187/what-is-a-gitlab-line-code-as-referenced-when-creating-a-new-merge-request-threa
    // refs: https://github.com/jdalrymple/gitbeaker/issues/3433
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
        },
      }
    );
  }
}
