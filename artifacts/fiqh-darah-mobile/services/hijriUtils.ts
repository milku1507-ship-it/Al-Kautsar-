export function getHijriDate(date: Date): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });
  const parts = formatter.formatToParts(date);
  const day = parseInt(parts.find(p => p.type === 'day')!.value);
  const month = parseInt(parts.find(p => p.type === 'month')!.value);
  const year = parseInt(parts.find(p => p.type === 'year')!.value);
  return { year, month, day };
}

export function calculateHijriAge(dobMasehi: string): { years: number; months: number; days: number } {
  const birthDate = new Date(dobMasehi);
  const today = new Date();
  const birthHijri = getHijriDate(birthDate);
  const todayHijri = getHijriDate(today);

  let years = todayHijri.year - birthHijri.year;
  let months = todayHijri.month - birthHijri.month;
  let days = todayHijri.day - birthHijri.day;

  if (days < 0) { months -= 1; days += 30; }
  if (months < 0) { years -= 1; months += 12; }

  return { years, months, days };
}
