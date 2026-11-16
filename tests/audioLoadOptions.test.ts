import { getAlertSoundInitialStatus } from '../services/audioLoadOptions.ts';

function equal(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
}

Deno.test('Android audio selects MediaPlayer at creation, without autoplay or looping', () => {
  const probe = getAlertSoundInitialStatus('android');
  equal(probe.androidImplementation, 'MediaPlayer');
  equal(probe.shouldPlay, false);
  equal(probe.isLooping, false);
  equal(probe.volume, 0);
  equal(probe.progressUpdateIntervalMillis, 150);
  equal(getAlertSoundInitialStatus('android', 1).androidImplementation, 'MediaPlayer');
  equal(getAlertSoundInitialStatus('android', 1).volume, 1);
});

Deno.test('iOS and browser keep their existing audio backend and gain', () => {
  for (const platform of ['ios', 'web']) {
    const options = getAlertSoundInitialStatus(platform, 0.45);
    equal(Object.prototype.hasOwnProperty.call(options, 'androidImplementation'), false);
    equal(options.volume, 0.45);
    equal(options.shouldPlay, false);
  }
});

Deno.test('decoder gain is always finite and within expo-av bounds', () => {
  equal(getAlertSoundInitialStatus('android', -1).volume, 0);
  equal(getAlertSoundInitialStatus('android', 2).volume, 1);
  equal(getAlertSoundInitialStatus('android', Number.NaN).volume, 0);
  equal(getAlertSoundInitialStatus('android', Number.POSITIVE_INFINITY).volume, 0);
});
