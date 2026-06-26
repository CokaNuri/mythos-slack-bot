const axios = require('axios');

const github = axios.create({
  baseURL: 'https://api.github.com',
  headers: {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  },
});

async function createIssue({ title, body, repo }) {
  const { data } = await github.post(
    `/repos/${process.env.GITHUB_OWNER}/${repo}/issues`,
    { title, body }
  );
  return { number: data.number, url: data.html_url };
}

module.exports = { createIssue };
