/**
 * Texte legale afisate in aplicatie (Setari → Legal).
 *
 * IMPORTANT — sablon, nu aviz juridic: textele de mai jos acopera situatia
 * tipica a acestui produs (software de gestiune si contabilitate livrat
 * on-premise/LAN unei firme din Romania) si trebuie REVIZUITE de un jurist
 * inainte de prima vanzare reala. Denumirea furnizorului, datele de contact si
 * instanta competenta se completeaza la livrare.
 *
 * Motivul pentru care exista in produs, nu doar intr-un PDF pe langa: aplicatia
 * prelucreaza date cu caracter personal (CNP-uri de angajati in modulul
 * Personal, CNP-uri de clienti persoane fizice pentru e-Factura B2C, date de
 * contact ale partenerilor), deci utilizatorul trebuie sa poata consulta oricand
 * ce se intampla cu ele.
 */

export interface DocumentLegal {
  id: string;
  titlu: string;
  actualizat: string;
  sectiuni: { titlu: string; paragrafe: string[] }[];
}

const FURNIZOR = '[Denumirea furnizorului]';

export const EULA: DocumentLegal = {
  id: 'eula',
  titlu: 'Licenta de utilizare (EULA)',
  actualizat: '2026-07-31',
  sectiuni: [
    {
      titlu: '1. Obiectul licentei',
      paragrafe: [
        `${FURNIZOR} ("Furnizorul") acorda clientului ("Beneficiarul") un drept neexclusiv, netransferabil, de a utiliza aplicatia de gestiune si contabilitate ("Aplicatia"), in limitele editiei, planului si numarului de utilizatori inscrise in cheia de licenta primita.`,
        'Licenta se acorda pentru uz intern al Beneficiarului. Nu include dreptul de a revinde, sublicentia, inchiria sau oferi Aplicatia ca serviciu catre terti, fara acord scris separat.',
      ],
    },
    {
      titlu: '2. Limite tehnice ale licentei',
      paragrafe: [
        'Cheia de licenta stabileste: editia (domeniul de activitate si modulele deblocate), numarul maxim de utilizatori activi simultan si, daca este cazul, data de expirare.',
        'Depasirea numarului de utilizatori este impiedicata tehnic de Aplicatie. Conturile dezactivate nu consuma licenta.',
        'Ocolirea sau modificarea mecanismului de licentiere constituie incalcare a prezentei licente si atrage incetarea de drept a acesteia.',
      ],
    },
    {
      titlu: '3. Expirare si date',
      paragrafe: [
        'La expirarea licentei, Aplicatia acorda o perioada de gratie in care functioneaza normal. Dupa aceasta, Aplicatia trece in regim de CONSULTARE: datele raman integral accesibile pentru vizualizare, raportare si export, dar nu se mai pot inregistra date noi.',
        'Datele introduse de Beneficiar ii apartin in totalitate. Furnizorul nu conditioneaza in niciun moment accesul la propriile date de plata licentei — obligatia legala de pastrare si prezentare a documentelor contabile revine Beneficiarului si nu poate fi impiedicata tehnic.',
        'Beneficiarul poate exporta oricand intreaga baza de date din Setari → Backup si restaurare.',
      ],
    },
    {
      titlu: '4. Actualizari si conformitate fiscala',
      paragrafe: [
        'Furnizorul depune diligente rezonabile pentru actualizarea Aplicatiei conform modificarilor legislative din Romania (cote TVA, formate de raportare, obligatii ANAF).',
        'Beneficiarul ramane singurul raspunzator pentru corectitudinea datelor introduse, pentru depunerea la termen a declaratiilor si pentru respectarea obligatiilor sale fiscale si contabile. Aplicatia este un instrument de lucru, nu un substitut al serviciilor unui contabil autorizat.',
      ],
    },
    {
      titlu: '5. Garantii si raspundere',
      paragrafe: [
        'Aplicatia este livrata "ca atare". Furnizorul garanteaza ca aceasta functioneaza in conformitate cu documentatia, dar nu garanteaza ca va fi lipsita de erori sau intreruperi.',
        'In limitele permise de lege, raspunderea Furnizorului este limitata la contravaloarea licentei achitate pentru perioada in care s-a produs prejudiciul. Furnizorul nu raspunde pentru pierderi indirecte, pierderi de profit sau pierderi de date cauzate de lipsa unor copii de siguranta la Beneficiar.',
        'Beneficiarul este responsabil pentru realizarea periodica a copiilor de siguranta.',
      ],
    },
    {
      titlu: '6. Incetare',
      paragrafe: [
        'Licenta inceteaza la expirarea termenului, prin acordul partilor sau prin incalcarea prevederilor de mai sus.',
        'La incetare, Beneficiarul pastreaza dreptul de a-si exporta datele.',
      ],
    },
    {
      titlu: '7. Lege aplicabila',
      paragrafe: [
        'Prezenta licenta este guvernata de legea romana. Eventualele litigii se solutioneaza pe cale amiabila, iar in caz contrar de instantele competente de la sediul Furnizorului.',
      ],
    },
  ],
};

export const GDPR: DocumentLegal = {
  id: 'gdpr',
  titlu: 'Prelucrarea datelor cu caracter personal (GDPR)',
  actualizat: '2026-07-31',
  sectiuni: [
    {
      titlu: '1. Rolurile partilor',
      paragrafe: [
        'Beneficiarul (firma care foloseste Aplicatia) este OPERATOR de date cu caracter personal in sensul Regulamentului (UE) 2016/679 (GDPR): el decide ce date introduce si in ce scop.',
        `${FURNIZOR} are calitatea de PERSOANA IMPUTERNICITA doar in masura in care ofera servicii de gazduire, mentenanta sau suport care presupun acces la date. In instalarile locale sau in retea proprie (on-premise), unde datele nu parasesc infrastructura Beneficiarului, Furnizorul NU are acces la date si nu prelucreaza date cu caracter personal.`,
      ],
    },
    {
      titlu: '2. Ce date personale prelucreaza Aplicatia',
      paragrafe: [
        'Angajati (modulul Personal): nume, prenume, CNP, functie, date de contract — necesare pentru evidenta de personal si raportari.',
        'Clienti persoane fizice: nume si, pentru facturarea electronica B2C conform cerintelor ANAF, CNP sau alt identificator.',
        'Reprezentanti ai partenerilor: nume, telefon, e-mail, adresa.',
        'Utilizatori ai Aplicatiei: nume de utilizator, rol, parola stocata exclusiv sub forma de amprenta criptografica (PBKDF2), niciodata in clar.',
        'Jurnal de audit: cine a creat, modificat sau sters o inregistrare si cand — necesar pentru trasabilitate contabila.',
      ],
    },
    {
      titlu: '3. Temeiul si scopul prelucrarii',
      paragrafe: [
        'Obligatie legala (art. 6 alin. 1 lit. c GDPR): evidenta contabila, raportari fiscale, evidenta de personal.',
        'Executarea unui contract (art. 6 alin. 1 lit. b): facturare, livrare, urmarirea comenzilor.',
        'Interes legitim (art. 6 alin. 1 lit. f): securitatea sistemului si jurnalul de audit.',
      ],
    },
    {
      titlu: '4. Stocare si securitate',
      paragrafe: [
        'In modul local, datele sunt stocate exclusiv pe calculatorul Beneficiarului. In modul retea/cloud, pe serverul indicat de Beneficiar.',
        'Accesul este controlat prin autentificare cu parola si prin roluri (drepturi diferentiate). Datele sensibile — CNP-uri de angajati, operatiuni bancare, registrul mijloacelor fixe, planul de conturi — sunt accesibile doar rolurilor care au nevoie de ele.',
        'Parolele sunt stocate ca amprente PBKDF2 cu sare individuala. Sesiunile expira automat si pot fi revocate imediat prin deconectare sau prin dezactivarea contului.',
        'Fiecare modificare a datelor este inregistrata in jurnalul de audit, care nu poate fi modificat sau sters de niciun rol, inclusiv administrator.',
      ],
    },
    {
      titlu: '5. Durata pastrarii',
      paragrafe: [
        'Documentele contabile si cele justificative se pastreaza conform termenelor legale din Romania (in general 5 sau 10 ani, in functie de tipul documentului).',
        'Datele de personal se pastreaza conform legislatiei muncii aplicabile.',
        'Stergerea efectiva a datelor este la latitudinea Beneficiarului, in calitate de operator.',
      ],
    },
    {
      titlu: '6. Drepturile persoanelor vizate',
      paragrafe: [
        'Persoanele ale caror date sunt prelucrate au dreptul de acces, rectificare, stergere (in limitele obligatiilor legale de arhivare), restrictionare, portabilitate si opozitie.',
        'Cererile se adreseaza Beneficiarului, in calitate de operator. Aplicatia pune la dispozitie functii de cautare, corectare si export care permit onorarea acestor cereri.',
      ],
    },
    {
      titlu: '7. Transferuri catre terti',
      paragrafe: [
        'Aplicatia nu transmite date catre terti in mod automat. Transferurile au loc doar la initiativa explicita a Beneficiarului: transmiterea facturilor catre ANAF (SPV), iar daca asistentul AI este configurat cu un server, textul intrebarilor si contextul relevant sunt trimise catre furnizorul serviciului AI.',
        'Asistentul AI functioneaza implicit OFFLINE, fara transmiterea vreunei date in afara instalarii; utilizarea variantei online este o alegere explicita a Beneficiarului.',
      ],
    },
  ],
};

export const DOCUMENTE_LEGALE: DocumentLegal[] = [EULA, GDPR];
