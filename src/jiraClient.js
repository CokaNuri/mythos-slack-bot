const axios = require('axios');

const jira = axios.create({
  baseURL: process.env.JIRA_BASE_URL,
  auth: {
    username: process.env.JIRA_EMAIL,
    password: process.env.JIRA_API_TOKEN,
  },
  headers: { 'Content-Type': 'application/json' },
});

async function findAccountIdByEmail(email) {
  const { data } = await jira.get('/rest/api/3/user/search', { params: { query: email } });
  return data[0]?.accountId ?? null;
}

async function createIssue({ summary, description, assigneeAccountId, issueType }) {
  const payload = {
    fields: {
      project: { key: process.env.JIRA_DEFAULT_PROJECT_KEY },
      issuetype: { name: issueType || process.env.JIRA_DEFAULT_ISSUE_TYPE },
      summary,
      description: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: description }],
          },
        ],
      },
      ...(assigneeAccountId ? { assignee: { accountId: assigneeAccountId } } : {}),
    },
  };

  const { data } = await jira.post('/rest/api/3/issue', payload);
  return { key: data.key, url: `${process.env.JIRA_BASE_URL}/browse/${data.key}` };
}

module.exports = { findAccountIdByEmail, createIssue };
