import * as dotenv from "dotenv";

dotenv.config();

export const REVIEWER = process.env.REVIEWER || 'chatGPT';
export const OPENAI_API = process.env.OPENAI_API || 'https://api.openai.com/v1/chat/completions';
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
export const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
export const PORT = process.env.PORT || 3000;
export const GITLAB_HOST = process.env.GITLAB_HOST || 'https://gitlab.com';
export const GITLAB_ACCESS_TOKEN = process.env.GITLAB_ACCESS_TOKEN;
export const GITLAB_WEBHOOK_SECRET = process.env.GITLAB_WEBHOOK_SECRET;
