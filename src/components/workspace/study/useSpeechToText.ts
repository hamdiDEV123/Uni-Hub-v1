import { useEffect, useMemo, useRef, useState } from "react";

type SpeechRecognitionResultLike = {
  0: { transcript: string };
  isFinal: boolean;
};

type SpeechRecognitionEventLike = Event & {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionLike = EventTarget & {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event & { error?: string }) => void) | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

export function useSpeechToText({ lang = "ar-EG" }: { lang?: string }) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const shouldKeepListeningRef = useRef(false);
  const finalTextRef = useRef("");
  const interimTextRef = useRef("");

  const [isListening, setIsListening] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState("");

  const supported = useMemo(
    () => typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition),
    []
  );

  useEffect(() => {
    finalTextRef.current = finalText;
  }, [finalText]);

  useEffect(() => {
    interimTextRef.current = interimText;
  }, [interimText]);

  useEffect(() => {
    if (!supported) return;
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setError("");
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      let nextFinalChunk = "";
      let nextInterim = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript?.trim() ?? "";
        if (!transcript) continue;
        if (result.isFinal) nextFinalChunk += `${transcript} `;
        else nextInterim += `${transcript} `;
      }

      if (nextFinalChunk.trim()) {
        setFinalText((prev) => `${prev} ${nextFinalChunk}`.trim());
      }
      setInterimText(nextInterim.trim());
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed") {
        setError("يرجى السماح بإذن الميكروفون أولًا.");
      } else if (event.error === "audio-capture") {
        setError("لا يوجد ميكروفون متاح على الجهاز.");
      } else {
        setError("حدثت مشكلة أثناء التعرف على الصوت.");
      }
    };

    recognition.onend = () => {
      if (shouldKeepListeningRef.current) {
        recognition.start();
        return;
      }
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      shouldKeepListeningRef.current = false;
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [lang, supported]);

  const start = () => {
    if (!recognitionRef.current || isListening) return;
    shouldKeepListeningRef.current = true;
    setError("");
    setFinalText("");
    setInterimText("");
    recognitionRef.current.start();
  };

  const stopAndGetTranscript = () => {
    shouldKeepListeningRef.current = false;
    const merged = `${finalTextRef.current} ${interimTextRef.current}`.trim();
    setFinalText(merged);
    setInterimText("");
    recognitionRef.current?.stop();
    return merged;
  };

  const clear = () => {
    setFinalText("");
    setInterimText("");
  };

  const transcript = `${finalText} ${interimText}`.trim();

  return { supported, isListening, transcript, error, start, stopAndGetTranscript, clear };
}
