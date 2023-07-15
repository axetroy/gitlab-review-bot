import axios from 'axios';
import { OPENAI_API_KEY } from '@/config/env';
import colors from 'colors';

const headers = {
  Authorization: `Bearer ${OPENAI_API_KEY}`,
  'Content-Type': 'application/json',
};

export type GptModel = 'gpt-3.5-turbo' | 'gpt-4';

export async function getChatCompletion(
  question: string,
  verbose: boolean = true,
  model: GptModel = 'gpt-3.5-turbo',
): Promise<string> {
  const result = await getChatCompletionMulti(question, verbose, 1, model);
  return result[0];
}

export async function getChatCompletionMulti(
  question: string,
  verbose: boolean = true,
  n: number = 1,
  model: GptModel = 'gpt-3.5-turbo',
): Promise<string[]> {
  const data = {
    model,
    messages: [{ role: 'user', content: question }],
    n,
  };

  try {
    if (verbose) {
      console.log(colors.cyan('Requesting'), question.bgGreen.black);
    }
    let response;
    let numberOfTries = 0;
    while (!response) {
      try {
        response = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          data,
          { headers },
        );
      } catch (error) {
        console.log('error', (error as any).response);
        // Failed, retrying
        if (numberOfTries++ > 5) {
          throw error;
        }
      }
    }
    const responseContent: string[] = response.data.choices.map(
      (choice: any) => choice.message.content,
    );
    if (verbose) {
      console.log(
        colors.yellow('Response:'),
        responseContent.join('\n-------\n').yellow,
      );
    }

    return responseContent;
  } catch (error) {
    console.error(colors.red('Error:'), error);
    return [];
  }
}
