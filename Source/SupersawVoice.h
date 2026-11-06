#pragma once

#include <juce_audio_utils/juce_audio_utils.h>
#include <array>
#include <cmath>

//==============================================================================
/** Parameters shared by every voice, refreshed once per audio block. */
struct VoiceParams
{
    float detune     = 0.4f;   // 0..1
    float mix        = 0.7f;   // 0..1  side-saw level
    float sub        = 0.0f;   // 0..1  sine sub-oscillator level
    float width      = 0.8f;   // 0..1  stereo spread of the unison saws
    int   octave     = 0;      // -2..+2

    float cutoff     = 8000.0f; // Hz
    float resonance  = 0.2f;    // 0..1
    float envAmount  = 0.3f;    // -1..1 (in units of 7 octaves)
    float keyTrack   = 0.5f;    // 0..1

    juce::ADSR::Parameters ampEnv    { 0.005f, 0.3f, 0.8f, 0.3f };
    juce::ADSR::Parameters filterEnv { 0.001f, 0.4f, 0.3f, 0.3f };
};

//==============================================================================
struct TranceSound : public juce::SynthesiserSound
{
    bool appliesToNote (int) override    { return true; }
    bool appliesToChannel (int) override { return true; }
};

//==============================================================================
/** Stereo, zero-delay-feedback state variable low-pass (Zavalishin TPT). */
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
        return v2; // low-pass output
    }

    float a1 = 0.0f, a2 = 0.0f, a3 = 0.0f;
    float ic1[2] {}, ic2[2] {};
};

//==============================================================================
/** A 7-oscillator detuned "supersaw" voice with sub, resonant filter and two ADSRs. */
class SupersawVoice : public juce::SynthesiserVoice
{
public:
    static constexpr int numSaws = 7;

    SupersawVoice()
    {
        // Pan positions interleaved so neighbouring detune pairs land on opposite sides.
        static constexpr float pans[numSaws] { -1.0f, 0.66f, -0.33f, 0.0f, 0.33f, -0.66f, 1.0f };
        for (int i = 0; i < numSaws; ++i)
            panPos[(size_t) i] = pans[i];
    }

    void prepare (double sampleRate)
    {
        setCurrentPlaybackSampleRate (sampleRate);
        ampEnv.setSampleRate (sampleRate);
        filterEnv.setSampleRate (sampleRate);
        filter.reset();
    }

    void setParams (const VoiceParams& p)
    {
        params = p;
        ampEnv.setParameters (p.ampEnv);
        filterEnv.setParameters (p.filterEnv);
    }

    bool canPlaySound (juce::SynthesiserSound* s) override
    {
        return dynamic_cast<TranceSound*> (s) != nullptr;
    }

    void startNote (int midiNote, float velocity, juce::SynthesiserSound*, int pitchWheelPos) override
    {
        currentNote = midiNote;
        noteHz      = (float) juce::MidiMessage::getMidiNoteInHertz (midiNote);
        velocityGain = 0.35f + 0.65f * velocity;
        pitchWheelMoved (pitchWheelPos);

        // Random start phases give the supersaw its characteristic animated sound.
        for (auto& ph : phases)
            ph = random.nextDouble();
        subPhase = 0.0;

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

    void pitchWheelMoved (int newValue) override
    {
        bendSemitones = 2.0f * ((float) newValue - 8192.0f) / 8192.0f;
    }

    void controllerMoved (int, int) override {}

    void renderNextBlock (juce::AudioBuffer<float>& out, int startSample, int numSamples) override
    {
        if (! isVoiceActive())
            return;

        const auto sr = getSampleRate();
        const auto baseHz = noteHz * std::pow (2.0f, (float) params.octave + bendSemitones / 12.0f);

        // Detune spread (relative frequency offsets, after the classic analogue-style supersaw).
        static constexpr float offsets[numSaws] { -0.11002313f, -0.06288439f, -0.01952356f, 0.0f,
                                                   0.01991221f,  0.06216538f,  0.10745242f };
        const auto d = params.detune;
        const auto detuneCurve = d * (0.15f + 0.85f * d * d);   // finer control at low settings

        std::array<double, numSaws> inc {};
        for (int i = 0; i < numSaws; ++i)
            inc[(size_t) i] = baseHz * (1.0 + (double) (offsets[i] * detuneCurve)) / sr;

        const auto m = params.mix;
        const auto centreGain = -0.55366f * m + 0.99785f;
        const auto sideGain   = -0.73764f * m * m + 1.2841f * m + 0.044372f;

        std::array<float, numSaws> gL {}, gR {};
        for (int i = 0; i < numSaws; ++i)
        {
            const auto g   = (i == 3 ? centreGain : sideGain) * 0.16f;
            const auto pan = panPos[(size_t) i] * params.width;           // -1..1
            const auto ang = (pan + 1.0f) * juce::MathConstants<float>::pi * 0.25f;
            gL[(size_t) i] = g * std::cos (ang) * juce::MathConstants<float>::sqrt2;
            gR[(size_t) i] = g * std::sin (ang) * juce::MathConstants<float>::sqrt2;
        }

        const auto subInc  = (baseHz * 0.5) / sr;
        const auto subGain = params.sub * 0.5f;

        // Key tracking: filter follows the played note relative to middle C.
        const auto keyTrackRatio = std::pow (2.0f, params.keyTrack * ((float) currentNote - 60.0f) / 12.0f);

        auto* left  = out.getWritePointer (0);
        auto* right = out.getNumChannels() > 1 ? out.getWritePointer (1) : nullptr;

        for (int n = 0; n < numSamples; ++n)
        {
            const auto fenv = filterEnv.getNextSample();

            if ((n & 15) == 0)
            {
                const auto fc = params.cutoff * keyTrackRatio
                              * std::pow (2.0f, params.envAmount * 7.0f * fenv);
                filter.setCoefficients (fc, params.resonance, sr);
            }

            float l = 0.0f, r = 0.0f;

            for (size_t i = 0; i < (size_t) numSaws; ++i)
            {
                auto& ph = phases[i];
                ph += inc[i];
                if (ph >= 1.0)
                    ph -= 1.0;

                const auto s = (float) (2.0 * ph - 1.0 - polyBlep (ph, inc[i]));
                l += s * gL[i];
                r += s * gR[i];
            }

            subPhase += subInc;
            if (subPhase >= 1.0)
                subPhase -= 1.0;

            const auto sub = subGain * (float) std::sin (juce::MathConstants<double>::twoPi * subPhase);
            l += sub;
            r += sub;

            l = filter.process (l, 0);
            r = filter.process (r, 1);

            const auto amp = ampEnv.getNextSample() * velocityGain;

            left[startSample + n] += l * amp;
            if (right != nullptr)
                right[startSample + n] += r * amp;

            if (! ampEnv.isActive())
            {
                clearCurrentNote();
                break;
            }
        }
    }

private:
    static double polyBlep (double t, double dt) noexcept
    {
        if (t < dt)
        {
            t /= dt;
            return t + t - t * t - 1.0;
        }
        if (t > 1.0 - dt)
        {
            t = (t - 1.0) / dt;
            return t * t + t + t + 1.0;
        }
        return 0.0;
    }

    VoiceParams params;
    juce::ADSR ampEnv, filterEnv;
    StereoSVF filter;
    juce::Random random;

    std::array<double, numSaws> phases {};
    std::array<float, numSaws> panPos {};
    double subPhase = 0.0;

    int   currentNote   = 60;
    float noteHz        = 440.0f;
    float velocityGain  = 1.0f;
    float bendSemitones = 0.0f;
};
