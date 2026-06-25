/**
 * micRecorder.ts
 *
 * Minimal microphone recording utility.
 * Records audio from the user's microphone and converts to WAV format.
 */

export interface RecordingState {
  isRecording: boolean;
  duration: number; // seconds
  maxDuration?: number; // optional max recording time
}

export class MicRecorder {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private isRecording = false;
  private audioBuffer: Float32Array[] = [];
  private sampleRate = 0;
  private onStateChange?: (state: RecordingState) => void;
  private recordingStartTime = 0;
  private maxDuration: number | undefined;
  private timerInterval: number | undefined;

  constructor(onStateChange?: (state: RecordingState) => void) {
    this.onStateChange = onStateChange;
  }

  async startRecording(maxDurationSec?: number): Promise<void> {
    try {
      // Get microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Create audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.sampleRate = this.audioContext.sampleRate;

      // Create source from microphone
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Create processor with 4096 buffer size for live capture
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (e) => {
        if (!this.isRecording) return;
        const data = e.inputBuffer.getChannelData(0);
        this.audioBuffer.push(new Float32Array(data));
      };

      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      this.isRecording = true;
      this.audioBuffer = [];
      this.recordingStartTime = Date.now();
      this.maxDuration = maxDurationSec;

      this.updateState();

      // Update duration every 100ms
      if (this.timerInterval) clearInterval(this.timerInterval);
      this.timerInterval = window.setInterval(() => {
        if (!this.isRecording) return;

        const elapsed = (Date.now() - this.recordingStartTime) / 1000;

        // Auto-stop if max duration reached
        if (this.maxDuration && elapsed >= this.maxDuration) {
          this.stopRecording();
          return;
        }

        this.updateState();
      }, 100);
    } catch (err) {
      // User denied permission or device unavailable
      throw new Error(
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone permission denied'
          : `Failed to access microphone: ${err}`
      );
    }
  }

  stopRecording(): Blob {
    if (!this.isRecording) throw new Error('Not recording');

    this.isRecording = false;

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = undefined;
    }

    // Clean up audio context
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.updateState();

    // Convert float32 buffers to WAV
    return this.encodeWAV();
  }

  cancelRecording(): void {
    if (!this.isRecording) return;

    this.isRecording = false;

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = undefined;
    }

    // Clean up
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.audioBuffer = [];
    this.updateState();
  }

  private updateState(): void {
    if (!this.onStateChange) return;

    const elapsed = this.isRecording ? (Date.now() - this.recordingStartTime) / 1000 : 0;

    this.onStateChange({
      isRecording: this.isRecording,
      duration: elapsed,
      maxDuration: this.maxDuration,
    });
  }

  private encodeWAV(): Blob {
    // Concatenate all float32 buffers
    const totalLength = this.audioBuffer.reduce((sum, buf) => sum + buf.length, 0);
    const pcmData = new Float32Array(totalLength);
    let offset = 0;

    for (const buf of this.audioBuffer) {
      pcmData.set(buf, offset);
      offset += buf.length;
    }

    // Convert float32 to PCM16
    const pcm16 = this.float32ToPCM16(pcmData);

    // Create WAV file
    const wav = this.createWAVBlob(pcm16);
    return wav;
  }

  private float32ToPCM16(float32Data: Float32Array): Uint8Array {
    const pcm16 = new Int16Array(float32Data.length);
    for (let i = 0; i < float32Data.length; i++) {
      // Clamp to [-1, 1] and convert to 16-bit range
      const s = Math.max(-1, Math.min(1, float32Data[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return new Uint8Array(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength);
  }

  private createWAVBlob(pcm16Data: Uint8Array): Blob {
    const channels = 1;
    const sampleRate = this.sampleRate;
    const bitDepth = 16;

    const bytesPerSample = bitDepth / 8;
    const byteRate = sampleRate * channels * bytesPerSample;
    const blockAlign = channels * bytesPerSample;

    const wavHeader = this.createWAVHeader(
      pcm16Data.byteLength,
      channels,
      sampleRate,
      byteRate,
      blockAlign
    );

    return new Blob([wavHeader, pcm16Data], { type: 'audio/wav' });
  }

  private createWAVHeader(
    dataLength: number,
    channels: number,
    sampleRate: number,
    byteRate: number,
    blockAlign: number
  ): Uint8Array {
    const header = new Uint8Array(44);
    const view = new DataView(header.buffer);

    // RIFF header
    view.setUint32(0, 0x46464952, true); // "RIFF"
    view.setUint32(4, 36 + dataLength, true); // file size - 8
    view.setUint32(8, 0x45564157, true); // "WAVE"

    // fmt subchunk
    view.setUint32(12, 0x20746d66, true); // "fmt "
    view.setUint32(16, 16, true); // subchunk1size
    view.setUint16(20, 1, true); // audio format (PCM)
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true); // bits per sample

    // data subchunk
    view.setUint32(36, 0x61746164, true); // "data"
    view.setUint32(40, dataLength, true);

    return header;
  }
}
