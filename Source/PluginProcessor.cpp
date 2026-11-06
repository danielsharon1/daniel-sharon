#include "PluginProcessor.h"
#include "PluginEditor.h"

const juce::StringArray TranceForgeProcessor::gateRateNames  { "1/8", "1/16", "1/32", "1/8T", "1/16T" };
const juce::StringArray TranceForgeProcessor::delayTimeNames { "1/16", "1/8", "1/8 D", "1/4", "1/4 D", "1/2" };

static constexpr double gateRateBeats[]  { 0.5, 0.25, 0.125, 1.0 / 3.0, 1.0 / 6.0 };
static constexpr double delayTimeBeats[] { 0.25, 0.5, 0.75, 1.0, 1.5, 2.0 };

//==============================================================================
namespace
{
    struct Preset
    {
        const char* name;
        std::vector<std::pair<const char*, float>> values;
        const char* gatePattern; // 16 chars, 'x' = open
    };

    const std::vector<Preset>& getPresets()
    {
        using namespace ParamIDs;
        static const std::vector<Preset> presets {
            { "Uplifting Supersaw Lead",
              { { detune, 0.45f }, { mix, 0.75f }, { sub, 0.15f }, { width, 0.9f }, { octave, 0.0f },
                { cutoff, 7000.0f }, { resonance, 0.15f }, { envAmount, 0.25f }, { keyTrack, 0.5f },
                { fAttack, 0.001f }, { fDecay, 0.5f }, { fSustain, 0.4f }, { fRelease, 0.4f },
                { attack, 0.005f }, { decay, 0.4f }, { sustain, 0.85f }, { release, 0.45f },
                { gateOn, 0.0f }, { gateRate, 1.0f }, { gateDepth, 1.0f }, { gateLength, 0.7f }, { gateSmooth, 3.0f },
                { delayMix, 0.25f }, { delayFb, 0.35f }, { delayTime, 2.0f },
                { reverbMix, 0.3f }, { reverbSize, 0.85f }, { master, -6.0f } },
              "x.xx.x.xx.xx.x.x" },

            { "Gated Trance Pad",
              { { detune, 0.55f }, { mix, 0.85f }, { sub, 0.1f }, { width, 1.0f }, { octave, 0.0f },
                { cutoff, 3500.0f }, { resonance, 0.2f }, { envAmount, 0.0f }, { keyTrack, 0.3f },
                { fAttack, 0.5f }, { fDecay, 1.0f }, { fSustain, 0.6f }, { fRelease, 1.0f },
                { attack, 0.35f }, { decay, 1.0f }, { sustain, 0.9f }, { release, 1.5f },
                { gateOn, 1.0f }, { gateRate, 1.0f }, { gateDepth, 1.0f }, { gateLength, 0.75f }, { gateSmooth, 4.0f },
                { delayMix, 0.2f }, { delayFb, 0.3f }, { delayTime, 2.0f },
                { reverbMix, 0.4f }, { reverbSize, 0.9f }, { master, -6.0f } },
              "x.xx.x.xx.xx.x.x" },

            { "Psy Pluck",
              { { detune, 0.2f }, { mix, 0.45f }, { sub, 0.25f }, { width, 0.6f }, { octave, 0.0f },
                { cutoff, 350.0f }, { resonance, 0.55f }, { envAmount, 0.75f }, { keyTrack, 0.6f },
                { fAttack, 0.001f }, { fDecay, 0.16f }, { fSustain, 0.0f }, { fRelease, 0.12f },
                { attack, 0.001f }, { decay, 0.25f }, { sustain, 0.0f }, { release, 0.15f },
                { gateOn, 0.0f }, { gateRate, 1.0f }, { gateDepth, 1.0f }, { gateLength, 0.6f }, { gateSmooth, 2.0f },
                { delayMix, 0.3f }, { delayFb, 0.45f }, { delayTime, 2.0f },
                { reverbMix, 0.2f }, { reverbSize, 0.6f }, { master, -6.0f } },
              "xxxxxxxxxxxxxxxx" },

            { "Rolling Bass",
              { { detune, 0.08f }, { mix, 0.2f }, { sub, 0.8f }, { width, 0.0f }, { octave, -1.0f },
                { cutoff, 220.0f }, { resonance, 0.35f }, { envAmount, 0.45f }, { keyTrack, 0.5f },
                { fAttack, 0.001f }, { fDecay, 0.12f }, { fSustain, 0.1f }, { fRelease, 0.08f },
                { attack, 0.001f }, { decay, 0.2f }, { sustain, 0.6f }, { release, 0.06f },
                { gateOn, 1.0f }, { gateRate, 1.0f }, { gateDepth, 1.0f }, { gateLength, 0.8f }, { gateSmooth, 1.5f },
                { delayMix, 0.0f }, { delayFb, 0.2f }, { delayTime, 1.0f },
                { reverbMix, 0.0f }, { reverbSize, 0.3f }, { master, -6.0f } },
              ".xxx.xxx.xxx.xxx" },

            { "Hands Up Stab",
              { { detune, 0.6f }, { mix, 0.9f }, { sub, 0.0f }, { width, 1.0f }, { octave, 0.0f },
                { cutoff, 2500.0f }, { resonance, 0.25f }, { envAmount, 0.5f }, { keyTrack, 0.4f },
                { fAttack, 0.001f }, { fDecay, 0.3f }, { fSustain, 0.2f }, { fRelease, 0.2f },
                { attack, 0.001f }, { decay, 0.35f }, { sustain, 0.2f }, { release, 0.3f },
                { gateOn, 0.0f }, { gateRate, 1.0f }, { gateDepth, 1.0f }, { gateLength, 0.7f }, { gateSmooth, 3.0f },
                { delayMix, 0.25f }, { delayFb, 0.4f }, { delayTime, 2.0f },
                { reverbMix, 0.35f }, { reverbSize, 0.8f }, { master, -6.0f } },
              "x.xx.x.xx.xx.x.x" },
        };
        return presets;
    }
}

//==============================================================================
TranceForgeProcessor::TranceForgeProcessor()
    : AudioProcessor (BusesProperties().withOutput ("Output", juce::AudioChannelSet::stereo(), true)),
      apvts (*this, nullptr, "TranceForge", createParameterLayout())
{
    for (int i = 0; i < 8; ++i)
        synth.addVoice (new SupersawVoice());

    synth.addSound (new TranceSound());

    for (int i = 0; i < TranceGate::numSteps; ++i)
        stepParams[(size_t) i] = apvts.getRawParameterValue (ParamIDs::gateStep (i));

    setCurrentProgram (0);
}

juce::AudioProcessorValueTreeState::ParameterLayout TranceForgeProcessor::createParameterLayout()
{
    using namespace juce;
    using namespace ParamIDs;

    std::vector<std::unique_ptr<RangedAudioParameter>> p;

    auto addFloat = [&p] (const char* id, const char* name, NormalisableRange<float> range, float def,
                          const char* suffix = "")
    {
        p.push_back (std::make_unique<AudioParameterFloat> (ParameterID { id, 1 }, name, range, def,
                                                            AudioParameterFloatAttributes().withLabel (suffix)));
    };

    auto timeRange = [] (float max) { return NormalisableRange<float> (0.001f, max, 0.0f, 0.3f); };

    // Oscillator
    addFloat (detune, "Detune", { 0.0f, 1.0f }, 0.45f);
    addFloat (mix,    "Saw Mix", { 0.0f, 1.0f }, 0.75f);
    addFloat (sub,    "Sub", { 0.0f, 1.0f }, 0.15f);
    addFloat (width,  "Width", { 0.0f, 1.0f }, 0.9f);
    p.push_back (std::make_unique<AudioParameterInt> (ParameterID { octave, 1 }, "Octave", -2, 2, 0));

    // Filter
    addFloat (cutoff,    "Cutoff", { 20.0f, 20000.0f, 0.0f, 0.25f }, 7000.0f, "Hz");
    addFloat (resonance, "Resonance", { 0.0f, 1.0f }, 0.15f);
    addFloat (envAmount, "Env Amount", { -1.0f, 1.0f }, 0.25f);
    addFloat (keyTrack,  "Key Track", { 0.0f, 1.0f }, 0.5f);

    addFloat (fAttack,  "Filter Attack",  timeRange (5.0f), 0.001f, "s");
    addFloat (fDecay,   "Filter Decay",   timeRange (5.0f), 0.5f, "s");
    addFloat (fSustain, "Filter Sustain", { 0.0f, 1.0f }, 0.4f);
    addFloat (fRelease, "Filter Release", timeRange (8.0f), 0.4f, "s");

    // Amp
    addFloat (attack,  "Attack",  timeRange (5.0f), 0.005f, "s");
    addFloat (decay,   "Decay",   timeRange (5.0f), 0.4f, "s");
    addFloat (sustain, "Sustain", { 0.0f, 1.0f }, 0.85f);
    addFloat (release, "Release", timeRange (8.0f), 0.45f, "s");

    // Trance gate
    p.push_back (std::make_unique<AudioParameterBool> (ParameterID { gateOn, 1 }, "Gate On", false));
    p.push_back (std::make_unique<AudioParameterChoice> (ParameterID { gateRate, 1 }, "Gate Rate", gateRateNames, 1));
    addFloat (gateDepth,  "Gate Depth",  { 0.0f, 1.0f }, 1.0f);
    addFloat (gateLength, "Gate Length", { 0.05f, 1.0f }, 0.7f);
    addFloat (gateSmooth, "Gate Smooth", { 0.5f, 30.0f, 0.0f, 0.5f }, 3.0f, "ms");

    for (int i = 0; i < TranceGate::numSteps; ++i)
        p.push_back (std::make_unique<AudioParameterBool> (ParameterID { gateStep (i), 1 },
                                                           "Gate Step " + String (i + 1), true));

    // FX
    addFloat (delayMix, "Delay Mix", { 0.0f, 1.0f }, 0.25f);
    addFloat (delayFb,  "Delay Feedback", { 0.0f, 0.9f }, 0.35f);
    p.push_back (std::make_unique<AudioParameterChoice> (ParameterID { delayTime, 1 }, "Delay Time", delayTimeNames, 2));
    addFloat (reverbMix,  "Reverb Mix",  { 0.0f, 1.0f }, 0.3f);
    addFloat (reverbSize, "Reverb Size", { 0.0f, 1.0f }, 0.85f);

    addFloat (master, "Master", { -36.0f, 6.0f }, -6.0f, "dB");

    return { p.begin(), p.end() };
}

//==============================================================================
void TranceForgeProcessor::prepareToPlay (double sampleRate, int)
{
    synth.setCurrentPlaybackSampleRate (sampleRate);
    for (int i = 0; i < synth.getNumVoices(); ++i)
        if (auto* v = dynamic_cast<SupersawVoice*> (synth.getVoice (i)))
            v->prepare (sampleRate);

    gate.prepare (sampleRate);
    delay.prepare (sampleRate);
    reverb.setSampleRate (sampleRate);
    reverb.reset();

    masterGain.reset (sampleRate, 0.05);
    masterGain.setCurrentAndTargetValue (juce::Decibels::decibelsToGain (get (ParamIDs::master)));
    freeRunPpq = 0.0;
}

bool TranceForgeProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    return layouts.getMainOutputChannelSet() == juce::AudioChannelSet::stereo();
}

void TranceForgeProcessor::updateVoiceParams()
{
    using namespace ParamIDs;

    VoiceParams vp;
    vp.detune    = get (detune);
    vp.mix       = get (mix);
    vp.sub       = get (sub);
    vp.width     = get (width);
    vp.octave    = (int) get (octave);
    vp.cutoff    = get (cutoff);
    vp.resonance = get (resonance);
    vp.envAmount = get (envAmount);
    vp.keyTrack  = get (keyTrack);
    vp.ampEnv    = { get (attack),  get (decay),  get (sustain),  get (release) };
    vp.filterEnv = { get (fAttack), get (fDecay), get (fSustain), get (fRelease) };

    for (int i = 0; i < synth.getNumVoices(); ++i)
        if (auto* v = dynamic_cast<SupersawVoice*> (synth.getVoice (i)))
            v->setParams (vp);
}

void TranceForgeProcessor::processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midi)
{
    juce::ScopedNoDenormals noDenormals;
    using namespace ParamIDs;

    const auto numSamples = buffer.getNumSamples();
    const auto sr = getSampleRate();
    buffer.clear();

    // --- tempo / position from the host (falls back to a free-running 138 BPM clock) ---
    double bpm = 138.0;
    double ppq = freeRunPpq;
    bool playing = false;

    if (auto* ph = getPlayHead())
    {
        if (auto pos = ph->getPosition())
        {
            if (auto b = pos->getBpm())
                bpm = *b;

            playing = pos->getIsPlaying();
            if (playing)
                if (auto p = pos->getPpqPosition())
                    ppq = *p;
        }
    }
    bpm = juce::jlimit (20.0, 999.0, bpm);
    const auto ppqPerSample = bpm / 60.0 / sr;

    // --- synth ---
    updateVoiceParams();
    synth.renderNextBlock (buffer, midi, 0, numSamples);

    // --- trance gate (before the FX so echoes and reverb follow the rhythm) ---
    std::array<bool, TranceGate::numSteps> steps {};
    for (size_t i = 0; i < steps.size(); ++i)
        steps[i] = stepParams[i]->load() > 0.5f;

    const auto gateEnabled = get (gateOn) > 0.5f;
    const auto stepBeats   = gateRateBeats[juce::jlimit (0, 4, (int) get (gateRate))];
    const auto depth       = get (gateDepth);
    const auto length      = get (gateLength);
    const auto smooth      = get (gateSmooth);

    auto* L = buffer.getWritePointer (0);
    auto* R = buffer.getWritePointer (1);

    for (int n = 0; n < numSamples; ++n)
    {
        const auto g = gate.process (ppq + n * ppqPerSample, gateEnabled, stepBeats, depth, length, smooth, steps);
        L[n] *= g;
        R[n] *= g;
    }
    currentGateStep.store (gate.getCurrentStep());

    if (! playing)
        freeRunPpq = ppq + numSamples * ppqPerSample;

    // --- ping-pong delay ---
    delay.process (buffer, bpm, delayTimeBeats[juce::jlimit (0, 5, (int) get (delayTime))],
                   get (delayMix), get (delayFb));

    // --- reverb ---
    const auto revMix = get (reverbMix);
    juce::Reverb::Parameters rp;
    rp.roomSize   = get (reverbSize);
    rp.damping    = 0.45f;
    rp.wetLevel   = revMix * 0.6f;
    rp.dryLevel   = 1.0f - revMix * 0.4f;
    rp.width      = 1.0f;
    rp.freezeMode = 0.0f;
    reverb.setParameters (rp);
    if (revMix > 0.0001f)
        reverb.processStereo (L, R, numSamples);

    // --- master gain + soft clipper ---
    masterGain.setTargetValue (juce::Decibels::decibelsToGain (get (master)));
    for (int n = 0; n < numSamples; ++n)
    {
        const auto g = masterGain.getNextValue();
        L[n] = std::tanh (L[n] * g);
        R[n] = std::tanh (R[n] * g);
    }
}

//==============================================================================
int TranceForgeProcessor::getNumPrograms()
{
    return (int) getPresets().size();
}

const juce::String TranceForgeProcessor::getProgramName (int index)
{
    const auto& presets = getPresets();
    return juce::isPositiveAndBelow (index, (int) presets.size()) ? presets[(size_t) index].name : "";
}

void TranceForgeProcessor::setCurrentProgram (int index)
{
    const auto& presets = getPresets();
    if (! juce::isPositiveAndBelow (index, (int) presets.size()))
        return;

    currentProgram = index;
    const auto& preset = presets[(size_t) index];

    for (const auto& [id, value] : preset.values)
        if (auto* param = apvts.getParameter (id))
            param->setValueNotifyingHost (param->convertTo0to1 (value));

    for (int i = 0; i < TranceGate::numSteps; ++i)
        if (auto* param = apvts.getParameter (ParamIDs::gateStep (i)))
            param->setValueNotifyingHost (preset.gatePattern[i] == 'x' ? 1.0f : 0.0f);
}

//==============================================================================
void TranceForgeProcessor::getStateInformation (juce::MemoryBlock& destData)
{
    auto state = apvts.copyState();
    state.setProperty ("program", currentProgram, nullptr);
    if (auto xml = state.createXml())
        copyXmlToBinary (*xml, destData);
}

void TranceForgeProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    if (auto xml = getXmlFromBinary (data, sizeInBytes))
    {
        if (xml->hasTagName (apvts.state.getType()))
        {
            auto state = juce::ValueTree::fromXml (*xml);
            currentProgram = state.getProperty ("program", 0);
            apvts.replaceState (state);
        }
    }
}

juce::AudioProcessorEditor* TranceForgeProcessor::createEditor()
{
    return new TranceForgeEditor (*this);
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new TranceForgeProcessor();
}
