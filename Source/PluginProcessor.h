#pragma once

#include <juce_audio_utils/juce_audio_utils.h>
#include <juce_dsp/juce_dsp.h>
#include "LeadVoice.h"
#include "PhrasePlayer.h"
#include "SoundDesigns.h"
#include "TranceFX.h"

namespace ParamIDs
{
    inline constexpr auto sound   = "sound";
    inline constexpr auto melody  = "melody";
    inline constexpr auto tone    = "tone";
    inline constexpr auto width   = "width";
    inline constexpr auto pluck   = "pluck";
    inline constexpr auto space   = "space";
    inline constexpr auto gate    = "gate";
    inline constexpr auto vibrato = "vibrato";
    inline constexpr auto volume  = "volume";
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
    double getTailLengthSeconds() const override { return 5.0; }

    int getNumPrograms() override;
    int getCurrentProgram() override;
    void setCurrentProgram (int index) override;
    const juce::String getProgramName (int index) override;
    void changeProgramName (int, const juce::String&) override {}

    void getStateInformation (juce::MemoryBlock& destData) override;
    void setStateInformation (const void* data, int sizeInBytes) override;

    int getCurrentGateStep() const noexcept { return currentGateStep.load(); }
    const SoundDesign& getCurrentSound() const;

    juce::AudioProcessorValueTreeState apvts;
    juce::MidiKeyboardState keyboardState;   // on-screen keyboard in the editor

    static juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout();
    static juce::StringArray getSoundNames();
    static juce::StringArray getMelodyNames();

private:
    float get (const char* id) const { return apvts.getRawParameterValue (id)->load(); }
    LeadParams makeLeadParams (const SoundDesign&) const;

    juce::Synthesiser synth;
    PhrasePlayer phrasePlayer;
    TranceGate gateFx;
    PingPongDelay delay;
    juce::dsp::Chorus<float> chorus;
    juce::dsp::StateVariableTPTFilter<float> highPass;
    juce::Reverb reverb;
    juce::SmoothedValue<float> masterGain;

    std::atomic<int> currentGateStep { -1 };
    double freeRunPpq = 0.0;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (TranceForgeProcessor)
};
