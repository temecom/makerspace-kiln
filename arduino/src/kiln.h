#ifndef KILN_H
#define KILN_H
#define ARDUINO_ARCH_SAMD
#define VERSION "0.1.0"

#if defined(ARDUINO_ARCH_SAMD)
#define Serial_ SerialUSB
#else
#define Serial_ Serial
#endif

#endif