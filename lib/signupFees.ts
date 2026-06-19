/** Mirrors FitNixTrackBackend computeSignupOneTimeFees / monthly billing helpers. */

export interface SignupPackageInput {
  price: number;
  discount?: number | null;
  duration: string;
}

export interface SignupTrainerInput {
  charges?: number | null;
}

export interface PendingOneTimePayment {
  id: number;
  totalAmount: number;
  admissionFee: number;
  packageFee: number;
  trainerFee: number;
  status: 'PENDING' | string;
}

export const SIGNUP_PAY_BLOCK_MESSAGE = 'Pay the signup one-time payment before monthly installments.';

export function parseDurationToMonths(duration: string): number {
  const match = duration.match(/(\d+)\s*month/i);
  if (!match) return 0;
  return parseInt(match[1], 10);
}

export function computeMonthlyPackageFee(packageData: SignupPackageInput): number {
  const packageDiscount = packageData.discount ?? 0;
  const net = Math.max(0, packageData.price - packageDiscount);
  const months = parseDurationToMonths(packageData.duration);
  return months === 12 ? net / 12 : net;
}

export function computeTrainerFeeFromTrainers(trainers: SignupTrainerInput[]): number {
  return trainers.reduce((sum, t) => sum + (Number(t.charges) || 0), 0);
}

export function computeMemberMonthlyInstallmentAmount(
  packageData: SignupPackageInput | null,
  trainers: SignupTrainerInput[],
  memberDiscount: number | null | undefined
): number {
  const packageFee = packageData ? computeMonthlyPackageFee(packageData) : 0;
  const trainerFee = computeTrainerFeeFromTrainers(trainers);
  return Math.max(0, packageFee + trainerFee - (memberDiscount ?? 0));
}

/** Signup one-time = admission + first month (monthly package + trainer − member discount). */
export function computeSignupOneTimeFees(params: {
  admissionFeePaid: number;
  packageData: SignupPackageInput | null;
  trainers: SignupTrainerInput[];
  memberDiscount: number | null | undefined;
}): {
  admissionFee: number;
  packageFee: number;
  trainerFee: number;
  firstMonthRecurring: number;
  totalAmount: number;
  monthlyInstallmentAmount: number;
} {
  const monthlyPackageFee = params.packageData
    ? computeMonthlyPackageFee(params.packageData)
    : 0;
  const trainerFee = computeTrainerFeeFromTrainers(params.trainers);
  const monthlyInstallmentAmount = computeMemberMonthlyInstallmentAmount(
    params.packageData,
    params.trainers,
    params.memberDiscount
  );
  const firstMonthRecurring =
    params.packageData || trainerFee > 0 ? monthlyInstallmentAmount : 0;
  const totalAmount = params.admissionFeePaid + firstMonthRecurring;

  return {
    admissionFee: params.admissionFeePaid,
    packageFee: monthlyPackageFee,
    trainerFee,
    firstMonthRecurring,
    totalAmount,
    monthlyInstallmentAmount,
  };
}

export function normalizePendingOneTime(raw: unknown): PendingOneTimePayment | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = Number(row.id);
  if (!id || Number.isNaN(id)) return null;
  return {
    id,
    totalAmount: Number(row.totalAmount) || 0,
    admissionFee: Number(row.admissionFee) || 0,
    packageFee: Number(row.packageFee) || 0,
    trainerFee: Number(row.trainerFee) || 0,
    status: String(row.status ?? 'PENDING'),
  };
}

export function resolveSignupAdmissionFee(oneTime: Pick<
  PendingOneTimePayment,
  'admissionFee' | 'packageFee' | 'trainerFee' | 'totalAmount'
>): number {
  if (oneTime.admissionFee > 0) return oneTime.admissionFee;
  const implied = oneTime.totalAmount - oneTime.packageFee - oneTime.trainerFee;
  return implied > 0.009 ? Math.round(implied * 100) / 100 : 0;
}

export function withResolvedAdmissionFee(
  oneTime: PendingOneTimePayment
): PendingOneTimePayment {
  const admissionFee = resolveSignupAdmissionFee(oneTime);
  return admissionFee === oneTime.admissionFee ? oneTime : { ...oneTime, admissionFee };
}

export function hasPendingSignupOneTime(
  pending: PendingOneTimePayment | null | undefined
): boolean {
  return pending != null && pending.status === 'PENDING';
}
