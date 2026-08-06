import { type Document, type Partener, type Postare, type Produs, numeCont } from '@gr/core-domain';

/**
 * Generator SAF-T (D406). Produce un AuditFile cu Header, MasterFiles (clienti,
 * furnizori, produse, plan de conturi), GeneralLedgerEntries (din registrul-jurnal
 * PERSISTAT) si un rezumat de SourceDocuments (facturi de vanzare).
 *
 * Faza 9: partea de GeneralLedgerEntries se construieste din LINIILE PERSISTATE
 * ale jurnalului (journal_lines), nu se re-deduce din documente — deci SAF-T
 * reconciliaza cu balanta de verificare. Schema oficiala completa D406 + validarea
 * ANAF raman EXTERNAL_REVIEW_REQUIRED (nu pot rula in acest mediu).
 */
export interface SaftCompanie {
  nume: string;
  cui: string;
  perioadaLuna: number;
  perioadaAn: number;
}

export interface SaftInput {
  companie: SaftCompanie;
  parteneri: readonly Partener[];
  produse: readonly Produs[];
  documente: readonly Document[];
  /** Liniile jurnalului persistat pentru perioada (sursa GeneralLedgerEntries). */
  postariJurnal?: readonly Postare[];
}

/** Un cont agregat pentru General Ledger / balanta. */
export interface RandGeneralLedger {
  cont: string;
  nume: string;
  totalDebitBani: number;
  totalCreditBani: number;
  soldDebitorBani: number;
  soldCreditorBani: number;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const dec = (bani: number) => (bani / 100).toFixed(2);

/**
 * Agrega liniile de jurnal pe cont (rulaje + sold). Aceeasi semantica precum
 * balanta de verificare — SAF-T GL si balanta au aceeasi sursa (jurnalul), deci
 * reconciliaza prin constructie.
 */
export function agregaGeneralLedger(postari: readonly Postare[]): RandGeneralLedger[] {
  const map = new Map<string, RandGeneralLedger>();
  for (const p of postari) {
    const r =
      map.get(p.cont) ??
      map
        .set(p.cont, {
          cont: p.cont,
          nume: numeCont(p.cont),
          totalDebitBani: 0,
          totalCreditBani: 0,
          soldDebitorBani: 0,
          soldCreditorBani: 0,
        })
        .get(p.cont)!;
    r.totalDebitBani += p.debitBani;
    r.totalCreditBani += p.creditBani;
  }
  for (const r of map.values()) {
    const sold = r.totalDebitBani - r.totalCreditBani;
    r.soldDebitorBani = sold > 0 ? sold : 0;
    r.soldCreditorBani = sold < 0 ? -sold : 0;
  }
  return [...map.values()].sort((a, b) => a.cont.localeCompare(b.cont));
}

export interface ReconciliereSaft {
  totalDebitBani: number;
  totalCreditBani: number;
  /** Partida dubla: suma debit == suma credit pe tot GL-ul. */
  echilibrat: boolean;
}

/** Verifica echilibrul General Ledger-ului (Σdebit == Σcredit). */
export function reconciliazaGeneralLedger(randuri: readonly RandGeneralLedger[]): ReconciliereSaft {
  let d = 0;
  let c = 0;
  for (const r of randuri) {
    d += r.totalDebitBani;
    c += r.totalCreditBani;
  }
  return { totalDebitBani: d, totalCreditBani: c, echilibrat: d === c };
}

export function genereazaSaftXML(input: SaftInput): string {
  const { companie, parteneri, produse, documente } = input;
  const clienti = parteneri.filter((p) => p.tip === 'client' || p.tip === 'ambele');
  const furnizori = parteneri.filter((p) => p.tip === 'furnizor' || p.tip === 'ambele');
  const facturi = documente.filter((d) => d.tip === 'factura_vanzare' && d.stare === 'validat');
  const gl = agregaGeneralLedger(input.postariJurnal ?? []);

  const customerXml = clienti
    .map(
      (c) =>
        `      <Customer><CompanyName>${esc(c.denumire)}</CompanyName><CustomerID>${esc(c.cui ?? c.id)}</CustomerID></Customer>`,
    )
    .join('\n');
  const supplierXml = furnizori
    .map(
      (s) =>
        `      <Supplier><CompanyName>${esc(s.denumire)}</CompanyName><SupplierID>${esc(s.cui ?? s.id)}</SupplierID></Supplier>`,
    )
    .join('\n');
  const productXml = produse
    .map(
      (p) =>
        `      <Product><ProductCode>${esc(p.cod)}</ProductCode><Description>${esc(p.denumire)}</Description><UOMBase>${esc(p.unitateMasura)}</UOMBase></Product>`,
    )
    .join('\n');
  const accountXml = gl
    .map(
      (r) =>
        `      <Account><AccountID>${esc(r.cont)}</AccountID><AccountDescription>${esc(r.nume)}</AccountDescription><OpeningDebitBalance>0.00</OpeningDebitBalance><ClosingDebitBalance>${dec(r.soldDebitorBani)}</ClosingDebitBalance><ClosingCreditBalance>${dec(r.soldCreditorBani)}</ClosingCreditBalance></Account>`,
    )
    .join('\n');
  const glLinesXml = gl
    .map(
      (r) =>
        `      <Line><AccountID>${esc(r.cont)}</AccountID><DebitAmount>${dec(r.totalDebitBani)}</DebitAmount><CreditAmount>${dec(r.totalCreditBani)}</CreditAmount></Line>`,
    )
    .join('\n');
  const invoiceXml = facturi
    .map(
      (d) =>
        `      <Invoice><InvoiceNo>${esc(d.cod)}</InvoiceNo><InvoiceDate>${d.data}</InvoiceDate><NetTotal>${dec(d.totalNetBani)}</NetTotal><TaxPayable>${dec(d.totalTvaBani)}</TaxPayable><GrossTotal>${dec(d.totalBrutBani)}</GrossTotal></Invoice>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<AuditFile xmlns="mfp:anaf:dgti:d406:declaratie:v1">
  <Header>
    <AuditFileVersion>D406</AuditFileVersion>
    <CompanyName>${esc(companie.nume)}</CompanyName>
    <TaxRegistrationNumber>${esc(companie.cui)}</TaxRegistrationNumber>
    <Period>${companie.perioadaLuna}</Period>
    <PeriodYear>${companie.perioadaAn}</PeriodYear>
    <CurrencyCode>RON</CurrencyCode>
  </Header>
  <MasterFiles>
    <GeneralLedgerAccounts>
${accountXml}
    </GeneralLedgerAccounts>
    <Customers>
${customerXml}
    </Customers>
    <Suppliers>
${supplierXml}
    </Suppliers>
    <Products>
${productXml}
    </Products>
  </MasterFiles>
  <GeneralLedgerEntries>
${glLinesXml}
  </GeneralLedgerEntries>
  <SourceDocuments>
    <SalesInvoices>
${invoiceXml}
    </SalesInvoices>
  </SourceDocuments>
</AuditFile>`;
}
