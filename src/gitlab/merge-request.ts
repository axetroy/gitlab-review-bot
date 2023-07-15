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
  minSeverity: SeverityLevel = 'low',
): Promise<void> {
  const changedFiles = await getChangedFiles(projectId, mergeRequestId);

  for (const paths of changedFiles) {
    const { oldFile, newFile, changedRanges } = await getOldAndNewFileVersions(
      projectId,
      mergeRequestId,
      paths,
    );
    const comments = await reviewFile(
      paths,
      {
        oldFile,
        newFile,
        changedRanges,
      },
      Severity[minSeverity],
    );
    await placeComments(projectId, mergeRequestId, comments, paths);
  }
}

export async function placeComments(
  projectId: number,
  mergeRequestId: number,
  comments: FinalReviewComment[],
  file: FileDiffResult,
): Promise<void> {
  // Fetch the specific merge request using the GitLab API
  const mergeRequest = await api.MergeRequests.show(projectId, mergeRequestId);

  // Get the target branch (typically 'master' or 'main') SHA
  const targetBranch = await api.Branches.show(
    projectId,
    mergeRequest.target_branch,
  );
  const base_sha = targetBranch.commit.id;

  // Get source branch SHA
  const sourceBranch = await api.Branches.show(
    projectId,
    mergeRequest.source_branch,
  );
  const head_sha = sourceBranch.commit.id;

  // In this case, as you want start_sha to be equal to base_sha
  const start_sha = base_sha;

  // Iterate over each comment to be placed
  for (const comment of comments) {
    // Use the GitLab API to create the comment on the merge request
    await api.MergeRequestDiscussions.create(
      projectId,
      mergeRequestId,
      comment.comment,
      {
        position: {
          base_sha: base_sha,
          head_sha: head_sha,
          start_sha: start_sha,
          new_path: file.newPath,
          old_path: file.oldPath,
          position_type: 'text',
          new_line: comment.line,
        },
      },
    );
  }
}
