// Destination photo (optimised by next/image) with an illustrated fallback
// for cities without a photo, plus a small credit line (CC BY / BY-SA require it).
import Image from "next/image";
import credits from "@/data/image-credits.json";
import { DestinationArt } from "./illustrations";

type Credit = { file: string; title: string; creator: string; license: string; page: string; source: string };
const CREDITS = credits as Record<string, Credit>;

export function hasPhoto(code: string) {
  return Boolean(CREDITS[code]);
}

export function photoCredit(code: string): Credit | undefined {
  return CREDITS[code];
}

export function DestinationImage({
  code,
  alt,
  sizes = "(max-width: 768px) 100vw, 33vw",
  className = "",
  showCredit = true,
  preload = false,
}: {
  code: string;
  alt: string;
  sizes?: string;
  className?: string;
  showCredit?: boolean;
  preload?: boolean;
}) {
  const c = CREDITS[code];
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {c ? (
        <Image src={c.file} alt={alt} fill sizes={sizes} quality={60} className="object-cover" preload={preload} />
      ) : (
        <DestinationArt code={code} className="absolute inset-0 h-full w-full" />
      )}
      {c && showCredit && (
        <a
          href={c.page}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-1 end-1 max-w-[80%] truncate rounded bg-black/45 px-1.5 py-0.5 text-[9px] text-white/90 hover:bg-black/70"
          title={`${c.title} - ${c.creator} (${c.license})`}
        >
          © {c.creator} · {c.license}
        </a>
      )}
    </div>
  );
}
