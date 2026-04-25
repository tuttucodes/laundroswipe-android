import { useCallback, useEffect, useState } from 'react';
import {
  ensureBluetoothPermissions,
  enableBluetoothIfNeeded,
  isBluetoothEnabled,
  listPairedPrinters,
  printEscPosBytes,
  rankPrinterFirst,
  type PairedPrinter,
} from '@/lib/printing/bluetooth';
import {
  loadPrinterPrefs,
  savePrinterPrefs,
  type BluetoothPrinterPrefs,
} from '@/lib/printing/printer-prefs';

export function useBluetoothPrinter() {
  const [prefs, setPrefs] = useState<BluetoothPrinterPrefs | null>(null);
  const [paired, setPaired] = useState<PairedPrinter[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [btOn, setBtOn] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const p = await loadPrinterPrefs();
      const on = await isBluetoothEnabled();
      if (alive) {
        setPrefs(p);
        setBtOn(on);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await ensureBluetoothPermissions();
      await enableBluetoothIfNeeded();
      const list = rankPrinterFirst(await listPairedPrinters());
      setPaired(list);
      setBtOn(await isBluetoothEnabled());
    } finally {
      setRefreshing(false);
    }
  }, []);

  const selectPrinter = useCallback(async (p: PairedPrinter) => {
    const next = await savePrinterPrefs({ mac: p.address, name: p.name });
    setPrefs(next);
  }, []);

  const setPaper = useCallback(async (paper: BluetoothPrinterPrefs['paper']) => {
    const next = await savePrinterPrefs({ paper });
    setPrefs(next);
  }, []);

  const setDensity = useCallback(async (printDensity: BluetoothPrinterPrefs['printDensity']) => {
    const next = await savePrinterPrefs({ printDensity });
    setPrefs(next);
  }, []);

  const print = useCallback(
    async (bytes: Uint8Array): Promise<{ ok: true } | { ok: false; error: string }> => {
      if (!prefs?.mac) return { ok: false, error: 'No printer selected. Open Printer settings.' };
      setPrinting(true);
      try {
        await printEscPosBytes(prefs.mac, bytes);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      } finally {
        setPrinting(false);
      }
    },
    [prefs?.mac],
  );

  return {
    prefs,
    paired,
    refresh,
    refreshing,
    selectPrinter,
    setPaper,
    setDensity,
    print,
    printing,
    btOn,
  };
}
