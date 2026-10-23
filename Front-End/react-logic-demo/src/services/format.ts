/*
Plano 6 (T7) — formatação dependente de idioma com a API Intl do navegador.
Substitui datas cruas ("2026-10-22"), toLocaleString("pt-BR") fixo, "dia(s)" e
o ordinal "1º" — que ficavam em português mesmo com o app em inglês.
*/
import { Lang } from "../i18n";

const locale = (lang: Lang) => (lang === "en" ? "en-US" : "pt-BR");

// Datas do backend vêm como "AAAA-MM-DD" (ou ISO completo). Só a data é
// interpretada como dia LOCAL — new Date("2026-10-22") seria meia-noite UTC e
// viraria o dia anterior no Brasil.
export const formatDate = (value: string | null | undefined, lang: Lang): string => {
  if (!value) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale(lang), { day: "numeric", month: "short", year: "numeric" });
};

export const formatNumber = (value: number, lang: Lang, digits = 0): string =>
  value.toLocaleString(locale(lang), { minimumFractionDigits: digits, maximumFractionDigits: digits });

// plural(3, lang, ["dia", "dias"], ["day", "days"]) → "3 dias" / "3 days"
export const plural = (n: number, lang: Lang, pt: [string, string], en: [string, string]): string => {
  const forms = lang === "en" ? en : pt;
  const rule = new Intl.PluralRules(locale(lang)).select(n);
  return `${formatNumber(n, lang)} ${rule === "one" ? forms[0] : forms[1]}`;
};

const EN_ORDINAL: Record<string, string> = { one: "st", two: "nd", few: "rd", other: "th" };

export const ordinal = (n: number, lang: Lang): string =>
  lang === "en" ? `${n}${EN_ORDINAL[new Intl.PluralRules("en-US", { type: "ordinal" }).select(n)]}` : `${n}º`;
