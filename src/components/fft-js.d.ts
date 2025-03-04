declare module 'fft-js' {
    export function fft(input: number[]): [number[], number[]];
    export function ifft(input: [number[], number[]]): number[];
    export function util(): {
      inverse(size: number): number[];
      completeSpectrum(spectrum: [number[], number[]]): [number[], number[]];
      mag(fftData: [number[], number[]]): number[];
      phase(fftData: [number[], number[]]): number[];
    };
  }
  