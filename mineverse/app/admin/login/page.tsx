'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Lock, Loader2 } from 'lucide-react';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await fetch('/api/panel/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, scope: 'admin' })
      });
      
      const data = await res.json();
      if (data.success) {
        toast.success('Login successful');
        router.push(data.redirect);
        router.refresh();
      } else {
        toast.error(data.error || 'Login failed');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm bg-slate-900 border-slate-800">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center">
              <Lock className="w-6 h-6 text-emerald-500" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-white tracking-tight">Admin Login</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <Input 
              type="password" 
              placeholder="Enter Admin Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-slate-950 border-slate-800 text-center text-lg h-12 text-white placeholder:text-slate-500"
              autoFocus
            />
            <Button type="submit" className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-bold" disabled={loading || !password}>
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enter Platform'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
