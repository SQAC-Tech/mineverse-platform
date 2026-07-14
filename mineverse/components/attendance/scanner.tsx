'use client';

import { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ScannerProps {
  onScan: (data: string) => void;
}

export function Scanner({ onScan }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const [hasCamera, setHasCamera] = useState(true);

  useEffect(() => {
    if (!videoRef.current) return;

    QrScanner.hasCamera().then((hasCamera) => {
      setHasCamera(hasCamera);
      if (hasCamera && videoRef.current) {
        scannerRef.current = new QrScanner(
          videoRef.current,
          (result) => {
            if (result.data) {
              onScan(result.data);
            }
          },
          {
            highlightScanRegion: true,
            highlightCodeOutline: true,
          }
        );
        scannerRef.current.start();
      }
    });

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop();
        scannerRef.current.destroy();
      }
    };
  }, [onScan]);

  if (!hasCamera) {
    return <div className="text-center p-4 bg-slate-900 text-slate-400 rounded-lg">No camera detected. Please use manual entry.</div>;
  }

  return (
    <Card className="bg-slate-950 border-slate-800 overflow-hidden relative aspect-video flex items-center justify-center">
      <video ref={videoRef} className="w-full h-full object-cover" />
      <div className="absolute inset-0 border-4 border-cyan-500/50 pointer-events-none rounded-lg" />
    </Card>
  );
}
