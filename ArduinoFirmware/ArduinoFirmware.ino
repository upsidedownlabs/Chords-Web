// Multi channel serial - BioAmp EXG Pill
// https://github.com/upsidedownlabs/BioAmp-EXG-Pill
// Upside Down Labs invests time and resources providing this open source code,
// please support Upside Down Labs and open-source hardware by purchasing
// products from Upside Down Labs!
// Copyright (c) 2021 - 2024 Upside Down Labs - contact@upsidedownlabs.tech
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
// Samples per second
#define SAMPLE_RATE 250
#define BAUD_RATE 115200
#define CHANNEL_COUNT 6
#define RESOLUTION 10

const uint16_t samplingRange[] = {125, 250, 500, 1000};
const uint8_t inputPins[CHANNEL_COUNT] = {A0, A1, A2, A3, A4, A5};

void setup()
{
    Serial.begin(BAUD_RATE);

    // Set ADC prescaler to 16 for faster reads
    ADCSRA = (ADCSRA & ~0x07) | 0x04;

    // Set up timer interrupt for precise sampling
    cli(); // Disable interrupts
    TCCR1A = 0;
    TCCR1B = 0;
    TCNT1 = 0;
    OCR1A = 16000000 / (SAMPLE_RATE * 8) - 1; // Set compare match register for 250Hz sampling
    TCCR1B |= (1 << WGM12);                   // CTC mode
    TCCR1B |= (1 << CS11);                    // 8 prescaler
    TIMSK1 |= (1 << OCIE1A);                  // Enable timer compare interrupt
    sei();                                    // Enable interrupts
}

ISR(TIMER1_COMPA_vect)
{
    static uint8_t counter = 0;

    Serial.print(counter++);
    for (int i = 0; i < CHANNEL_COUNT; i++)
    {
        Serial.print(',');
        Serial.print(analogRead(inputPins[i]));
    }
    Serial.println();
}

void loop()
{
    if (Serial.available() > 0)
    {
        char receivedChar = Serial.read();
        switch (receivedChar)
        {
        case 'c':
            Serial.println(CHANNEL_COUNT);
            break;
        case 's':
            for (int i = 0; i < 4; i++)
            {
                Serial.print("s");
                Serial.print(i);
                Serial.print(": ");
                Serial.println(samplingRange[i]);
            }
            break;
        case 'r':
            Serial.println(RESOLUTION);
            break;
        case 'n':
            Serial.println(F("Arduino"));
            break;
        }
    }
}