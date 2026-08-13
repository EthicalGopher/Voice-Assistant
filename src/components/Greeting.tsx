import { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface GreetingProps {
  userName: string;
}

export function Greeting({ userName }: GreetingProps) {
  const textRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (textRef.current) {
      gsap.fromTo(
        textRef.current,
        { opacity: 0, y: -15, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 1.2, ease: 'power3.out', delay: 0.2 }
      );
    }
  }, [userName]);

  return (
    <div className="absolute top-20 sm:top-24 left-0 right-0 z-20 flex flex-col items-center justify-center px-6 text-center pointer-events-none">
      <h2
        ref={textRef}
        className="text-2xl sm:text-4xl md:text-5xl font-light tracking-tight text-slate-100 max-w-xl leading-tight font-outfit drop-shadow-md opacity-0"
      >
        Hi {userName}, how can I<br />
        <span className="text-slate-200/90 font-normal">help you today?</span>
      </h2>
    </div>
  );
}
