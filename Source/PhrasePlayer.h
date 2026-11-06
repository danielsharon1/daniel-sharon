#pragma once

#include <juce_audio_basics/juce_audio_basics.h>
#include <algorithm>
#include <array>
#include <cmath>
#include <vector>

//==============================================================================
/** A looping trance melody, written in 16th-note steps as semitone offsets from
    the key the player holds down (natural minor). All phrases are original. */
struct Phrase
{
    struct Note { int step, length, semitones; };

    const char* name;
    int lengthSteps;
    std::vector<Note> notes;
};

inline const std::vector<Phrase>& getPhrases()
{
    static const std::vector<Phrase> phrases {
        { "Uplifting Roll", 32,
          { { 0, 3, 12 }, { 3, 3, 7 }, { 6, 2, 3 }, { 8, 3, 12 }, { 11, 3, 7 }, { 14, 2, 3 },
            { 16, 3, 14 }, { 19, 3, 10 }, { 22, 2, 7 }, { 24, 3, 15 }, { 27, 3, 14 }, { 30, 2, 10 } } },

        { "Anthem Hook", 64,
          { { 0, 4, 7 }, { 4, 2, 8 }, { 6, 2, 7 }, { 8, 4, 5 }, { 12, 4, 3 },
            { 16, 6, 5 }, { 22, 2, 7 }, { 24, 8, 3 },
            { 32, 4, 7 }, { 36, 2, 8 }, { 38, 2, 10 }, { 40, 4, 12 }, { 44, 4, 10 },
            { 48, 6, 8 }, { 54, 2, 7 }, { 56, 8, 7 } } },

        { "Rising Arp", 16,
          { { 0, 1, 0 }, { 1, 1, 3 }, { 2, 1, 7 }, { 3, 1, 12 }, { 4, 1, 15 }, { 5, 1, 12 }, { 6, 1, 7 }, { 7, 1, 3 },
            { 8, 1, 0 }, { 9, 1, 3 }, { 10, 1, 7 }, { 11, 1, 12 }, { 12, 1, 15 }, { 13, 1, 19 }, { 14, 1, 15 }, { 15, 1, 12 } } },

        { "Call & Answer", 32,
          { { 0, 2, 12 }, { 2, 2, 10 }, { 4, 2, 7 }, { 6, 2, 10 }, { 8, 4, 12 }, { 12, 4, 15 },
            { 16, 2, 14 }, { 18, 2, 12 }, { 20, 2, 10 }, { 22, 2, 7 }, { 24, 6, 5 }, { 30, 2, 7 } } },

        { "Offbeat Stabs", 16,
          { { 2, 1, 0 }, { 2, 1, 7 }, { 6, 1, 0 }, { 6, 1, 7 }, { 10, 1, 3 }, { 10, 1, 10 }, { 14, 1, 0 }, { 14, 1, 7 } } },
    };
    return phrases;
}

//==============================================================================
/** Turns held keys into a tempo-synced melody. While a phrase is selected, incoming
    notes choose the key (the lowest held note is the root) and the player generates
    the actual note events on the 16th-note grid of the host's timeline. */
class PhrasePlayer
{
public:
    void reset() { held.clear(); active.clear(); }

    /** Replaces the note events in `midi` with the generated melody. */
    void process (juce::MidiBuffer& midi, int numSamples, double ppqStart, double ppqPerSample, const Phrase* phrase)
    {
        juce::MidiBuffer out;

        if (phrase == nullptr)
        {
            // phrase mode turned off: silence anything we started, pass the keys straight through
            for (const auto& a : active)
                out.addEvent (juce::MidiMessage::noteOff (1, a.note), 0);
            active.clear();
            held.clear();
            for (const auto m : midi)
                out.addEvent (m.getMessage(), m.samplePosition);
            midi.swapWith (out);
            return;
        }

        constexpr double stepBeats = 0.25;
        const auto stepAtSample = [&] (int s) { return (ppqStart + s * ppqPerSample) / stepBeats; };

        // Every 16th-note boundary that falls inside this block.
        std::vector<std::pair<int, long long>> ticks;
        const auto firstStep = (long long) std::ceil (stepAtSample (0) - 1.0e-7);
        for (auto k = firstStep;; ++k)
        {
            const auto pos = (int) std::round (((double) k * stepBeats - ppqStart) / ppqPerSample);
            if (pos >= numSamples)
                break;
            ticks.push_back ({ juce::jmax (0, pos), k });
        }

        auto tick = ticks.begin();

        auto runTicksUntil = [&] (int samplePos)
        {
            for (; tick != ticks.end() && tick->first <= samplePos; ++tick)
                onStep (out, tick->first, tick->second, *phrase);
        };

        for (const auto m : midi)
        {
            const auto msg = m.getMessage();
            runTicksUntil (m.samplePosition - 1);

            if (msg.isNoteOn())
            {
                held.push_back (msg.getNoteNumber());
            }
            else if (msg.isNoteOff())
            {
                held.erase (std::remove (held.begin(), held.end(), msg.getNoteNumber()), held.end());
                if (held.empty())
                    releaseAll (out, m.samplePosition);
            }
            else if (msg.isAllNotesOff() || msg.isAllSoundOff())
            {
                held.clear();
                releaseAll (out, m.samplePosition);
            }
            else
            {
                out.addEvent (msg, m.samplePosition);   // pitch bend, CCs, ...
            }
        }

        runTicksUntil (numSamples);
        midi.swapWith (out);
    }

private:
    struct Active { int note; long long endStep; };

    void onStep (juce::MidiBuffer& out, int samplePos, long long step, const Phrase& phrase)
    {
        // end notes whose length is over
        for (auto it = active.begin(); it != active.end();)
        {
            if (it->endStep <= step)
            {
                out.addEvent (juce::MidiMessage::noteOff (1, it->note), samplePos);
                it = active.erase (it);
            }
            else
            {
                ++it;
            }
        }

        if (held.empty())
            return;

        const auto root = *std::min_element (held.begin(), held.end());
        const auto pos = (int) (((step % phrase.lengthSteps) + phrase.lengthSteps) % phrase.lengthSteps);

        for (const auto& n : phrase.notes)
        {
            if (n.step != pos)
                continue;

            const auto note = root + n.semitones;
            if (! juce::isPositiveAndBelow (note, 128))
                continue;

            for (auto it = active.begin(); it != active.end();)
            {
                if (it->note == note)
                {
                    out.addEvent (juce::MidiMessage::noteOff (1, note), samplePos);
                    it = active.erase (it);
                }
                else
                {
                    ++it;
                }
            }

            const auto velocity = (pos % 4 == 0) ? 1.0f : 0.82f;   // accent on the beat
            out.addEvent (juce::MidiMessage::noteOn (1, note, velocity), samplePos);
            active.push_back ({ note, step + n.length });
        }
    }

    void releaseAll (juce::MidiBuffer& out, int samplePos)
    {
        for (const auto& a : active)
            out.addEvent (juce::MidiMessage::noteOff (1, a.note), samplePos);
        active.clear();
    }

    std::vector<int> held;
    std::vector<Active> active;
};
