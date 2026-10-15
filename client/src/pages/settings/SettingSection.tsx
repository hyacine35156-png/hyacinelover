import type { ReactNode } from 'react';
import { Card, CardContent } from '@client/src/components/ui/card';

interface SettingSectionProps {
  title: string;
  description: string;
  icon?: ReactNode;
  children: ReactNode;
}

const SettingSection = ({
  title,
  description,
  icon,
  children,
}: SettingSectionProps) => {
  return (
    <Card className="overflow-hidden border-border/60 shadow-sm transition-all duration-200 hover:shadow-md">
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="flex items-start gap-3">
            {icon && (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {icon}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-foreground">
                {title}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {description}
              </p>
            </div>
          </div>
          <div className="shrink-0 sm:ml-auto">{children}</div>
        </div>
      </CardContent>
    </Card>
  );
};

interface SettingRowProps {
  label: string;
  description?: string;
  control: ReactNode;
}

const SettingRow = ({ label, description, control }: SettingRowProps) => {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
};

export { SettingSection, SettingRow };
