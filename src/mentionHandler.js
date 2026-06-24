const { findAccountIdByEmail, createIssue } = require('./jiraClient');

const TICKET_TRIGGER = /(지라|jira).{0,6}(티켓|이슈)/;

async function collectThreadText(client, channel, thread_ts) {
  if (!thread_ts) return '';
  const { messages } = await client.conversations.replies({ channel, ts: thread_ts, limit: 50 });
  return messages.map((m) => m.text).filter(Boolean).join('\n');
}

async function resolveAssignee(client, text) {
  const mentions = [...text.matchAll(/<@([A-Z0-9]+)>/g)];
  const userMention = mentions[1]; // 첫 번째는 봇 자신, 두 번째가 지정 유저
  if (!userMention) return null;
  const { user } = await client.users.info({ user: userMention[1] });
  if (!user?.profile?.email) return null;
  return findAccountIdByEmail(user.profile.email);
}

async function handleAppMention({ event, client, say }) {
  console.log('app_mention received:', event.text);
  const text = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();

  if (!TICKET_TRIGGER.test(text)) {
    await say({ text: '티켓 생성 요청을 못 찾았어요. "지라 티켓 만들어줘" 같은 문구를 포함해 멘션해주세요.', thread_ts: event.thread_ts ?? event.ts });
    return;
  }

  const threadText = await collectThreadText(client, event.channel, event.thread_ts);
  const description = threadText || text;
  const cleanText = text.replace(/(지라|jira).{0,6}(티켓|이슈)\s*만들어줘?\s*[-:]?\s*/i, '').trim();
  const summary = (cleanText || description.split('\n')[0]).slice(0, 80);

  let assigneeAccountId = null;
  try {
    assigneeAccountId = await resolveAssignee(client, event.text);
  } catch (err) {
    console.error('assignee lookup failed', err.message);
  }

  try {
    const issue = await createIssue({ summary, description, assigneeAccountId });
    await say({ text: `티켓 생성 완료: ${issue.url}`, thread_ts: event.thread_ts ?? event.ts });
  } catch (err) {
    console.error('jira create failed', err.response?.data ?? err.message);
    await say({ text: '티켓 생성에 실패했어요. 로그를 확인해주세요.', thread_ts: event.thread_ts ?? event.ts });
  }
}

module.exports = { handleAppMention };
