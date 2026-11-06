#pragma once

#include "PluginProcessor.h"

//==============================================================================
/** Dark neon look for TranceForge. */
class TranceLookAndFeel : public juce::LookAndFeel_V4
{
public:
    TranceLookAndFeel();

    void drawRotarySlider (juce::Graphics&, int x, int y, int width, int height, float sliderPos,
                           float rotaryStartAngle, float rotaryEndAngle, juce::Slider&) override;
    void drawButtonBackground (juce::Graphics&, juce::Button&, const juce::Colour& backgroundColour,
                               bool isMouseOverButton, bool isButtonDown) override;
    juce::Font getComboBoxFont (juce::ComboBox&) override;
    juce::Font getTextButtonFont (juce::TextButton&, int buttonHeight) override;

    static const juce::Colour background, panel, accent, accent2, text;
};

//==============================================================================
class TranceForgeEditor : public juce::AudioProcessorEditor,
                          private juce::Timer
{
public:
    explicit TranceForgeEditor (TranceForgeProcessor&);
    ~TranceForgeEditor() override;

    void paint (juce::Graphics&) override;
    void resized() override;

private:
    using APVTS = juce::AudioProcessorValueTreeState;

    struct Macro
    {
        juce::Slider knob { juce::Slider::RotaryHorizontalVerticalDrag, juce::Slider::TextBoxBelow };
        juce::Label label, hint;
        std::unique_ptr<APVTS::SliderAttachment> attachment;
    };

    void timerCallback() override;
    void addMacro (const char* paramId, const juce::String& name, const juce::String& hint);
    void selectSound (int index);

    TranceForgeProcessor& proc;
    TranceLookAndFeel lnf;

    juce::ComboBox soundBox, melodyBox;
    juce::TextButton prevButton { "<" }, nextButton { ">" };
    std::unique_ptr<APVTS::ComboBoxAttachment> melodyAttachment;
    juce::Label melodyHint;

    std::vector<std::unique_ptr<Macro>> macros;

    juce::MidiKeyboardComponent keyboard;

    juce::Rectangle<int> soundPanel, melodyPanel, macroPanel, gateStrip;
    int lastStep = -2, lastSound = -1;
    bool lastGateOn = false;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (TranceForgeEditor)
};
