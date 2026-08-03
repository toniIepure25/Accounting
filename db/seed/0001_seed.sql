-- Date de baza (seed). Rulate o singura data, dupa migratii.

-- Cote TVA Romania (valori curente; editabile din aplicatie).
INSERT INTO cote_tva (procent, denumire, implicita) VALUES (19, 'Standard 19%', 1);
INSERT INTO cote_tva (procent, denumire, implicita) VALUES (9,  'Redusa 9%', 0);
INSERT INTO cote_tva (procent, denumire, implicita) VALUES (5,  'Redusa 5%', 0);
INSERT INTO cote_tva (procent, denumire, implicita) VALUES (0,  'Scutit / 0%', 0);

-- Unitati de masura uzuale.
INSERT INTO unitati_masura (cod, denumire) VALUES ('buc', 'bucata');
INSERT INTO unitati_masura (cod, denumire) VALUES ('kg',  'kilogram');
INSERT INTO unitati_masura (cod, denumire) VALUES ('l',   'litru');
INSERT INTO unitati_masura (cod, denumire) VALUES ('m',   'metru');
INSERT INTO unitati_masura (cod, denumire) VALUES ('mp',  'metru patrat');
INSERT INTO unitati_masura (cod, denumire) VALUES ('set', 'set');

-- Fragment din planul de conturi romanesc (se poate incarca integral din setari).
INSERT INTO plan_conturi (id, simbol, denumire, clasa, tip) VALUES ('pc-301', '301', 'Materii prime', 3, 'sintetic');
INSERT INTO plan_conturi (id, simbol, denumire, clasa, tip) VALUES ('pc-345', '345', 'Produse finite', 3, 'sintetic');
INSERT INTO plan_conturi (id, simbol, denumire, clasa, tip) VALUES ('pc-371', '371', 'Marfuri', 3, 'sintetic');
INSERT INTO plan_conturi (id, simbol, denumire, clasa, tip) VALUES ('pc-401', '401', 'Furnizori', 4, 'sintetic');
INSERT INTO plan_conturi (id, simbol, denumire, clasa, tip) VALUES ('pc-411', '411', 'Clienti', 4, 'sintetic');
INSERT INTO plan_conturi (id, simbol, denumire, clasa, tip) VALUES ('pc-4426', '4426', 'TVA deductibila', 4, 'sintetic');
INSERT INTO plan_conturi (id, simbol, denumire, clasa, tip) VALUES ('pc-4427', '4427', 'TVA colectata', 4, 'sintetic');
INSERT INTO plan_conturi (id, simbol, denumire, clasa, tip) VALUES ('pc-5311', '5311', 'Casa in lei', 5, 'sintetic');
INSERT INTO plan_conturi (id, simbol, denumire, clasa, tip) VALUES ('pc-5121', '5121', 'Conturi la banci in lei', 5, 'sintetic');
INSERT INTO plan_conturi (id, simbol, denumire, clasa, tip) VALUES ('pc-707', '707', 'Venituri din vanzarea marfurilor', 7, 'sintetic');

-- Punct de lucru + gestiuni demo (portare din aplicatia KISS).
INSERT INTO puncte_lucru (id, cod, denumire, adresa)
VALUES ('11111111-1111-1111-1111-111111111111', 'PL02', 'Punct de lucru 02 Aiud Centru', 'Aiud, Centru');

INSERT INTO gestiuni (id, cod, denumire, gestionar, cont_sintetic, cont_analitic, tip, punct_de_lucru_id)
VALUES ('22222222-2222-2222-2222-222222222221', 'BAR', 'Gestiune Bar', '', '371', '371.01', 'global_valorica', '11111111-1111-1111-1111-111111111111');

INSERT INTO gestiuni (id, cod, denumire, gestionar, cont_sintetic, cont_analitic, tip, punct_de_lucru_id)
VALUES ('22222222-2222-2222-2222-222222222222', 'DEP', 'Depozit central', '', '371', '371.02', 'cantitativ_valorica', '11111111-1111-1111-1111-111111111111');
