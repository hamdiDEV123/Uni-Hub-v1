import { useEffect, useState } from "react";

export function GlowingCursor() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      setPosition({ x: event.clientX, y: event.clientY });
      setVisible(true);
    };

    const onLeave = () => setVisible(false);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseout", onLeave);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseout", onLeave);
    };
  }, []);

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed z-[9999] hidden h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl transition-opacity duration-300 md:block ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      style={{ left: position.x, top: position.y }}
    />
  );
}

