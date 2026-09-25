const easternDateTime = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Detroit', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function editionScheduleMessage(editionDate, now = new Date()) {
  const parts = Object.fromEntries(easternDateTime.formatToParts(now).map(part => [part.type, part.value]));
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const afterFour = Number(parts.hour) >= 16;
  if (editionDate < today && afterFour) {
    return 'Today’s edition is running late. The latest reading remains available.';
  }
  return 'New edition scheduled daily for 2:30 p.m. Eastern';
}
