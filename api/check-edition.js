import { checkDailyEdition } from '../scripts/check-daily-edition.mjs';

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ status: 'unauthorized' }, { status: 401 });
  }
  if (!process.env.GITHUB_DISPATCH_TOKEN) {
    return Response.json({ status: 'not-configured' }, { status: 503 });
  }
  try {
    return Response.json(await checkDailyEdition({ token: process.env.GITHUB_DISPATCH_TOKEN }));
  } catch (error) {
    console.error('Daily edition fallback failed:', error.message);
    return Response.json({ status: 'failed' }, { status: 502 });
  }
}
