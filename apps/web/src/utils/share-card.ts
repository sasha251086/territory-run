import { cellCountWord } from './territory';

export type ShareCardData = {
  nickname: string;
  cellsCaptured: number;
  km: number;
  influence: number;
  cellsOwned: number;
  areaLabel?: string | null;
  pvpCaptures?: number;
};

function loadFont(family: string, url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const face = new FontFace(family, `url(${url})`);
    face.load().then((loaded) => {
      document.fonts.add(loaded);
      resolve();
    }).catch(reject);
  });
}

async function ensureFonts() {
  await Promise.allSettled([
    loadFont('Fraunces', 'https://fonts.gstatic.com/s/fraunces/v36/6NUh8KMycv6KPwpB-a1sks.woff2'),
    loadFont('JetBrains Mono', 'https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbV2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKy.woff2'),
  ]);
  await document.fonts.ready;
}

export async function generateShareCardBlob(data: ShareCardData): Promise<Blob> {
  await ensureFonts();

  const width = 720;
  const height = 480;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas not supported');
  }

  const bg = '#F7F4EE';
  const sage = '#5B8A72';
  const ink = '#2C2825';
  const muted = '#8A8378';

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = 0.06;
  for (let y = 0; y < height; y += 28) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= width; x += 40) {
      ctx.lineTo(x, y + Math.sin(x / 80) * 6);
    }
    ctx.strokeStyle = sage;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#E5DDD2';
  ctx.lineWidth = 2;
  roundRect(ctx, 40, 40, width - 80, height - 80, 24);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = muted;
  ctx.font = '600 14px "DM Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TERRITORY RUN', width / 2, 96);

  ctx.fillStyle = ink;
  ctx.font = '600 42px Fraunces, Georgia, serif';
  ctx.fillText(`+${data.cellsCaptured} ${cellCountWord(data.cellsCaptured)}`, width / 2, 156);

  ctx.font = '500 22px "DM Sans", sans-serif';
  ctx.fillStyle = '#5C564E';
  const subParts = [
    data.km > 0 ? `${data.km.toFixed(1)} км` : null,
    data.pvpCaptures && data.pvpCaptures > 0 ? `${data.pvpCaptures} PvP` : null,
    data.influence > 0 ? `+${data.influence} влияния` : null,
  ].filter(Boolean);
  ctx.fillText(subParts.join(' · ') || 'Пробежка засчитана', width / 2, 196);

  const chips = [
    { label: 'ЗАХВАТ', value: `+${data.cellsCaptured}` },
    { label: 'КМ', value: data.km > 0 ? data.km.toFixed(1) : '—' },
    { label: 'ВСЕГО', value: String(data.cellsOwned) },
  ];
  const chipW = 160;
  const chipGap = 16;
  const chipStart = (width - (chipW * 3 + chipGap * 2)) / 2;
  chips.forEach((chip, index) => {
    const x = chipStart + index * (chipW + chipGap);
    const y = 230;
    ctx.fillStyle = bg;
    ctx.strokeStyle = '#E5DDD2';
    roundRect(ctx, x, y, chipW, 88, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = sage;
    ctx.font = '600 28px "JetBrains Mono", monospace';
    ctx.fillText(chip.value, x + chipW / 2, y + 44);
    ctx.fillStyle = muted;
    ctx.font = '600 11px "DM Sans", sans-serif';
    ctx.fillText(chip.label, x + chipW / 2, y + 68);
  });

  ctx.fillStyle = muted;
  ctx.font = '500 16px "DM Sans", sans-serif';
  const footer = data.areaLabel
    ? `${data.nickname} · ${data.areaLabel}`
    : data.nickname;
  ctx.fillText(footer, width / 2, 390);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to export share card'));
      }
    }, 'image/png');
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function shareRunResults(data: ShareCardData, fallbackText: string) {
  try {
    const blob = await generateShareCardBlob(data);
    const file = new File([blob], 'territory-run.png', { type: 'image/png' });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: 'Territory Run',
        text: fallbackText,
        files: [file],
      });
      return;
    }
  } catch {
    // fall through to text share
  }

  if (navigator.share) {
    await navigator.share({ title: 'Territory Run', text: fallbackText });
    return;
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(fallbackText);
  }
}
