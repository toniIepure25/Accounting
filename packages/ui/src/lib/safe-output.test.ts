import { describe, expect, it } from 'vitest';
import { csvField, escapeHtml } from './safe-output.js';

describe('escapeHtml', () => {
  it('scapa caracterele speciale HTML', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('scapa ghilimelele, ca sa nu se poata iesi dintr-un atribut HTML', () => {
    expect(escapeHtml(`"><img src=x onerror=alert(1)>`)).not.toContain('"');
    expect(escapeHtml(`"><img src=x onerror=alert(1)>`)).not.toMatch(/<img/);
  });

  it('trateaza null/undefined ca sir gol', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('lasa neschimbat un text obisnuit, fara caractere speciale', () => {
    expect(escapeHtml('Lemn Prod SRL')).toBe('Lemn Prod SRL');
  });
});

describe('csvField', () => {
  it('pune intre ghilimele o valoare care contine virgula, ca sa nu sparga coloanele', () => {
    expect(csvField('Popescu, Ion SRL')).toBe('"Popescu, Ion SRL"');
  });

  it('dubleaza ghilimelele interne', () => {
    expect(csvField('Firma "Alfa" SRL')).toBe('"Firma ""Alfa"" SRL"');
  });

  it('antepune un apostrof valorilor care incep cu un semn de formula (protectie CSV injection)', () => {
    expect(csvField('=cmd|calc!A1')).toMatch(/^'=/);
    expect(csvField('+1234')).toMatch(/^'\+/);
    expect(csvField('-1234')).toMatch(/^'-/);
    expect(csvField('@SUM(A1)')).toMatch(/^'@/);
  });

  it('lasa neschimbata o valoare simpla, fara caractere speciale', () => {
    expect(csvField('RO12345678')).toBe('RO12345678');
  });

  it('trateaza null/undefined ca sir gol', () => {
    expect(csvField(null)).toBe('');
    expect(csvField(undefined)).toBe('');
  });
});
