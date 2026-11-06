#pragma once

#include <juce_audio_utils/juce_audio_utils.h>
#include <array>
#include <cmath>
#include <vector>

//==============================================================================
/** 16-step tempo-synced volume gate - the classic "trance gate". */
class TranceGate
{
public:
    static constexpr int numSteps = 16;

    void prepare (double newSampleRate) { sampleRate = newSampleRate; smoothed = 1.0f; }

    /** Returns the gain for a sample at the given musical position (in quarter notes). */
    float process (double ppq, bool enabled, double stepLengthBeats, float depth,
                   float gateLength, float smoothMs, const std::array<bool, numSteps>& steps) noexcept
    {
        float target = 1.0f;

        if (enabled)
        {
            const auto stepPos = ppq / stepLengthBeats;
            const auto stepFloor = std::floor (stepPos);
            auto idx = (int) std::fmod (stepFloor, (double) numSteps);
            if (idx < 0)
                idx += numSteps;

            currentStep = idx;
            const auto frac = (float) (stepPos - stepFloor);
            const auto on = steps[(size_t) idx] && frac < gateLength;
            target = on ? 1.0f : 1.0f - depth;
        }
        else
        {
            currentStep = -1;
        }

        const auto smoothSamples = juce::jmax (1.0, (double) smoothMs * 0.001 * sampleRate);
        const auto coef = (float) std::exp (-1.0 / smoothSamples);
        smoothed = target + coef * (smoothed - target);
        return smoothed;
    }

    int getCurrentStep() const noexcept { return currentStep; }

private:
    double sampleRate = 44100.0;
    float smoothed = 1.0f;
    int currentStep = -1;
};

//==============================================================================
/** Tempo-synced stereo ping-pong delay with a damped feedback path. */
class PingPongDelay
{
public:
    void prepare (double newSampleRate)
    {
        sampleRate = newSampleRate;
        const auto size = (size_t) (sampleRate * 4.0) + 1;
        bufL.assign (size, 0.0f);
        bufR.assign (size, 0.0f);
        writePos = 0;
        dampL = dampR = 0.0f;
        currentDelay = -1.0f;
    }

    void reset()
    {
        std::fill (bufL.begin(), bufL.end(), 0.0f);
        std::fill (bufR.begin(), bufR.end(), 0.0f);
        dampL = dampR = 0.0f;
    }

    void process (juce::AudioBuffer<float>& buffer, double bpm, double delayBeats, float mix, float feedback)
    {
        if (bufL.empty() || buffer.getNumChannels() < 2)
            return;

        const auto size = (int) bufL.size();
        const auto targetDelay = (float) juce::jlimit (1.0, (double) size - 2.0,
                                                      delayBeats * 60.0 / bpm * sampleRate);
        if (currentDelay < 0.0f)
            currentDelay = targetDelay;

        auto* L = buffer.getWritePointer (0);
        auto* R = buffer.getWritePointer (1);
        const auto dampCoef = 0.35f;   // gentle low-pass so repeats get darker

        for (int n = 0; n < buffer.getNumSamples(); ++n)
        {
            // glide towards a new delay time instead of jumping (avoids clicks on tempo changes)
            currentDelay += 0.001f * (targetDelay - currentDelay);

            auto readPos = (float) writePos - currentDelay;
            if (readPos < 0.0f)
                readPos += (float) size;

            const auto i0 = (int) readPos;
            const auto i1 = (i0 + 1) % size;
            const auto frac = readPos - (float) i0;

            const auto dL = bufL[(size_t) i0] + frac * (bufL[(size_t) i1] - bufL[(size_t) i0]);
            const auto dR = bufR[(size_t) i0] + frac * (bufR[(size_t) i1] - bufR[(size_t) i0]);

            dampL += dampCoef * (dL - dampL);
            dampR += dampCoef * (dR - dampR);

            const auto inL = L[n], inR = R[n];

            // ping-pong: mono input enters the left line, each line feeds the other
            bufL[(size_t) writePos] = 0.5f * (inL + inR) + dampR * feedback;
            bufR[(size_t) writePos] = dampL * feedback;

            L[n] = inL + dL * mix;
            R[n] = inR + dR * mix;

            if (++writePos >= size)
                writePos = 0;
        }
    }

private:
    double sampleRate = 44100.0;
    std::vector<float> bufL, bufR;
    int writePos = 0;
    float dampL = 0.0f, dampR = 0.0f;
    float currentDelay = -1.0f;
};
