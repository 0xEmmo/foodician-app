'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function NotFoundPage() {
  return (
    <div className="w-full h-screen bg-black overflow-x-hidden flex justify-center items-center relative">
      <MessageDisplay />
      <CharactersAnimation />
      <CircleAnimation />
    </div>
  );
}

function MessageDisplay() {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="absolute flex flex-col justify-center items-center w-[90%] h-[90%] z-[100]">
      <div
        className={`flex flex-col items-center transition-opacity duration-500 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="text-[35px] font-semibold text-white m-[1%]">
          Page Not Found
        </div>
        <div className="text-[80px] font-bold text-white m-[1%]" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 4 }}>
          404
        </div>
        <div className="text-[15px] w-1/2 min-w-[40%] text-center text-gray-300 m-[1%]">
          The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
        </div>
        <div className="flex gap-6 mt-8">
          <button
            onClick={() => router.back()}
            className="text-white border-2 border-white hover:bg-white hover:text-black transition-all duration-300 ease-in-out px-6 py-2 h-auto text-base font-medium flex items-center gap-2 hover:scale-105"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 19-7-7 7-7"/>
              <path d="M19 12H5"/>
            </svg>
            Go Back
          </button>
          <Link
            href="/"
            className="text-white transition-all duration-300 ease-in-out px-6 py-2 h-auto text-base font-medium flex items-center gap-2 hover:scale-105"
            style={{ background: '#534AB7' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            Go Home
          </Link>
        </div>
        <p className="text-[12px] text-gray-500 mt-8">
          Need help?{' '}
          <a
            href="https://wa.me/2349015845354"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#534AB7' }}
            className="hover:opacity-80 transition-opacity"
          >
            Contact us on WhatsApp
          </a>
        </p>
      </div>
    </div>
  );
}

type StickFigure = {
  top?: string;
  bottom?: string;
  src: string;
  transform?: string;
  speedX: number;
  speedRotation?: number;
};

function CharactersAnimation() {
  const charactersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stickFigures: StickFigure[] = [
      {
        top: '0%',
        src: 'https://raw.githubusercontent.com/RicardoYare/imagenes/9ef29f5bbe075b1d1230a996d87bca313b9b6a63/sticks/stick0.svg',
        transform: 'rotateZ(-90deg)',
        speedX: 1500,
      },
      {
        top: '10%',
        src: 'https://raw.githubusercontent.com/RicardoYare/imagenes/9ef29f5bbe075b1d1230a996d87bca313b9b6a63/sticks/stick1.svg',
        speedX: 3000,
        speedRotation: 2000,
      },
      {
        top: '20%',
        src: 'https://raw.githubusercontent.com/RicardoYare/imagenes/9ef29f5bbe075b1d1230a996d87bca313b9b6a63/sticks/stick2.svg',
        speedX: 5000,
        speedRotation: 1000,
      },
      {
        top: '25%',
        src: 'https://raw.githubusercontent.com/RicardoYare/imagenes/9ef29f5bbe075b1d1230a996d87bca313b9b6a63/sticks/stick0.svg',
        speedX: 2500,
        speedRotation: 1500,
      },
      {
        top: '35%',
        src: 'https://raw.githubusercontent.com/RicardoYare/imagenes/9ef29f5bbe075b1d1230a996d87bca313b9b6a63/sticks/stick0.svg',
        speedX: 2000,
        speedRotation: 300,
      },
      {
        bottom: '5%',
        src: 'https://raw.githubusercontent.com/RicardoYare/imagenes/9ef29f5bbe075b1d1230a996d87bca313b9b6a63/sticks/stick3.svg',
        speedX: 0,
      },
    ];

    if (charactersRef.current) {
      charactersRef.current.innerHTML = '';
    }

    stickFigures.forEach((figure, index) => {
      const stick = document.createElement('img');
      stick.style.position = 'absolute';
      stick.style.width = '18%';
      stick.style.height = '18%';

      if (figure.top)    stick.style.top    = figure.top;
      if (figure.bottom) stick.style.bottom = figure.bottom;
      if (figure.transform) stick.style.transform = figure.transform;

      stick.src = figure.src;
      charactersRef.current?.appendChild(stick);

      if (index === 5) return;

      stick.animate(
        [{ left: '100%' }, { left: '-20%' }],
        { duration: figure.speedX, easing: 'linear', fill: 'forwards' },
      );

      if (index === 0 || !figure.speedRotation) return;

      stick.animate(
        [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-360deg)' }],
        { duration: figure.speedRotation, iterations: Infinity, easing: 'linear' },
      );
    });

    return () => {
      if (charactersRef.current) {
        charactersRef.current.innerHTML = '';
      }
    };
  }, []);

  return <div ref={charactersRef} className="absolute w-[99%] h-[95%]" />;
}

interface Circulo { x: number; y: number; size: number; }

function CircleAnimation() {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const requestIdRef = useRef<number>();
  const timerRef    = useRef(0);
  const circulosRef = useRef<Circulo[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const initArr = () => {
      circulosRef.current = [];
      for (let i = 0; i < 300; i++) {
        circulosRef.current.push({
          x:    Math.floor(Math.random() * (canvas.width * 3 - canvas.width * 1.2 + 1)) + canvas.width * 1.2,
          y:    Math.floor(Math.random() * (canvas.height - canvas.height * -0.2 + 1)) + canvas.height * -0.2,
          size: canvas.width / 1000,
        });
      }
    };

    const draw = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      timerRef.current++;
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      const distanceX = canvas.width / 80;
      const growthRate = canvas.width / 1000;

      ctx.fillStyle = 'white';
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      circulosRef.current.forEach((c) => {
        ctx.beginPath();
        if (timerRef.current < 65) {
          c.x    -= distanceX;
          c.size += growthRate;
        } else if (timerRef.current < 500) {
          c.x    -= distanceX * 0.02;
          c.size += growthRate * 0.2;
        }
        ctx.arc(c.x, c.y, c.size, 0, 360);
        ctx.fill();
      });

      if (timerRef.current > 500) {
        if (requestIdRef.current) cancelAnimationFrame(requestIdRef.current);
        return;
      }
      requestIdRef.current = requestAnimationFrame(draw);
    };

    timerRef.current = 0;
    initArr();
    draw();

    const handleResize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      timerRef.current = 0;
      if (requestIdRef.current) cancelAnimationFrame(requestIdRef.current);
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.reset?.();
      initArr();
      draw();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (requestIdRef.current) cancelAnimationFrame(requestIdRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}
