import { loopSlackPostsPerSession } from "@qawolf/api-contracts/v1";

export const slackMessages = {
  posted: (permalink: string) => `Posted in Slack: ${permalink}`,
  notALoopSession:
    "QA Wolf posted nothing: only a QA Wolf session that a loop started can post in Slack.",
  loopDeleted:
    "QA Wolf posted nothing: the loop that started this session was deleted.",
  channelNotAllowed: (channelId: string) =>
    `QA Wolf posted nothing: ${channelId} is not one of the workspace's own Slack channels.`,
  agentNotInChannel: (channelId: string) =>
    `QA Wolf posted nothing: the QA Wolf agent is not in ${channelId}. Invite it to the channel, then post again.`,
  rateLimited: `QA Wolf posted nothing: this loop run already posted ${loopSlackPostsPerSession} Slack messages, the most one run may post.`,
} as const;
