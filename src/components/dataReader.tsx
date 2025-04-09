import { EXGFilter, Notch } from './filters';

type BitSelection = any; // or define properly if known


export class DataReader {
    private options: {
      maxCanvasElementCountRef: React.MutableRefObject<number>;
      readerRef: React.MutableRefObject<ReadableStreamDefaultReader<Uint8Array> | null | undefined>;
      isDeviceConnectedRef: React.MutableRefObject<boolean>;
      datastream: (data: number[]) => void;
      isRecordingRef: React.MutableRefObject<boolean>;
      recordingBuffers: number[][][];
      activeBufferIndex: number;
      MAX_BUFFER_SIZE: number;
      fillingindex: React.MutableRefObject<number>;
      canvasElementCountRef: React.MutableRefObject<number>;
      selectedChannels: number[];
      processBuffer: (bufferIndex: number, canvasCount: number, selectChannel: number[]) => Promise<void>;
      recordingStartTimeRef: React.MutableRefObject<number>;
      endTimeRef: React.MutableRefObject<number | null>;
      setRecordingElapsedTime: (time: number) => void;
      appliedFiltersRef: React.MutableRefObject<{ [key: number]: number }>;
      appliedEXGFiltersRef: React.MutableRefObject<{ [key: number]: number }>;
      detectedBitsRef: React.MutableRefObject<BitSelection>;
      sampingrateref: React.MutableRefObject<number>;
    };
  
    constructor(options: any) {
      this.options = options;
    }
  
    async readData(): Promise<void> {
      const HEADER_LENGTH = 3;
      const NUM_CHANNELS = this.options.maxCanvasElementCountRef.current;
      const PACKET_LENGTH = NUM_CHANNELS * 2 + HEADER_LENGTH + 1;
      const SYNC_BYTE1 = 0xc7;
      const SYNC_BYTE2 = 0x7c;
      const END_BYTE = 0x01;
      let previousCounter: number | null = null;
      const buffer: number[] = [];
      const notchFilters = Array.from({ length: this.options.maxCanvasElementCountRef.current }, () => new Notch());
      const EXGFilters = Array.from({ length: this.options.maxCanvasElementCountRef.current }, () => new EXGFilter());
      
      notchFilters.forEach((filter) => {
        filter.setbits(this.options.sampingrateref.current);
      });
      
      EXGFilters.forEach((filter) => {
        filter.setbits(this.options.detectedBitsRef.current.toString(), this.options.sampingrateref.current);
      });
  
      try {
        while (this.options.isDeviceConnectedRef.current) {
          const streamData = await this.options.readerRef.current?.read();
          if (streamData?.done) {
            console.log("Thank you for using our app!");
            break;
          }
          if (streamData) {
            const { value } = streamData;
            buffer.push(...value);
          }
  
          while (buffer.length >= PACKET_LENGTH) {
            const syncIndex = buffer.findIndex(
              (byte, index) =>
                byte === SYNC_BYTE1 && buffer[index + 1] === SYNC_BYTE2
            );
  
            if (syncIndex === -1) {
              buffer.length = 0;
              continue;
            }
  
            if (syncIndex + PACKET_LENGTH <= buffer.length) {
              const endByteIndex = syncIndex + PACKET_LENGTH - 1;
  
              if (
                buffer[syncIndex] === SYNC_BYTE1 &&
                buffer[syncIndex + 1] === SYNC_BYTE2 &&
                buffer[endByteIndex] === END_BYTE
              ) {
                const packet = buffer.slice(syncIndex, syncIndex + PACKET_LENGTH);
                const channelData: number[] = [];
                const counter = packet[2];
                channelData.push(counter);
                
                for (let channel = 0; channel < NUM_CHANNELS; channel++) {
                  const highByte = packet[channel * 2 + HEADER_LENGTH];
                  const lowByte = packet[channel * 2 + HEADER_LENGTH + 1];
                  const value = (highByte << 8) | lowByte;
  
                  channelData.push(
                    notchFilters[channel].process(
                      EXGFilters[channel].process(
                        value,
                        this.options.appliedEXGFiltersRef.current[channel]
                      ),
                      this.options.appliedFiltersRef.current[channel]
                    )
                  );
                }
                
                this.options.datastream(channelData);
                
                if (this.options.isRecordingRef.current) {
                  const channeldatavalues = channelData
                    .slice(0, this.options.canvasElementCountRef.current + 1)
                    .map((value) => (value !== undefined ? value : null))
                    .filter((value): value is number => value !== null);
                  
                  this.options.recordingBuffers[this.options.activeBufferIndex][this.options.fillingindex.current] = channeldatavalues;
  
                  if (this.options.fillingindex.current >= this.options.MAX_BUFFER_SIZE - 1) {
                    await this.options.processBuffer(
                      this.options.activeBufferIndex, 
                      this.options.canvasElementCountRef.current, 
                      this.options.selectedChannels
                    );
                    this.options.activeBufferIndex = (this.options.activeBufferIndex + 1) % NUM_BUFFERS;
                  }
                  
                  this.options.fillingindex.current = (this.options.fillingindex.current + 1) % this.options.MAX_BUFFER_SIZE;
                  const elapsedTime = Date.now() - this.options.recordingStartTimeRef.current;
                  
                  this.options.setRecordingElapsedTime((prev) => {
                    if (this.options.endTimeRef.current !== null && elapsedTime >= this.options.endTimeRef.current) {
                      // stopRecording would need to be handled
                      return this.options.endTimeRef.current;
                    }
                    return elapsedTime;
                  });
                }
  
                if (previousCounter !== null) {
                  const expectedCounter: number = (previousCounter + 1) % 256;
                  if (counter !== expectedCounter) {
                    console.warn(
                      `Data loss detected! Previous counter: ${previousCounter}, Current counter: ${counter}`
                    );
                  }
                }
                
                previousCounter = counter;
                buffer.splice(0, endByteIndex + 1);
              } else {
                buffer.splice(0, syncIndex + 1);
              }
            } else {
              break;
            }
          }
        }
      } catch (error) {
        console.error("Error reading from device:", error);
      }
    }
  }