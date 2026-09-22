/**
 * Pure curriculum helpers. A production scheduler can call these after loading
 * editions from Postgres; keeping them pure makes retries safe and testable.
 */
export function distribution(editions, field, recent = 14) {
  return editions.slice(0, recent).flatMap(e => e.works).reduce((counts, work) => {
    const value = field === 'culture' ? work.author.culture : work[field];
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

export function balanceScore(candidate, editions) {
  const cultures = distribution(editions, 'culture');
  const categories = distribution(editions, 'category');
  const authors = distribution(editions, 'authorName');
  const recent = editions.slice(0, 5).flatMap(e => e.works);
  const repetitionPenalty = recent.some(w => w.author.name === candidate.author.name) ? 100 : 0;
  return 50 - (cultures[candidate.author.culture] || 0) * 4 - (categories[candidate.category] || 0) * 5 - (authors[candidate.author?.name] || 0) * 8 - repetitionPenalty;
}

export function generateEdition({ date, editions, candidates }) {
  const existing = editions.find(e => e.date === date);
  if (existing) return { edition: existing, created: false, reason: 'edition_exists' };
  const eligible = candidates.filter(w => w.sourceUrl && w.copyright && w.author?.name);
  const works = ['story', 'poem', 'essay'].map(type => eligible.filter(w => w.type === type).sort((a,b) => balanceScore(b, editions)-balanceScore(a, editions))[0]);
  if (works.some(Boolean) === false || works.length !== 3 || works.some(w => !w)) throw new Error('Insufficient verified candidates');
  const next = { id: date, date, number: Math.max(0,...editions.map(e=>e.number))+1, theme: 'New edition', curatorNote: 'Editorial note pending.', works };
  return { edition: next, created: true, reason: 'created' };
}
