#pragma once

#include <juce_audio_utils/juce_audio_utils.h>
#include <juce_dsp/juce_dsp.h>
#include "SupersawVoice.h"
#include "TranceFX.h"

namespace ParamIDs
{
    inline constexpr auto detune     = "detune";
    inline constexpr auto mix        = "mix";
    inline constexpr auto sub        = "sub";
    inline constexpr auto width      = "width";
    inline constexpr auto octave     = "octave";

    inline constexpr auto cutoff     = "cutoff";
    inline constexpr auto resonance  = "resonance";
    inline constexpr auto envAmount  = "envAmount";
    inline constexpr auto keyTrack   = "keyTrack";

    inline constexpr auto fAttack    = "fAttack";
    inline constexpr auto fDecay     = "fDecay";
    inline constexpr auto fSustain   = "fSustain";
    inline constexpr auto fRelease   = "fRelease";

    inline constexpr auto attack     = "attack";
    inline constexpr auto decay      = "decay";
    inline constexpr auto sustain    = "sustain";
    inline constexpr auto release    = "release";

    inline constexpr auto gateOn     = "gateOn";
    inline constexpr auto gateRate   = "gateRate";
    inline constexpr auto gateDepth  = "gateDepth";
    inline constexpr auto gateLength = "gateLength";
    inline constexpr auto gateSmooth = "gateSmooth";

    inline constexpr auto delayMix   = "delayMix";
    inline constexpr auto delayFb    = "delayFeedback";
    inline constexpr auto delayTime  = "delayTime";

    inline constexpr auto reverbMix  = "reverbMix";
    inline constexpr auto reverbSize = "reverbSize";

    inline constexpr auto master     = "master";

    inline juce::String gateStep (int i) { return "gateStep" + juce::String (i); }
}

//==============================================================================
class TranceForgeProcessor : public juce::AudioProcessor
{
public:
    TranceForgeProcessor();
    ~TranceForgeProcessor() override = default;

    void prepareToPlay (double sampleRate, int samplesPerBlock) override;
    void releaseResources() override {}
    bool isBusesLayoutSupported (const BusesLayout& layouts) const override;
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;
    using AudioProcessor::processBlock;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    const juce::String getName() const override { return JucePlugin_Name; }
    bool acceptsMidi() const override  { return true; }
    bool producesMidi() const override { return false; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 4.0; }

    int getNumPrograms() override;
    int getCurrentProgram() override { return currentProgram; }
    void setCurrentProgram (int index) override;
    const juce::String getProgramName (int index) override;
    void changeProgramName (int, const juce::String&) override {}

    void getStateInformation (juce::MemoryBlock& destData) override;
    void setStateInformation (const void* data, int sizeInBytes) override;

    /** The gate step currently playing (-1 when the gate is off) - used by the editor. */
    int getCurrentGateStep() const noexcept { return currentGateStep.load(); }

    juce::AudioProcessorValueTreeState apvts;
    static juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout();

    static const juce::StringArray gateRateNames;
    static const juce::StringArray delayTimeNames;

private:
    float get (const char* id) const { return apvts.getRawParameterValue (id)->load(); }
    void updateVoiceParams();

    juce::Synthesiser synth;
    TranceGate gate;
    PingPongDelay delay;
    juce::Reverb reverb;
    juce::SmoothedValue<float> masterGain;

    std::array<std::atomic<float>*, TranceGate::numSteps> stepParams {};
    std::atomic<int> currentGateStep { -1 };

    double freeRunPpq = 0.0;
    int currentProgram = 0;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (TranceForgeProcessor)
};
