import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
}

const StatsCard = ({ title, value, icon: Icon, trend, trendUp }: StatsCardProps) => {
  return (
    <Card className="p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs md:text-sm text-muted-foreground mb-1 truncate">{title}</p>
          <h3 className="text-2xl md:text-3xl font-bold text-foreground">{value}</h3>
          {trend && (
            <p className={`text-xs md:text-sm mt-1 ${trendUp ? 'text-success' : 'text-destructive'}`}>
              {trend}
            </p>
          )}
        </div>
        <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-lg bg-primary-light flex-shrink-0 ml-2">
          <Icon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
        </div>
      </div>
    </Card>
  );
};

export default StatsCard;
