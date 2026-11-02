import React from 'react';
import { 
  Brain, Compass, Calculator, BookOpen, 
  TrendingUp, PenTool, DollarSign, Layers,
  LucideIcon 
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  Brain,
  Compass,
  Calculator,
  BookOpen,
  TrendingUp,
  PenTool,
  DollarSign,
  Layers,
};

export function SubjectIcon({ name, className = "w-5 h-5" }: { name: string; className?: string }) {
  const IconComponent = ICON_MAP[name] || Layers;
  return <IconComponent className={className} />;
}
