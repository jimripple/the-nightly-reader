const siteUrl = 'https://the-nightly-reader.vercel.app/content/daily-editions.json';
const workflowUrl = 'https://api.github.com/repos/jimripple/the-nightly-reader/actions/workflows/daily-edition.yml';

function detroitDate(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Detroit', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export async function checkDailyEdition({ fetchImpl = fetch, now = new Date(), token }) {
  if (!token) throw new Error('GitHub dispatch token is not configured');
  const today = detroitDate(now);
  let liveEdition = null;
  try {
    const response = await fetchImpl(`${siteUrl}?check=${now.getTime()}`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (response.ok) {
      const editions = await response.json();
      liveEdition = Array.isArray(editions) ? editions.find(edition => edition.date === today) : null;
    }
  } catch (error) {
    console.warn('Could not verify the public edition:', error.message);
  }

  if (liveEdition) {
    const types = ['article', 'poem', 'story'];
    const valid = Array.isArray(liveEdition.works) && liveEdition.works.length === 3 &&
      types.every(type => liveEdition.works.filter(work => work.type === type).length === 1);
    if (!valid) throw new Error(`Edition ${today} is live but has an invalid article/poem/story lineup`);
    return { status: 'healthy', date: today };
  }

  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  const runsResponse = await fetchImpl(`${workflowUrl}/runs?per_page=20`, { headers, cache: 'no-store', signal: AbortSignal.timeout(8000) });
  if (!runsResponse.ok) throw new Error(`GitHub run check failed (${runsResponse.status})`);
  const runs = (await runsResponse.json()).workflow_runs || [];
  const active = runs.some(run => run.status !== 'completed' && detroitDate(new Date(run.created_at)) === today);
  if (active) return { status: 'publisher-running', date: today };

  const dispatchResponse = await fetchImpl(`${workflowUrl}/dispatches`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: 'main' }), signal: AbortSignal.timeout(8000),
  });
  if (!dispatchResponse.ok) throw new Error(`GitHub workflow dispatch failed (${dispatchResponse.status})`);
  return { status: 'publisher-dispatched', date: today };
}
