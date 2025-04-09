import { BoardsList } from "./boards";
import { toast } from "sonner";

type SavedDevice = {
  usbVendorId: number;
  usbProductId: number;
  baudRate: number;
  serialTimeout: number;
  selectedChannels: number[];
  deviceName?: string;
};

type SerialServiceOptions = {
  portRef: React.MutableRefObject<SerialPort | null>;
  readerRef: React.MutableRefObject<ReadableStreamDefaultReader<Uint8Array> | null | undefined>;
  writerRef: React.MutableRefObject<WritableStreamDefaultWriter<Uint8Array> | null>;
  devicenameref: React.MutableRefObject<string>;
  maxCanvasElementCountRef: React.MutableRefObject<number>;
  initialSelectedChannelsRef: React.MutableRefObject<number[]>;
  isDeviceConnectedRef: React.MutableRefObject<boolean>;
  setSelectedChannels: (channels: number[]) => void;
  setIsDeviceConnected: (connected: boolean) => void;
  setIsDisplay: (display: boolean) => void;
  setCanvasCount: (count: number) => void;
  setIsAllEnabledChannelSelected: (selected: boolean) => void;
  setDatasets: (data: any[]) => void;
  readData: () => Promise<void>;
  formatPortInfo: (info: SerialPortInfo, deviceName: string, fieldPid?: number) => any;
  handleFrequencySelectionEXG: (channelIndex: number, frequency: number) => void;
  getFileCountFromIndexedDB: () => Promise<any[]>;
  disconnectDevice: () => Promise<void>;
};

export class SerialService {
  private options: SerialServiceOptions;

  constructor(options: SerialServiceOptions) {
    this.options = options;
  }

  async connectToSerialDevice({ onSuccess, setLoading, isFFT = false }: {
    onSuccess: () => void;
    setLoading: (state: boolean) => void;
    isFFT?: boolean;
  }) {
    try {
      if (this.options.portRef.current && this.options.portRef.current.readable) {
        await this.options.disconnectDevice();
      }

      const savedPorts = JSON.parse(localStorage.getItem('savedDevices') || '[]');
      const ports = await navigator.serial.getPorts();
      let port = ports.find((p) => {
        const info = p.getInfo();
        return savedPorts.some((saved: SavedDevice) => saved.usbProductId === info.usbProductId);
      }) || null;

      if (isFFT) {
        this.options.handleFrequencySelectionEXG(0, 3);
      }

      let baudRate: number;
      let serialTimeout: number;

      if (!port) {
        port = await navigator.serial.requestPort();
        const newPortInfo = await port.getInfo();
        const usbProductId = newPortInfo.usbProductId ?? 0;
        const board = BoardsList.find((b) => b.field_pid === usbProductId);
        baudRate = board?.baud_Rate ?? 0;
        serialTimeout = board?.serial_timeout ?? 0;
        await port.open({ baudRate });
      } else {
        const info = port.getInfo();
        const savedDevice = savedPorts.find((saved: SavedDevice) => saved.usbProductId === info.usbProductId);
        baudRate = savedDevice?.baudRate || 230400;
        serialTimeout = savedDevice?.serialTimeout || 2000;
        await port.open({ baudRate });
      }

      setLoading(true);

      if (port.readable) {
        const reader = port.readable.getReader();
        this.options.readerRef.current = reader;

        const writer = port.writable?.getWriter();
        if (writer) {
          this.options.writerRef.current = writer;

          const whoAreYouMessage = new TextEncoder().encode("WHORU\n");
          setTimeout(() => writer.write(whoAreYouMessage), serialTimeout);

          let buffer = "";
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) {
              buffer += new TextDecoder().decode(value);
              if (buffer.includes("\n")) break;
            }
          }

          const response = buffer.trim().split("\n").pop();
          const extractedName = response?.match(/[A-Za-z0-9\-_\s]+$/)?.[0]?.trim() || "Unknown Device";
          this.options.devicenameref.current = extractedName;

          const currentPortInfo = port.getInfo();
          const usbProductId = currentPortInfo.usbProductId ?? 0;

          const existingDeviceIndex = savedPorts.findIndex(
            (saved: SavedDevice) => saved.deviceName === extractedName
          );

          const lastSelectedChannels = existingDeviceIndex !== -1
            ? savedPorts[existingDeviceIndex].selectedChannels
            : [1];

          this.options.setSelectedChannels(lastSelectedChannels);

          if (existingDeviceIndex === -1) {
            savedPorts.push({
              deviceName: extractedName,
              usbProductId,
              baudRate,
              serialTimeout,
              selectedChannels: this.options.initialSelectedChannelsRef.current,
            });
          }

          localStorage.setItem('savedDevices', JSON.stringify(savedPorts));

          const { formattedInfo, adcResolution, channelCount, baudRate: extractedBaudRate, serialTimeout: extractedSerialTimeout } =
            this.options.formatPortInfo(currentPortInfo, extractedName, usbProductId);

          if (channelCount) {
            this.options.maxCanvasElementCountRef.current = channelCount;
          }

          const allSelected = this.options.initialSelectedChannelsRef.current.length == channelCount;
          this.options.setIsAllEnabledChannelSelected(!allSelected);

          baudRate = extractedBaudRate ?? baudRate;
          serialTimeout = extractedSerialTimeout ?? serialTimeout;

          toast.success("Connection Successful", {
            description: (
              <div className="mt-2 flex flex-col space-y-1">
                <p>Device: {formattedInfo}</p>
                <p>Product ID: {usbProductId}</p>
                <p>Baud Rate: {baudRate}</p>
                {adcResolution && <p>Resolution: {adcResolution} bits</p>}
                {channelCount && <p>Channel: {channelCount}</p>}
              </div>
            ),
          });

          const startMessage = new TextEncoder().encode("START\n");
          setTimeout(() => writer.write(startMessage), 2000);
        }
      }

      this.options.setSelectedChannels(this.options.initialSelectedChannelsRef.current);
      this.options.setIsDeviceConnected(true);
      this.options.setIsDisplay(true);
      this.options.setCanvasCount(1);
      this.options.isDeviceConnectedRef.current = true;
      this.options.portRef.current = port;

      const data = await this.options.getFileCountFromIndexedDB();
      this.options.setDatasets(data);
      this.options.readData();
      await navigator.wakeLock.request("screen");

      onSuccess();
    } catch (error) {
      await this.options.disconnectDevice();
      console.error("Error connecting to device:", error);
      toast.error("Failed to connect to device.");
    }

    setLoading(false);
  }
}