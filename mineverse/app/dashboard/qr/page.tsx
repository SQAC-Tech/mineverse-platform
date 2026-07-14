'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Image from 'next/image';
import QRCode from 'qrcode';

export default function DashboardQRPage() {
  const [teamCode, setTeamCode] = useState('');
  const [qrImage, setQrImage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeam = async () => {
      const res = await fetch('/api/dashboard/data');
      const json = await res.json();
      if (json.success) {
        setTeamCode(json.team.team_code);
        if (json.team.qr_token) {
          const img = await QRCode.toDataURL(json.team.qr_token, { width: 300, margin: 2 });
          setQrImage(img);
        }
      }
      setLoading(false);
    };
    fetchTeam();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6 flex flex-col items-center max-w-lg mx-auto mt-12">
      <Card className="w-full bg-slate-900 border-slate-800">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-slate-100">Team QR Code</CardTitle>
          <p className="text-slate-400">Team {teamCode}</p>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-6">
          {qrImage ? (
            <div className="bg-white p-4 rounded-xl shadow-lg">
              <Image src={qrImage} alt="Team QR" width={250} height={250} className="w-64 h-64 object-contain" />
            </div>
          ) : (
            <div className="w-64 h-64 bg-slate-800 rounded-xl flex items-center justify-center text-slate-500">
              QR Not Available
            </div>
          )}
          
          <div className="text-center text-slate-400 text-sm">
            Present this QR code to the organizers at each checkpoint to mark your attendance.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
