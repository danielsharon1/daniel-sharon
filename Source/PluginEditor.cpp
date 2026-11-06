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

juce::Font TranceLookAndFeel::getTextButtonFont (juce::TextButton&, int buttonHeight)
{
    return juce::Font (juce::FontOptions (juce::jmin (18.0f, (float) buttonHeight * 0.5f), juce::Font::bold));
}

juce::Font TranceLookAndFeel::getComboBoxFont (juce::ComboBox& box)
{
    return juce::Font (juce::FontOptions (juce::jlimit (13.0f, 22.0f, (float) box.getHeight() * 0.48f), juce::Font::bold));
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
    : AudioProcessorEditor (&p), proc (p),
      keyboard (p.keyboardState, juce::MidiKeyboardComponent::horizontalKeyboard)
{
    setLookAndFeel (&lnf);
    using namespace ParamIDs;

    // --- sound selector: picking a sound loads it exactly as designed ---
    soundBox.addItemList (TranceForgeProcessor::getSoundNames(), 1);
    soundBox.setJustificationType (juce::Justification::centred);
    soundBox.onChange = [this] { selectSound (soundBox.getSelectedId() - 1); };
    addAndMakeVisible (soundBox);

    prevButton.onClick = [this] { selectSound ((proc.getCurrentProgram() + proc.getNumPrograms() - 1) % proc.getNumPrograms()); };
    nextButton.onClick = [this] { selectSound ((proc.getCurrentProgram() + 1) % proc.getNumPrograms()); };
    addAndMakeVisible (prevButton);
    addAndMakeVisible (nextButton);

    // --- melody player ---
    melodyBox.addItemList (TranceForgeProcessor::getMelodyNames(), 1);
    melodyAttachment = std::make_unique<APVTS::ComboBoxAttachment> (proc.apvts, melody, melodyBox);
    addAndMakeVisible (melodyBox);

    melodyHint.setText (juce::String::fromUTF8 ("Hold one key - TranceForge plays the melody in that key, in sync with your tempo."),
                        juce::dontSendNotification);
    melodyHint.setFont (juce::Font (juce::FontOptions (13.0f)));
    melodyHint.setColour (juce::Label::textColourId, TranceLookAndFeel::text.withAlpha (0.55f));
    melodyHint.setJustificationType (juce::Justification::topLeft);
    addAndMakeVisible (melodyHint);

    // --- macro knobs ---
    addMacro (tone,    "TONE",    "dark / bright");
    addMacro (width,   "WIDTH",   "mono / huge");
    addMacro (pluck,   "PLUCK",   "soft / snappy");
    addMacro (space,   "SPACE",   "dry / delay+verb");
    addMacro (gate,    "GATE",    "off / chopped");
    addMacro (vibrato, "VIBRATO", "none / wide");
    addMacro (volume,  "VOLUME",  "");

    // --- playable keyboard ---
    keyboard.setLowestVisibleKey (48);
    keyboard.setKeyWidth (26.0f);
    keyboard.setColour (juce::MidiKeyboardComponent::keyDownOverlayColourId, TranceLookAndFeel::accent);
    keyboard.setColour (juce::MidiKeyboardComponent::mouseOverKeyOverlayColourId, TranceLookAndFeel::accent2.withAlpha (0.4f));
    addAndMakeVisible (keyboard);

    setSize (900, 600);
    timerCallback();
    startTimerHz (30);
}

TranceForgeEditor::~TranceForgeEditor()
{
    stopTimer();
    setLookAndFeel (nullptr);
}

void TranceForgeEditor::addMacro (const char* paramId, const juce::String& name, const juce::String& hint)
{
    auto m = std::make_unique<Macro>();

    m->knob.setTextBoxStyle (juce::Slider::TextBoxBelow, false, 80, 18);
    m->knob.setColour (juce::Slider::textBoxOutlineColourId, juce::Colours::transparentBlack);
    m->attachment = std::make_unique<APVTS::SliderAttachment> (proc.apvts, paramId, m->knob);

    m->label.setText (name, juce::dontSendNotification);
    m->label.setFont (juce::Font (juce::FontOptions (15.0f, juce::Font::bold)));
    m->label.setJustificationType (juce::Justification::centred);

    m->hint.setText (hint, juce::dontSendNotification);
    m->hint.setFont (juce::Font (juce::FontOptions (11.0f)));
    m->hint.setColour (juce::Label::textColourId, TranceLookAndFeel::text.withAlpha (0.45f));
    m->hint.setJustificationType (juce::Justification::centred);

    addAndMakeVisible (m->knob);
    addAndMakeVisible (m->label);
    addAndMakeVisible (m->hint);
    macros.push_back (std::move (m));
}

void TranceForgeEditor::selectSound (int index)
{
    if (index >= 0 && index != proc.getCurrentProgram())
        proc.setCurrentProgram (index);
}

//==============================================================================
void TranceForgeEditor::resized()
{
    auto area = getLocalBounds().reduced (14);
    area.removeFromTop (52);   // header

    auto top = area.removeFromTop (110);
    soundPanel  = top.removeFromLeft (top.getWidth() / 2 - 5);
    top.removeFromLeft (10);
    melodyPanel = top;

    {
        auto r = soundPanel.reduced (12).withTrimmedTop (22);
        auto row = r.removeFromTop (46);
        prevButton.setBounds (row.removeFromLeft (46));
        nextButton.setBounds (row.removeFromRight (46));
        soundBox.setBounds (row.reduced (8, 0));
    }
    {
        auto r = melodyPanel.reduced (12).withTrimmedTop (22);
        melodyBox.setBounds (r.removeFromTop (34));
        r.removeFromTop (4);
        melodyHint.setBounds (r);
    }

    area.removeFromTop (10);
    macroPanel = area.removeFromTop (220);
    {
        auto r = macroPanel.reduced (10).withTrimmedTop (8);
        const auto w = r.getWidth() / (int) macros.size();
        for (auto& m : macros)
        {
            auto cell = r.removeFromLeft (w);
            m->label.setBounds (cell.removeFromTop (22));
            m->hint.setBounds (cell.removeFromBottom (16));
            m->knob.setBounds (cell.reduced (6, 2));
        }
    }

    area.removeFromTop (10);
    gateStrip = area.removeFromTop (22);
    area.removeFromTop (10);
    keyboard.setBounds (area);
}

void TranceForgeEditor::paint (juce::Graphics& g)
{
    using L = TranceLookAndFeel;
    g.fillAll (L::background);

    auto header = getLocalBounds().reduced (14).removeFromTop (44);
    g.setGradientFill (juce::ColourGradient (L::accent, (float) header.getX(), 0.0f,
                                             L::accent2, (float) header.getX() + 270.0f, 0.0f, false));
    g.setFont (juce::Font (juce::FontOptions (32.0f, juce::Font::bold)));
    g.drawText ("TRANCEFORGE", header, juce::Justification::centredLeft);
    g.setColour (L::text.withAlpha (0.55f));
    g.setFont (juce::Font (juce::FontOptions (14.0f)));
    g.drawText ("ready-to-play trance lead", header.withTrimmedLeft (280), juce::Justification::centredLeft);

    auto drawPanel = [&g] (juce::Rectangle<int> r, const juce::String& title)
    {
        g.setColour (L::panel);
        g.fillRoundedRectangle (r.toFloat(), 10.0f);
        g.setColour (L::accent.withAlpha (0.18f));
        g.drawRoundedRectangle (r.toFloat().reduced (0.5f), 10.0f, 1.0f);
        if (title.isNotEmpty())
        {
            g.setColour (L::accent);
            g.setFont (juce::Font (juce::FontOptions (12.0f, juce::Font::bold)));
            g.drawText (title, r.reduced (12, 8).removeFromTop (14), juce::Justification::centredLeft);
        }
    };

    drawPanel (soundPanel, "SOUND");
    drawPanel (melodyPanel, "MELODY PLAYER");
    drawPanel (macroPanel, {});

    // gate pattern of the current sound, with the playing step lit
    const auto& sound = proc.getCurrentSound();
    const auto gateOn = proc.apvts.getRawParameterValue (ParamIDs::gate)->load() > 0.01f;
    const auto step = proc.getCurrentGateStep();

    g.setColour (L::text.withAlpha (0.5f));
    g.setFont (juce::Font (juce::FontOptions (11.0f, juce::Font::bold)));
    auto strip = gateStrip;
    g.drawText ("GATE PATTERN", strip.removeFromLeft (100), juce::Justification::centredLeft);

    const auto cellW = strip.getWidth() / TranceGate::numSteps;
    for (int i = 0; i < TranceGate::numSteps; ++i)
    {
        auto cell = strip.removeFromLeft (cellW).reduced (3, 5).toFloat();
        const auto open = sound.gatePattern[i] == 'x';
        auto c = open ? L::accent.withAlpha (gateOn ? 0.75f : 0.2f) : L::background.brighter (0.15f);
        if (i == step)
            c = L::accent2;
        g.setColour (c);
        g.fillRoundedRectangle (cell, 3.0f);
    }
}

void TranceForgeEditor::timerCallback()
{
    const auto sound = proc.getCurrentProgram();
    if (sound != lastSound)
    {
        lastSound = sound;
        soundBox.setSelectedId (sound + 1, juce::dontSendNotification);
        repaint();
    }

    // the gate strip reflects both the playing step and the GATE knob
    const auto step = proc.getCurrentGateStep();
    const auto gateOn = proc.apvts.getRawParameterValue (ParamIDs::gate)->load() > 0.01f;
    if (step != lastStep || gateOn != lastGateOn)
    {
        lastStep = step;
        lastGateOn = gateOn;
        repaint (gateStrip.expanded (2));
    }
}
