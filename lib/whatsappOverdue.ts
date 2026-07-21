import { formatOverdueDate, type OverdueCheckinAlert } from '@/lib/overdueAlerts';

export type OverdueWhatsAppContext = {
  alert: OverdueCheckinAlert;
  gymName: string;
  adminName: string;
  gender?: string | null;
};

/** Normalize a phone/contact string for wa.me links (defaults to Pakistan +92). */
export function normalizeWhatsAppPhone(contact: string | null | undefined): string | null {
  if (!contact) return null;
  let digits = contact.replace(/\D/g, '');
  if (!digits) return null;

  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0') && digits.length === 11) digits = `92${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith('3')) digits = `92${digits}`;

  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

export function memberHonorific(gender?: string | null): 'Mr.' | 'Mrs.' | null {
  const g = (gender ?? '').trim().toLowerCase();
  if (g === 'male' || g === 'm') return 'Mr.';
  if (g === 'female' || g === 'f') return 'Mrs.';
  return null;
}

export function buildOverdueWhatsAppMessage({
  alert,
  gymName,
  adminName: _adminName,
  gender: _gender,
}: OverdueWhatsAppContext): string {
  const amount = alert.overdueAmount.toLocaleString('en-US', { maximumFractionDigits: 0 });
  const dueSince = alert.overdueSince ? formatOverdueDate(alert.overdueSince) : null;
  const overdueLine = dueSince
    ? `This is a friendly reminder that your Rs. ${amount} gym membership fee has been overdue since ${dueSince} .`
    : `This is a friendly reminder that your Rs. ${amount} gym membership fee is overdue.`;

  const lines = [
    `Hi ${alert.memberName}!`,
    '',
    overdueLine,
    '',
    'Please make your payment as soon as you can to keep your membership active.',
    '',
    'Thank you!',
    gymName.trim() || 'Your Gym',
  ];

  return lines.join('\n');
}

export function openWhatsAppOverdueChat(ctx: OverdueWhatsAppContext): boolean {
  const phone = normalizeWhatsAppPhone(ctx.alert.contact);
  if (!phone) return false;

  const message = buildOverdueWhatsAppMessage(ctx);
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}
