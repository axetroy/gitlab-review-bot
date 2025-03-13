import axios from 'axios';
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

    try {
      let data: any;
      let numberOfTries = 0;
      while (!data) {
        try {
          data = await fetch(OPENAI_API, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(questionData),
          }).then(res => res.json());
        } catch (error) {
          // Failed, retrying
          if (numberOfTries++ > 5) {
            // throw error;
            throw new Error('Fail to get response from OpenAI');
          }
        }
      }

      const responseContent: string[] = data.choices.map(
        (choice: any) => choice.message.content
      );

      return responseContent;
    } catch (error) {
      console.error(colors.red('Error:'), error);
      return [];
    }
  }
}
