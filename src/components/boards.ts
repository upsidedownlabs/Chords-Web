// Shared constants for common properties
const COMMON_BAUD_RATE = 230400;
const COMMON_TIMEOUT = 2000;
const HIGH_SPEED_TIMEOUT = 100;
const COMMON_SAMPLING_RATE = 250;

// Type definition for the board configuration
interface BoardConfig {
    chords_id: string;
    device_name: string;
    field_pid: number;
    adc_resolution: number;
    channel_count: number;
    sampling_rate: number;
    serial_timeout: number;
    baud_Rate: number;
}

// Shared configurations
const createBoardConfig = ({
    chords_id,
    device_name,
    field_pid,
    adc_resolution,
    channel_count,
    sampling_rate = COMMON_SAMPLING_RATE,
    serial_timeout = COMMON_TIMEOUT,
    baud_Rate = COMMON_BAUD_RATE, // Default value for baud_Rate
}: Partial<BoardConfig> & { chords_id: string; device_name: string; field_pid: number; adc_resolution: number; channel_count: number }) => {
    // Validate required parameters
    if (!chords_id || !device_name || !field_pid || !adc_resolution || !channel_count) {
        throw new Error('Missing required board configuration parameters');
    }

    // Validate numeric parameters
    if (adc_resolution <= 0 || channel_count <= 0 || sampling_rate <= 0 || serial_timeout <= 0 || baud_Rate <= 0) {
        throw new Error('Invalid numeric parameters in board configuration');
    }

    return {
        chords_id,
        device_name,
        field_pid,
        adc_resolution,
        channel_count,
        sampling_rate,
        serial_timeout,
        baud_Rate,
    };
};

export const BoardsList: ReadonlyArray<BoardConfig> = Object.freeze([
    createBoardConfig({
        chords_id: "UNO-R3",
        device_name: "Arduino UNO R3",
        field_pid: 67,
        adc_resolution: 10,
        channel_count: 6,
        baud_Rate: 115200,
    }),
    createBoardConfig({
        chords_id: "MEGA-2560-R3",
        device_name: "Arduino MEGA 2560 R3",
        field_pid: 66,
        adc_resolution: 10,
        channel_count: 16,
        baud_Rate: 115200,
    }),
    createBoardConfig({
        chords_id: "MEGA-2560-CLONE",
        device_name: "MEGA 2560 CLONE",
        field_pid: 29987,
        adc_resolution: 10,
        channel_count: 16,
        baud_Rate: 115200,
    }),
    createBoardConfig({
        chords_id: "MEGA-2560-CLONE",
        device_name: "MEGA 2560 CLONE",
        field_pid: 32832,
        adc_resolution: 10,
        channel_count: 16,
        baud_Rate: 115200,
    }),
    createBoardConfig({
        chords_id: "NANO-CLONE",
        device_name: "Arduino Nano Clone",
        field_pid: 29987,
        adc_resolution: 10,
        channel_count: 8,
        baud_Rate: 115200,
    }),
    createBoardConfig({
        chords_id: "NANO-CLONE",
        device_name: "Arduino Nano Clone",
        field_pid: 32832,
        adc_resolution: 10,
        channel_count: 8,
        baud_Rate: 115200,
    }),
    createBoardConfig({
        chords_id: "NANO-CLASSIC",
        device_name: "Arduino NANO Classic",
        field_pid: 24577,
        adc_resolution: 10,
        channel_count: 8,
        baud_Rate: 115200,
    }),
    createBoardConfig({
        chords_id: "GENUINO-UNO",
        device_name: "Genuino UNO",
        field_pid: 579,
        adc_resolution: 10,
        channel_count: 6,
        baud_Rate: 115200,
    }),
    createBoardConfig({
        chords_id: "UNO-R4",
        device_name: "Arduino UNO R4 Minima",
        field_pid: 105,
        adc_resolution: 14,
        channel_count: 6,
        sampling_rate: 500,
        serial_timeout: HIGH_SPEED_TIMEOUT,
    }),
    createBoardConfig({
        chords_id: "UNO-R4",
        device_name: "Arduino UNO R4 Wifi",
        field_pid: 4098,
        adc_resolution: 14,
        channel_count: 6,
        sampling_rate: 500,
        serial_timeout: HIGH_SPEED_TIMEOUT,
    }),
    createBoardConfig({
        chords_id: "UNO-CLONE",
        device_name: "Maker UNO / UNO Clone",
        field_pid: 29987,
        adc_resolution: 10,
        channel_count: 6,
        baud_Rate: 115200,
    }),
    createBoardConfig({
        chords_id: "UNO-CLONE",
        device_name: "Maker UNO / UNO Clone",
        field_pid: 32832,
        adc_resolution: 10,
        channel_count: 6,
        baud_Rate: 115200,
    }),
    createBoardConfig({
        chords_id: "RPI-PICO-RP2040",
        device_name: "Raspberry Pi Pico",
        field_pid: 192,
        adc_resolution: 12,
        channel_count: 3,
        sampling_rate: 500,
        serial_timeout: HIGH_SPEED_TIMEOUT,
    }),
    createBoardConfig({
        chords_id: "GIGA-R1",
        device_name: "Arduino GIGA R1",
        field_pid: 614,
        adc_resolution: 16,
        channel_count: 6,
        sampling_rate: 500,
        serial_timeout: HIGH_SPEED_TIMEOUT,
    }),
    createBoardConfig({
        chords_id: "STM32G4-CORE-BOARD",
        device_name: "STM32G4 Core Board",
        field_pid: 22336,
        adc_resolution: 12,
        channel_count: 16,
        sampling_rate: 250,
        serial_timeout: HIGH_SPEED_TIMEOUT,
    }),
    createBoardConfig({
        chords_id: "STM32F4-BLACK-PILL",
        device_name: "STM32F4 Black Pill",
        field_pid: 22336,
        adc_resolution: 12,
        channel_count: 8,
        sampling_rate: 500,
        serial_timeout: HIGH_SPEED_TIMEOUT,
    }),
    createBoardConfig({ 
        chords_id: "NPG-LITE",
        device_name: "NPG-LITE",
        field_pid: 4097,
        adc_resolution: 12,
        channel_count: 3,
        sampling_rate: 500,
        serial_timeout: HIGH_SPEED_TIMEOUT,
    }),
]);
