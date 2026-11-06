#include "PluginProcessor.h"
#include "PluginEditor.h"

//==============================================================================
TranceForgeProcessor::TranceForgeProcessor()
    : AudioProcessor (BusesProperties().withOutput ("Output", juce::AudioChannelSet::stereo(), true)),
      apvts (*this, nullptr, "TranceForge", createParameterLayout())
{
    for (int i = 0; i < 8; ++i)
        synth.addVoice (new LeadVoice());

    synth.addSound (new LeadSound());
}

juce::StringArray TranceForgeProcessor::getSoundNames()
{
    juce::StringArray names;
    for (const auto& s : getSoundDesigns())
        names.add (s.name);
    return names;
}

juce::StringArray TranceForgeProcessor::getMelodyNames()
{
    juce::StringArray names { "Off - play it yourself" };
    for (const auto& p : getPhrases())
        names.add (p.name);
    return names;
}

juce::AudioProcessorValueTreeState::ParameterLayout TranceForgeProcessor::createParameterLayout()
{
    using namespace juce;
    using namespace ParamIDs;

    std::vector<std::unique_ptr<RangedAudioParameter>> p;

    p.push_back (std::make_unique<AudioParameterChoice> (ParameterID { sound, 1 }, "Sound", getSoundNames(), 0));
    p.push_back (std::make_unique<AudioParameterChoice> (ParameterID { melody, 1 }, "Melody", getMelodyNames(), 0));

    auto macro = [&p] (const char* id, const char* name, float def)
    {
        p.push_back (std::make_unique<AudioParameterFloat> (
            ParameterID { id, 1 }, name, NormalisableRange<float> (0.0f, 1.0f), def,
            AudioParameterFloatAttributes().withStringFromValueFunction (
                [] (float v, int) { return String (roundToInt (v * 100.0f)) + "%"; })));
    };

    macro (tone,    "Tone",    0.5f);
    macro (width,   "Width",   0.5f);
    macro (pluck,   "Pluck",   0.5f);
    macro (space,   "Space",   0.5f);
    macro (gate,    "Gate",    0.0f);
    macro (vibrato, "Vibrato", 0.5f);

    p.push_back (std::make_unique<AudioParameterFloat> (
        ParameterID { volume, 1 }, "Volume", NormalisableRange<float> (-36.0f, 6.0f), -4.0f,
        AudioParameterFloatAttributes().withStringFromValueFunction (
            [] (float v, int) { return String (v, 1) + " dB"; })));

    return { p.begin(), p.end() };
}

//==============================================================================
const SoundDesign& TranceForgeProcessor::getCurrentSound() const
{
    const auto& sounds = getSoundDesigns();
    return sounds[(size_t) juce::jlimit (0, (int) sounds.size() - 1, (int) get (ParamIDs::sound))];
}

/** The macro knobs sit at 50% for the sound exactly as designed and bend it from there. */
LeadParams TranceForgeProcessor::makeLeadParams (const SoundDesign& s) const
{
    using namespace ParamIDs;
    const auto t = get (tone), w = get (width), pl = get (pluck), v = get (vibrato);

    LeadParams lp;
    lp.detune      = juce::jlimit (0.0f, 1.0f, s.detune * (0.4f + 1.2f * w));
    lp.width       = juce::jlimit (0.0f, 1.0f, s.width * 2.0f * w);
    lp.sawMix      = s.sawMix;
    lp.octaveLayer = s.octaveLayer;
    lp.sub         = s.sub;

    lp.cutoff      = s.cutoff * std::pow (2.0f, (t - 0.5f) * 4.0f);
    lp.resonance   = s.resonance;
    lp.envAmount   = s.envAmount * (0.5f + pl);

    lp.pluck       = s.pluck * 2.0f * pl;
    lp.pluckDecay  = s.pluckDecay;

    lp.vibrato     = s.vibrato * 2.0f * v + juce::jmax (0.0f, v - 0.5f) * 0.3f;

    const auto softAttack = juce::jmax (0.0f, 0.5f - pl) * 0.3f;          // PLUCK low = softer attack
    const auto shorter    = 1.0f - juce::jmax (0.0f, pl - 0.5f) * 1.4f;    // PLUCK high = shorter, snappier
    lp.ampEnv    = { s.A + softAttack, s.D, s.S * shorter, s.R };
    lp.filterEnv = { s.fA, s.fD, s.fS, s.fR };
    return lp;
}

//==============================================================================
void TranceForgeProcessor::prepareToPlay (double sampleRate, int samplesPerBlock)
{
    synth.setCurrentPlaybackSampleRate (sampleRate);
    for (int i = 0; i < synth.getNumVoices(); ++i)
        if (auto* v = dynamic_cast<LeadVoice*> (synth.getVoice (i)))
            v->prepare (sampleRate);

    const juce::dsp::ProcessSpec spec { sampleRate, (juce::uint32) samplesPerBlock, 2 };

    chorus.prepare (spec);
    chorus.setRate (0.6f);
    chorus.setDepth (0.25f);
    chorus.setCentreDelay (8.0f);
    chorus.setFeedback (0.0f);

    highPass.prepare (spec);
    highPass.setType (juce::dsp::StateVariableTPTFilterType::highpass);

    phrasePlayer.reset();
    gateFx.prepare (sampleRate);
    delay.prepare (sampleRate);
    reverb.setSampleRate (sampleRate);
    reverb.reset();

    masterGain.reset (sampleRate, 0.05);
    masterGain.setCurrentAndTargetValue (juce::Decibels::decibelsToGain (get (ParamIDs::volume)));
    freeRunPpq = 0.0;
}

bool TranceForgeProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    return layouts.getMainOutputChannelSet() == juce::AudioChannelSet::stereo();
}

void TranceForgeProcessor::processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midi)
{
    juce::ScopedNoDenormals noDenormals;
    using namespace ParamIDs;

    const auto numSamples = buffer.getNumSamples();
    const auto sr = getSampleRate();
    buffer.clear();

    // notes played on the editor's on-screen keyboard
    keyboardState.processNextMidiBuffer (midi, 0, numSamples, true);

    // --- tempo & position (free-running 138 BPM when the host isn't playing) ---
    double bpm = 138.0, ppq = freeRunPpq;
    bool playing = false;
    if (auto* ph = getPlayHead())
        if (auto pos = ph->getPosition())
        {
            if (auto b = pos->getBpm()) bpm = *b;
            playing = pos->getIsPlaying();
            if (playing)
                if (auto p = pos->getPpqPosition()) ppq = *p;
        }
    bpm = juce::jlimit (20.0, 999.0, bpm);
    const auto ppqPerSample = bpm / 60.0 / sr;
    if (! playing)
        freeRunPpq = ppq + numSamples * ppqPerSample;

    const auto& sound = getCurrentSound();

    // --- melody player ---
    const auto melodyIndex = (int) get (melody);
    const auto& phrases = getPhrases();
    const Phrase* phrase = juce::isPositiveAndBelow (melodyIndex - 1, (int) phrases.size())
                               ? &phrases[(size_t) (melodyIndex - 1)] : nullptr;
    phrasePlayer.process (midi, numSamples, ppq, ppqPerSample, phrase);

    // --- the lead ---
    const auto lp = makeLeadParams (sound);
    for (int i = 0; i < synth.getNumVoices(); ++i)
        if (auto* v = dynamic_cast<LeadVoice*> (synth.getVoice (i)))
            v->setParams (lp);

    synth.renderNextBlock (buffer, midi, 0, numSamples);

    juce::dsp::AudioBlock<float> block (buffer);
    juce::dsp::ProcessContextReplacing<float> ctx (block);

    highPass.setCutoffFrequency (sound.highPass);
    highPass.process (ctx);

    // --- trance gate ---
    std::array<bool, TranceGate::numSteps> steps {};
    for (size_t i = 0; i < steps.size(); ++i)
        steps[i] = sound.gatePattern[i] == 'x';

    const auto gateAmount = get (gate);
    auto* L = buffer.getWritePointer (0);
    auto* R = buffer.getWritePointer (1);
    for (int n = 0; n < numSamples; ++n)
    {
        const auto g = gateFx.process (ppq + n * ppqPerSample, gateAmount > 0.01f, sound.gateStepBeats,
                                       gateAmount, 0.72f, 3.0f, steps);
        L[n] *= g;
        R[n] *= g;
    }
    currentGateStep.store (gateFx.getCurrentStep());

    // --- chorus / delay / reverb ---
    const auto w = get (width), sp = get (space);

    chorus.setMix (juce::jlimit (0.0f, 0.8f, sound.chorus * 2.0f * w));
    chorus.process (ctx);

    delay.process (buffer, bpm, sound.delayBeats,
                   juce::jlimit (0.0f, 0.8f, sound.delayMix * 2.0f * sp), sound.delayFeedback);

    const auto revMix = juce::jlimit (0.0f, 0.9f, sound.reverbMix * 2.0f * sp);
    juce::Reverb::Parameters rp;
    rp.roomSize = juce::jlimit (0.0f, 0.98f, sound.reverbSize + (sp - 0.5f) * 0.2f);
    rp.damping  = 0.4f;
    rp.wetLevel = revMix * 0.6f;
    rp.dryLevel = 1.0f - revMix * 0.4f;
    rp.width    = 1.0f;
    reverb.setParameters (rp);
    if (revMix > 0.0001f)
        reverb.processStereo (L, R, numSamples);

    // --- volume + soft clip ---
    masterGain.setTargetValue (juce::Decibels::decibelsToGain (get (volume)));
    for (int n = 0; n < numSamples; ++n)
    {
        const auto g = masterGain.getNextValue();
        L[n] = std::tanh (L[n] * g);
        R[n] = std::tanh (R[n] * g);
    }
}

//==============================================================================
// Host "programs" = the ready-made sounds.
int TranceForgeProcessor::getNumPrograms()     { return (int) getSoundDesigns().size(); }
int TranceForgeProcessor::getCurrentProgram()  { return (int) get (ParamIDs::sound); }

const juce::String TranceForgeProcessor::getProgramName (int index)
{
    const auto& sounds = getSoundDesigns();
    return juce::isPositiveAndBelow (index, (int) sounds.size()) ? sounds[(size_t) index].name : "";
}

void TranceForgeProcessor::setCurrentProgram (int index)
{
    const auto& sounds = getSoundDesigns();
    if (! juce::isPositiveAndBelow (index, (int) sounds.size()))
        return;

    auto set = [this] (const char* id, float value)
    {
        if (auto* param = apvts.getParameter (id))
            param->setValueNotifyingHost (param->convertTo0to1 (value));
    };

    // choosing a sound loads it exactly as designed
    set (ParamIDs::sound, (float) index);
    for (auto* id : { ParamIDs::tone, ParamIDs::width, ParamIDs::pluck, ParamIDs::space, ParamIDs::vibrato })
        set (id, 0.5f);
    set (ParamIDs::gate, sounds[(size_t) index].gateDefault);
}

//==============================================================================
void TranceForgeProcessor::getStateInformation (juce::MemoryBlock& destData)
{
    if (auto xml = apvts.copyState().createXml())
        copyXmlToBinary (*xml, destData);
}

void TranceForgeProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    if (auto xml = getXmlFromBinary (data, sizeInBytes))
        if (xml->hasTagName (apvts.state.getType()))
            apvts.replaceState (juce::ValueTree::fromXml (*xml));
}

juce::AudioProcessorEditor* TranceForgeProcessor::createEditor()
{
    return new TranceForgeEditor (*this);
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new TranceForgeProcessor();
}
