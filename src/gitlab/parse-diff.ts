/** 表示一个差异中的行号范围 */
export type LineRange = [number, number];

/**
 * 解析一个差异字符串，并提取出新增或修改的行号范围。
 * @param {string} diff - 要解析的差异字符串
 * @returns {LineRange[]} 一个包含行号范围的数组
 */
export function parseDiff(diff: string): LineRange[] {
  const lines = diff.split('\n');
  const hunkHeaderPattern = /^@@ -\d+,\d+ \+(\d+),\d+ @@/;

  let currentLineNumber: number | null = null;
  let rangeStart: number | null = null;
  const lineRanges: LineRange[] = [];

  for (const line of lines) {
    const hunkHeaderMatch = line.match(hunkHeaderPattern);

    if (hunkHeaderMatch) {
      // 如果正在追踪一个区间，先结束它
      if (rangeStart !== null) {
        lineRanges.push([rangeStart, currentLineNumber! - 1]);
        rangeStart = null;
      }
      // 提取新的起始行号
      currentLineNumber = parseInt(hunkHeaderMatch[1]);
    } else if (currentLineNumber !== null) {
      if (line.startsWith('+')) {
        // 新增行，开始新的区间（如果尚未开始）
        if (rangeStart === null) {
          rangeStart = currentLineNumber;
        }
        currentLineNumber++;
      } else if (line.startsWith(' ')) {
        // 未更改行，结束当前区间（如果正在追踪）
        if (rangeStart !== null) {
          lineRanges.push([rangeStart, currentLineNumber - 1]);
          rangeStart = null;
        }
        currentLineNumber++;
      }
      // 删除行不影响行号，仅跳过
    }
  }

  // 如果最后还有未结束的区间，补充到结果中
  if (rangeStart !== null) {
    lineRanges.push([rangeStart, currentLineNumber! - 1]);
  }

  return lineRanges;
}

export interface Hunk {
  oldStart: number;
  oldEnd: number;
  newStart: number;
  newEnd: number;
  oldLines: number;
  newLines: number;
  changes: Change[];
}

export interface Change {
  type: 'insert' | 'delete' | 'normal';
  isInsert?: boolean;
  isDelete?: boolean;
  isNormal?: boolean;
  lineNumber?: number;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export function parseDiff2(diff: string): Hunk[] {
  const lines = diff.split('\n');
  const hunkHeaderPattern = /^@@ -(\d+),(\d+) \+(\d+),(\d+) @@/;

  const sections: Hunk[] = [];
  let oldLineNumber: number = 0;
  let newLineNumber: number = 0;

  for (const line of lines) {
    const hunkHeaderMatch = line.match(hunkHeaderPattern);

    if (hunkHeaderMatch) {
      const [, oldStartLine, oldLineCount, newStartLine, newLineCount] =
        hunkHeaderMatch;
      sections.push({
        oldStart: Number(oldStartLine),
        oldEnd: Number(oldStartLine) + Number(oldLineCount) - 1,
        newStart: Number(newStartLine),
        newEnd: Number(newStartLine) + Number(newLineCount) - 1,
        oldLines: Number(oldLineCount),
        newLines: Number(newLineCount),
        changes: [],
      });
      oldLineNumber = Number(oldStartLine);
      newLineNumber = Number(newStartLine);
    } else if (sections.length) {
      const section = sections.at(-1)!;
      if (line.startsWith('-')) {
        section.changes.push({
          type: 'delete',
          isDelete: true,
          oldLineNumber: oldLineNumber,
        });
        oldLineNumber++;
      } else if (line.startsWith('+')) {
        section.changes.push({
          type: 'insert',
          isInsert: true,
          newLineNumber: newLineNumber,
        });
        newLineNumber++;
      } else if (line.startsWith(' ')) {
        section.changes.push({
          type: 'normal',
          isNormal: true,
          lineNumber: newLineNumber,
        });
        oldLineNumber++;
        newLineNumber++;
      }
    }
  }

  return sections;
}
