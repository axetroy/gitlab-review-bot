require('source-map-support').install();
import { testGitlabConnection } from './gitlab/gitlab-api';
import { createWebhookApp } from './gitlab/webhook';
import './utils/replace-promise';

async function main() {
  await testGitlabConnection();
  createWebhookApp();
}

void main();
