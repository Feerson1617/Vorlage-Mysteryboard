import { useEffect, useState } from "react";
import { fitImage } from "../core/layout";

export function CardImage({
  src,
  alt,
  y,
}: {
  src: string;
  alt?: string;
  y: number;
}) {
  const [dimensions, setDimensions] = useState<{
    src: string;
    width: number;
    height: number;
  } | null>(null);
  useEffect(() => {
    let live = true;
    const image = new Image();
    image.onload = () => {
      if (live && image.naturalWidth > 0 && image.naturalHeight > 0)
        setDimensions({
          src,
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
    };
    image.src = src;
    return () => {
      live = false;
      image.onload = null;
    };
  }, [src]);
  if (!dimensions || dimensions.src !== src) return null;
  const box = fitImage(dimensions.width, dimensions.height, {
    x: 18,
    y,
    width: 264,
    height: 98,
  });
  return (
    <image href={src} {...box} preserveAspectRatio="xMidYMid meet">
      <title>{alt}</title>
    </image>
  );
}
