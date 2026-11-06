#include "PluginEditor.h"

//==============================================================================
const juce::Colour TranceLookAndFeel::background { 0xff0d0b1a };
const juce::Colour TranceLookAndFeel::panel      { 0xff171430 };
const juce::Colour TranceLookAndFeel::accent     { 0xff22d3ee }; // cyan
const juce::Colour TranceLookAndFeel::accent2    { 0xffc026d3 }; // magenta
const juce::Colour TranceLookAndFeel::text       { 0xffe5e7eb };

TranceLookAndFeel::TranceLookAndFeel()
{
    setColour (juce::Slider::textBoxTextColourId, text);
    setColour (juce::Slider::textBoxOutlineColourId, juce::Colours::transparentBlack);
    setColour (juce::Slider::textBoxBackgroundColourId, juce::Colours::transparentBlack);
    setColour (juce::Label::textColourId, text);
    setColour (juce::ComboBox::backgroundColourId, panel.brighter (0.15f));
    setColour (juce::ComboBox::outlineColourId, accent.withAlpha (0.5f));
    setColour (juce::ComboBox::textColourId, text);
    setColour (juce::ComboBox::arrowColourId, accent);
    setColour (juce::PopupMenu::backgroundColourId, panel);
    setColour (juce::PopupMenu::highlightedBackgroundColourId, accent2.withAlpha (0.6f));
    setColour (juce::TextButton::buttonColourId, panel.brighter (0.2f));
    setColour (juce::TextButton::buttonOnColourId, accent);
    setColour (juce::TextButton::textColourOffId, text.withAlpha (0.6f));
    setColour (juce::TextButton::textColourOnId, background);
}

void TranceLookAndFeel::drawRotarySlider (juce::Graphics& g, int x, int y, int width, int height, float sliderPos,
                                          float startAngle, float endAngle, juce::Slider& slider)
{
    const auto bounds = juce::Rectangle<int> (x, y, width, height).toFloat().reduced (4.0f);
    const auto radius = juce::jmin (bounds.getWidth(), bounds.getHeight()) * 0.5f;
    const auto centre = bounds.getCentre();
    const auto lineW  = juce::jmax (2.5f, radius * 0.16f);
    const auto arcR   = radius - lineW * 0.5f;
    const auto angle  = startAngle + sliderPos * (endAngle - startAngle);

    juce::Path track;
    track.addCentredArc (centre.x, centre.y, arcR, arcR, 0.0f, startAngle, endAngle, true);
    g.setColour (background.brighter (0.25f));
    g.strokePath (track, juce::PathStrokeType (lineW, juce::PathStrokeType::curved, juce::PathStrokeType::rounded));

    if (slider.isEnabled())
    {
        // Bipolar parameters draw their arc from the centre.
        const auto bipolar = slider.getMinimum() < 0.0 && slider.getMaximum() > 0.0;
        const auto from = bipolar ? (startAngle + endAngle) * 0.5f : startAngle;

        juce::Path value;
        value.addCentredArc (centre.x, centre.y, arcR, arcR, 0.0f, juce::jmin (from, angle), juce::jmax (from, angle), true);
        g.setGradientFill (juce::ColourGradient (accent2, bounds.getBottomLeft(), accent, bounds.getTopRight(), false));
        g.strokePath (value, juce::PathStrokeType (lineW, juce::PathStrokeType::curved, juce::PathStrokeType::rounded));
    }

    const auto knobR = arcR - lineW * 1.2f;
    g.setColour (panel.brighter (0.3f));
    g.fillEllipse (juce::Rectangle<float> (knobR * 2.0f, knobR * 2.0f).withCentre (centre));

    juce::Path pointer;
    pointer.addRoundedRectangle (-1.5f, -knobR, 3.0f, knobR * 0.55f, 1.5f);
    g.setColour (text);
    g.fillPath (pointer, juce::AffineTransform::rotation (angle).translated (centre));
}

juce::Font TranceLookAndFeel::getComboBoxFont (juce::ComboBox&)
{
    return juce::Font (juce::FontOptions (14.0f));
}

void TranceLookAndFeel::drawButtonBackground (juce::Graphics& g, juce::Button& button, const juce::Colour& bg,
                                              bool over, bool down)
{
    auto r = button.getLocalBounds().toFloat().reduced (1.5f);
    auto c = button.getToggleState() ? accent : bg;
    if (over)  c = c.brighter (0.15f);
    if (down)  c = c.darker (0.2f);

    g.setColour (c);
    g.fillRoundedRectangle (r, 4.0f);

    if (button.getToggleState())
    {
        g.setColour (accent.withAlpha (0.35f));
        g.drawRoundedRectangle (r.expanded (1.0f), 5.0f, 2.0f);
    }
}

//==============================================================================
TranceForgeEditor::TranceForgeEditor (TranceForgeProcessor& p)
    : AudioProcessorEditor (&p), proc (p)
{
    setLookAndFeel (&lnf);
    using namespace ParamIDs;

    // Preset selector
    for (int i = 0; i < proc.getNumPrograms(); ++i)
        presetBox.addItem (proc.getProgramName (i), i + 1);
    presetBox.setSelectedId (proc.getCurrentProgram() + 1, juce::dontSendNotification);
    presetBox.onChange = [this]
    {
        if (const auto id = presetBox.getSelectedId(); id > 0)
            proc.setCurrentProgram (id - 1);
    };
    addAndMakeVisible (presetBox);

    sections.push_back ({ "OSCILLATOR", { addKnob (detune, "Detune"), addKnob (mix, "Saw Mix"), addKnob (sub, "Sub"),
                                          addKnob (width, "Width"), addKnob (octave, "Octave") }, {} });
    sections.push_back ({ "FILTER", { addKnob (cutoff, "Cutoff"), addKnob (resonance, "Reso"),
                                      addKnob (envAmount, "Env Amt"), addKnob (keyTrack, "Key Trk") }, {} });
    sections.push_back ({ "MASTER", { addKnob (master, "Volume") }, {} });

    sections.push_back ({ "FILTER ENV", { addKnob (fAttack, "Attack"), addKnob (fDecay, "Decay"),
                                          addKnob (fSustain, "Sustain"), addKnob (fRelease, "Release") }, {} });
    sections.push_back ({ "AMP ENV", { addKnob (attack, "Attack"), addKnob (decay, "Decay"),
                                       addKnob (sustain, "Sustain"), addKnob (release, "Release") }, {} });
    sections.push_back ({ "DELAY / REVERB", { addKnob (delayMix, "Delay"), addKnob (delayFb, "Feedback"),
                                              addCombo (delayTime, "Time", TranceForgeProcessor::delayTimeNames),
                                              addKnob (reverbMix, "Reverb"), addKnob (reverbSize, "Size") }, {} });

    sections.push_back ({ "TRANCE GATE", { addToggle (gateOn, "Gate"),
                                           addCombo (gateRate, "Rate", TranceForgeProcessor::gateRateNames),
                                           addKnob (gateDepth, "Depth"), addKnob (gateLength, "Length"),
                                           addKnob (gateSmooth, "Smooth") }, {} });

    for (int i = 0; i < TranceGate::numSteps; ++i)
    {
        auto& b = stepButtons[(size_t) i];
        b.setButtonText (juce::String (i + 1));
        b.setClickingTogglesState (true);
        addAndMakeVisible (b);
        stepAttachments[(size_t) i] = std::make_unique<APVTS::ButtonAttachment> (proc.apvts, gateStep (i), b);
    }

    setSize (980, 610);
    startTimerHz (30);
}

TranceForgeEditor::~TranceForgeEditor()
{
    stopTimer();
    setLookAndFeel (nullptr);
}

//==============================================================================
TranceForgeEditor::Control* TranceForgeEditor::addKnob (const juce::String& paramId, const juce::String& name)
{
    auto c = std::make_unique<Control>();
    auto slider = std::make_unique<juce::Slider> (juce::Slider::RotaryHorizontalVerticalDrag, juce::Slider::TextBoxBelow);
    slider->setTextBoxStyle (juce::Slider::TextBoxBelow, false, 72, 16);
    slider->setPopupDisplayEnabled (false, false, nullptr);
    c->sliderAttachment = std::make_unique<APVTS::SliderAttachment> (proc.apvts, paramId, *slider);

    // Compact, readable value display (the attachment's default prints 7 decimals).
    juce::String suffix;
    bool isInt = false;
    if (auto* param = proc.apvts.getParameter (paramId))
    {
        suffix = param->getLabel();
        isInt  = dynamic_cast<juce::AudioParameterInt*> (param) != nullptr;
    }

    slider->textFromValueFunction = [suffix, isInt] (double v)
    {
        if (suffix == "Hz")
            return v >= 1000.0 ? juce::String (v / 1000.0, 1) + " kHz" : juce::String (juce::roundToInt (v)) + " Hz";
        if (suffix == "s")
            return v < 0.9995 ? juce::String (juce::roundToInt (v * 1000.0)) + " ms" : juce::String (v, 2) + " s";
        if (suffix == "ms")
            return juce::String (v, 1) + " ms";
        if (suffix == "dB")
            return juce::String (v, 1) + " dB";
        return isInt ? juce::String (juce::roundToInt (v)) : juce::String (v, 2);
    };
    slider->setColour (juce::Slider::textBoxOutlineColourId, juce::Colours::transparentBlack);
    slider->updateText();
    c->component = std::move (slider);

    c->label.setText (name, juce::dontSendNotification);
    c->label.setJustificationType (juce::Justification::centred);
    c->label.setFont (juce::Font (juce::FontOptions (13.0f, juce::Font::bold)));

    addAndMakeVisible (*c->component);
    addAndMakeVisible (c->label);
    controls.push_back (std::move (c));
    return controls.back().get();
}

TranceForgeEditor::Control* TranceForgeEditor::addCombo (const juce::String& paramId, const juce::String& name,
                                                         const juce::StringArray& items)
{
    auto c = std::make_unique<Control>();
    auto box = std::make_unique<juce::ComboBox>();
    box->addItemList (items, 1);
    c->comboAttachment = std::make_unique<APVTS::ComboBoxAttachment> (proc.apvts, paramId, *box);
    c->component = std::move (box);

    c->label.setText (name, juce::dontSendNotification);
    c->label.setJustificationType (juce::Justification::centred);
    c->label.setFont (juce::Font (juce::FontOptions (13.0f, juce::Font::bold)));

    addAndMakeVisible (*c->component);
    addAndMakeVisible (c->label);
    controls.push_back (std::move (c));
    return controls.back().get();
}

TranceForgeEditor::Control* TranceForgeEditor::addToggle (const juce::String& paramId, const juce::String& name)
{
    auto c = std::make_unique<Control>();
    auto button = std::make_unique<juce::TextButton> ("ON");
    button->setClickingTogglesState (true);
    c->buttonAttachment = std::make_unique<APVTS::ButtonAttachment> (proc.apvts, paramId, *button);
    c->component = std::move (button);

    c->label.setText (name, juce::dontSendNotification);
    c->label.setJustificationType (juce::Justification::centred);
    c->label.setFont (juce::Font (juce::FontOptions (13.0f, juce::Font::bold)));

    addAndMakeVisible (*c->component);
    addAndMakeVisible (c->label);
    controls.push_back (std::move (c));
    return controls.back().get();
}

//==============================================================================
void TranceForgeEditor::layoutSection (Section& s)
{
    auto area = s.bounds.reduced (8).withTrimmedTop (22);
    const auto n = (int) s.controls.size();
    const auto w = area.getWidth() / juce::jmax (1, n);

    for (auto* c : s.controls)
    {
        auto cell = area.removeFromLeft (w).reduced (3, 0);
        c->label.setBounds (cell.removeFromTop (18));

        if (dynamic_cast<juce::Slider*> (c->component.get()) != nullptr)
            c->component->setBounds (cell.withSizeKeepingCentre (juce::jmin (cell.getWidth(), 86), cell.getHeight()));
        else
            c->component->setBounds (cell.withSizeKeepingCentre (juce::jmin (cell.getWidth(), 84), 28));
    }
}

void TranceForgeEditor::resized()
{
    auto area = getLocalBounds().reduced (12);

    auto top = area.removeFromTop (44);
    presetBox.setBounds (top.removeFromRight (280).withSizeKeepingCentre (280, 30));
    area.removeFromTop (8);

    const auto rowH = 170;
    const auto gap  = 10;

    auto layoutRow = [&] (juce::Rectangle<int> row, int first, int count)
    {
        int totalWeight = 0;
        for (int i = first; i < first + count; ++i)
            totalWeight += (int) juce::jmax<size_t> (1, sections[(size_t) i].controls.size());

        const auto available = row.getWidth() - gap * (count - 1);
        for (int i = first; i < first + count; ++i)
        {
            auto& s = sections[(size_t) i];
            const auto wgt = (int) juce::jmax<size_t> (1, s.controls.size());
            const auto w = (i == first + count - 1) ? row.getWidth() : available * wgt / totalWeight;
            s.bounds = row.removeFromLeft (w);
            row.removeFromLeft (gap);
            layoutSection (s);
        }
    };

    layoutRow (area.removeFromTop (rowH), 0, 3);
    area.removeFromTop (gap);
    layoutRow (area.removeFromTop (rowH), 3, 3);
    area.removeFromTop (gap);

    // Gate row: controls on the left, 16 step buttons on the right.
    auto& gateSection = sections[6];
    gateSection.bounds = area;
    auto inner = area.reduced (8).withTrimmedTop (22);
    auto controlsArea = inner.removeFromLeft (420);
    {
        // layoutSection() insets by 8px and skips a 22px title strip, so pre-expand accordingly.
        Section tmp { {}, gateSection.controls,
                      { controlsArea.getX() - 8, controlsArea.getY() - 30,
                        controlsArea.getWidth() + 16, controlsArea.getHeight() + 38 } };
        layoutSection (tmp);
    }

    inner.removeFromLeft (16);
    stepArea = inner.withSizeKeepingCentre (inner.getWidth(), 60);
    const auto stepW = stepArea.getWidth() / TranceGate::numSteps;
    auto stepsRow = stepArea.withHeight (44);
    for (auto& b : stepButtons)
        b.setBounds (stepsRow.removeFromLeft (stepW).reduced (2, 0));
}

void TranceForgeEditor::paint (juce::Graphics& g)
{
    using L = TranceLookAndFeel;
    g.fillAll (L::background);

    // Header
    auto header = getLocalBounds().reduced (12).removeFromTop (44);
    g.setGradientFill (juce::ColourGradient (L::accent, (float) header.getX(), 0.0f,
                                             L::accent2, (float) header.getX() + 260.0f, 0.0f, false));
    g.setFont (juce::Font (juce::FontOptions (30.0f, juce::Font::bold)));
    g.drawText ("TRANCEFORGE", header, juce::Justification::centredLeft);
    g.setColour (L::text.withAlpha (0.5f));
    g.setFont (juce::Font (juce::FontOptions (13.0f)));
    g.drawText ("supersaw synth + trance gate", header.withTrimmedLeft (265), juce::Justification::centredLeft);

    // Section panels
    for (const auto& s : sections)
    {
        const auto r = s.bounds.toFloat();
        g.setColour (L::panel);
        g.fillRoundedRectangle (r, 8.0f);
        g.setColour (L::accent.withAlpha (0.15f));
        g.drawRoundedRectangle (r.reduced (0.5f), 8.0f, 1.0f);

        g.setColour (L::accent);
        g.setFont (juce::Font (juce::FontOptions (12.0f, juce::Font::bold)));
        g.drawText (s.title, s.bounds.reduced (10, 6).removeFromTop (14), juce::Justification::centredLeft);
    }

    // Playing-step indicator under the gate steps
    const auto step = proc.getCurrentGateStep();
    const auto stepW = stepArea.getWidth() / TranceGate::numSteps;
    for (int i = 0; i < TranceGate::numSteps; ++i)
    {
        auto led = juce::Rectangle<int> (stepArea.getX() + i * stepW, stepArea.getY() + 50, stepW, 8)
                       .reduced (6, 0).toFloat();
        g.setColour (i == step ? L::accent2 : L::background.brighter (0.2f));
        g.fillRoundedRectangle (led, 3.0f);
    }
}

void TranceForgeEditor::timerCallback()
{
    const auto step = proc.getCurrentGateStep();
    if (step != lastStep)
    {
        lastStep = step;
        repaint (stepArea.expanded (4));
    }

    const auto prog = proc.getCurrentProgram() + 1;
    if (presetBox.getSelectedId() != prog)
        presetBox.setSelectedId (prog, juce::dontSendNotification);
}
