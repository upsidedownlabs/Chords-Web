
//Notch Filter 50Hz/60Hz
export class Notch {
    // Properties to hold the state of the filter sections
    private z1_1: number;
    private z2_1: number;

    private z1_2: number;
    private z2_2: number;

    private x_1: number;
    private x_2: number;

    constructor() {
        // Initialize state variables for both filter sections
        this.z1_1 = 0;
        this.z2_1 = 0;

        this.z1_2 = 0;
        this.z2_2 = 0;

        this.x_1 = 0;
        this.x_2 = 0;
    }

    // Method to apply the filter
    process(input: number, type: number, sample: number): number {
        let output = input;
        switch (sample) {
            case 1: // 500Hz
                switch (type) {
                    case 1: // Notch Sampling rate: 500.0 Hz, frequency: [48.0, 52.0] Hz.
                        this.x_1 = output - (-1.56858163 * this.z1_1) - (0.96424138 * this.z2_1);
                        output = 0.96508099 * this.x_1 + -1.56202714 * this.z1_1 + 0.96508099 * this.z2_1;
                        this.z2_1 = this.z1_1;
                        this.z1_1 = this.x_1;

                        // Second filter section
                        this.x_2 = output - (-1.61100358 * this.z1_2) - (0.96592171 * this.z2_2);
                        output = 1.0 * this.x_2 + -1.61854514 * this.z1_2 + 1.0 * this.z2_2;
                        this.z2_2 = this.z1_2;
                        this.z1_2 = this.x_2;
                        break;
                    case 2: // Notch Sampling rate: 500.0 Hz, frequency: [58.0, 62.0] Hz.
                        this.x_1 = output - (-1.40810535 * this.z1_1) - (0.96443153 * this.z2_1);
                        output = 0.96508099 * this.x_1 + (-1.40747202 * this.z1_1) + (0.96508099 * this.z2_1);
                        this.z2_1 = this.z1_1;
                        this.z1_1 = this.x_1;

                        // Second filter section
                        this.x_2 = output - (-1.45687509 * this.z1_2) - (0.96573127 * this.z2_2);
                        output = 1.00000000 * this.x_2 + (-1.45839783 * this.z1_2) + (1.00000000 * this.z2_2);
                        this.z2_2 = this.z1_2;
                        this.z1_2 = this.x_2;
                        break;
                    default:
                        break;
                }
                break;

            case 2: // 250Hz
                switch (type) {
                    case 1: // Notch Sampling rate: 250.0 Hz, frequency: [48.0, 52.0] Hz.
                        this.x_1 = output - (-0.53127491 * this.z1_1) - (0.93061518 * this.z2_1);
                        output = 0.93137886 * this.x_1 + (-0.57635175 * this.z1_1) + 0.93137886 * this.z2_1;
                        this.z2_1 = this.z1_1;
                        this.z1_1 = this.x_1;

                        // Second filter section
                        this.x_2 = output - (-0.66243374 * this.z1_2) - (0.93214913 * this.z2_2);
                        output = 1.00000000 * this.x_2 + (-0.61881558 * this.z1_2) + 1.00000000 * this.z2_2;
                        this.z2_2 = this.z1_2;
                        this.z1_2 = this.x_2;
                        break;

                    case 2: // Notch Sampling rate: 250.0 Hz, frequency: [58.0, 62.0] Hz.
                        this.x_1 = output - (-0.05269865 * this.z1_1) - (0.93123336 * this.z2_1);
                        output = 0.93137886 * this.x_1 + (-0.11711144 * this.z1_1) + 0.93137886 * this.z2_1;
                        this.z2_1 = this.z1_1;
                        this.z1_1 = this.x_1;

                        // Second filter section
                        this.x_2 = output - (-0.18985625 * this.z1_2) - (0.93153034 * this.z2_2);
                        output = 1.00000000 * this.x_2 + (-0.12573985 * this.z1_2) + 1.00000000 * this.z2_2;
                        this.z2_2 = this.z1_2;
                        this.z1_2 = this.x_2;
                        break;

                    default:
                        break;
                }
                break;

            default:
                break;
        }

        return output;
    }
}