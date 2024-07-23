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

#define BUFFER_SIZE 100

#define CHANNEL_COUNT 6

#define MaxValue 1024 // Sending maximum value of 10 bit arduino, to update chart limits

volatile uint8_t head = 0;
volatile uint8_t tail = 0;
volatile bool dataReady = false;
uint16_t buffer[BUFFER_SIZE][CHANNEL_COUNT];

void setup()
{
  Serial.begin(BAUD_RATE);

  // Set ADC prescaler to 16 for faster reads
  ADCSRA = (ADCSRA & ~0x07) | 0x04;

  // Set ADC reference to AVCC
  ADMUX = (1 << REFS0);

  // Set up timer interrupt for sampling
  cli();
  TCCR1A = 0;
  TCCR1B = 0;
  TCNT1 = 0;
  OCR1A = 16000000 / (8 * SAMPLE_RATE) - 1;
  TCCR1B |= (1 << WGM12) | (1 << CS11);
  TIMSK1 |= (1 << OCIE1A);
  sei();
}

ISR(TIMER1_COMPA_vect)
{
  static uint8_t channel = 0;

  if (channel == 0)
  {
    if (((head + 1) & (BUFFER_SIZE - 1)) == tail)
    {
      tail = (tail + 1) & (BUFFER_SIZE - 1);
    }
  }

  // Start conversion for next channel
  ADMUX = (ADMUX & 0xF0) | (channel & 0x07);
  ADCSRA |= (1 << ADSC);

  // Wait for conversion to complete
  while (ADCSRA & (1 << ADSC))
    ;

  // Read ADC value
  buffer[head][channel] = ADC;

  channel = (channel + 1) % CHANNEL_COUNT;

  if (channel == 0)
  {
    head = (head + 1) & (BUFFER_SIZE - 1);
    dataReady = true;
  }
}

void loop()
{
  if (dataReady)
  {
    dataReady = false;
    static uint8_t counter = 0;
    while (head != tail)
    {
      Serial.print(counter++); // This will automatically wrap around to 0 after 255
      for (int i = 0; i < CHANNEL_COUNT; i++)
      {
        Serial.print(',');
        Serial.print(buffer[tail][i]);
      }
      Serial.println();
      tail = (tail + 1) & (BUFFER_SIZE - 1);
    }
  }
  if (Serial.available() > 0)
  {
    char receivedChar = Serial.read();
    switch (receivedChar)
    {
    case 'b':
      Serial.println(MaxValue);
      break;
    }
  }
}