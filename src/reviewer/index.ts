import { REVIEWER } from '@/config/env';
import { CompletionChatGPT } from './chatGPT';

export interface Reviewer {
  getCompletion(question: string): Promise<string>;

  getCompletionMultiple(question: string, n: number): Promise<string[]>;
}

const CompletionFactory = [CompletionChatGPT].find(
  Factory => Factory.name === REVIEWER
);

if (!CompletionFactory) {
  throw new Error(`Reviewer ${REVIEWER} not found`);
}

const completion: Reviewer = new CompletionFactory();

export default completion;
