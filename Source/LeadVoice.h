#pragma once

#include <juce_audio_utils/juce_audio_utils.h>
#include <array>
#include <cmath>

//==============================================================================
/** Engine settings for one block - a SoundDesign after the macro knobs are applied. */
struct LeadParams
{
    float detune = 0.5f, sawMix = 0.8f, width = 0.9f;
    float octaveLayer = 0.4f, sub = 0.1f;
    float pluck = 0.3f, pluckDecay = 0.1f;
    float cutoff = 5000.0f, resonance = 0.15f, envAmount = 0.25f;
    float vibrato = 0.1f;
    juce::ADSR::Parameters ampEnv    { 0.003f, 0.5f, 0.85f, 0.35f };
    juce::ADSR::Parameters filterEnv { 0.001f, 0.6f, 0.5f, 0.4f };
};

struct LeadSound : public juce::SynthesiserSound
{
    bool appliesToNote (int) override    { return true; }
    bool appliesToChannel (int) override { return true; }
};

//==============================================================================
/** Stereo zero-delay-feedback state variable low-pass (Zavalishin TPT). */
struct StereoSVF
{
    void reset() noexcept { ic1[0] = ic1[1] = ic2[0] = ic2[1] = 0.0f; }

    void setCoefficients (float cutoffHz, float resonance01, double sampleRate) noexcept
    {
        const auto fc = juce::jlimit (20.0f, (float) (sampleRate * 0.45), cutoffHz);
        const auto g  = std::tan (juce::MathConstants<float>::pi * fc / (float) sampleRate);
        const auto k  = 2.0f * (1.0f - 0.97f * juce::jlimit (0.0f, 1.0f, resonance01));
        a1 = 1.0f / (1.0f + g * (g + k));
        a2 = g * a1;
        a3 = g * a2;
    }

    float process (float x, int ch) noexcept
    {
        const auto v3 = x - ic2[ch];
        const auto v1 = a1 * ic1[ch] + a2 * v3;
        const auto v2 = ic2[ch] + a2 * ic1[ch] + a3 * v3;
        ic1[ch] = 2.0f * v1 - ic1[ch];
        ic2[ch] = 2.0f * v2 - ic2[ch];
        return v2;
    }

    float a1 = 0.0f, a2 = 0.0f, a3 = 0.0f;
    float ic1[2] {}, ic2[2] {};
};

//==============================================================================
/** One note of the trance lead: a 7-saw supersaw, a 3-saw layer an octave up,
    a sine sub, a bright "pluck" transient, a resonant filter and delayed vibrato. */
class LeadVoice : public juce::SynthesiserVoice
{
public:
    static constexpr int numSaws = 7;
    static constexpr int numOctSaws = 3;

    void prepare (double sampleRate)
    {
        setCurrentPlaybackSampleRate (sampleRate);
        ampEnv.setSampleRate (sampleRate);
        filterEnv.setSampleRate (sampleRate);
        filter.reset();
    }

    void setParams (const LeadParams& p)
    {
        params = p;
        ampEnv.setParameters (p.ampEnv);
        filterEnv.setParameters (p.filterEnv);
    }

    bool canPlaySound (juce::SynthesiserSound* s) override { return dynamic_cast<LeadSound*> (s) != nullptr; }

    void startNote (int midiNote, float velocity, juce::SynthesiserSound*, int pitchWheelPos) override
    {
        noteHz = (float) juce::MidiMessage::getMidiNoteInHertz (midiNote);
        velocityGain = 0.45f + 0.55f * velocity;
        pitchWheelMoved (pitchWheelPos);

        for (auto& ph : phases)    ph = random.nextDouble();
        for (auto& ph : octPhases) ph = random.nextDouble();
        subPhase = pluckPhase = 0.0;
        pluckEnv = 1.0f;
        lfoPhase = 0.0;
        noteTime = 0.0;

        filter.reset();
        ampEnv.noteOn();
        filterEnv.noteOn();
    }

    void stopNote (float, bool allowTailOff) override
    {
        if (allowTailOff)
        {
            ampEnv.noteOff();
            filterEnv.noteOff();
        }
        else
        {
            ampEnv.reset();
            filterEnv.reset();
            clearCurrentNote();
        }
    }

    void pitchWheelMoved (int v) override { bendSemitones = 2.0f * ((float) v - 8192.0f) / 8192.0f; }
    void controllerMoved (int, int) override {}

    void renderNextBlock (juce::AudioBuffer<float>& out, int startSample, int numSamples) override
    {
        if (! isVoiceActive())
            return;

        const auto sr = getSampleRate();
        constexpr auto pi = juce::MathConstants<float>::pi;

        // Relative detune offsets of the classic supersaw, and pan positions that
        // alternate sides so each detuned pair spreads across the stereo field.
        static constexpr float offsets[numSaws]    { -0.11002313f, -0.06288439f, -0.01952356f, 0.0f,
                                                      0.01991221f,  0.06216538f,  0.10745242f };
        static constexpr float pans[numSaws]       { -1.0f, 0.66f, -0.33f, 0.0f, 0.33f, -0.66f, 1.0f };
        static constexpr float octOffsets[numOctSaws] { -0.045f, 0.0f, 0.047f };
        static constexpr float octPans[numOctSaws]    { -0.8f, 0.0f, 0.8f };

        const auto d = params.detune;
        const auto detuneCurve = d * (0.15f + 0.85f * d * d);

        const auto m = params.sawMix;
        const auto centreGain = -0.55366f * m + 0.99785f;
        const auto sideGain   = -0.73764f * m * m + 1.2841f * m + 0.044372f;

        auto panGains = [] (float pan, float gain, float& l, float& r)
        {
            const auto ang = (juce::jlimit (-1.0f, 1.0f, pan) + 1.0f) * pi * 0.25f;
            l = gain * std::cos (ang) * juce::MathConstants<float>::sqrt2;
            r = gain * std::sin (ang) * juce::MathConstants<float>::sqrt2;
        };

        std::array<float, numSaws> gL {}, gR {};
        for (int i = 0; i < numSaws; ++i)
            panGains (pans[i] * params.width, (i == 3 ? centreGain : sideGain) * 0.13f, gL[(size_t) i], gR[(size_t) i]);

        std::array<float, numOctSaws> oL {}, oR {};
        for (int i = 0; i < numOctSaws; ++i)
            panGains (octPans[i] * params.width, params.octaveLayer * 0.16f, oL[(size_t) i], oR[(size_t) i]);

        const auto pluckCoef = (float) std::exp (-1.0 / (juce::jmax (0.005f, params.pluckDecay) * sr));
        const auto pluckGain = params.pluck * 0.35f;
        const auto subGain   = params.sub * 0.45f;
        const auto keyTrack  = std::sqrt (noteHz / 261.63f);   // filter follows the note at 50%

        auto* left  = out.getWritePointer (0);
        auto* right = out.getNumChannels() > 1 ? out.getWritePointer (1) : nullptr;

        std::array<double, numSaws> inc {};
        std::array<double, numOctSaws> octInc {};
        double baseInc = 0.0;

        for (int n = 0; n < numSamples; ++n)
        {
            const auto fenv = filterEnv.getNextSample();

            if ((n & 15) == 0)
            {
                // delayed vibrato: fades in after the note has sounded for a moment
                const auto vibAmount = params.vibrato * juce::jlimit (0.0f, 1.0f, (float) ((noteTime - 0.25) / 0.5));
                const auto vib = vibAmount * (float) std::sin (juce::MathConstants<double>::twoPi * lfoPhase);
                const auto hz = noteHz * std::pow (2.0f, (bendSemitones + vib) / 12.0f);

                baseInc = hz / sr;
                for (int i = 0; i < numSaws; ++i)
                    inc[(size_t) i] = baseInc * (1.0 + (double) (offsets[i] * detuneCurve));
                for (int i = 0; i < numOctSaws; ++i)
                    octInc[(size_t) i] = 2.0 * baseInc * (1.0 + (double) (octOffsets[i] * detuneCurve));

                filter.setCoefficients (params.cutoff * keyTrack * std::pow (2.0f, params.envAmount * 6.0f * fenv),
                                        params.resonance, sr);
            }

            float l = 0.0f, r = 0.0f;

            for (size_t i = 0; i < (size_t) numSaws; ++i)
            {
                const auto s = saw (phases[i], inc[i]);
                l += s * gL[i];
                r += s * gR[i];
            }

            for (size_t i = 0; i < (size_t) numOctSaws; ++i)
            {
                const auto s = saw (octPhases[i], octInc[i]);
                l += s * oL[i];
                r += s * oR[i];
            }

            subPhase += baseInc * 0.5;
            if (subPhase >= 1.0) subPhase -= 1.0;
            const auto sub = subGain * (float) std::sin (juce::MathConstants<double>::twoPi * subPhase);
            l += sub;
            r += sub;

            l = filter.process (l, 0);
            r = filter.process (r, 1);

            // bright, unfiltered transient an octave up - gives the lead its "bite"
            if (pluckEnv > 1.0e-4f)
            {
                const auto p = saw (pluckPhase, baseInc * 2.0) * pluckEnv * pluckGain;
                pluckEnv *= pluckCoef;
                l += p;
                r += p;
            }

            const auto amp = ampEnv.getNextSample() * velocityGain;
            left[startSample + n] += l * amp;
            if (right != nullptr)
                right[startSample + n] += r * amp;

            lfoPhase += 5.5 / sr;
            if (lfoPhase >= 1.0) lfoPhase -= 1.0;
            noteTime += 1.0 / sr;

            if (! ampEnv.isActive())
            {
                clearCurrentNote();
                break;
            }
        }
    }

private:
    static float saw (double& phase, double dt) noexcept
    {
        phase += dt;
        if (phase >= 1.0)
            phase -= 1.0;

        auto t = phase;
        double blep = 0.0;
        if (t < dt)            { t /= dt;               blep = t + t - t * t - 1.0; }
        else if (t > 1.0 - dt) { t = (t - 1.0) / dt;    blep = t * t + t + t + 1.0; }
        return (float) (2.0 * phase - 1.0 - blep);
    }

    LeadParams params;
    juce::ADSR ampEnv, filterEnv;
    StereoSVF filter;
    juce::Random random;

    std::array<double, numSaws> phases {};
    std::array<double, numOctSaws> octPhases {};
    double subPhase = 0.0, pluckPhase = 0.0, lfoPhase = 0.0, noteTime = 0.0;
    float pluckEnv = 0.0f;

    float noteHz = 440.0f, velocityGain = 1.0f, bendSemitones = 0.0f;
};
