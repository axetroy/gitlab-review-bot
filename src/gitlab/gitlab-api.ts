import { GITLAB_ACCESS_TOKEN, GITLAB_HOST } from '@/config/env';
import { Gitlab } from '@gitbeaker/node';

export const api = new Gitlab({
  host: GITLAB_HOST,
  token: GITLAB_ACCESS_TOKEN,
  rejectUnauthorized: false,
});

export async function testGitlabConnection() {
  console.log('token', GITLAB_ACCESS_TOKEN);
  try {
    const user = await api.Users.current();
    console.log(
      'Connected to GitLab successfully. Current user:',
      user.username
    );
    return true;
  } catch (error) {
    console.error('Failed to connect to GitLab:', error);
    return false;
  }
}
