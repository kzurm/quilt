/* Quilt — wrapper around the TweaksPanel starter */

function TweaksPanelWrap({ tweaks, setTweaks }) {
  return (
    <TweaksPanel title="Tweaks">
      <TweakSection label="Appearance" />
      <TweakRadio label="Density"
        value={tweaks.density}
        options={[
          {value: 'comfortable', label: 'Comfortable'},
          {value: 'compact', label: 'Compact'},
        ]}
        onChange={v => setTweaks('density', v)} />
      <TweakColor label="Accent"
        value={tweaks.accent}
        options={[
          'oklch(0.55 0.13 255)',
          'oklch(0.55 0.13 150)',
          'oklch(0.65 0.13 65)',
          'oklch(0.58 0.16 290)',
          'oklch(0.30 0.01 260)',
        ]}
        onChange={v => setTweaks('accent', v)} />
      <TweakSection label="Layout" />
      <TweakSlider label="Left pane width"
        value={tweaks.leftPaneWidth || 380}
        min={280} max={520} step={10} unit="px"
        onChange={v => setTweaks('leftPaneWidth', v)} />
    </TweaksPanel>
  );
}

Object.assign(window, { TweaksPanelWrap });
