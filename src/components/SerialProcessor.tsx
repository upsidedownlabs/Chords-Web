// components/SerialProcessor.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';

interface Sample {
  Counter: number;
  Channel1: number;
  TimeDelta?: number;
  timestamp: number;
}

const SerialProcessor = () => {
  const [port, setPort] = useState<SerialPort | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [data, setData] = useState<Sample[]>([]);
  const [lastTimestamp, setLastTimestamp] = useState<number | null>(null);

  const connectSerial = async () => {
    try {
      const selectedPort = await navigator.serial.requestPort();
      await selectedPort.open({ baudRate: 230400 });
      setPort(selectedPort);
      setIsConnected(true);
    } catch (error) {
      console.error('Error connecting to serial:', error);
    }
  };

  const extractTimestamp = (packet: Uint8Array): number => {
    const timeIndex = 3 + (6 * 2); // HEADER_LEN + (NUM_CHANNELS * 2)
    return (packet[timeIndex] << 24) | 
           (packet[timeIndex + 1] << 16) | 
           (packet[timeIndex + 2] << 8) | 
           packet[timeIndex + 3];
  };

  const processPacket = (packet: Uint8Array): Sample | null => {
    if (packet.length < 20) return null; // Minimum packet size check

    // Check sync bytes
    if (packet[0] !== 0xC7 || packet[1] !== 0x7C) return null;

    const timestamp = extractTimestamp(packet);
    const counter = packet[2];
    
    // Process Channel1 (assuming 14-bit ADC)
    const channel1High = packet[3];
    const channel1Low = packet[4];
    const channel1Value = ((channel1High << 8) | channel1Low) / 16384.0; // Normalize to 0-1

    const timeDelta = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0;
    setLastTimestamp(timestamp);

    return {
      Counter: counter,
      Channel1: channel1Value,
      TimeDelta: timeDelta,
      timestamp: timestamp
    };
  };

  const startRecording = async () => {
    if (!port) return;

    setIsRecording(true);
    setData([]);
    setLastTimestamp(null);

    try {
      // Send START command
      const encoder = new TextEncoder();
      const writer = port.writable.getWriter();
      await writer.write(encoder.encode('START\n'));
      writer.releaseLock();

      // Start reading
      const reader = port.readable.getReader();
      
      while (isRecording) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const sample = processPacket(value);
        if (sample) {
          setData(prev => [...prev, sample]);
        }
      }
      
      reader.releaseLock();
    } catch (error) {
      console.error('Error during recording:', error);
    }
  };

  const stopRecording = async () => {
    if (!port) return;

    setIsRecording(false);
    
    try {
      const encoder = new TextEncoder();
      const writer = port.writable.getWriter();
      await writer.write(encoder.encode('STOP\n'));
      writer.releaseLock();
    } catch (error) {
      console.error('Error stopping recording:', error);
    }
  };

  const saveToCSV = () => {
    const csvContent = [
      // CSV Header
      ['Counter', 'Channel1', 'TimeDelta'].join(','),
      // CSV Data
      ...data.map(sample => 
        [
          sample.Counter,
          sample.Channel1.toFixed(6),
          sample.TimeDelta?.toFixed(3)
        ].join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ChordsWeb${new Date().toISOString().slice(0,-5).replace(/[:-]/g, '')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4">
      <div className="flex gap-4 mb-4">
        <Button 
          onClick={connectSerial}
          disabled={isConnected}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Connect Serial
        </Button>
        <Button 
          onClick={isRecording ? stopRecording : startRecording}
          disabled={!isConnected}
          className={isRecording ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "bg-primary text-primary-foreground hover:bg-primary/90"}
        >
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </Button>
        <Button 
          onClick={saveToCSV}
          disabled={data.length === 0}
          className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
        >
          Save CSV
        </Button>
      </div>
      <div className="text-sm text-muted-foreground">
        {isConnected ? 'Connected to serial port' : 'Not connected'}
        <br />
        Samples recorded: {data.length}
      </div>
    </div>
  );
};

export default SerialProcessor;
