import { api } from './gitlab-api';
import { LineRange, parseDiff } from './parse-diff';

export interface FileDiffResult {
  oldPath: string;
  newPath: string;
  changedRanges: LineRange[];
}

const codeExtensions = [
  '.js',
  '.ts',
  '.jsx',
  '.tsx',
  '.mjs',
  '.cjs',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.php',
  '.py',
  '.rb',
  '.java',
  '.kt',
  '.kts',
  '.go',
  '.rs',
  '.dart',
  '.lua',
  '.sh',
  '.bash',
  '.zsh',
  '.bat',
  '.cmd',
  '.ps1',
  '.vbs',
  '.wsf',
  '.sql',
  '.cs',
  '.scala',
  '.hs',
  '.erl',
  '.ex',
  '.exs',
];

export async function getChangedFiles(
  projectId: number,
  mergeRequestId: number
): Promise<FileDiffResult[]> {
  // Fetch the merge request changes
  const changes = await api.MergeRequests.allDiffs(projectId, mergeRequestId);

  // Filter the files with .ts, .js, or .php extension
  const filteredFiles = changes
    .filter(diff => codeExtensions.some(ext => diff.new_path.endsWith(ext)))
    .map(diff => ({
      oldPath: diff.old_path,
      newPath: diff.new_path,
      changedRanges: parseDiff(diff.diff),
    }));

  // Log the filtered files
  filteredFiles.forEach(path => console.log(`File: ${path.newPath}`));

  // Return the filtered files
  return filteredFiles;
}

export interface MRFileVersions {
  oldFile: string | null;
  newFile: string;
  changedRanges: LineRange[];
}

export async function getOldAndNewFileVersions(
  projectId: number,
  mergeRequestId: number,
  fileDiff: FileDiffResult
): Promise<MRFileVersions> {
  // Fetch the merge request
  const mergeRequest = await api.MergeRequests.show(projectId, mergeRequestId);

  // Get the source and target branches of the merge request
  const sourceBranch = mergeRequest.source_branch;
  const targetBranch = mergeRequest.target_branch;

  // Fetch the file from the source branch (new version)
  const newFile = (await api.RepositoryFiles.showRaw(
    projectId,
    fileDiff.newPath,
    sourceBranch
  )) as string;

  // Fetch the file from the target branch (old version)
  let oldFile: string | null;

  try {
    oldFile = (await api.RepositoryFiles.showRaw(
      projectId,
      fileDiff.oldPath,
      targetBranch
    )) as string;
  } catch (error) {
    // File might not exist in the target branch (e.g., if it was added in this merge request)
    if ((error as any).description === '404 File Not Found') {
      oldFile = null;
    } else {
      throw error;
    }
  }
  return { oldFile, newFile, changedRanges: fileDiff.changedRanges };
}
