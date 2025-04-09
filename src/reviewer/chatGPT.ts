import { OPENAI_API, OPENAI_API_KEY, OPENAI_MODEL } from '@/config/env';
import colors from 'colors';
import { Reviewer } from './index';

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

    try {
      let data: any;
      let numberOfTries = 0;
      while (!data) {
        console.log('Asking question...');

        try {
          data = await fetch(OPENAI_API, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(questionData),
          }).then(res => res.json());
        } catch (error) {
          // Failed, retrying
          if (numberOfTries++ > 3) {
            // throw error;
            throw new Error('Fail to get response from OpenAI');
          }
        }
      }

      // Skip if the response is error
      if (data?.error || data?.message) {
        console.error(colors.red('Error:'), data.error || data.message);
        return [];
      }

      // Skip if the response is empty
      if (!data?.choices) {
        console.error(colors.red('Error:'), 'No choices in response');
        return [];
      }

      const responseContent: string[] = data.choices.map(
        (choice: any) => choice.message.content
      );

      const t2 = process.hrtime.bigint();

      console.log('Response received in ' + Number(t2 - t1) / 1e9 + ' seconds');

      return responseContent;
    } catch (error) {
      console.error(colors.red('Error:'), error);
      return [];
    }
  }
}
