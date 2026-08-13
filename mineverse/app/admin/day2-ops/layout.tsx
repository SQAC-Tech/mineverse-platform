import { AdminShell } from '@/components/admin/admin-shell';
import '../../theme-kit.css';
import '../nether.css';

export default function Day2OpsLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}

