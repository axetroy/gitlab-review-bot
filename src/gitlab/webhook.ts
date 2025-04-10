import { SeverityLevel } from '@/review/review-comment';
import express from 'express';
import { toNumber } from 'lodash';
import { GITLAB_WEBHOOK_SECRET, PORT } from '../config/env';
import { api } from './gitlab-api';
import { reviewMergeRequest } from './merge-request';

async function getAllMergeRequestDiscussions(
  projectId: number,
  mergeRequestId: number
) {
  const discussions = [];
  let page = 1;
  let perPage = 100;

  while (true) {
    const results = await api.MergeRequestDiscussions.all(
      projectId,
      mergeRequestId,
      {
        page: page,
        perPage: perPage,
      }
    );

    for (const discussion of results) {
      discussions.push(discussion);
    }

    if (results.length < perPage) {
      break; // No more pages
    }

    page++;
  }

  return discussions;
}

export function createWebhookApp() {
  const app = express();
  app.use(express.json());

  // Middleware to verify webhook secret
  const webhookSecret = GITLAB_WEBHOOK_SECRET;
  if (webhookSecret) {
    app.use((req, res, next) => {
      const requestToken = req.headers['x-gitlab-token'];

      if (requestToken !== webhookSecret) {
        return res.status(401).send('Invalid token');
      }

      next();
    });
  }

  app.post('/webhook', handleWebhookRequest);
  app.listen(toNumber(PORT), '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
  });
  return app;
}

async function handleWebhookRequest(
  req: express.Request,
  res: express.Response
) {
  const data = req.body;

  if (
    data.object_kind === 'note' &&
    data.object_attributes.noteable_type === 'MergeRequest'
  ) {
    const commentBody = data.object_attributes.note;

    handleMergeRequestComment(commentBody, data).catch(error => {
      console.error(
        `Error handling merge request comment: ${error.message}`,
        error
      );
    });
  }

  // Always send a 200 OK response immediately,
  // as the review may take a while and we don't want to keep the webhook connection open.
  res.sendStatus(200);
}

async function handleMergeRequestComment(commentBody: any, data: any) {
  const currentUser = await api.Users.showCurrentUser();
  const mentionsCurrentUser = new RegExp(
    `(\b|\s)?@${currentUser.username}(\b\s)?`
  ).test(commentBody);

  const asksForReview = /(\b\s)?\/review(\b|\s)?/.test(
    commentBody.toLowerCase()
  );

  let severity: SeverityLevel | null = null;
  const severityLevels: SeverityLevel[] = ['low', 'medium', 'high'];

  for (const severityLevel of severityLevels) {
    if (commentBody.includes(severityLevel)) {
      severity = severityLevel;
    }
  }

  if (!severity) {
    // If no severity level is mentioned, default to 'low'
    severity = 'low';
  }

  if (mentionsCurrentUser && asksForReview) {
    console.log('Received webhook:', JSON.stringify(data, null, 2));

    const projectId = data.project_id;
    const mergeRequestId = data.merge_request.iid;
    const currentDiscussionId = data.object_attributes.discussion_id;
    const id = data.object_attributes.id;

    // 获取当前所有机器人的审核，然后清理
    const discussions = await getAllMergeRequestDiscussions(
      projectId,
      mergeRequestId
    );

    for (const discussion of discussions) {
      if (discussion.id === currentDiscussionId) {
        continue;
      }

      for (const note of discussion.notes ?? []) {
        if (note.author.username === currentUser.username) {
          // remove the bot's own comment
          await api.MergeRequestNotes.remove(
            projectId,
            mergeRequestId,
            note.id
          ).catch(error => {
            console.error(
              `Error removing bot's comment ${note.id} from discussion ${discussion.id}:`,
              error
            );
          });
        }
      }
    }

    const note = await api.MergeRequestDiscussions.addNote(
      projectId,
      mergeRequestId,
      currentDiscussionId,
      id,
      `@${data.user.username} 我正在审核这个合并请求。请稍等片刻 ☕️`
    );

    // Call the review function asynchronously
    reviewMergeRequest(
      projectId,
      mergeRequestId,
      async (index, total, file) => {
        const progress = Math.ceil((index / total) * 100);

        await api.MergeRequestNotes.edit(projectId, mergeRequestId, note.id, {
          body: `我正在审核 '${file.newPath}'，进度 ${progress}% (${index}/${total})。请稍等片刻 ☕️`,
        }).catch(console.error);
      }
    )
      .then(async commentCount => {
        await api.MergeRequestNotes.remove(
          projectId,
          mergeRequestId,
          note.id
        ).catch(console.error);

        // Resolve the discussion
        await api.MergeRequestDiscussions.resolve(
          projectId,
          mergeRequestId,
          currentDiscussionId,
          true
        );
      })
      .catch(error => {
        console.error(
          `Error reviewing merge request ${mergeRequestId} of project ${projectId}:`,
          error
        );

        api.MergeRequestNotes.edit(projectId, mergeRequestId, note.id, {
          body: '审核过程中发生错误，请检查日志。',
        });
      });
  }
}
