# Prerequesites

You will need to create a .env file with the following variables:

```bash
OPENAI_API_KEY=...
GITLAB_HOST=...
GITLAB_ACCESS_TOKEN=...
GITLAB_WEBHOOK_SECRET=... (optional)
```

## Gitlab API token

It is recommended to set up a separate gitlab user for your bot. Once created, follow this guide to set up an API token for this user.

https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html

## OpenAI API Key

Set up an account on OpenAI's website. You have to ensure that GPT-4 access is enabled for your account. The GPT-3.5-turbo model is not accurate enough for code reviews.

https://openai.com/blog/openai-api

# Starting the project

The `docker-compose.yml` contains a service to host the application. You can either use a port mapping to make the service available on your machine, or attach the service to an existing docker network as shown below. If you want to access the webhook from the public internet, I highly recommend to put the service behind a webserver with SSL termination.

Create a port mapping:

```yml
services:
  gitlab-review-bot:
    ports:
      - 3000:3000
```

Attach to an existing network:

```yml
networks:
  default:
    name: ${NETWORK_NAME}
    external: true
```

Once you have adjusted the `docker-compose.yml` according to your needs, run the following command:

```bash
docker-compose up -d --build
```

# Setting up the webhook

Follow this guide to set up a webhook for your project. The webhook URL should be `${SERVICE_URL}/webhook`.

https://docs.gitlab.com/ee/user/project/integrations/webhooks.html

# Triggering a review

You can initiate a review on a merge request with a comment like this:

@BotUser Review this merge request with severity low

The severity can be "low", "medium" or "high". The bot will ignore issues with lower severity. If omitted, severity "low" will be used as threshold, so all issues will be considered.
