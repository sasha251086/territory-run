import { useMemo } from 'react';

type HexConfettiProps = {
  count?: number;
};

export default function HexConfetti({ count = 8 }: HexConfettiProps) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => ({
        id: index,
        left: 8 + ((index * 37) % 84),
        delay: (index % 5) * 0.08,
        duration: 0.9 + (index % 4) * 0.15,
        rotate: (index * 41) % 360,
        drift: index % 2 === 0 ? -18 : 18,
      })),
    [count],
  );

  return (
    <div className="hex-confetti" aria-hidden="true">
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="hex-confetti__piece"
          style={{
            left: `${piece.left}%`,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
            ['--hex-rotate' as string]: `${piece.rotate}deg`,
            ['--hex-drift' as string]: `${piece.drift}px`,
          }}
        />
      ))}
    </div>
  );
}
