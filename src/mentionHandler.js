const { findAccountIdByEmail, createIssue } = require('./jiraClient');
const { classifyTicket } = require('./aiClassifier');

const TICKET_TRIGGER = /(지라|jira).{0,6}(티켓|이슈)/i;

async function collectThreadText(client, channel, thread_ts) {
  if (!thread_ts) return '';
  const { messages } = await client.conversations.replies({ channel, ts: thread_ts, limit: 50 });
  return messages.map((m) => m.text).filter(Boolean).join('\n');
}

async function resolveExplicitAssignee(client, rawText) {
  const mentions = [...rawText.matchAll(/<@([A-Z0-9]+)>/g)];
  const userMention = mentions[1]; // 첫 번째는 봇 자신, 두 번째가 지정 유저
  if (!userMention) return null;
  const { user } = await client.users.info({ user: userMention[1] });
  if (!user?.profile?.email) return null;
  return findAccountIdByEmail(user.profile.email);
}

async function handleAppMention({ event, client, say }) {
  console.log('app_mention received:', event.text);
  const textWithoutMentions = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();

  if (!TICKET_TRIGGER.test(textWithoutMentions)) {
    await say({
      text: '티켓 생성 요청을 못 찾았어요. "지라 티켓 만들어줘" 같은 문구를 포함해 멘션해주세요.',
      thread_ts: event.thread_ts ?? event.ts,
    });
    return;
  }

  const threadText = await collectThreadText(client, event.channel, event.thread_ts);

  // AI 분류 (실패 시 기존 로직으로 폴백)
  let summary, issueType, assigneeEmail, description;
  try {
    const result = await classifyTicket({ text: textWithoutMentions, threadText });
    summary = result.summary;
    issueType = result.issueType;
    assigneeEmail = result.assigneeEmail;
    description = result.description;
    console.log('AI classification:', { summary, issueType, assigneeEmail });
  } catch (err) {
    console.error('AI classification failed, falling back to regex:', err.message);
    const cleanText = textWithoutMentions
      .replace(/(지라|jira).{0,6}(티켓|이슈)\s*만들어줘?\s*[-:]?\s*/i, '')
      .trim();
    const content = threadText || textWithoutMentions;
    summary = (cleanText || content.split('\n')[0]).slice(0, 80);
    description = content;
    issueType = null;
  }

  // 명시적 @멘션이 있으면 AI 추론보다 우선
  let assigneeAccountId = null;
  try {
    assigneeAccountId = await resolveExplicitAssignee(client, event.text);
    if (!assigneeAccountId && assigneeEmail) {
      assigneeAccountId = await findAccountIdByEmail(assigneeEmail);
    }
  } catch (err) {
    console.error('assignee lookup failed:', err.message);
  }

  try {
    const issue = await createIssue({ summary, description, assigneeAccountId, issueType });
    await say({ text: `티켓 생성 완료: ${issue.url}`, thread_ts: event.thread_ts ?? event.ts });
  } catch (err) {
    console.error('jira create failed:', err.response?.data ?? err.message);
    await say({
      text: '티켓 생성에 실패했어요. 로그를 확인해주세요.',
      thread_ts: event.thread_ts ?? event.ts,
    });
  }
}

module.exports = { handleAppMention };
