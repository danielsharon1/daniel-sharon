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

    struct Control
    {
        std::unique_ptr<juce::Component> component;
        juce::Label label;
        std::unique_ptr<APVTS::SliderAttachment> sliderAttachment;
        std::unique_ptr<APVTS::ComboBoxAttachment> comboAttachment;
        std::unique_ptr<APVTS::ButtonAttachment> buttonAttachment;
    };

    struct Section
    {
        juce::String title;
        std::vector<Control*> controls;
        juce::Rectangle<int> bounds;
    };

    void timerCallback() override;

    Control* addKnob (const juce::String& paramId, const juce::String& name);
    Control* addCombo (const juce::String& paramId, const juce::String& name, const juce::StringArray& items);
    Control* addToggle (const juce::String& paramId, const juce::String& name);
    void layoutSection (Section&);

    TranceForgeProcessor& proc;
    TranceLookAndFeel lnf;

    juce::ComboBox presetBox;
    std::vector<std::unique_ptr<Control>> controls;
    std::vector<Section> sections;

    std::array<juce::TextButton, TranceGate::numSteps> stepButtons;
    std::array<std::unique_ptr<APVTS::ButtonAttachment>, TranceGate::numSteps> stepAttachments;
    juce::Rectangle<int> stepArea;
    int lastStep = -2;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (TranceForgeEditor)
};
