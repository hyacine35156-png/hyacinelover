import { checkPasswordStrength } from '@client/src/utils/password-strength';

interface PasswordStrengthIndicatorProps {
  password: string;
}

const PasswordStrengthIndicator = ({ password }: PasswordStrengthIndicatorProps) => {
  if (!password) return null;
  const strength = checkPasswordStrength(password);

  const barColor = (): string => {
    switch (strength.level) {
      case 'strong':
        return 'bg-green-500';
      case 'medium':
        return 'bg-amber-500';
      default:
        return 'bg-red-500';
    }
  };

  const textColor = (): string => {
    switch (strength.level) {
      case 'strong':
        return 'text-green-600';
      case 'medium':
        return 'text-amber-600';
      default:
        return 'text-red-500';
    }
  };

  const barFill = barColor();
  const labelColor = textColor();

  return (
    <div className="space-y-1">
      <div className="flex h-1.5 gap-1">
        <div
          className={`flex-1 rounded-full transition-colors ${
            password.length >= 6 ? barFill : 'bg-border'
          }`}
        />
        <div
          className={`flex-1 rounded-full transition-colors ${
            strength.score >= 2 ? barFill : 'bg-border'
          }`}
        />
        <div
          className={`flex-1 rounded-full transition-colors ${
            strength.score >= 3 ? barFill : 'bg-border'
          }`}
        />
        <div
          className={`flex-1 rounded-full transition-colors ${
            strength.level === 'strong' ? barFill : 'bg-border'
          }`}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium ${labelColor}`}>
          密码强度：{strength.label}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {strength.criteria.length ? '✓ 长度≥8' : '长度 6-7'}·
          {strength.criteria.number ? '✓' : '✗'}数字 ·
          {strength.criteria.uppercase ? '✓' : '✗'}大写 ·
          {strength.criteria.special ? '✓' : '✗'}特殊
        </span>
      </div>
    </div>
  );
};

export default PasswordStrengthIndicator;
