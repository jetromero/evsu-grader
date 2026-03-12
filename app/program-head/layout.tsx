import DashboardLayout from '@/components/DashboardLayout';

export const dynamic = 'force-dynamic';

export default function ProgramHeadLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
