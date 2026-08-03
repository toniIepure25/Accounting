import type { Document, Partener, Produs } from '@gr/core-domain';

/**
 * Generator SAF-T (D406) — subset structural. Produce un AuditFile cu Header,
 * MasterFiles (clienti, furnizori, produse) si un rezumat de SourceDocuments
 * (facturi de vanzare). Este un punct de plecare conform ca structura; schema
 * completa D406 (GeneralLedgerEntries, TaxTable detaliat) se extinde ulterior.
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
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const dec = (bani: number) => (bani / 100).toFixed(2);

export function genereazaSaftXML(input: SaftInput): string {
  const { companie, parteneri, produse, documente } = input;
  const clienti = parteneri.filter((p) => p.tip === 'client' || p.tip === 'ambele');
  const furnizori = parteneri.filter((p) => p.tip === 'furnizor' || p.tip === 'ambele');
  const facturi = documente.filter((d) => d.tip === 'factura_vanzare' && d.stare === 'validat');

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
  <SourceDocuments>
    <SalesInvoices>
${invoiceXml}
    </SalesInvoices>
  </SourceDocuments>
</AuditFile>`;
}
