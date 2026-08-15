const fs = require('fs');
const path = require('path');

function rm(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

rm('mineverse/app/round1');
rm('mineverse/app/(game)/round');

for (let i = 1; i <= 4; i++) {
  const dir = mineverse/app/(game)/round;
  fs.mkdirSync(dir, { recursive: true });
  
  const pageContent = import { CustomRoundShell } from '@/components/game/custom-round-ui/CustomRoundShell';

export default function RoundPage() {
  return <CustomRoundShell roundId={} />;
}
;
  fs.writeFileSync(path.join(dir, 'page.tsx'), pageContent);
  
  const layoutContent = import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import '../../../theme-kit.css';

export default async function RoundLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  return children;
}
;
  fs.writeFileSync(path.join(dir, 'layout.tsx'), layoutContent);
}
