import { contributionsResponse, createContributionsReader } from "../lib/github-contributions";
import { createLiveStatus, statusResponse } from "../lib/twitch-status";
import { hasLoadedEncryptedEnvironment } from "./load-encrypted-environment";

hasLoadedEncryptedEnvironment();

const contributions = createContributionsReader({
  token: process.env.GITHUB_TOKEN,
});

const liveStatus = createLiveStatus({
  clientId: process.env.TWITCH_CLIENT_ID,
  clientSecret: process.env.TWITCH_CLIENT_SECRET,
});

const port = Number(process.env.PORT ?? 3000);

Bun.serve({
  port,
  routes: {
    "/api/stream-status": async () => statusResponse(await liveStatus.get()),
    "/api/github-contributions": async () => contributionsResponse(await contributions.get()),
  },
  fetch: () => new Response("Not found", { status: 404 }),
});
