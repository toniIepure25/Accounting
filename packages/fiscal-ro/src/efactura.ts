/**
 * Generator e-Factura (RO_CIUS) — factura electronica UBL 2.1 conforma cu
 * profilul national CIUS-RO cerut de ANAF (SPV). Genereaza XML-ul dintr-un
 * document de vanzare. Semnarea si trimiterea la SPV se fac in stratul de
 * integrare (server / desktop), nu aici.
 */

export interface EFacturaParte {
  nume: string;
  cui: string | null;
  /**
   * CNP — pentru un cumparator persoana fizica fara CUI (e-Factura B2C).
   * Ignorat daca `cui` e setat. Schema exacta de identificare preferata de
   * ANAF pentru persoane fizice ar trebui confirmata contra mediului de test
   * SPV cand exista credentiale reale — aici folosim `PartyIdentification`
   * (element UBL standard), fara sa emitem un `PartyTaxScheme`/CompanyID
   * (acela e specific inregistrarii fiscale a persoanelor juridice).
   */
  cnp?: string | null;
  adresa: string;
  oras: string;
  judet: string;
  tara?: string;
}

export interface EFacturaLinie {
  denumire: string;
  cantitate: number;
  unitateMasura: string;
  pretUnitarBani: number;
  cotaTvaProcent: number;
  netBani: number;
  tvaBani: number;
}

export interface EFacturaInput {
  serieNumar: string;
  dataEmitere: string; // yyyy-mm-dd
  scadenta?: string | null;
  moneda?: string;
  vanzator: EFacturaParte;
  cumparator: EFacturaParte;
  linii: EFacturaLinie[];
  totalNetBani: number;
  totalTvaBani: number;
  totalBrutBani: number;
}

const CUSTOMIZATION = 'urn:cen.eu:en16931:2017#compliant#urn:efactura.mfinante.ro:CIUS-RO:1.0.1';
const PROFILE = 'urn:cen.eu:en16931:2017';

/** Coduri UN/ECE pentru unitatea de masura (subset uzual). */
const UOM: Record<string, string> = {
  buc: 'H87',
  set: 'SET',
  kg: 'KGM',
  l: 'LTR',
  m: 'MTR',
  mp: 'MTK',
  ora: 'HUR',
  portie: 'H87',
};

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dec = (bani: number) => (bani / 100).toFixed(2);
const uom = (u: string) => UOM[u] ?? 'H87';

function xmlParte(
  rol: 'AccountingSupplierParty' | 'AccountingCustomerParty',
  p: EFacturaParte,
): string {
  const taxScheme = p.cui
    ? `<cac:PartyTaxScheme><cbc:CompanyID>${esc(p.cui.toUpperCase().startsWith('RO') ? p.cui.toUpperCase() : `RO${p.cui}`)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>`
    : '';
  // B2C: cumparator persoana fizica, fara CUI — identificat prin CNP (daca e cunoscut), nu prin PartyTaxScheme.
  const partyId =
    !p.cui && p.cnp
      ? `<cac:PartyIdentification><cbc:ID schemeID="CNP">${esc(p.cnp)}</cbc:ID></cac:PartyIdentification>`
      : '';
  return `  <cac:${rol}>
    <cac:Party>
      ${partyId}
      <cac:PostalAddress>
        <cbc:CityName>${esc(p.oras)}</cbc:CityName>
        <cbc:CountrySubentity>${esc(p.judet)}</cbc:CountrySubentity>
        <cac:AddressLine><cbc:Line>${esc(p.adresa)}</cbc:Line></cac:AddressLine>
        <cac:Country><cbc:IdentificationCode>${esc(p.tara ?? 'RO')}</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      ${taxScheme}
      <cac:PartyLegalEntity><cbc:RegistrationName>${esc(p.nume)}</cbc:RegistrationName></cac:PartyLegalEntity>
    </cac:Party>
  </cac:${rol}>`;
}

function xmlLinie(index: number, l: EFacturaLinie, moneda: string): string {
  const pretFaraTva = l.cantitate !== 0 ? Math.round(l.netBani / l.cantitate) : l.pretUnitarBani;
  return `  <cac:InvoiceLine>
    <cbc:ID>${index}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${uom(l.unitateMasura)}">${l.cantitate}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${moneda}">${dec(l.netBani)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>${esc(l.denumire)}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>${l.cotaTvaProcent > 0 ? 'S' : 'Z'}</cbc:ID>
        <cbc:Percent>${l.cotaTvaProcent.toFixed(2)}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="${moneda}">${dec(pretFaraTva)}</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>`;
}

/** Genereaza XML-ul UBL 2.1 (CIUS-RO) pentru o factura. */
export function genereazaEFacturaXML(input: EFacturaInput): string {
  const moneda = input.moneda ?? 'RON';
  const linii = input.linii.map((l, i) => xmlLinie(i + 1, l, moneda)).join('\n');
  const scadenta = input.scadenta ? `  <cbc:DueDate>${input.scadenta}</cbc:DueDate>\n` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>${CUSTOMIZATION}</cbc:CustomizationID>
  <cbc:ProfileID>${PROFILE}</cbc:ProfileID>
  <cbc:ID>${esc(input.serieNumar)}</cbc:ID>
  <cbc:IssueDate>${input.dataEmitere}</cbc:IssueDate>
${scadenta}  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${moneda}</cbc:DocumentCurrencyCode>
${xmlParte('AccountingSupplierParty', input.vanzator)}
${xmlParte('AccountingCustomerParty', input.cumparator)}
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${moneda}">${dec(input.totalTvaBani)}</cbc:TaxAmount>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${moneda}">${dec(input.totalNetBani)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${moneda}">${dec(input.totalNetBani)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${moneda}">${dec(input.totalBrutBani)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${moneda}">${dec(input.totalBrutBani)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${linii}
</Invoice>`;
}
