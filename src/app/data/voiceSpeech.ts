/**
 * Browser speech-to-text (Web Speech API).
 * Does not create or persist goals/tasks — returns transcript text only.
 *
 * Provider note: Chromium routes recognition through the browser vendor
 * (typically Google). Audio is not stored by Arbol; we only receive text.
 */

export type VoiceCaptureStatus =
  | 'idle'
  | 'unsupported'
  | 'permission_denied'
  | 'listening'
  | 'processing'
  | 'error';

export interface VoiceCaptureResult {
  transcript: string;
  status: VoiceCaptureStatus;
  errorMessage?: string;
}

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: ((ev: Event) => void) | null;
  onend: ((ev: Event) => void) | null;
  onerror: ((ev: Event & { error?: string }) => void) | null;
  onresult: ((ev: Event & {
    resultIndex: number;
    results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean; length: number }>;
  }) => void) | null;
};

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isVoiceCaptureSupported(): boolean {
  return !!getSpeechRecognitionCtor();
}

export class VoiceCaptureSession {
  private rec: SpeechRecognitionLike | null = null;
  private finalParts: string[] = [];
  private interim = '';
  private stoppedByUser = false;
  private generation = 0;

  constructor(
    private readonly onUpdate: (state: {
      status: VoiceCaptureStatus;
      transcript: string;
      interim: string;
      errorMessage?: string;
    }) => void,
  ) {}

  start(): void {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      this.onUpdate({ status: 'unsupported', transcript: '', interim: '', errorMessage: 'Voice input is not supported in this browser.' });
      return;
    }
    this.stopInternal(true);
    this.stoppedByUser = false;
    this.finalParts = [];
    this.interim = '';
    const gen = ++this.generation;

    const rec = new Ctor();
    this.rec = rec;
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      if (gen !== this.generation) return;
      this.onUpdate({ status: 'listening', transcript: this.joined(), interim: '' });
    };

    rec.onresult = (ev) => {
      if (gen !== this.generation) return;
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const row = ev.results[i];
        const text = row[0]?.transcript ?? '';
        if (row.isFinal) this.finalParts.push(text.trim());
        else interim += text;
      }
      this.interim = interim;
      this.onUpdate({
        status: 'listening',
        transcript: this.joined(),
        interim: this.interim,
      });
    };

    rec.onerror = (ev) => {
      if (gen !== this.generation) return;
      const code = String(ev.error || '');
      if (code === 'aborted' || code === 'no-speech') {
        // no-speech: allow user to stop; aborted: ignore if we cancelled
        if (code === 'no-speech' && !this.stoppedByUser) {
          this.onUpdate({
            status: 'error',
            transcript: this.joined(),
            interim: '',
            errorMessage: 'No speech detected. Try again, or type manually.',
          });
        }
        return;
      }
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        this.onUpdate({
          status: 'permission_denied',
          transcript: this.joined(),
          interim: '',
          errorMessage: 'Microphone permission denied. Enable it in browser settings, or type manually.',
        });
        return;
      }
      this.onUpdate({
        status: 'error',
        transcript: this.joined(),
        interim: '',
        errorMessage: 'Could not capture voice. Try again, or type manually.',
      });
    };

    rec.onend = () => {
      if (gen !== this.generation) return;
      if (this.stoppedByUser) {
        this.onUpdate({
          status: 'processing',
          transcript: this.joined(),
          interim: '',
        });
      }
    };

    try {
      rec.start();
    } catch {
      this.onUpdate({
        status: 'error',
        transcript: '',
        interim: '',
        errorMessage: 'Could not start recording. Try again, or type manually.',
      });
    }
  }

  stop(): string {
    this.stoppedByUser = true;
    const text = this.joined();
    try { this.rec?.stop(); } catch { /* ignore */ }
    this.onUpdate({ status: 'processing', transcript: text, interim: '' });
    return text;
  }

  cancel(): void {
    this.stoppedByUser = true;
    this.stopInternal(true);
    this.finalParts = [];
    this.interim = '';
    this.onUpdate({ status: 'idle', transcript: '', interim: '' });
  }

  private stopInternal(abort: boolean): void {
    this.generation += 1;
    try {
      if (abort) this.rec?.abort();
      else this.rec?.stop();
    } catch { /* ignore */ }
    this.rec = null;
  }

  private joined(): string {
    return [...this.finalParts, this.interim].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  }
}
