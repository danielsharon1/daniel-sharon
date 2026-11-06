#pragma once

#include <array>

//==============================================================================
/** A complete, pre-designed lead sound. The user never sees these numbers -
    they pick a sound by name and shape it with a handful of macro knobs. */
struct SoundDesign
{
    const char* name;

    // supersaw core
    float detune, sawMix, width;
    float octaveLayer;   // level of the +1 octave supersaw layer
    float sub;           // sine one octave below
    float pluck;         // level of the bright attack transient layer
    float pluckDecay;    // seconds

    // filter
    float cutoff, resonance, envAmount;
    float fA, fD, fS, fR;

    // amp
    float A, D, S, R;

    float vibrato;       // semitones

    // effects
    float chorus;
    float delayMix, delayFeedback;
    float delayBeats;
    float reverbMix, reverbSize;
    float highPass;      // Hz - keeps the lead out of the bass/kick range

    // trance gate
    const char* gatePattern; // 16 chars, 'x' = open
    float gateStepBeats;
    float gateDefault;   // default value of the GATE macro for this sound
};

inline const std::array<SoundDesign, 6>& getSoundDesigns()
{
    static const std::array<SoundDesign, 6> sounds {{
        { "Uplifting Lead",
          0.50f, 0.80f, 0.90f, 0.45f, 0.10f, 0.35f, 0.12f,
          5200.0f, 0.15f, 0.25f,   0.001f, 0.60f, 0.50f, 0.40f,
          0.003f, 0.50f, 0.85f, 0.35f,
          0.12f,
          0.30f, 0.28f, 0.38f, 0.75f, 0.35f, 0.88f, 180.0f,
          "x.xx.x.xx.xx.x.x", 0.25f, 0.0f },

        { "Euphoric Supersaw",
          0.65f, 0.90f, 1.00f, 0.50f, 0.00f, 0.15f, 0.10f,
          7000.0f, 0.10f, 0.15f,   0.020f, 0.80f, 0.70f, 0.60f,
          0.020f, 0.80f, 0.90f, 0.60f,
          0.10f,
          0.40f, 0.25f, 0.35f, 0.75f, 0.45f, 0.92f, 200.0f,
          "x.xx.x.xx.xx.x.x", 0.25f, 0.0f },

        { "Pluck Lead",
          0.40f, 0.70f, 0.80f, 0.35f, 0.10f, 0.60f, 0.08f,
          1300.0f, 0.30f, 0.60f,   0.001f, 0.25f, 0.15f, 0.25f,
          0.001f, 0.35f, 0.30f, 0.30f,
          0.00f,
          0.25f, 0.32f, 0.42f, 0.75f, 0.30f, 0.80f, 220.0f,
          "xxxxxxxxxxxxxxxx", 0.25f, 0.0f },

        { "Gated Trance Lead",
          0.55f, 0.85f, 1.00f, 0.40f, 0.05f, 0.25f, 0.10f,
          4500.0f, 0.18f, 0.20f,   0.010f, 0.80f, 0.60f, 0.50f,
          0.010f, 0.80f, 0.90f, 0.50f,
          0.08f,
          0.35f, 0.25f, 0.30f, 0.75f, 0.40f, 0.90f, 200.0f,
          "x.xx.x.xx.xx.x.x", 0.25f, 1.0f },

        { "Psy Lead",
          0.20f, 0.40f, 0.50f, 0.20f, 0.15f, 0.40f, 0.06f,
          1800.0f, 0.45f, 0.40f,   0.001f, 0.30f, 0.35f, 0.20f,
          0.002f, 0.30f, 0.70f, 0.20f,
          0.25f,
          0.15f, 0.30f, 0.45f, 0.75f, 0.25f, 0.70f, 250.0f,
          "x.x.x.x.x.x.x.x.", 0.25f, 0.0f },

        { "Bright Solo Lead",
          0.30f, 0.55f, 0.70f, 0.30f, 0.10f, 0.30f, 0.10f,
          9000.0f, 0.12f, 0.15f,   0.001f, 0.50f, 0.70f, 0.40f,
          0.005f, 0.40f, 0.90f, 0.30f,
          0.20f,
          0.30f, 0.25f, 0.35f, 0.75f, 0.30f, 0.85f, 200.0f,
          "x.xx.x.xx.xx.x.x", 0.25f, 0.0f },
    }};
    return sounds;
}
