// Date formatting utilities

function toSafeDateInput(dateInput: unknown): string {
  if (dateInput == null) return '';
  if (typeof dateInput === 'object') {
    const obj = dateInput as Record<string, unknown>;
    const nestedDate =
      obj.$date ??
      obj.iso ??
      obj.value ??
      obj.date ??
      obj.dateOfBirth ??
      obj.createdAt ??
      obj.updatedAt;
    if (nestedDate != null) return toSafeDateInput(nestedDate);
    const y = obj.year ?? obj.y;
    const m = obj.month ?? obj.m;
    const d = obj.day ?? obj.d;
    if (y != null && m != null && d != null) {
      const yy = String(y).padStart(4, '0');
      const mm = String(m).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      return `${yy}-${mm}-${dd}`;
    }
  }
  const trimmed = String(dateInput).trim();
  if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
    const [dd, mm, yyyy] = trimmed.split('-');
    return `${yyyy}-${mm}-${dd}`;
  }
  if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`;
  return trimmed;
}

export const formatDate = (dateString: unknown): string => {
  if (dateString == null || dateString === '') return 'N/A';

  const normalized = toSafeDateInput(dateString);
  if (!normalized) return 'N/A';
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return 'N/A';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

export const formatDateForInput = (dateString: unknown): string => {
  if (dateString == null || dateString === '') return '';

  const normalized = toSafeDateInput(dateString);
  if (!normalized) return '';
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

