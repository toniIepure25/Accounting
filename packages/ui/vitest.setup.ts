import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Fara test.globals:true in config, RTL nu inregistreaza automat cleanup-ul
// intre teste (verifica global afterEach) — il inregistram explicit, altfel
// randarile din teste succesive se acumuleaza in acelasi document jsdom.
afterEach(cleanup);
