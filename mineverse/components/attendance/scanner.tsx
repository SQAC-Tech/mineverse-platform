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

  // Held in a ref so a new `onScan` identity on every parent render doesn't tear
  // down and restart the camera mid-shift.
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!videoRef.current) return;

    QrScanner.hasCamera().then((hasCamera) => {
      setHasCamera(hasCamera);
      if (hasCamera && videoRef.current) {
        scannerRef.current = new QrScanner(
          videoRef.current,
          (result: any) => {
            const data = typeof result === 'string' ? result : result?.data;
            if (data) {
              onScanRef.current(data);
            }
          },
          {
            highlightScanRegion: true,
            highlightCodeOutline: true,
            returnDetailedScanResult: true,
          } as any
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
  }, []);

  if (!hasCamera) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-center text-sm text-slate-400">
        No camera available. Use the team code box below.
      </div>
    );
  }

  return (
    <Card className="relative flex aspect-square w-full items-center justify-center overflow-hidden border-slate-800 bg-slate-950 sm:aspect-video">
      <video ref={videoRef} className="h-full w-full object-cover" />
      <div className="pointer-events-none absolute inset-0 rounded-lg border-4 border-cyan-500/50" />
    </Card>
  );
}
