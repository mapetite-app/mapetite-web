// "1.234 recensioni": in italiano i browser recenti raggruppano le migliaia solo da 5 cifre
// ("1234"), quindi il punto si chiede sempre (giro del 24/10).
const FMT = new Intl.NumberFormat("it-IT", { useGrouping: "always" } as unknown as Intl.NumberFormatOptions);
export const migliaia = (n: number) => FMT.format(n);
