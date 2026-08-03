import { DocumentEditor } from '../components/index.js';

export const ReceptiiMaterialePage = () => (
  <DocumentEditor
    tip="receptie_furnizor"
    title="Receptii materiale (NIR)"
    subtitle="Intrari de materii prime si materiale de la furnizori"
    prefix="NIR"
    partenerTip="furnizor"
    needsGestiune
  />
);

export const ReceptiiMarfaPage = () => (
  <DocumentEditor
    tip="receptie_furnizor"
    title="Receptii marfa de la furnizori"
    subtitle="Intrari de marfa (NIR)"
    prefix="NIR"
    partenerTip="furnizor"
    needsGestiune
  />
);

export const BonuriConsumPage = () => (
  <DocumentEditor
    tip="bon_consum"
    title="Bonuri de consum"
    subtitle="Iesiri de materiale in consum"
    prefix="BC"
    partenerTip={null}
    needsGestiune
  />
);

export const TransferuriPage = () => (
  <DocumentEditor
    tip="receptie_transfer"
    title="Transferuri intre gestiuni"
    subtitle="Miscari de stoc intre gestiuni"
    prefix="TR"
    partenerTip={null}
    needsGestiune
    needsDestinatie
  />
);

export const PlusMinusPage = () => (
  <DocumentEditor
    tip="plus_minus"
    title="Plusuri / Minusuri la inventar"
    subtitle="Regularizari de stoc (cantitate negativa = minus)"
    prefix="PM"
    partenerTip={null}
    needsGestiune
  />
);

export const VanzariAmanuntPage = () => (
  <DocumentEditor
    tip="vanzare_amanunt"
    title="Vanzari cu amanuntul"
    subtitle="Bonuri de vanzare (pret cu TVA inclus)"
    prefix="BON"
    partenerTip="client"
    needsGestiune
    retail
  />
);

export const VanzariFacturatePage = () => (
  <DocumentEditor
    tip="factura_vanzare"
    title="Vanzari facturate"
    subtitle="Facturi catre clienti"
    prefix="FCT"
    partenerTip="client"
    needsGestiune
  />
);

export const FacturiCumpararePage = () => (
  <DocumentEditor
    tip="factura_cumparare"
    title="Facturi furnizori"
    subtitle="Inregistrari facturi de cumparare — leaga de NIR pentru potrivire (3-way match), fara dubla contabilizare"
    prefix="FC"
    partenerTip="furnizor"
    linkSursaTip="receptie_furnizor"
    linkSursaLabel="NIR sursa (receptie)"
  />
);

export const AvizePage = () => (
  <DocumentEditor
    tip="aviz"
    title="Avize de insotire"
    subtitle="Avize de insotire a marfii"
    prefix="AV"
    partenerTip="client"
    needsGestiune
  />
);

export const ProformePage = () => (
  <DocumentEditor
    tip="proforma"
    title="Proforme"
    subtitle="Facturi proforma"
    prefix="PRO"
    partenerTip="client"
  />
);
