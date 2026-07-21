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
  adminName,
  gender,
}: OverdueWhatsAppContext): string {
  const honorific = memberHonorific(gender);
  const greeting = honorific ? `Dear ${honorific} ${alert.memberName}` : `Dear ${alert.memberName}`;

  const amount = alert.overdueAmount.toLocaleString('en-US', { maximumFractionDigits: 0 });
  const installmentWord = alert.overdueCount === 1 ? 'installment' : 'installments';
  const dueSince = alert.overdueSince ? `, due since ${formatOverdueDate(alert.overdueSince)}` : '';

  const lines = [
    `${greeting},`,
    '',
    'We hope you are doing well. This is a gentle reminder that your gym membership fee is currently overdue.',
    `You have ${alert.overdueCount} overdue ${installmentWord} totaling Rs. ${amount}${dueSince}.`,
    '',
    'Kindly clear your pending payment at your earliest convenience so you can continue enjoying uninterrupted access to our facilities.',
    '',
    'Thank you for your cooperation.',
    '',
    `Regards,`,
    adminName.trim() || 'Gym Admin',
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
