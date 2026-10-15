export type PasswordStrength = 'weak' | 'medium' | 'strong';

export interface PasswordStrengthResult {
  level: PasswordStrength;
  label: string;
  score: number; // 0-4, number of met criteria
  criteria: {
    length: boolean; // >= 8 characters
    lowercase: boolean;
    uppercase: boolean;
    number: boolean;
    special: boolean;
  };
}

export function checkPasswordStrength(password: string): PasswordStrengthResult {
  const criteria = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  const charTypeCount =
    (criteria.lowercase ? 1 : 0) +
    (criteria.uppercase ? 1 : 0) +
    (criteria.number ? 1 : 0) +
    (criteria.special ? 1 : 0);

  let level: PasswordStrength = 'weak';
  let label = '弱';

  if (criteria.length && charTypeCount >= 3) {
    level = 'strong';
    label = '强';
  } else if (criteria.length && charTypeCount >= 2) {
    level = 'medium';
    label = '中';
  } else if (!criteria.length && password.length >= 6 && charTypeCount >= 2) {
    // 长度 6-7 但有两种以上字符，仍然算弱（不满足长度>=8）
    level = 'weak';
    label = '弱';
  }

  // score: count of 4 key criteria (length, 2+ char types implied, uppercase, number)
  const score =
    (criteria.length ? 1 : 0) +
    (criteria.uppercase ? 1 : 0) +
    (criteria.number ? 1 : 0) +
    (criteria.special ? 1 : 0);

  return { level, label, score, criteria };
}
