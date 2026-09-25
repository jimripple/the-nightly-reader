export function isReadableArticleCandidate(item){
  let url;
  try{ url=new URL(item.link||item.sourceUrl); }catch{ return false; }
  const author=typeof item.author==='object'?item.author?.name:item.author;
  const summary=item.summary||item.text||'';
  if(url.hostname.endsWith('aeon.co')&&!url.pathname.startsWith('/essays/'))return false;
  if(url.hostname.endsWith('publicdomainreview.org')&&!/^\/(?:essay|blog)\//.test(url.pathname))return false;
  return !/\/(?:videos?|podcasts?|audio|films?|collections?)(?:\/|$)/i.test(url.pathname)
    && !/\b(?:video|podcast|audio|film)\b/i.test(item.category||'')
    && !/\b(?:video|podcast)\s*$/i.test(author||'')
    && !/\b(?:watch|listen) on (?:aeon|the site)\b/i.test(summary);
}

export function cleanArticleSummary(summary){
  return summary.replace(/\s+- by .+? Read on Aeon\s*$/i,'').trim();
}
