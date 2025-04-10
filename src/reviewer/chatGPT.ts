import { OPENAI_API, OPENAI_API_KEY, OPENAI_MODEL } from '@/config/env';
import { Reviewer } from './index';
import axios, { AxiosResponse } from 'axios';

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

    let response: AxiosResponse;
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 2000; // 2 second

    while (true) {
      retryCount++;
      if (retryCount > maxRetries) {
        throw new Error('Max retries reached');
      }
      try {
        response = await axios(OPENAI_API, {
          method: 'POST',
          headers: headers,
          data: questionData,
          timeout: 120 * 1000,
        });

        break;
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const errorMessage = String(
            error.response?.data?.error?.message || error.message
          ).toLowerCase();

          // Retry on timeout errors
          if (errorMessage.includes('timeout')) {
            console.log('Retrying in ' + retryDelay / 1000 + ' seconds...');
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          } else {
            console.error('An error occurred:', errorMessage);
            throw new Error('Request failed: ' + errorMessage);
          }
        } else {
          console.error('An unexpected error occurred:', error);
          throw new Error('Unexpected error: ' + error);
        }
      }
    }

    const data = response.data;

    if (!Array.isArray(data.choices)) {
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
