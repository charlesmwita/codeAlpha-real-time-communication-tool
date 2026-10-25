export async function getFallbackStream() {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#161410";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#e8ff47";
    ctx.beginPath();
    ctx.arc(640, 330, 54, 0, Math.PI * 2);
    ctx.fill();
  }
  const stream = canvas.captureStream(8);
  const audioCtx = new AudioContext();
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  gain.gain.value = 0;
  oscillator.connect(gain);
  const dest = audioCtx.createMediaStreamDestination();
  gain.connect(dest);
  oscillator.start();
  dest.stream.getAudioTracks().forEach((track) => {
    track.enabled = false;
    stream.addTrack(track);
  });
  stream.getVideoTracks().forEach((track) => {
    track.enabled = false;
  });
  return stream;
}

export async function getMediaStream() {
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: "user",
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } catch {
    return getFallbackStream();
  }
}

export function attachSpeakingDetector(
  stream: MediaStream,
  onLevel: (speaking: boolean) => void,
) {
  const audioTrack = stream.getAudioTracks()[0];
  if (!audioTrack) {
    onLevel(false);
    return () => undefined;
  }

  try {
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let frame = 0;
    let active = true;

    const loop = () => {
      if (!active) return;
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) sum += data[i];
      const avg = sum / data.length;
      onLevel(avg > 14 && audioTrack.enabled);
      frame = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      active = false;
      cancelAnimationFrame(frame);
      source.disconnect();
      void audioCtx.close();
    };
  } catch {
    onLevel(false);
    return () => undefined;
  }
}
