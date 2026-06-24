const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic();

let teamMembers = [];
try {
  if (process.env.TEAM_MEMBERS_JSON) {
    teamMembers = JSON.parse(process.env.TEAM_MEMBERS_JSON);
  }
} catch (e) {
  console.error('TEAM_MEMBERS_JSON parse error:', e.message);
}

function buildTeamContext() {
  if (!teamMembers.length) return '';
  const lines = teamMembers.map(
    (m) => `- ${m.name} (${m.email}): ${m.role}, 담당: ${(m.domains || []).join(', ')}`
  );
  return `\n\n팀원 정보 (담당자 추론에 활용):\n${lines.join('\n')}`;
}

async function classifyTicket({ text, threadText }) {
  const context = [threadText, text].filter(Boolean).join('\n\n---\n\n');
  const teamContext = buildTeamContext();

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Slack 메시지를 분석해서 Jira 티켓 정보를 추출해줘.${teamContext}

메시지:
${context}

아래 JSON 형식으로만 응답해 (마크다운 코드블록 없이 순수 JSON만):
{
  "summary": "티켓 제목 (80자 이하, 핵심 작업만)",
  "issueType": "Task 또는 Story 또는 Bug 중 하나 (영어)",
  "assigneeEmail": "담당자 이메일 또는 null",
  "description": "작업 상세 설명"
}`,
      },
    ],
    output_config: {
      format: {
        type: 'json_schema',
        name: 'ticket_classification',
        schema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            issueType: { type: 'string', enum: ['Task', 'Story', 'Bug'] },
            assigneeEmail: { type: ['string', 'null'] },
            description: { type: 'string' },
          },
          required: ['summary', 'issueType', 'description'],
          additionalProperties: false,
        },
      },
    },
  });

  return JSON.parse(response.content[0].text);
}

module.exports = { classifyTicket };
