export enum Severity {
  low = 1,
  medium = 2,
  high = 5,
}

export type SeverityLevel = 'low' | 'medium' | 'high';

export type ReviewComment = {
  refersTo: string;
  comment: string;
  severity: 'low' | 'medium' | 'high';
};
