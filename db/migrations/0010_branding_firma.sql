-- White-label: fiecare firma poate avea propriul logo, culoare primara si
-- nume de aplicatie afisat — necesar ca instalarea sa poata fi vanduta/
-- prezentata sub identitatea vizuala a clientului, nu doar cu date fiscale
-- proprii (deja acoperite de migratia 0004_firme.sql). Coloane nullable,
-- fara valoare implicita diferita de NULL: o firma existenta ramane cu
-- brandingul generic al aplicatiei pana e configurata explicit din Setari.

ALTER TABLE firme ADD COLUMN logo_data_url TEXT;
ALTER TABLE firme ADD COLUMN culoare_primara TEXT;
ALTER TABLE firme ADD COLUMN nume_aplicatie TEXT;
