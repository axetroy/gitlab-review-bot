import { OPENAI_API, OPENAI_API_KEY, OPENAI_MODEL } from '@/config/env';
import { Reviewer } from './index';
import axios from 'axios';

export class CompletionChatGPT implements Reviewer {
  static name = 'chatGPT';

  async getCompletion(question: string): Promise<string> {
    const result = await this.getCompletionMultiple(question, 1);
    return result[0];
  }

  async getCompletionMultiple(question: string, n: number): Promise<string[]> {
    const questionData = {
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: question }],
      n,
    };

    const headers = {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    };

    const t1 = process.hrtime.bigint();

    const response = await axios(OPENAI_API, {
      method: 'POST',
      headers: headers,
      data: questionData,
      timeout: 60 * 1000,
    });

    const data = response.data;

    if (!Array.isArray(data.chooses)) {
      const errorMessage = String(data.message) || String(data.error);

      throw new Error('Failed to get response: ' + errorMessage);
    }

    const responseContent: string[] = data.choices.map(
      (choice: any) => choice.message.content
    );

    const t2 = process.hrtime.bigint();

    console.log('Response received in ' + Number(t2 - t1) / 1e9 + ' seconds');

    return responseContent;
  }
}
