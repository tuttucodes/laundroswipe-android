declare module 'react-native-bluetooth-escpos-printer' {
  export const BluetoothManager: {
    enableBluetooth(): Promise<unknown>;
    scanDevices(): Promise<string>;
    connect(address: string): Promise<unknown>;
    isBluetoothEnabled(): Promise<boolean>;
  };
  export const BluetoothEscposPrinter: {
    ALIGN: { LEFT: number; CENTER: number; RIGHT: number };
    printerInit(): Promise<void>;
    printerAlign(align: number): Promise<void>;
    printText(text: string, options?: Record<string, unknown>): Promise<void>;
    printAndFeed(n: number): Promise<void>;
  };
}
