// Schermate d'avvio dell'app installata su iPhone (piano 6.3): senza, iOS mostra uno schermo
// bianco finché la pagina non è pronta. iOS sceglie l'immagine solo se misure e densità
// coincidono esattamente con il telefono: una voce per ogni misura di iPhone in commercio.
// [larghezza CSS, altezza CSS, densità]
export const IPHONE_SCHERMI: [number, number, number][] = [
  [440, 956, 3], // 16 Pro Max
  [402, 874, 3], // 16 Pro
  [430, 932, 3], // 16 Plus, 15 Pro Max, 15 Plus, 14 Pro Max
  [393, 852, 3], // 16, 15, 15 Pro, 14 Pro
  [390, 844, 3], // 14, 13, 13 Pro, 12, 12 Pro
  [428, 926, 3], // 14 Plus, 13 Pro Max, 12 Pro Max
  [375, 812, 3], // 13 mini, 12 mini, 11 Pro, XS, X
  [414, 896, 3], // 11 Pro Max, XS Max
  [414, 896, 2], // 11, XR
  [414, 736, 3], // 8 Plus
  [375, 667, 2], // SE, 8
];

export const avvioFile = ([w, h, r]: [number, number, number]) => `${w * r}x${h * r}.png`;

export const avvioStartupImages = IPHONE_SCHERMI.map((s) => ({
  url: `/avvio/${avvioFile(s)}`,
  media: `(device-width: ${s[0]}px) and (device-height: ${s[1]}px) and (-webkit-device-pixel-ratio: ${s[2]}) and (orientation: portrait)`,
}));
