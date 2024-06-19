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
// Make sure to set the same baud rate on your Serial Monitor/Plotter
#define BAUD_RATE 115200
// Change if not using A0 analog pin
#define INPUT_PIN A0
#define Channel_Count 6
#define Resolution 10

const int samplingRange[] = {125, 250, 500, 1000};

void setup()
{
    // Serial connection begin
    Serial.begin(BAUD_RATE);
    //    analogReadResolution(14);
}

void loop()
{
    static unsigned long past = 0;
    unsigned long present = micros();
    unsigned long interval = present - past;
    past = present;
    static long timer = 0;
    timer -= interval;
    static bool data = 0;
    static long counter = 0;

    // Check if data is available to read
    if (Serial.available() > 0)
    {
        char receivedChar = Serial.read();
        switch (receivedChar)
        {
        case 'c':
            Serial.println(Channel_Count);
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
            Serial.println(Resolution);
            break;

        case 'n':
            Serial.println("Arduino");
            break;
        }
    }

    // Sample
    if (timer < 0)
    {
        data = !data;
        timer += 1000000 / SAMPLE_RATE;
        Serial.print(counter);
        Serial.print(',');
        counter++;
        Serial.print(millis());
        Serial.print(',');
        int sensor0 = analogRead(A0);
        Serial.print(sensor0);
        Serial.print(',');
        int sensor1 = analogRead(A1);
        Serial.print(sensor1);
        Serial.print(',');
        int sensor2 = analogRead(A2);
        Serial.print(sensor2);
        Serial.print(',');
        int sensor3 = analogRead(A3);
        Serial.print(sensor3);
        Serial.print(',');
        int sensor4 = analogRead(A4);
        Serial.print(sensor4);
        Serial.print(',');
        int sensor5 = analogRead(A5);
        Serial.println(sensor5);
    }
}