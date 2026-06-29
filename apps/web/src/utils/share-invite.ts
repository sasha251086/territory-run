const INVITE_TEXT =
  'Присоединяйся к Territory Run — захватывай клетки на пробежках!';

export async function shareAppInvite(): Promise<'shared' | 'copied' | 'failed'> {
  const url = window.location.origin;
  const message = `${INVITE_TEXT}\n${url}`;

  try {
    if (navigator.share) {
      await navigator.share({
        title: 'Territory Run',
        text: message,
        url,
      });
      return 'shared';
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(message);
      return 'copied';
    }
  } catch {
    return 'failed';
  }

  return 'failed';
}
