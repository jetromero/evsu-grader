interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'maroon' | 'gold';
  className?: string;
}

const variantClasses = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
  info: 'bg-blue-50 text-blue-700',
  maroon: 'bg-evsu-maroon/8 text-evsu-maroon',
  gold: 'bg-evsu-gold/10 text-evsu-gold-dark',
};

export default function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium tracking-wide ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
}
