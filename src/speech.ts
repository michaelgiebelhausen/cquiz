type RecognitionEvent = {
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string };
    };
  };
  resultIndex: number;
};
type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
export const speechAvailable = () =>
  !!(
    (window as SpeechWindow).SpeechRecognition ||
    (window as SpeechWindow).webkitSpeechRecognition
  ) && window.isSecureContext;
export class SpeechCapture {
  private recognition: Recognition | null = null;
  private finalText = "";
  private interimText = "";
  private prefix = "";
  private stopped = false;
  private settle: (() => void) | null = null;
  constructor(
    private onText: (text: string) => void,
    private onStatus: (status: "listening" | "stopped") => void,
    private onError: (error: string) => void,
    initialText = "",
  ) {
    this.prefix = initialText;
  }
  start(prefix = "") {
    if (this.recognition) this.abort();
    const Constructor =
      (window as SpeechWindow).SpeechRecognition ||
      (window as SpeechWindow).webkitSpeechRecognition;
    if (!Constructor || !window.isSecureContext) {
      this.onError(
        "Voice input needs a supported browser and a secure connection. Use Safari on iPhone or Chrome on Android, and check with your instructor.",
      );
      return;
    }
    this.prefix = prefix.trim();
    this.finalText = "";
    this.interimText = "";
    this.stopped = false;
    const recognition = new Constructor();
    this.recognition = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let final = "",
        interim = "";
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal)
          final += event.results[i][0].transcript + " ";
        else interim += event.results[i][0].transcript + " ";
      }
      this.finalText = final.trim();
      this.interimText = interim.trim();
      this.onText(this.text);
    };
    recognition.onerror = (event) => {
      const messages: Record<string, string> = {
        "not-allowed":
          "Microphone access was denied. Allow microphone access in your browser settings and retry.",
        "audio-capture":
          "No microphone was found. Check your phone’s microphone and retry.",
        network:
          "Speech recognition lost its connection. Your collected text remains visible. Retry voice input.",
        "no-speech":
          "No speech was detected. Tap Resume voice input and speak clearly.",
        "service-not-allowed":
          "Speech recognition is unavailable on this device. Check Siri settings on iPhone or ask the instructor.",
      };
      if (event.error !== "aborted")
        this.onError(
          messages[event.error] ||
            "Voice input stopped. Your collected text is preserved; tap Resume voice input.",
        );
    };
    recognition.onend = () => {
      if (this.recognition === recognition) this.recognition = null;
      this.onStatus("stopped");
      this.settle?.();
      this.settle = null;
    };
    try {
      recognition.start();
      this.onStatus("listening");
    } catch {
      this.onError(
        "Voice input could not start. Check microphone access and retry.",
      );
      this.recognition = null;
      this.onStatus("stopped");
    }
  }
  get text() {
    return [this.prefix, this.finalText, this.interimText]
      .filter(Boolean)
      .join(" ")
      .trim();
  }
  async finish() {
    this.stopped = true;
    if (this.recognition) {
      await new Promise<void>((resolve) => {
        this.settle = resolve;
        this.recognition?.stop();
        setTimeout(() => {
          this.settle?.();
          this.settle = null;
        }, 2200);
      });
    }
    return this.text;
  }
  abort() {
    this.stopped = true;
    this.recognition?.abort();
    this.recognition = null;
    this.onStatus("stopped");
  }
}
