import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { Dimensions, Text, View } from 'react-native';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import QRCode from 'react-native-qrcode-svg';
import * as Brightness from 'expo-brightness';

export type HandshakePayload = {
  token: string;
  orderId: string;
  userId: string;
  name?: string | null;
};

export type HandshakeRef = {
  open(): void;
  close(): void;
};

const { width: SCREEN_W } = Dimensions.get('window');
const QR_SIZE = Math.min(280, SCREEN_W - 80);

export const DigitalHandshake = forwardRef<HandshakeRef, { payload: HandshakePayload | null }>(
  function DigitalHandshake({ payload }, ref) {
    const sheetRef = useRef<BottomSheet>(null);
    const previousBrightness = useRef<number | null>(null);

    const open = useCallback(() => {
      sheetRef.current?.expand();
    }, []);
    const close = useCallback(() => {
      sheetRef.current?.close();
    }, []);

    useImperativeHandle(ref, () => ({ open, close }), [open, close]);

    useEffect(() => {
      let cancelled = false;
      (async () => {
        const { status } = await Brightness.requestPermissionsAsync();
        if (cancelled || status !== 'granted') return;
        try {
          previousBrightness.current = await Brightness.getBrightnessAsync();
          await Brightness.setBrightnessAsync(1);
        } catch {
          /* best-effort; not all sims support brightness */
        }
      })();
      return () => {
        cancelled = true;
        if (previousBrightness.current !== null) {
          Brightness.setBrightnessAsync(previousBrightness.current).catch(() => undefined);
        }
      };
    }, []);

    const qrValue = payload
      ? JSON.stringify({ t: payload.token, o: payload.orderId, u: payload.userId })
      : '';

    const backdrop = useCallback(
      (p: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...p} appearsOnIndex={0} disappearsOnIndex={-1} />
      ),
      [],
    );

    return (
      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={[QR_SIZE + 200]}
        enablePanDownToClose
        backdropComponent={backdrop}
        backgroundStyle={{
          backgroundColor: '#FFFFFF',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
        }}
      >
        <BottomSheetView style={{ padding: 24, alignItems: 'center' }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#1A1D2E' }}>
            Show this to the agent
          </Text>
          <Text style={{ marginTop: 6, color: '#475569', textAlign: 'center' }}>
            They scan this code to confirm your pickup or drop-off.
          </Text>
          <View
            style={{ marginTop: 20, padding: 16, borderRadius: 18, backgroundColor: '#F8FAFC' }}
          >
            {qrValue ? (
              <QRCode value={qrValue} size={QR_SIZE} backgroundColor="#F8FAFC" color="#1A1D2E" />
            ) : null}
          </View>
          <Text style={{ marginTop: 16, fontWeight: '700', color: '#1746A2', letterSpacing: 4 }}>
            #{payload?.token ?? '—'}
          </Text>
        </BottomSheetView>
      </BottomSheet>
    );
  },
);
