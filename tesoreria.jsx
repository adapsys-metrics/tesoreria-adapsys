import { useState, useEffect, useMemo, useRef, createContext, useContext, Fragment as Frag } from "react";

/* ─────────────────────────  TOKENS  ───────────────────────── */
const C = {
  ink: "#15181C", paper: "#F7F7F4", surface: "#FFFFFF",
  rule: "#E3E4DF", ruleSoft: "#EFEFEB", muted: "#767C74",
  teal: "#0F6E5C", tealSoft: "#E4F0EC",
  brick: "#B0432C", brickSoft: "#F7E9E5",
  amber: "#8A6A18", amberSoft: "#F6EFDC",
  seccion: "#DDE6E3",
};
const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const SANS = "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif";
const TC_USD = 970;
const AÑO = 2026;
const MESC = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/* ─────────────────────────  EMPRESAS Y CUENTAS  ───────────────────────── */
const EMPRESAS = [
  { id: "adap", nombre: "CLA ADAPTACIÓN", corto: "ADAP", grupo: "Adapsys" },
  { id: "cons", nombre: "CLA CONSULTORES", corto: "CONS", grupo: "Adapsys" },
  { id: "clting", nombre: "CLA CONSULTING", corto: "CLTG", grupo: "Adapsys" },
  { id: "ctria", nombre: "CLA CONSULTORIA", corto: "CTRIA", grupo: "Adapsys" },
  { id: "sm", nombre: "SANTA MARÍA", corto: "SM", grupo: "Empresas relacionadas" },
];
const IDS_ADAPSYS = EMPRESAS.filter((e) => e.grupo === "Adapsys").map((e) => e.id);
const PRESETS = [
  { id: "ads", nombre: "Adapsys", ids: IDS_ADAPSYS },
  { id: "todas", nombre: "Todas", ids: EMPRESAS.map((e) => e.id) },
  { id: "rel", nombre: "Relacionadas", ids: ["sm"] },
];
const empDe = (id) => EMPRESAS.find((e) => e.id === id) || EMPRESAS[0];

const CUENTAS = [
  { id: "a1", nombre: "CLA ADAPTACIÓN PESOS", empresa: "adap", moneda: "CLP", tipo: "banco", saldo: 199673281, principal: true },
  { id: "a2", nombre: "CLA ADAPTACIÓN DÓLAR", empresa: "adap", moneda: "USD", tipo: "banco", saldo: 53 },
  { id: "b1", nombre: "CLA CONSULTORES PESOS", empresa: "cons", moneda: "CLP", tipo: "banco", saldo: 4866278, principal: true },
  { id: "b2", nombre: "CLA CONSULTORES DÓLAR", empresa: "cons", moneda: "USD", tipo: "banco", saldo: 4746 },
  { id: "c1", nombre: "CLA CONSULTING PESOS", empresa: "clting", moneda: "CLP", tipo: "banco", saldo: 185642497, principal: true },
  { id: "c2", nombre: "CLA CONSULTING DÓLAR", empresa: "clting", moneda: "USD", tipo: "banco", saldo: 21 },
  { id: "d1", nombre: "CLA CONSULTORIA PESOS", empresa: "ctria", moneda: "CLP", tipo: "banco", saldo: 2731975, principal: true },
  { id: "e1", nombre: "SANTA MARÍA PESOS", empresa: "sm", moneda: "CLP", tipo: "banco", saldo: -132518, principal: true },
  { id: "e2", nombre: "SANTA MARÍA DÓLAR", empresa: "sm", moneda: "USD", tipo: "banco", saldo: 1000 },
  { id: "x1", nombre: "Facturas por cobrar CLP", empresa: "adap", moneda: "CLP", tipo: "cxc", saldo: 0 },
  { id: "x2", nombre: "Facturas por cobrar USD", empresa: "adap", moneda: "USD", tipo: "cxc", saldo: 16285 },
];

/* ───────────────  CATÁLOGO: naturaleza → categoría → subcategoría  ─────────────── */
const NATURALEZAS = [
  { id: "ingreso", nombre: "Ingresos" },
  { id: "inversion", nombre: "Gastos de Inversión" },
  { id: "operativo", nombre: "Gastos Operativos" },
];
const RESPONSABLES = ["", "I+D", "Analítica avanzada", "Finanzas", "Personas", "Comercial", "Gerencia"];

const CATS_INI = [
  { id: "a-ingresos-clientes", nombre: "A INGRESOS CLIENTES", controlado: true },
  { id: "b-otros-ingresos", nombre: "B OTROS INGRESOS", controlado: true },
  { id: "1-costo-de-venta", nombre: "1 COSTO DE VENTA", controlado: true },
  { id: "1-desarrollo-organizaciona", nombre: "1 DESARROLLO ORGANIZACIONAL", controlado: true },
  { id: "2-gastos-administracion", nombre: "2 GASTOS ADMINISTRACIÓN", controlado: true },
  { id: "2-0-comercial-y-marketing", nombre: "2.0 COMERCIAL Y MARKETING", controlado: true },
  { id: "2-1-posicionamiento-nueva", nombre: "2.1 POSICIONAMIENTO NUEVA MARCA", controlado: true },
  { id: "2-2-compra-activos", nombre: "2.2 COMPRA ACTIVOS", controlado: true },
  { id: "2-3-gastos-sistemas-digita", nombre: "2.3 GASTOS SISTEMAS DIGITALES", controlado: true },
  { id: "2-4-equipos-computacionale", nombre: "2.4 EQUIPOS COMPUTACIONALES", controlado: true },
  { id: "3-recursos-humanos", nombre: "3 RECURSOS HUMANOS", controlado: true },
  { id: "4-impuestos", nombre: "4 IMPUESTOS", controlado: true },
  { id: "5-bancos", nombre: "5 BANCOS", controlado: true },
  { id: "6-prestamos-bancarios", nombre: "6 PRESTAMOS BANCARIOS", controlado: false },
  { id: "7-inversiones", nombre: "7 INVERSIONES", controlado: false },
  { id: "8-relacionados-y-socios", nombre: "8 RELACIONADOS Y SOCIOS", controlado: false },
];
const SUBS_INI = [
  { id: "aasa", cat: "a-ingresos-clientes", nombre: "AASA", nat: "ingreso" },
  { id: "abastible", cat: "a-ingresos-clientes", nombre: "ABASTIBLE", nat: "ingreso" },
  { id: "acciona", cat: "a-ingresos-clientes", nombre: "ACCIONA", nat: "ingreso" },
  { id: "achs", cat: "a-ingresos-clientes", nombre: "ACHS", nat: "ingreso" },
  { id: "adapsys-australia", cat: "a-ingresos-clientes", nombre: "ADAPSYS AUSTRALIA", nat: "ingreso" },
  { id: "adapsys-colombia", cat: "a-ingresos-clientes", nombre: "ADAPSYS COLOMBIA", nat: "ingreso" },
  { id: "adapsys-peru", cat: "a-ingresos-clientes", nombre: "ADAPSYS PERÚ", nat: "ingreso" },
  { id: "agrosuper", cat: "a-ingresos-clientes", nombre: "AGROSUPER", nat: "ingreso" },
  { id: "aislapol", cat: "a-ingresos-clientes", nombre: "AISLAPOL", nat: "ingreso" },
  { id: "albemarle", cat: "a-ingresos-clientes", nombre: "ALBEMARLE", nat: "ingreso" },
  { id: "almagro", cat: "a-ingresos-clientes", nombre: "ALMAGRO", nat: "ingreso" },
  { id: "aln-programa-liderazgo", cat: "a-ingresos-clientes", nombre: "ALN PROGRAMA LIDERAZGO", nat: "ingreso" },
  { id: "alto-las-condes", cat: "a-ingresos-clientes", nombre: "ALTO LAS CONDES", nat: "ingreso" },
  { id: "amsa", cat: "a-ingresos-clientes", nombre: "AMSA", nat: "ingreso" },
  { id: "anasac", cat: "a-ingresos-clientes", nombre: "ANASAC", nat: "ingreso" },
  { id: "andritz", cat: "a-ingresos-clientes", nombre: "ANDRITZ", nat: "ingreso" },
  { id: "angloamerican", cat: "a-ingresos-clientes", nombre: "ANGLOAMERICAN", nat: "ingreso" },
  { id: "aon-corporation", cat: "a-ingresos-clientes", nombre: "AON CORPORATION", nat: "ingreso" },
  { id: "arcoprime", cat: "a-ingresos-clientes", nombre: "ARCOPRIME", nat: "ingreso" },
  { id: "asociacion-de-empresas-familiares", cat: "a-ingresos-clientes", nombre: "ASOCIACIÓN DE EMPRESAS FAMILIARES", nat: "ingreso" },
  { id: "astrazeneca", cat: "a-ingresos-clientes", nombre: "ASTRAZENECA", nat: "ingreso" },
  { id: "banchile", cat: "a-ingresos-clientes", nombre: "BANCHILE", nat: "ingreso" },
  { id: "banco-bci", cat: "a-ingresos-clientes", nombre: "BANCO BCI", nat: "ingreso" },
  { id: "banco-central", cat: "a-ingresos-clientes", nombre: "BANCO CENTRAL", nat: "ingreso" },
  { id: "banco-de-chile", cat: "a-ingresos-clientes", nombre: "BANCO DE CHILE", nat: "ingreso" },
  { id: "banco-estado-beco", cat: "a-ingresos-clientes", nombre: "BANCO ESTADO BECO", nat: "ingreso" },
  { id: "banco-itau", cat: "a-ingresos-clientes", nombre: "BANCO ITAÚ", nat: "ingreso" },
  { id: "banco-santander", cat: "a-ingresos-clientes", nombre: "BANCO SANTANDER", nat: "ingreso" },
  { id: "bbk", cat: "a-ingresos-clientes", nombre: "BBK", nat: "ingreso" },
  { id: "bbosch", cat: "a-ingresos-clientes", nombre: "BBOSCH", nat: "ingreso" },
  { id: "bechtel", cat: "a-ingresos-clientes", nombre: "BECHTEL", nat: "ingreso" },
  { id: "besalco", cat: "a-ingresos-clientes", nombre: "BESALCO", nat: "ingreso" },
  { id: "betterfly", cat: "a-ingresos-clientes", nombre: "BETTERFLY", nat: "ingreso" },
  { id: "bhp-billiton", cat: "a-ingresos-clientes", nombre: "BHP BILLITON", nat: "ingreso" },
  { id: "bice-corp", cat: "a-ingresos-clientes", nombre: "BICE CORP", nat: "ingreso" },
  { id: "bice-vida", cat: "a-ingresos-clientes", nombre: "BICE VIDA", nat: "ingreso" },
  { id: "biodiversa", cat: "a-ingresos-clientes", nombre: "BIODIVERSA", nat: "ingreso" },
  { id: "blumar", cat: "a-ingresos-clientes", nombre: "BLUMAR", nat: "ingreso" },
  { id: "burn-to-give", cat: "a-ingresos-clientes", nombre: "BURN TO GIVE", nat: "ingreso" },
  { id: "c-l-fruit", cat: "a-ingresos-clientes", nombre: "C&L Fruit", nat: "ingreso" },
  { id: "caja-los-andes", cat: "a-ingresos-clientes", nombre: "CAJA LOS ANDES", nat: "ingreso" },
  { id: "camara-de-comercio", cat: "a-ingresos-clientes", nombre: "CÁMARA DE COMERCIO", nat: "ingreso" },
  { id: "cap", cat: "a-ingresos-clientes", nombre: "CAP", nat: "ingreso" },
  { id: "cardif", cat: "a-ingresos-clientes", nombre: "CARDIF", nat: "ingreso" },
  { id: "carey", cat: "a-ingresos-clientes", nombre: "CAREY", nat: "ingreso" },
  { id: "cargill", cat: "a-ingresos-clientes", nombre: "CARGILL", nat: "ingreso" },
  { id: "caserones-lundin-mining", cat: "a-ingresos-clientes", nombre: "CASERONES LUNDIN MINING", nat: "ingreso" },
  { id: "cchc", cat: "a-ingresos-clientes", nombre: "CCHC", nat: "ingreso" },
  { id: "charlas-magistrales", cat: "a-ingresos-clientes", nombre: "CHARLAS MAGISTRALES", nat: "ingreso" },
  { id: "chilexpress", cat: "a-ingresos-clientes", nombre: "CHILEXPRESS", nat: "ingreso" },
  { id: "cla-consulting", cat: "a-ingresos-clientes", nombre: "CLA CONSULTING", nat: "ingreso" },
  { id: "cla-consultores", cat: "a-ingresos-clientes", nombre: "CLA CONSULTORES", nat: "ingreso" },
  { id: "cla-consultoria", cat: "a-ingresos-clientes", nombre: "CLA CONSULTORÍA", nat: "ingreso" },
  { id: "clinica-opia", cat: "a-ingresos-clientes", nombre: "CLÍNICA OPIA", nat: "ingreso" },
  { id: "club-mujeres-empresarias", cat: "a-ingresos-clientes", nombre: "CLUB MUJERES EMPRESARIAS", nat: "ingreso" },
  { id: "clue", cat: "a-ingresos-clientes", nombre: "CLUE", nat: "ingreso" },
  { id: "cmpc", cat: "a-ingresos-clientes", nombre: "CMPC", nat: "ingreso" },
  { id: "cmpc-softys", cat: "a-ingresos-clientes", nombre: "CMPC SOFTYS", nat: "ingreso" },
  { id: "coasin", cat: "a-ingresos-clientes", nombre: "COASIN", nat: "ingreso" },
  { id: "coca-cola-andina", cat: "a-ingresos-clientes", nombre: "COCA COLA ANDINA", nat: "ingreso" },
  { id: "codelco", cat: "a-ingresos-clientes", nombre: "CODELCO", nat: "ingreso" },
  { id: "colbun", cat: "a-ingresos-clientes", nombre: "COLBUN", nat: "ingreso" },
  { id: "colegio-alianza-francesa", cat: "a-ingresos-clientes", nombre: "COLEGIO ALIANZA FRANCESA", nat: "ingreso" },
  { id: "colegio-saint-joseph-school", cat: "a-ingresos-clientes", nombre: "COLEGIO SAINT JOSEPH SCHOOL", nat: "ingreso" },
  { id: "colmena", cat: "a-ingresos-clientes", nombre: "COLMENA", nat: "ingreso" },
  { id: "compass", cat: "a-ingresos-clientes", nombre: "COMPASS", nat: "ingreso" },
  { id: "consalud", cat: "a-ingresos-clientes", nombre: "CONSALUD", nat: "ingreso" },
  { id: "copec", cat: "a-ingresos-clientes", nombre: "COPEC", nat: "ingreso" },
  { id: "dfsi", cat: "a-ingresos-clientes", nombre: "DFSI", nat: "ingreso" },
  { id: "division-andina", cat: "a-ingresos-clientes", nombre: "DIVISIÓN ANDINA", nat: "ingreso" },
  { id: "division-salvador", cat: "a-ingresos-clientes", nombre: "DIVISIÓN SALVADOR", nat: "ingreso" },
  { id: "duoc-uc", cat: "a-ingresos-clientes", nombre: "DUOC UC", nat: "ingreso" },
  { id: "echeverria-izquierdo", cat: "a-ingresos-clientes", nombre: "ECHEVERRÍA IZQUIERDO", nat: "ingreso" },
  { id: "ecometales", cat: "a-ingresos-clientes", nombre: "ECOMETALES", nat: "ingreso" },
  { id: "edf", cat: "a-ingresos-clientes", nombre: "EDF", nat: "ingreso" },
  { id: "egt", cat: "a-ingresos-clientes", nombre: "EGT", nat: "ingreso" },
  { id: "el-mercurio", cat: "a-ingresos-clientes", nombre: "EL MERCURIO", nat: "ingreso" },
  { id: "emin", cat: "a-ingresos-clientes", nombre: "EMIN", nat: "ingreso" },
  { id: "empresas-demaria", cat: "a-ingresos-clientes", nombre: "EMPRESAS DEMARIA", nat: "ingreso" },
  { id: "empresas-salcobrand", cat: "a-ingresos-clientes", nombre: "EMPRESAS SALCOBRAND", nat: "ingreso" },
  { id: "empresas-sb", cat: "a-ingresos-clientes", nombre: "EMPRESAS SB", nat: "ingreso" },
  { id: "empresas-socovesa", cat: "a-ingresos-clientes", nombre: "EMPRESAS SOCOVESA", nat: "ingreso" },
  { id: "enap", cat: "a-ingresos-clientes", nombre: "ENAP", nat: "ingreso" },
  { id: "energia-rio-claro", cat: "a-ingresos-clientes", nombre: "ENERGÍA RÍO CLARO", nat: "ingreso" },
  { id: "entel", cat: "a-ingresos-clientes", nombre: "ENTEL", nat: "ingreso" },
  { id: "enthalpy", cat: "a-ingresos-clientes", nombre: "ENTHALPY", nat: "ingreso" },
  { id: "essbio", cat: "a-ingresos-clientes", nombre: "ESSBIO", nat: "ingreso" },
  { id: "essilorluxottica", cat: "a-ingresos-clientes", nombre: "ESSILORLUXOTTICA", nat: "ingreso" },
  { id: "essity", cat: "a-ingresos-clientes", nombre: "ESSITY", nat: "ingreso" },
  { id: "esval", cat: "a-ingresos-clientes", nombre: "ESVAL", nat: "ingreso" },
  { id: "evol", cat: "a-ingresos-clientes", nombre: "EVOL", nat: "ingreso" },
  { id: "falabella", cat: "a-ingresos-clientes", nombre: "FALABELLA", nat: "ingreso" },
  { id: "fedefruta", cat: "a-ingresos-clientes", nombre: "FEDEFRUTA", nat: "ingreso" },
  { id: "ferradanehme", cat: "a-ingresos-clientes", nombre: "FERRADANEHME", nat: "ingreso" },
  { id: "finix", cat: "a-ingresos-clientes", nombre: "FINIX", nat: "ingreso" },
  { id: "fundacion-belen-educa", cat: "a-ingresos-clientes", nombre: "FUNDACIÓN BELEN EDUCA", nat: "ingreso" },
  { id: "fundacion-gantz", cat: "a-ingresos-clientes", nombre: "FUNDACION GANTZ", nat: "ingreso" },
  { id: "fundacion-nuestros-hijos", cat: "a-ingresos-clientes", nombre: "FUNDACIÓN NUESTROS HIJOS", nat: "ingreso" },
  { id: "furoiani", cat: "a-ingresos-clientes", nombre: "FUROIANI", nat: "ingreso" },
  { id: "goldfield", cat: "a-ingresos-clientes", nombre: "GOLDFIELD", nat: "ingreso" },
  { id: "grupo-rcd", cat: "a-ingresos-clientes", nombre: "GRUPO RCD", nat: "ingreso" },
  { id: "grupo-security", cat: "a-ingresos-clientes", nombre: "GRUPO SECURITY", nat: "ingreso" },
  { id: "grylan", cat: "a-ingresos-clientes", nombre: "GRYLAN", nat: "ingreso" },
  { id: "gtd", cat: "a-ingresos-clientes", nombre: "GTD", nat: "ingreso" },
  { id: "hotel-talbot", cat: "a-ingresos-clientes", nombre: "HOTEL TALBOT", nat: "ingreso" },
  { id: "iconstruye", cat: "a-ingresos-clientes", nombre: "ICONSTRUYE", nat: "ingreso" },
  { id: "ieside", cat: "a-ingresos-clientes", nombre: "IESIDE", nat: "ingreso" },
  { id: "iff", cat: "a-ingresos-clientes", nombre: "IFF", nat: "ingreso" },
  { id: "inchcape", cat: "a-ingresos-clientes", nombre: "INCHCAPE", nat: "ingreso" },
  { id: "irade", cat: "a-ingresos-clientes", nombre: "IRADE", nat: "ingreso" },
  { id: "knauf", cat: "a-ingresos-clientes", nombre: "KNAUF", nat: "ingreso" },
  { id: "komatsu", cat: "a-ingresos-clientes", nombre: "KOMATSU", nat: "ingreso" },
  { id: "kpmg-chile", cat: "a-ingresos-clientes", nombre: "KPMG CHILE", nat: "ingreso" },
  { id: "kyndryl", cat: "a-ingresos-clientes", nombre: "KYNDRYL", nat: "ingreso" },
  { id: "laad", cat: "a-ingresos-clientes", nombre: "LAAD", nat: "ingreso" },
  { id: "laboratorio-janssen", cat: "a-ingresos-clientes", nombre: "LABORATORIO JANSSEN", nat: "ingreso" },
  { id: "laboratorios-saval-s-a", cat: "a-ingresos-clientes", nombre: "LABORATORIOS SAVAL S.A.", nat: "ingreso" },
  { id: "larrain-vial", cat: "a-ingresos-clientes", nombre: "LARRAÍN VIAL", nat: "ingreso" },
  { id: "mall-plaza", cat: "a-ingresos-clientes", nombre: "MALL PLAZA", nat: "ingreso" },
  { id: "mas-analytics", cat: "a-ingresos-clientes", nombre: "MAS ANALYTICS", nat: "ingreso" },
  { id: "mas-errazuriz", cat: "a-ingresos-clientes", nombre: "MAS ERRAZURIZ", nat: "ingreso" },
  { id: "masisa", cat: "a-ingresos-clientes", nombre: "MASISA", nat: "ingreso" },
  { id: "metagroup", cat: "a-ingresos-clientes", nombre: "METAGROUP", nat: "ingreso" },
  { id: "metlife", cat: "a-ingresos-clientes", nombre: "METLIFE", nat: "ingreso" },
  { id: "metso-chile", cat: "a-ingresos-clientes", nombre: "METSO CHILE", nat: "ingreso" },
  { id: "minera-florida", cat: "a-ingresos-clientes", nombre: "MINERA FLORIDA", nat: "ingreso" },
  { id: "minsait-indra", cat: "a-ingresos-clientes", nombre: "MINSAIT INDRA", nat: "ingreso" },
  { id: "mitsui-auto-finance", cat: "a-ingresos-clientes", nombre: "MITSUI AUTO FINANCE", nat: "ingreso" },
  { id: "molymet", cat: "a-ingresos-clientes", nombre: "MOLYMET", nat: "ingreso" },
  { id: "monarch", cat: "a-ingresos-clientes", nombre: "MONARCH", nat: "ingreso" },
  { id: "mts", cat: "a-ingresos-clientes", nombre: "MTS", nat: "ingreso" },
  { id: "mutual-de-seguridad", cat: "a-ingresos-clientes", nombre: "MUTUAL DE SEGURIDAD", nat: "ingreso" },
  { id: "nestle", cat: "a-ingresos-clientes", nombre: "NESTLE", nat: "ingreso" },
  { id: "nttdata", cat: "a-ingresos-clientes", nombre: "NTTDATA", nat: "ingreso" },
  { id: "ogilvy", cat: "a-ingresos-clientes", nombre: "Ogilvy", nat: "ingreso" },
  { id: "ohl", cat: "a-ingresos-clientes", nombre: "OHL", nat: "ingreso" },
  { id: "old-navy", cat: "a-ingresos-clientes", nombre: "OLD NAVY", nat: "ingreso" },
  { id: "opia-marketing", cat: "a-ingresos-clientes", nombre: "OPIA MARKETING", nat: "ingreso" },
  { id: "oracle", cat: "a-ingresos-clientes", nombre: "ORACLE", nat: "ingreso" },
  { id: "oxiquim", cat: "a-ingresos-clientes", nombre: "OXIQUIM", nat: "ingreso" },
  { id: "papelera-lo-izquierdo", cat: "a-ingresos-clientes", nombre: "PAPELERA LO IZQUIERDO", nat: "ingreso" },
  { id: "parque-arauco", cat: "a-ingresos-clientes", nombre: "PARQUE ARAUCO", nat: "ingreso" },
  { id: "pflp", cat: "a-ingresos-clientes", nombre: "PFLP", nat: "ingreso" },
  { id: "pisquera-de-chile", cat: "a-ingresos-clientes", nombre: "PISQUERA DE CHILE", nat: "ingreso" },
  { id: "plaza-maule", cat: "a-ingresos-clientes", nombre: "PLAZA MAULE", nat: "ingreso" },
  { id: "porsche", cat: "a-ingresos-clientes", nombre: "PORSCHE", nat: "ingreso" },
  { id: "pragmaxion", cat: "a-ingresos-clientes", nombre: "PRAGMAXION", nat: "ingreso" },
  { id: "prestigio", cat: "a-ingresos-clientes", nombre: "PRESTIGIO", nat: "ingreso" },
  { id: "promigas", cat: "a-ingresos-clientes", nombre: "PROMIGAS", nat: "ingreso" },
  { id: "pronto-espacio", cat: "a-ingresos-clientes", nombre: "PRONTO ESPACIO", nat: "ingreso" },
  { id: "prosegur", cat: "a-ingresos-clientes", nombre: "PROSEGUR", nat: "ingreso" },
  { id: "pucobre", cat: "a-ingresos-clientes", nombre: "PUCOBRE", nat: "ingreso" },
  { id: "quimica-latinoamericana", cat: "a-ingresos-clientes", nombre: "QUÍMICA LATINOAMERICANA", nat: "ingreso" },
  { id: "red-igualdad", cat: "a-ingresos-clientes", nombre: "RED IGUALDAD", nat: "ingreso" },
  { id: "ride", cat: "a-ingresos-clientes", nombre: "RIDE", nat: "ingreso" },
  { id: "roche", cat: "a-ingresos-clientes", nombre: "ROCHE", nat: "ingreso" },
  { id: "salfa", cat: "a-ingresos-clientes", nombre: "SALFA", nat: "ingreso" },
  { id: "scotiabank", cat: "a-ingresos-clientes", nombre: "SCOTIABANK", nat: "ingreso" },
  { id: "scretting", cat: "a-ingresos-clientes", nombre: "SCRETTING", nat: "ingreso" },
  { id: "servicio-civil", cat: "a-ingresos-clientes", nombre: "SERVICIO CIVIL", nat: "ingreso" },
  { id: "simon-de-cirene", cat: "a-ingresos-clientes", nombre: "SIMON DE CIRENE", nat: "ingreso" },
  { id: "sinacofi", cat: "a-ingresos-clientes", nombre: "SINACOFI", nat: "ingreso" },
  { id: "sk", cat: "a-ingresos-clientes", nombre: "SK", nat: "ingreso" },
  { id: "sky-airlines", cat: "a-ingresos-clientes", nombre: "SKY AIRLINES", nat: "ingreso" },
  { id: "softys", cat: "a-ingresos-clientes", nombre: "SOFTYS", nat: "ingreso" },
  { id: "southbridge", cat: "a-ingresos-clientes", nombre: "SOUTHBRIDGE", nat: "ingreso" },
  { id: "starken", cat: "a-ingresos-clientes", nombre: "STARKEN", nat: "ingreso" },
  { id: "statkraft", cat: "a-ingresos-clientes", nombre: "STATKRAFT", nat: "ingreso" },
  { id: "sura", cat: "a-ingresos-clientes", nombre: "SURA", nat: "ingreso" },
  { id: "systep", cat: "a-ingresos-clientes", nombre: "SYSTEP", nat: "ingreso" },
  { id: "tanner", cat: "a-ingresos-clientes", nombre: "TANNER", nat: "ingreso" },
  { id: "teck", cat: "a-ingresos-clientes", nombre: "TECK", nat: "ingreso" },
  { id: "testcloud", cat: "a-ingresos-clientes", nombre: "TESTCLOUD", nat: "ingreso" },
  { id: "tgr", cat: "a-ingresos-clientes", nombre: "TGR", nat: "ingreso" },
  { id: "the-coca-cola-company", cat: "a-ingresos-clientes", nombre: "THE COCA-COLA COMPANY", nat: "ingreso" },
  { id: "tigre-ads", cat: "a-ingresos-clientes", nombre: "TIGRE/ADS", nat: "ingreso" },
  { id: "timining", cat: "a-ingresos-clientes", nombre: "TIMINING", nat: "ingreso" },
  { id: "toctoc", cat: "a-ingresos-clientes", nombre: "TOCTOC", nat: "ingreso" },
  { id: "tottus", cat: "a-ingresos-clientes", nombre: "TOTTUS", nat: "ingreso" },
  { id: "transelec", cat: "a-ingresos-clientes", nombre: "TRANSELEC", nat: "ingreso" },
  { id: "trendy", cat: "a-ingresos-clientes", nombre: "TRENDY", nat: "ingreso" },
  { id: "tres-montes", cat: "a-ingresos-clientes", nombre: "TRES MONTES", nat: "ingreso" },
  { id: "triciclos", cat: "a-ingresos-clientes", nombre: "TRICICLOS", nat: "ingreso" },
  { id: "uai", cat: "a-ingresos-clientes", nombre: "UAI", nat: "ingreso" },
  { id: "universidad-adolfo-ibanez", cat: "a-ingresos-clientes", nombre: "UNIVERSIDAD ADOLFO IBAÑEZ", nat: "ingreso" },
  { id: "universidad-de-atacama", cat: "a-ingresos-clientes", nombre: "UNIVERSIDAD DE ATACAMA", nat: "ingreso" },
  { id: "universidad-san-sebastian", cat: "a-ingresos-clientes", nombre: "UNIVERSIDAD SAN SEBASTIAN", nat: "ingreso" },
  { id: "uno-salud", cat: "a-ingresos-clientes", nombre: "UNO SALUD", nat: "ingreso" },
  { id: "vantaz", cat: "a-ingresos-clientes", nombre: "VANTAZ", nat: "ingreso" },
  { id: "vida-camara", cat: "a-ingresos-clientes", nombre: "VIDA CAMARA", nat: "ingreso" },
  { id: "walmart", cat: "a-ingresos-clientes", nombre: "WALMART", nat: "ingreso" },
  { id: "wec", cat: "a-ingresos-clientes", nombre: "WEC", nat: "ingreso" },
  { id: "zurich", cat: "a-ingresos-clientes", nombre: "ZURICH", nat: "ingreso" },
  { id: "otros-ingresos", cat: "b-otros-ingresos", nombre: "Otros ingresos", nat: "ingreso" },
  { id: "prestamos-bancarios", cat: "b-otros-ingresos", nombre: "Prestamos bancarios", nat: "ingreso" },
  { id: "prestamos-relacionadas", cat: "b-otros-ingresos", nombre: "Prestamos relacionadas", nat: "ingreso" },
  { id: "utilidades-colombia", cat: "b-otros-ingresos", nombre: "Utilidades Colombia", nat: "ingreso" },
  { id: "utilidades-peru", cat: "b-otros-ingresos", nombre: "Utilidades Perú", nat: "ingreso" },
  { id: "conferencias", cat: "1-costo-de-venta", nombre: "Conferencias", nat: "operativo" },
  { id: "costos-directos-consultoria", cat: "1-costo-de-venta", nombre: "Costos directos consultoría", nat: "operativo" },
  { id: "costos-directos-consultoria-equipa", cat: "1-costo-de-venta", nombre: "Costos directos consultoría - Equipamiento tecnológico Salvador", nat: "operativo" },
  { id: "costos-directos-consultoria-examen", cat: "1-costo-de-venta", nombre: "Costos directos consultoría - Exámenes y certificaciones Salvador", nat: "operativo" },
  { id: "costos-directos-consultoria-logist", cat: "1-costo-de-venta", nombre: "Costos directos consultoría - Logística Salvador", nat: "operativo" },
  { id: "costos-directos-consultoria-materi", cat: "1-costo-de-venta", nombre: "Costos directos consultoría - Materiales Salvador", nat: "operativo" },
  { id: "distribucion-de-margen", cat: "1-costo-de-venta", nombre: "Distribución de margen", nat: "operativo" },
  { id: "generacion-de-contenido", cat: "1-costo-de-venta", nombre: "Generación de contenido", nat: "operativo" },
  { id: "horas", cat: "1-costo-de-venta", nombre: "Horas", nat: "operativo" },
  { id: "ingreso-minimo-asegurado", cat: "1-costo-de-venta", nombre: "Ingreso mínimo asegurado", nat: "operativo" },
  { id: "jefaturas", cat: "1-costo-de-venta", nombre: "Jefaturas", nat: "operativo" },
  { id: "actividades-aprendizaje-organizaci", cat: "1-desarrollo-organizaciona", nombre: "Actividades aprendizaje organizacional", nat: "inversion" },
  { id: "asesoria-proy-desarrollo-interno", cat: "1-desarrollo-organizaciona", nombre: "AsesorÍa Proy. Desarrollo Interno", nat: "inversion" },
  { id: "asesoria-proyectos-probono", cat: "1-desarrollo-organizaciona", nombre: "Asesoría proyectos Probono", nat: "inversion" },
  { id: "capacitacion-consultores", cat: "1-desarrollo-organizaciona", nombre: "Capacitación Consultores", nat: "operativo" },
  { id: "coalicion-de-cambio", cat: "1-desarrollo-organizaciona", nombre: "Coalición de cambio", nat: "inversion" },
  { id: "consultoria-y-gestion-de-proyectos", cat: "1-desarrollo-organizaciona", nombre: "Consultoría y gestión de proyectos", nat: "inversion" },
  { id: "direccion-ejecutiva", cat: "1-desarrollo-organizaciona", nombre: "Dirección Ejecutiva", nat: "inversion" },
  { id: "proyecto-formacion", cat: "1-desarrollo-organizaciona", nombre: "Proyecto formación", nat: "inversion" },
  { id: "reparto-de-utilidades-anuales", cat: "1-desarrollo-organizaciona", nombre: "Reparto de utilidades anuales", nat: "inversion" },
  { id: "arriendo-oficina", cat: "2-gastos-administracion", nombre: "Arriendo oficina", nat: "operativo" },
  { id: "asesoria-contable", cat: "2-gastos-administracion", nombre: "Asesoría contable", nat: "operativo" },
  { id: "beneficios-personas", cat: "2-gastos-administracion", nombre: "Beneficios personas", nat: "operativo" },
  { id: "caja-chica", cat: "2-gastos-administracion", nombre: "Caja chica", nat: "operativo" },
  { id: "certificaciones", cat: "2-gastos-administracion", nombre: "Certificaciones", nat: "inversion" },
  { id: "contribuciones", cat: "2-gastos-administracion", nombre: "Contribuciones", nat: "operativo" },
  { id: "equipamiento-oficina", cat: "2-gastos-administracion", nombre: "Equipamiento oficina", nat: "inversion" },
  { id: "gastos-comunes", cat: "2-gastos-administracion", nombre: "Gastos comunes", nat: "operativo" },
  { id: "gastos-de-representacion", cat: "2-gastos-administracion", nombre: "Gastos de representación", nat: "operativo" },
  { id: "gastos-legales", cat: "2-gastos-administracion", nombre: "Gastos legales", nat: "operativo" },
  { id: "insumos-oficina", cat: "2-gastos-administracion", nombre: "Insumos oficina", nat: "operativo" },
  { id: "jornadas-y-eventos-organizacion", cat: "2-gastos-administracion", nombre: "Jornadas y eventos organizacion", nat: "operativo" },
  { id: "offsite-internacional", cat: "2-gastos-administracion", nombre: "Offsite internacional", nat: "operativo" },
  { id: "mant-y-reparacion-oficina", cat: "2-gastos-administracion", nombre: "Mant. y Reparación oficina", nat: "operativo" },
  { id: "patente-comercial", cat: "2-gastos-administracion", nombre: "Patente comercial", nat: "operativo" },
  { id: "telefonia-e-internet", cat: "2-gastos-administracion", nombre: "Telefonía e internet", nat: "operativo" },
  { id: "agencia-comunicaciones", cat: "2-0-comercial-y-marketing", nombre: "Agencia comunicaciones", nat: "inversion" },
  { id: "alianzas-estudios-y-relacionamient", cat: "2-0-comercial-y-marketing", nombre: "Alianzas, estudios y relacionamiento", nat: "inversion" },
  { id: "asistencia-a-eventos", cat: "2-0-comercial-y-marketing", nombre: "Asistencia a eventos", nat: "operativo" },
  { id: "estudios-publicos", cat: "2-0-comercial-y-marketing", nombre: "Estudios públicos", nat: "inversion" },
  { id: "eventos-propios", cat: "2-0-comercial-y-marketing", nombre: "Eventos propios", nat: "inversion" },
  { id: "gastos-de-marketing", cat: "2-0-comercial-y-marketing", nombre: "Gastos de marketing", nat: "operativo" },
  { id: "marketing-digital", cat: "2-0-comercial-y-marketing", nombre: "Marketing digital", nat: "inversion" },
  { id: "medios-digitales", cat: "2-0-comercial-y-marketing", nombre: "Medios digitales", nat: "operativo" },
  { id: "pagina-web", cat: "2-0-comercial-y-marketing", nombre: "Página web", nat: "inversion" },
  { id: "branding-y-merchandising", cat: "2-1-posicionamiento-nueva", nombre: "Branding y merchandising", nat: "inversion" },
  { id: "difusion-nueva-marca", cat: "2-1-posicionamiento-nueva", nombre: "Difusión nueva marca", nat: "inversion" },
  { id: "nueva-marca-organizacional", cat: "2-1-posicionamiento-nueva", nombre: "Nueva marca organizacional", nat: "inversion" },
  { id: "2-1-posicionamiento-nueva-pagina-web", cat: "2-1-posicionamiento-nueva", nombre: "Pagina web", nat: "inversion" },
  { id: "registro-legales-nueva-marca", cat: "2-1-posicionamiento-nueva", nombre: "Registro legales nueva marca", nat: "inversion" },
  { id: "garantias", cat: "2-2-compra-activos", nombre: "Garantías", nat: "inversion" },
  { id: "infraestructura", cat: "2-2-compra-activos", nombre: "Infraestructura", nat: "inversion" },
  { id: "legales-y-puesta-en-marcha", cat: "2-2-compra-activos", nombre: "Legales y puesta en marcha", nat: "inversion" },
  { id: "muebles-y-enseres", cat: "2-2-compra-activos", nombre: "Muebles y enseres", nat: "inversion" },
  { id: "propiedades-oficina", cat: "2-2-compra-activos", nombre: "Propiedades (Oficina)", nat: "inversion" },
  { id: "gastos-sistemas-digitales", cat: "2-3-gastos-sistemas-digita", nombre: "Gastos sistemas digitales", nat: "operativo" },
  { id: "sistemas-analitica-avanzada-ia-y-r", cat: "2-3-gastos-sistemas-digita", nombre: "Sistemas Analítica avanzada, IA y Relac.", nat: "operativo" },
  { id: "sistemas-diseno", cat: "2-3-gastos-sistemas-digita", nombre: "Sistemas Diseño", nat: "inversion" },
  { id: "sistemas-operaciones", cat: "2-3-gastos-sistemas-digita", nombre: "Sistemas Operaciones", nat: "operativo" },
  { id: "sistemas-operaciones-y-finanzas", cat: "2-3-gastos-sistemas-digita", nombre: "Sistemas Operaciones y Finanzas", nat: "operativo" },
  { id: "equipos-computacionales", cat: "2-4-equipos-computacionale", nombre: "Equipos Computacionales", nat: "inversion" },
  { id: "mantenimiento-equipos", cat: "2-4-equipos-computacionale", nombre: "Mantenimiento Equipos", nat: "operativo" },
  { id: "capacitacion-del-personal", cat: "3-recursos-humanos", nombre: "Capacitación del personal", nat: "inversion" },
  { id: "finiquitos", cat: "3-recursos-humanos", nombre: "Finiquitos", nat: "operativo" },
  { id: "imposiciones", cat: "3-recursos-humanos", nombre: "Imposiciones", nat: "operativo" },
  { id: "jornadas-y-eventos-equipo-interno", cat: "3-recursos-humanos", nombre: "Jornadas y eventos equipo interno", nat: "operativo" },
  { id: "servicios-externos-rr-hh", cat: "3-recursos-humanos", nombre: "Servicios externos RR.HH", nat: "operativo" },
  { id: "sueldos", cat: "3-recursos-humanos", nombre: "Sueldos", nat: "operativo" },
  { id: "impuesto-a-la-renta", cat: "4-impuestos", nombre: "Impuesto a la renta", nat: "operativo" },
  { id: "iva-compras", cat: "4-impuestos", nombre: "IVA compras", nat: "operativo" },
  { id: "iva-mensual", cat: "4-impuestos", nombre: "IVA mensual", nat: "operativo" },
  { id: "retencion-bhe", cat: "4-impuestos", nombre: "Retención BHE", nat: "operativo" },
  { id: "comisiones-bancarias", cat: "5-bancos", nombre: "Comisiones bancarias", nat: "operativo" },
  { id: "tarjeta-de-credito", cat: "5-bancos", nombre: "Tarjeta de credito", nat: "operativo" },
  { id: "traspaso-entre-empresas", cat: "5-bancos", nombre: "Traspaso entre empresas", nat: "operativo" },
  { id: "prestamos-bancarios-pago", cat: "6-prestamos-bancarios", nombre: "Prestamos bancarios (pago)", nat: "operativo" },
  { id: "depositos-a-plazo", cat: "7-inversiones", nombre: "Depositos a plazo", nat: "operativo" },
  { id: "firmex", cat: "7-inversiones", nombre: "Firmex", nat: "operativo" },
  { id: "fondos-mutuos", cat: "7-inversiones", nombre: "Fondos mutuos", nat: "operativo" },
  { id: "invexor", cat: "7-inversiones", nombre: "Invexor", nat: "operativo" },
  { id: "poliglota", cat: "7-inversiones", nombre: "Poliglota", nat: "operativo" },
  { id: "adapsys-miami", cat: "8-relacionados-y-socios", nombre: "Adapsys Miami", nat: "operativo" },
  { id: "cuenta-corriente-peru-chile", cat: "8-relacionados-y-socios", nombre: "Cuenta corriente Perú-Chile", nat: "operativo" },
  { id: "participacion-comite", cat: "8-relacionados-y-socios", nombre: "Participación Comité", nat: "operativo" },
  { id: "prestamos-socios", cat: "8-relacionados-y-socios", nombre: "Préstamos socios", nat: "operativo" },
  { id: "retiros-socios", cat: "8-relacionados-y-socios", nombre: "Retiros socios", nat: "operativo" },
];

const S = {
  sueldos: "sueldos", honor: "horas", sistop: "arriendo-oficina", comis: "comisiones-bancarias",
  contab: "asesoria-contable", tarjeta: "tarjeta-de-credito", licencias: "sistemas-operaciones-y-finanzas",
  analitica: "sistemas-analitica-avanzada-ia-y-r", cdir: "costos-directos-consultoria",
  viajes: "gastos-de-representacion", mkt: "marketing-digital", iva: "iva-mensual",
  finiq: "finiquitos", retiros: "retiros-socios", capacit: "capacitacion-del-personal",
  estudios: "estudios-publicos", eventos: "eventos-propios", plataforma: "gastos-sistemas-digitales",
  alianzas: "alianzas-estudios-y-relacionamient", otring: "otros-ingresos",
  desorg1: "direccion-ejecutiva", recluta: "servicios-externos-rr-hh", infra: "equipos-computacionales",
  cobranza: "bhp-billiton", cobranza2: "consalud", cobranza3: "codelco",
};
const R = (id) => S[id] || id;

const Cat = createContext(null);
const useCat = () => useContext(Cat);
const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 44) || "x";

/* Importador: soporta "Categoría:Subcategoría", listas indentadas,
   marcadores de sección (Gastos de Inversión / Gastos Operativos / Ingresos)
   y el sufijo (inversión) o (operativo) por categoría. */
function parseCatalogo(txt) {
  const cats = [], subs = [];
  let nat = "operativo", ultimo = null;
  const addCat = (nombre) => {
    const id = slug(nombre);
    if (!cats.find((c) => c.id === id)) cats.push({ id, nombre: nombre.trim(), controlado: true });
    return id;
  };
  const addSub = (catId, nombre, natSub) => {
    const id = slug(catId + "-" + nombre);
    if (!subs.find((s) => s.id === id)) subs.push({ id, cat: catId, nombre: nombre.trim(), nat: natSub || nat });
  };
  txt.split(/\r?\n/).forEach((raw) => {
    if (!raw.trim()) return;
    const indentado = /^[\t ]+\S/.test(raw);
    const linea = raw.trim().replace(/^[-•*#]\s*/, "");
    if (!indentado && /^total/i.test(linea)) return;
    if (!indentado && /^(gastos?\s+de\s+inversi|inversi[oó]n)/i.test(linea) && !linea.includes(":")) { nat = "inversion"; ultimo = null; return; }
    if (!indentado && /^gastos?\s+operativ/i.test(linea) && !linea.includes(":")) { nat = "operativo"; ultimo = null; return; }
    if (!indentado && /^(ingresos?|inflows?)$/i.test(linea)) { nat = "ingreso"; ultimo = null; return; }
    if (!indentado && /^(egresos?|outflows?)$/i.test(linea)) { nat = "operativo"; ultimo = null; return; }
    let natLinea = null;
    if (/\(\s*inversi[oó]n\s*\)/i.test(linea)) natLinea = "inversion";
    else if (/\(\s*operativ[oa]s?\s*\)/i.test(linea)) natLinea = "operativo";
    else if (/\(\s*ingresos?\s*\)/i.test(linea)) natLinea = "ingreso";
    const limpio = linea.replace(/\(\s*(inversi[oó]n|operativ[oa]s?|ingresos?|egresos?)\s*\)/gi, "").trim();
    if (!limpio) return;
    if (limpio.includes(":")) {
      const [p, ...r] = limpio.split(":");
      const cid = addCat(p);
      const hijo = r.join(":").trim();
      if (hijo) addSub(cid, hijo, natLinea);
      ultimo = cid;
    } else if (indentado && ultimo) addSub(ultimo, limpio, natLinea);
    else { ultimo = addCat(limpio); if (natLinea) nat = natLinea; }
  });
  cats.forEach((c) => { if (!subs.some((s) => s.cat === c.id)) addSub(c.id, c.nombre); });
  return { cats, subs };
}

/* ─────────────────────────  DATOS DE EJEMPLO  ───────────────────────── */
const hoy = new Date(AÑO, 7, 20);
const d = (dd, mm) => new Date(AÑO, mm - 1, dd).toISOString().slice(0, 10);
const rnd = (s) => { const x = Math.sin(s) * 10000; return x - Math.floor(x); };

const RECUR = [
  { sub: "sueldos", empresa: "adap", dia: 25, base: -10428100, v: .03, payee: "Sueldos", memo: "Sueldos CLA Adaptación", f: 1.02 },
  { sub: "sueldos", empresa: "clting", dia: 25, base: -400000, v: .02, payee: "Sueldos", memo: "Sueldos CLA Consulting", f: 1.02 },
  { sub: "honor", empresa: "adap", dia: 20, base: -1815955, v: .22, payee: "Honorarios equipo", memo: "Boletas honorarios", f: .92 },
  { sub: "honor", empresa: "cons", dia: 27, base: -2966250, v: .14, payee: "Carolina Yachan", memo: "Servicio directora ejecutiva", f: .92 },
  { sub: "sistop", empresa: "adap", dia: 20, base: -3408866, v: .11, payee: "Arriendo y sistemas", memo: "Oficina, servicios", f: 1.05 },
  { sub: "comis", empresa: "adap", dia: 26, base: -50000, v: .3, payee: "Banco Santander", memo: "Comisiones", f: 1.2 },
  { sub: "contab", empresa: "cons", dia: 27, base: -1200000, v: 0, payee: "Luis Palomino", memo: "Servicio contabilidad", f: 1 },
  { sub: "tarjeta", empresa: "adap", dia: 20, base: -411367, v: .38, payee: "Mastercard Pesos 7184", memo: "Estado de cuenta", f: .85 },
  { sub: "licencias", empresa: "adap", dia: 20, base: -680000, v: .15, payee: "Buk, Entel, otros", memo: "Licencias y suscripciones", f: 1.05 },
  { sub: "analitica", empresa: "adap", dia: 18, base: -820000, v: .3, payee: "Anthropic / Cloud", memo: "Analítica avanzada e IA", f: 1.1 },
  { sub: "cdir", empresa: "cons", dia: 15, base: -4200000, v: .33, payee: "Proveedores consultoría", memo: "Costos directos proyectos", f: 1.15 },
  { sub: "viajes", empresa: "cons", dia: 12, base: -380000, v: .5, payee: "Traslados y hotelería", memo: "Viajes terreno", f: 1.3 },
  { sub: "mkt", empresa: "cons", dia: 25, base: -424830, v: .4, payee: "Marketing Digital", memo: "Convenio comunicaciones", f: 1.1 },
  { sub: "iva", empresa: "adap", dia: 30, base: -6800000, v: .2, payee: "Tesorería General", memo: "IVA y PPM", f: 1 },
  { sub: "cobranza", empresa: "adap", dia: 5, base: 38000000, v: .18, payee: "BHP Chile", memo: "Programa ALT", f: 1.08 },
  { sub: "cobranza2", empresa: "cons", dia: 15, base: 14000000, v: .28, payee: "Consalud", memo: "Adopción IA", f: 1.08 },
  { sub: "cobranza3", empresa: "clting", dia: 10, base: 3200000, v: .4, payee: "Clientes varios", memo: "Facturación", f: 1.08 },
  { sub: "cdir", empresa: "ctria", dia: 18, base: -640000, v: .45, payee: "Proveedores", memo: "Costos consultoría", f: 1 },
  { sub: "cobranza", empresa: "ctria", dia: 20, base: 1800000, v: .35, payee: "Clientes varios", memo: "Facturación", f: 1 },
  { sub: "retiros", empresa: "adap", dia: 20, base: -20000000, v: 0, meses: [3, 6, 8], payee: "Socios", memo: "Retiros socios", f: 1 },
  { sub: "capacit", empresa: "adap", dia: 14, base: -650000, v: .6, payee: "Capacitaciones", memo: "Formación equipo", f: 1, meses: [3, 5, 7] },
  { sub: "estudios", empresa: "cons", dia: 22, base: -1400000, v: .3, payee: "Estudio público", memo: "Estudio de mercado", f: 1, meses: [4, 7] },
];

let _n = 0;
const mv = (fecha, empresa, payee, memo, sub, monto, extra = {}) => ({
  id: "m" + ++_n, fecha, empresa, payee, memo, sub: R(sub), monto,
  moneda: "CLP", tc: 1, estado: "proyectado", cuenta: null, ...extra,
});
/* boleta de honorarios: el neto pagado se abre en bruto + retención */
const TASAS_INI = { iva: 0.19, bhe: 0.1525 }; // verificar la retención vigente en el SII
const pct = (t) => (t * 100).toFixed(2).replace(/[.,]?0+$/, "").replace(".", ",") + "%";

/* Boleta de honorarios: se ingresa el BRUTO, la retención se resta y da el líquido a pagar. */
const bhe = (bruto, subBruto = "horas", tasa = TASAS_INI.bhe) => {
  const ret = Math.round(-bruto * tasa);
  return { monto: bruto + ret, lineas: [
    { sub: R(subBruto), monto: bruto, glosa: "Bruto" },
    { sub: "retencion-bhe", monto: ret, glosa: `Retención ${pct(tasa)}` }] };
};
/* Factura afecta: se ingresa el NETO, el IVA se suma y da el total a pagar. */
const conIva = (neto, subNeto, tasa = TASAS_INI.iva) => {
  const iva = Math.round(neto * tasa);
  return { monto: neto + iva, lineas: [
    { sub: R(subNeto), monto: neto, glosa: "Neto" },
    { sub: "iva-compras", monto: iva, glosa: `IVA ${pct(tasa)}` }] };
};
/* un movimiento repartido en varias subcategorías */
const split = (...pares) => ({ lineas: pares.map(([sub, monto, glosa]) => ({ sub: R(sub), monto, glosa })) });

/* Cada movimiento aporta una o varias líneas al análisis por subcategoría. */
const expandir = (ms) => ms.flatMap((m) =>
  m.lineas?.length ? m.lineas.map((l, i) => ({ ...m, sub: l.sub, monto: l.monto, glosa: l.glosa, _padre: m.id, _linea: i })) : [m]);

const HISTORICO = (() => {
  const out = [];
  RECUR.forEach((r, ri) => {
    for (let m = 1; m <= 8; m++) {
      if (r.meses && !r.meses.includes(m)) continue;
      if (m === 8 && r.dia >= 20) continue;
      const monto = Math.round((r.base * (1 + (rnd(ri * 31 + m * 7) - .5) * 2 * r.v)) / 1000) * 1000;
      out.push(mv(d(Math.min(r.dia, 28), m), r.empresa, r.payee,
        `${r.memo} ${String(m).padStart(2, "0")}-${AÑO}`, r.sub, monto, { estado: "conciliado" }));
    }
  });
  return out;
})();

const PROYECTADO = [
  mv(d(20, 8), "adap", "Buk", "FA334125 Plataforma personas 2,6UF más IVA", "licencias", 0, conIva(-109244, "licencias")),
  mv(d(14, 8), "adap", "GTD", "FA3109609 Internet oficina", "telefonia-e-internet", -365026,
    { lineas: [{ sub: "telefonia-e-internet", monto: -306745, glosa: "Neto" }, { sub: "iva-compras", monto: -58281, glosa: "IVA 19%" }] }),
  mv(d(14, 8), "adap", "Empresa Social de Ca...", "FA174272 Agua Purificada oficina", "gastos-comunes", 0, conIva(-40921, "gastos-comunes")),
  mv(d(20, 8), "adap", "ENTEL", "FA54068286 Plan celulares", "licencias", -78866),
  mv(d(20, 8), "adap", "Mastercard Pesos 7184", "TARJETA ESTADO CUENTA PESOS", "tarjeta", -411367, split(["gastos-sistemas-digitales", -96400, "Anthropic Claude"], ["gastos-sistemas-digitales", -49900, "Google Workspace"],
    ["insumos-oficina", -60000, "Librería Nacional"], ["gastos-de-representacion", -132967, "Almuerzos cliente"],
    ["caja-chica", -72100, "Uber corporativo"])),
  mv(d(20, 8), "adap", "Juan Carlos Eichholz", "Retiros socios", "retiros", -20000000),
  mv(d(20, 8), "adap", "Juan Ignacio Court", "B113 Honorarios 07-2026", "honor", 0, bhe(-418251)),
  mv(d(20, 8), "adap", "Magdalena Toral", "B405 Honorarios 07-2026", "honor", 0, bhe(-1253118)),
  mv(d(20, 8), "adap", "Oscar Clark", "B10 Honorarios 07-2026", "honor", 0, bhe(-471350)),
  mv(d(20, 8), "cons", "Valle Alto SpA", "FA109 Utilidades IA Consalud — Adopción etapa I", "cdir", -5276448),
  mv(d(20, 8), "cons", "Alexandra Montenegro", "B1060679 Traslados BHP Jornada ALT", "viajes", -74645),
  mv(d(20, 8), "adap", "Hotel Antofagasta SpA", "FA90602 Hotel BHP — Taller ALT Escondida", "viajes", -202300),
  mv(d(20, 8), "cons", "Caja Mágica", "FAXX Lápices Adapsys", "mkt", -424830),
  mv(d(25, 8), "adap", "Sueldos", "Sueldos CLA Adaptación", "sueldos", -10428100),
  mv(d(25, 8), "cons", "Comunicación y Marketing Digital", "SALDO 50% FA3419 Convenio 2025-2026 Web", "mkt", -148750),
  mv(d(25, 8), "adap", "Andrés Gebauer", "Indemnización demanda", "finiq", -30000000),
  mv(d(26, 8), "adap", "Banco Santander", "Comisión transferencia de fondos", "comis", -50000),
  mv(d(27, 8), "cons", "Luis Palomino", "BXX Servicio contabilidad", "contab", -1200000),
  mv(d(27, 8), "cons", "Carolina Yachan", "Servicio directora ejecutiva Adapsys", "honor", 0, bhe(-3500000, "direccion-ejecutiva")),
  mv(d(28, 8), "clting", "Sueldos", "Sueldos CLA Consulting", "sueldos", -400000),
  mv(d(31, 8), "adap", "Tesorería General", "IVA agosto 2026", "iva", -8400000),
  mv(d(3, 9), "adap", "BHP Chile", "FA1204 Programa ALT — cuota 3", "cobranza", 42500000),
  mv(d(5, 9), "cons", "Consalud", "FA109 Adopción IA etapa I", "cobranza2", 18900000),
  mv(d(10, 9), "adap", "Arriendo oficina", "Canon septiembre", "sistop", -3200000),
  mv(d(12, 9), "adap", "Desarrollo plataforma", "Sprint 3 portal clientes", "plataforma", -2400000),
  mv(d(15, 9), "cons", "Codelco", "FA1188 Diagnóstico cultural", "cobranza3", 12400000, { moneda: "USD", tc: 970, monto: 12784 }),
  mv(d(25, 9), "adap", "Sueldos", "Sueldos CLA Adaptación", "sueldos", -10428100),
  mv(d(25, 9), "clting", "Sueldos", "Sueldos CLA Consulting", "sueldos", -400000),
  mv(d(30, 9), "adap", "Tesorería General", "IVA septiembre 2026", "iva", -6100000),
  mv(d(8, 10), "adap", "BHP Chile", "FA1210 Programa ALT — cuota 4", "cobranza", 42500000),
  mv(d(15, 10), "adap", "Evento anual", "Encuentro clientes 2026", "eventos", -1000000),
  mv(d(20, 10), "sm", "Contribuciones", "Contribuciones Santa María Q4", "sistop", -1850000),
  mv(d(25, 10), "adap", "Sueldos", "Sueldos CLA Adaptación", "sueldos", -10428100),
  mv(d(25, 10), "clting", "Sueldos", "Sueldos CLA Consulting", "sueldos", -400000),
  mv(d(30, 10), "adap", "Tesorería General", "IVA octubre 2026", "iva", -7200000),
  mv(d(15, 11), "cons", "Consalud", "FA112 Adopción IA etapa II", "cobranza2", 16400000),
  mv(d(25, 11), "adap", "Sueldos", "Sueldos CLA Adaptación", "sueldos", -10428100),
  mv(d(20, 12), "adap", "Socios", "Retiros socios diciembre", "retiros", -20000000),
  mv(d(25, 12), "adap", "Sueldos", "Sueldos + aguinaldo", "sueldos", -14600000),
  ...[8, 9, 10, 11, 12].map((m) => mv(d(18, m), "adap", "Mastercard dólar 7184", `TARJETA ESTADO CUENTA DOLAR ${String(m).padStart(2, "0")}-2026`, "tarjeta", m === 8 ? -1112.85 : -829.94, { moneda: "USD", tc: 0 })),
  ...[8, 9, 10, 11, 12].map((m) => mv(d(26, m), "cons", "Irina Cayo", `BXX Sueldo ${MESC[m - 1]} 2026`, "sueldos", -200, { moneda: "USD", tc: 0 })),
  { id: "u27a", fecha: "2027-01-18", empresa: "adap", payee: "Mastercard dólar 7184", memo: "TARJETA ESTADO CUENTA DOLAR 01-2027", sub: "tarjeta-de-credito", monto: -829.94, moneda: "USD", tc: 0, estado: "proyectado", cuenta: null },
  { id: "u27b", fecha: "2027-01-26", empresa: "cons", payee: "Irina Cayo", memo: "BXX Sueldo enero 2027", sub: "sueldos", monto: -200, moneda: "USD", tc: 0, estado: "proyectado", cuenta: null },
];

/* presupuesto CONSOLIDADO de las 4 empresas Adapsys: una línea por subcategoría */
const PPTO_INI = (() => {
  const p = {};
  RECUR.forEach((r) => {
    if (!IDS_ADAPSYS.includes(r.empresa)) return;
    const meses = r.meses ? r.meses.length : 12;
    const anual = Math.round((r.base * meses * r.f) / 100000) * 100000;
    const sid = R(r.sub);
    p[sid] = p[sid] || { monto: 0, anterior: 0, resp: "", nota: "" };
    p[sid].monto += anual;
  });
  const set = (sub0, monto, anterior, resp, nota) => (p[R(sub0)] = { monto, anterior, resp: resp || "", nota: nota || "" });
  set("alianzas", 0, 0, "Comercial", "");
  set("eventos", -1000000, -3000000, "I+D", "Se deja previsión base");
  set("estudios", -5000000, -12000000, "I+D", "");
  set("desorg1", -500000, -3000000, "Gerencia", "");
  set("capacit", -1000000, -1600000, "Personas", "");
  set("recluta", -500000, -800000, "Personas", "");
  set("plataforma", -2850000, -3400000, "I+D", "Portal clientes");
  set("infra", -1000000, -1442000, "I+D", "");
  set("otring", 0, 0, "Finanzas", "");
  const ant0 = { sueldos: 1.06, honor: 1.14, sistop: .95, comis: .82, contab: 1, tarjeta: 1.22, licencias: 1.02,
    analitica: 1.11, cdir: .89, viajes: .78, mkt: 3.62, iva: .97, cobranza: .93, retiros: 1 };
  Object.keys(p).forEach((k) => {
    const alias = Object.keys(S).find((a) => S[a] === k) || k;
    if (p[k].anterior === 0 && ant0[alias]) p[k].anterior = Math.round((p[k].monto * ant0[alias]) / 100000) * 100000;
    if (!p[k].resp) p[k].resp = { sueldos: "Personas", honor: "Personas", sistop: "Finanzas", comis: "Finanzas",
      contab: "Finanzas", tarjeta: "Finanzas", licencias: "I+D", analitica: "Analítica avanzada",
      cdir: "Comercial", viajes: "Comercial", mkt: "I+D", iva: "Finanzas", cobranza: "Comercial", retiros: "Gerencia" }[alias] || "";
  });
  p[R("mkt")].nota = "Se incorpora SEM aprox USD 1.200";
  p[R("analitica")].nota = "Licencias IA y fondo manejador base de datos";
  p[R("tarjeta")].nota = "Se ajusta a la baja tras cambio de política";
  return p;
})();

/* ─────────────────────────  UTIL  ───────────────────────── */
const clp = (n) => (n < 0 ? "−" : "") + Math.round(Math.abs(n)).toLocaleString("es-CL");
const mag = (n) => Math.round(Math.abs(n)).toLocaleString("es-CL");
const clpK = (n) => {
  const a = Math.abs(n), s = n < 0 ? "−" : "";
  if (a >= 1e6) return s + (a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(".", ",") + "M";
  if (a >= 1e3) return s + Math.round(a / 1e3) + "k";
  return a === 0 ? "—" : s + Math.round(a);
};
const enCLP = (m) => (m.moneda === "USD" ? m.monto * (m.tc || TC_USD) : m.monto);
const ctaCLP = (c) => (c.moneda === "USD" ? c.saldo * TC_USD : c.saldo);
const lunesDe = (dt) => { const x = new Date(dt); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); x.setHours(0, 0, 0, 0); return x; };
const iso = (dt) => dt.toISOString().slice(0, 10);
const addD = (dt, n) => { const x = new Date(dt); x.setDate(x.getDate() + n); return x; };
const etiqSem = (dt) => `${dt.getDate()} ${MESC[dt.getMonth()]}`;
const pctAño = (() => { const i = new Date(AÑO, 0, 1); return (hoy - i) / (new Date(AÑO + 1, 0, 1) - i); })();

const RANGOS = [
  { id: "ytd", nombre: "Año en curso", calc: () => [`${AÑO}-01-01`, iso(hoy)] },
  { id: "año", nombre: "Año completo", calc: () => [`${AÑO}-01-01`, `${AÑO}-12-31`] },
  { id: "mes", nombre: "Mes actual", calc: () => [iso(new Date(AÑO, hoy.getMonth(), 1)), iso(new Date(AÑO, hoy.getMonth() + 1, 0))] },
  { id: "trim", nombre: "Trimestre actual", calc: () => { const t = Math.floor(hoy.getMonth() / 3); return [iso(new Date(AÑO, t * 3, 1)), iso(new Date(AÑO, t * 3 + 3, 0))]; } },
  { id: "u12", nombre: "Últimos 12 meses", calc: () => [iso(new Date(AÑO - 1, hoy.getMonth(), hoy.getDate())), iso(hoy)] },
  { id: "fut", nombre: "De hoy en adelante", calc: () => [iso(hoy), `${AÑO}-12-31`] },
  { id: "p12", nombre: "Próximos 12 meses", calc: () => [iso(hoy), iso(new Date(AÑO + 1, hoy.getMonth(), hoy.getDate()))] },
];

/* ─────────────────────────  APP  ───────────────────────── */
export default function Tesoreria() {
  const [movs, setMovs] = useState([...HISTORICO, ...PROYECTADO]);
  const [cuentas, setCuentas] = useState(CUENTAS);
  const [ppto, setPpto] = useState(PPTO_INI);
  const [cats, setCats] = useState(CATS_INI);
  const [subs, setSubs] = useState(SUBS_INI);
  const [reportes, setReportes] = useState([]);
  const [sel, setSel] = useState(IDS_ADAPSYS);
  const [subsPpto, setSubsPpto] = useState(SUBS_INI.filter((s) => CATS_INI.find((c) => c.id === s.cat)?.controlado).map((s) => s.id));
  const [tc, setTc] = useState(TC_USD);
  const [tasas, setTasas] = useState(TASAS_INI);
  const [vista, setVista] = useState("flujo");
  const [cargando, setCargando] = useState(true);

  const setters = { movs: setMovs, cuentas: setCuentas, ppto: setPpto, cats: setCats, subs: setSubs, reportes: setReportes, sel: setSel, subsPpto: setSubsPpto, tc: setTc, tasas: setTasas };
  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("tesoreria:v4");
        if (r?.value) {
          const p = JSON.parse(r.value);
          Object.keys(setters).forEach((k) => { if (p[k]) setters[k](p[k]); });
        }
      } catch (e) { /* primera carga */ }
      setCargando(false);
    })();
  }, []);
  useEffect(() => {
    if (cargando) return;
    window.storage.set("tesoreria:v4", JSON.stringify({ movs, cuentas, ppto, cats, subs, reportes, sel, subsPpto, tc, tasas })).catch(() => {});
  }, [movs, cuentas, ppto, cats, subs, reportes, sel, subsPpto, tc, tasas, cargando]);

  const reiniciar = async () => {
    try { await window.storage.delete("tesoreria:v4"); } catch (e) {}
    setMovs([...HISTORICO, ...PROYECTADO]); setCuentas(CUENTAS); setPpto(PPTO_INI);
    setCats(CATS_INI); setSubs(SUBS_INI); setReportes([]); setSel(IDS_ADAPSYS);
    setSubsPpto(SUBS_INI.filter((s) => CATS_INI.find((c) => c.id === s.cat)?.controlado).map((s) => s.id));
    setTc(TC_USD); setTasas(TASAS_INI);
  };

  const ctx = useMemo(() => {
    const subDe = (id) => subs.find((s) => s.id === id) || { id, cat: "__nc", nombre: "Sin clasificar" };
    const catDe = (id) => cats.find((c) => c.id === id) || { id: "__nc", nombre: "Sin clasificar", controlado: false };
    return { cats, subs, setCats, setSubs, subDe, catDe,
      subsDe: (cid, nat) => subs.filter((s) => s.cat === cid && (!nat || s.nat === nat)),
      catsDe: (nat) => cats.filter((c) => subs.some((s) => s.cat === c.id && s.nat === nat)) };
  }, [cats, subs]);

  const fMovs = useMemo(() => movs.filter((m) => sel.includes(m.empresa)), [movs, sel]);
  const fCtas = useMemo(() => cuentas.filter((c) => sel.includes(c.empresa)), [cuentas, sel]);
  const bancos = fCtas.filter((c) => c.tipo === "banco");
  const efectivo = bancos.filter((c) => c.moneda === "CLP").reduce((s, c) => s + c.saldo, 0);
  const usd = bancos.filter((c) => c.moneda === "USD").reduce((s, c) => s + c.saldo, 0);
  const cxc = fCtas.filter((c) => c.tipo === "cxc" && c.moneda === "CLP").reduce((s, c) => s + c.saldo, 0);
  const cxcUsd = fCtas.filter((c) => c.tipo === "cxc" && c.moneda === "USD").reduce((s, c) => s + c.saldo, 0);
  const comprometido = fMovs.filter((m) => m.estado === "proyectado" && m.moneda === "CLP").reduce((s, m) => s + m.monto, 0);

  const pagar = (id) => setMovs((prev) => {
    const m = prev.find((x) => x.id === id);
    if (!m || m.estado !== "proyectado") return prev;
    const cta = cuentas.find((c) => c.id === m.cuenta) || cuentas.find((c) => c.empresa === m.empresa && c.principal) || cuentas.find((c) => c.empresa === m.empresa);
    if (cta) {
      const delta = m.moneda === "USD" && cta.moneda === "USD" ? m.monto : enCLP(m) / (cta.moneda === "USD" ? TC_USD : 1);
      setCuentas((cs) => cs.map((c) => (c.id === cta.id ? { ...c, saldo: c.saldo + delta } : c)));
    }
    return prev.map((x) => (x.id === id ? { ...x, estado: "pagado", cuenta: cta?.id ?? null } : x));
  });
  const conciliar = (id) => setMovs((p) => p.map((x) => (x.id === id ? { ...x, estado: "conciliado" } : x)));
  const editar = (id, k, v) => setMovs((p) => p.map((x) => (x.id === id ? { ...x, [k]: v } : x)));
  const editarLinea = (id, i, k, v) => setMovs((p) => p.map((m) => (m.id === id
    ? { ...m, lineas: m.lineas.map((l, j) => (j === i ? { ...l, [k]: v } : l)) } : m)));
  const conLineas = (id, fn) => setMovs((p) => p.map((m) => (m.id === id ? fn(m) : m)));
  const hacerSplit = (id) => conLineas(id, (m) => ({ ...m, lineas: [{ sub: m.sub, monto: m.monto, glosa: "" }] }));
  const agregarLinea = (id) => conLineas(id, (m) => {
    const falta = m.monto - m.lineas.reduce((s, l) => s + l.monto, 0);
    return { ...m, lineas: [...m.lineas, { sub: m.lineas[0]?.sub || m.sub, monto: Math.round(falta), glosa: "" }] };
  });
  const quitarLinea = (id, i) => conLineas(id, (m) => {
    const ls = m.lineas.filter((_, j) => j !== i);
    return ls.length ? { ...m, lineas: ls } : { ...m, lineas: undefined, sub: m.lineas[0].sub };
  });
  const quitarSplit = (id) => conLineas(id, (m) => ({ ...m, lineas: undefined, sub: m.lineas?.[0]?.sub || m.sub }));
  const cuadrar = (id) => conLineas(id, (m) => {
    const dif = Math.round(m.monto - m.lineas.reduce((s, l) => s + l.monto, 0));
    const ls = [...m.lineas];
    ls[ls.length - 1] = { ...ls[ls.length - 1], monto: ls[ls.length - 1].monto + dif };
    return { ...m, lineas: ls };
  });
  /* Aplica IVA (suma sobre el neto) o retención (resta sobre el bruto) y recalcula el líquido a pagar. */
  const aplicarImpuesto = (id, tipo) => conLineas(id, (m) => {
    const subTax = tipo === "iva" ? "iva-compras" : "retencion-bhe";
    const tasa = tipo === "iva" ? tasas.iva : tasas.bhe;
    const base = (m.lineas?.length ? m.lineas : [{ sub: m.sub, monto: m.monto, glosa: "" }]).filter((l) => l.sub !== subTax);
    const suma = base.reduce((s, l) => s + l.monto, 0);
    const monto = Math.round(tipo === "iva" ? suma * tasa : -suma * tasa);
    const lineas = [...base, { sub: subTax, monto, glosa: `${tipo === "iva" ? "IVA" : "Retención"} ${pct(tasa)}` }];
    return { ...m, lineas, monto: lineas.reduce((s, l) => s + l.monto, 0) };
  });
  /* toma el último número de cada fila como monto y el resto como glosa */
  const pegarLineas = (id, texto) => conLineas(id, (m) => {
    const signo = m.monto < 0 ? -1 : 1;
    const nuevas = (texto || "").split(/\r?\n/).map((raw) => {
      const t = raw.trim();
      if (!t) return null;
      const nums = t.match(/-?[\d.,]*\d/g);
      if (!nums) return null;
      const crudo = nums[nums.length - 1];
      const n = Number(crudo.replace(/\./g, "").replace(",", "."));
      if (!isFinite(n) || n === 0) return null;
      const glosa = t.slice(0, t.lastIndexOf(crudo)).replace(/[\t;|]+/g, " ").trim();
      return { sub: m.lineas?.[0]?.sub || m.sub, monto: signo * Math.abs(n), glosa: glosa || "—" };
    }).filter(Boolean);
    return nuevas.length ? { ...m, lineas: [...(m.lineas || []), ...nuevas] } : m;
  });
  const agregar = (nu) => setMovs((p) => [...p, { ...nu, id: "m" + Date.now() }]);
  const setPptoCampo = (sub, campo, val) =>
    setPpto((p) => ({ ...p, [sub]: { monto: 0, anterior: 0, resp: "", nota: "", ...p[sub], [campo]: val } }));

  return (
    <Cat.Provider value={ctx}>
      <div style={{ fontFamily: SANS, background: C.paper, color: C.ink, minHeight: "100vh", fontSize: 13 }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
          * { box-sizing: border-box; }
          button { font-family: inherit; cursor: pointer; }
          input, select, textarea { font-family: inherit; font-size: inherit; color: inherit; }
          ::-webkit-scrollbar { height: 9px; width: 9px; }
          ::-webkit-scrollbar-thumb { background: #CFD2CB; border-radius: 6px; }
          .row:hover { background: ${C.tealSoft} !important; }
        `}</style>
        <Encabezado {...{ vista, setVista, sel, setSel, efectivo, usd, cxc, cxcUsd, comprometido, reiniciar }} />
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          <Cuentas cuentas={fCtas} movs={fMovs} />
          <main style={{ flex: 1, minWidth: 0, padding: "18px 20px 60px" }}>
            {vista === "flujo" && <Flujo movs={fMovs} efectivo={efectivo} editar={editar} editarLinea={editarLinea} tc={tc} />}
            {vista === "movs" && <Registro {...{ movs: fMovs, editar, editarLinea, agregarLinea, quitarLinea, quitarSplit, hacerSplit, cuadrar, pegarLineas, aplicarImpuesto, pagar, agregar, sel, tasas, setTasas }} />}
            {vista === "conc" && <Conciliacion movs={fMovs} conciliar={conciliar} cuentas={cuentas} />}
            {vista === "ppto" && <Presupuesto {...{ movs, sel, ppto, setPptoCampo, subsPpto, setSubsPpto, tc, setTc }} />}
            {vista === "rep" && <Reportes {...{ movs: fMovs, sel, reportes, setReportes }} />}
            {vista === "cat" && <Catalogo movs={movs} />}
          </main>
        </div>
      </div>
    </Cat.Provider>
  );
}

/* ─────────────────────────  ENCABEZADO  ───────────────────────── */
function Encabezado({ vista, setVista, sel, setSel, efectivo, usd, cxc, cxcUsd, comprometido, reiniciar }) {
  const tabs = [["flujo", "Flujo semanal"], ["movs", "Movimientos"], ["conc", "Conciliación"],
    ["ppto", "Presupuesto anual"], ["rep", "Reportes"], ["cat", "Categorías"]];
  return (
    <header style={{ borderBottom: `1px solid ${C.rule}`, background: C.surface, position: "sticky", top: 0, zIndex: 30 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14, padding: "12px 20px 0" }}>
        <div style={{ fontFamily: MONO, fontWeight: 600, letterSpacing: "-0.02em", fontSize: 14 }}>
          TESORERÍA<span style={{ color: C.teal }}>/</span>ADAPSYS
        </div>
        <SelectorEmpresas sel={sel} setSel={setSel} />
        <div style={{ display: "flex", gap: 22, marginLeft: "auto", flexWrap: "wrap" }}>
          <Cifra rotulo="Efectivo CLP" valor={efectivo} tono={C.teal} />
          <Cifra rotulo="Comprometido CLP" valor={comprometido} tono={C.brick} />
          <Cifra rotulo="Posición proyectada CLP" valor={efectivo + comprometido} tono={efectivo + comprometido < 0 ? C.brick : C.ink} fuerte />
          <Cifra rotulo="Saldo USD" texto={"US$" + clp(usd)} tono={C.muted} />
          <Cifra rotulo="Por cobrar" texto={(cxc ? "$" + clp(cxc) + "  " : "") + (cxcUsd ? "US$" + clp(cxcUsd) : cxc ? "" : "—")} tono={C.muted} />
        </div>
        <button onClick={reiniciar} title="Volver a los datos de ejemplo"
          style={{ fontFamily: MONO, fontSize: 10, color: C.muted, background: "none", border: `1px solid ${C.rule}`, padding: "4px 7px", borderRadius: 3 }}>RESET</button>
      </div>
      <nav style={{ display: "flex", gap: 2, padding: "10px 20px 0", overflowX: "auto" }}>
        {tabs.map(([id, txt]) => (
          <button key={id} onClick={() => setVista(id)}
            style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", padding: "7px 12px",
              background: "none", border: "none", whiteSpace: "nowrap", borderBottom: `2px solid ${vista === id ? C.teal : "transparent"}`,
              color: vista === id ? C.ink : C.muted, fontWeight: vista === id ? 600 : 400 }}>{txt}</button>
        ))}
      </nav>
    </header>
  );
}

function usarCierre(setAbierto) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [setAbierto]);
  return ref;
}

function SelectorEmpresas({ sel, setSel }) {
  const [abierto, setAbierto] = useState(false);
  const ref = usarCierre(setAbierto);
  const preset = PRESETS.find((p) => p.ids.length === sel.length && p.ids.every((i) => sel.includes(i)));
  const toggle = (id) => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setAbierto(!abierto)}
        style={{ fontFamily: MONO, fontSize: 11, padding: "5px 10px", border: `1px solid ${C.rule}`, background: C.paper, borderRadius: 3, display: "flex", alignItems: "center", gap: 7 }}>
        {(preset ? preset.nombre : `${sel.length} empresas`).toUpperCase()}<span style={{ color: C.muted, fontSize: 9 }}>▾</span>
      </button>
      {abierto && (
        <div style={{ ...popover, left: 0, minWidth: 230 }}>
          <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
            {PRESETS.map((p) => <button key={p.id} onClick={() => setSel(p.ids)} style={miniBtn}>{p.nombre}</button>)}
          </div>
          {["Adapsys", "Empresas relacionadas"].map((g) => (
            <div key={g}>
              <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", color: C.muted, padding: "6px 6px 3px" }}>{g}</div>
              {EMPRESAS.filter((e) => e.grupo === g).map((e) => (
                <Check key={e.id} on={sel.includes(e.id)} onClick={() => toggle(e.id)}>{e.nombre}</Check>))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SelectorLineas({ sel, setSel, etiqueta = "Líneas" }) {
  const { cats, subs, subsDe } = useCat();
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const [abiertas, setAbiertas] = useState([]);
  const ref = usarCierre(setAbierto);
  const todas = sel.length === subs.length;
  const toggle = (id) => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  const toggleCat = (cid) => {
    const ids = subsDe(cid).map((s) => s.id);
    const dentro = ids.every((i) => sel.includes(i));
    setSel(dentro ? sel.filter((x) => !ids.includes(x)) : [...new Set([...sel, ...ids])]);
  };
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const buscando = q.trim().length > 1;
  const coincide = (s) => norm(s.nombre).includes(norm(q));
  const visibles = (cid) => (buscando ? subsDe(cid).filter(coincide) : subsDe(cid));

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setAbierto(!abierto)}
        style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".04em", textTransform: "uppercase", padding: "5px 10px",
          border: `1px solid ${todas ? C.rule : C.ink}`, background: todas ? C.surface : C.paper, color: todas ? C.muted : C.ink,
          borderRadius: 3, display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}>
        {etiqueta}: {todas ? "todas" : `${sel.length}/${subs.length}`}<span style={{ fontSize: 9, opacity: .6 }}>▾</span>
      </button>
      {abierto && (
        <div style={{ ...popover, right: 0, width: 330, maxHeight: 440, display: "flex", flexDirection: "column" }}>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar subcategoría"
            style={{ padding: "6px 8px", border: `1px solid ${C.rule}`, borderRadius: 3, fontSize: 11.5, background: C.paper, marginBottom: 6 }} />
          <div style={{ display: "flex", gap: 4, marginBottom: 6, flexWrap: "wrap" }}>
            <button onClick={() => setSel(subs.map((s) => s.id))} style={miniBtn}>Todas</button>
            <button onClick={() => setSel([])} style={miniBtn}>Ninguna</button>
            <button onClick={() => setSel(subs.filter((s) => cats.find((c) => c.id === s.cat)?.controlado).map((s) => s.id))} style={miniBtn}>Solo controladas</button>
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {NATURALEZAS.map((n) => {
              const cs = cats.filter((c) => visibles(c.id).some((s) => s.nat === n.id));
              if (!cs.length) return null;
              return (
                <div key={n.id}>
                  <div style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: ".12em", textTransform: "uppercase", color: C.teal, padding: "9px 6px 2px", borderTop: `1px solid ${C.ruleSoft}`, marginTop: 4 }}>{n.nombre}</div>
                  {cs.map((c) => {
                    const vs = visibles(c.id).filter((s) => s.nat === n.id);
                    const ids = subsDe(c.id, n.id).map((s) => s.id);
                    const dentro = ids.length > 0 && ids.every((i) => sel.includes(i));
                    const algunos = !dentro && ids.some((i) => sel.includes(i));
                    const desplegada = buscando || abiertas.includes(n.id + c.id);
                    return (
                      <div key={n.id + c.id}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 6px 2px" }}>
                          <button onClick={() => toggleCat(c.id)} aria-label="Marcar categoría completa"
                            style={{ width: 11, height: 11, borderRadius: 2, padding: 0, flexShrink: 0,
                              border: `1.5px solid ${dentro || algunos ? C.teal : "#C3C7C0"}`,
                              background: dentro ? C.teal : algunos ? C.tealSoft : "transparent" }} />
                          <button onClick={() => setAbiertas(desplegada ? abiertas.filter((x) => x !== n.id + c.id) : [...abiertas, n.id + c.id])}
                            style={{ flex: 1, display: "flex", alignItems: "center", gap: 5, textAlign: "left", fontFamily: MONO, fontSize: 9,
                              letterSpacing: ".07em", textTransform: "uppercase", color: dentro ? C.ink : C.muted, background: "none", border: "none", padding: 0 }}>
                            <span style={{ fontSize: 8, width: 7 }}>{desplegada ? "▾" : "▸"}</span>
                            <span style={{ flex: 1 }}>{c.nombre}</span>
                            <span style={{ color: "#B8BDB6" }}>{vs.length}</span>
                          </button>
                        </div>
                        {desplegada && vs.map((s) => <Check key={s.id} on={sel.includes(s.id)} onClick={() => toggle(s.id)} sangria>{s.nombre}</Check>)}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const Check = ({ on, onClick, children, sangria }) => (
  <label onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 8, padding: `4px 6px 4px ${sangria ? 20 : 6}px`, cursor: "pointer", borderRadius: 3, fontSize: 11.5 }}
    onMouseEnter={(e) => (e.currentTarget.style.background = C.paper)}
    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
    <input type="checkbox" readOnly checked={on} style={{ accentColor: C.teal, pointerEvents: "none" }} />
    {children}
  </label>
);
const popover = { position: "absolute", top: "calc(100% + 5px)", background: C.surface, border: `1px solid ${C.rule}`, borderRadius: 4, boxShadow: "0 6px 20px rgba(0,0,0,.09)", padding: 8, zIndex: 45 };
const miniBtn = { fontFamily: MONO, fontSize: 9, letterSpacing: ".04em", textTransform: "uppercase", padding: "3px 7px", borderRadius: 3, border: `1px solid ${C.rule}`, background: C.paper, color: C.muted };

function Cifra({ rotulo, valor, tono, fuerte, texto }) {
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".09em", textTransform: "uppercase", color: C.muted }}>{rotulo}</div>
      <div style={{ fontFamily: MONO, fontSize: fuerte ? 17 : 15, fontWeight: fuerte ? 600 : 500, color: tono, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
        {texto ?? "$" + clp(valor)}
      </div>
    </div>
  );
}

/* ─────────────────────────  CUENTAS  ───────────────────────── */
function Cuentas({ cuentas, movs }) {
  const porEmpresa = EMPRESAS.map((e) => ({ e, cs: cuentas.filter((c) => c.empresa === e.id && c.tipo === "banco") })).filter((x) => x.cs.length);
  const pendientes = movs.filter((m) => m.estado === "pagado").length;
  return (
    <aside style={{ width: 244, flexShrink: 0, borderRight: `1px solid ${C.rule}`, background: C.surface, minHeight: "calc(100vh - 92px)", padding: "16px 0" }}>
      <Rotulo texto="Saldos por empresa" pad />
      {porEmpresa.map(({ e, cs }) => {
        const tot = cs.filter((c) => c.moneda === "CLP").reduce((s, c) => s + c.saldo, 0);
        return (
          <div key={e.id} style={{ padding: "9px 16px", borderBottom: `1px solid ${C.ruleSoft}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 11.5, fontWeight: 600 }}>{e.nombre}</span>
              <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, color: tot < 0 ? C.brick : C.ink, fontVariantNumeric: "tabular-nums" }}>{clpK(tot)}</span>
            </div>
            {cs.map((c) => (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", marginTop: 3, fontSize: 10.5,
                color: c.moneda === "USD" ? "#A9AEA7" : C.muted }}>
                <span style={{ fontFamily: MONO }}>{c.moneda}{c.moneda === "USD" && " · fuera del flujo"}</span>
                <span style={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}>{c.moneda === "USD" ? "US$" : "$"}{clp(c.saldo)}</span>
              </div>
            ))}
          </div>
        );
      })}
      <div style={{ padding: "14px 16px", marginTop: 6 }}>
        <Rotulo texto="Por conciliar" />
        <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 600, color: pendientes ? C.amber : C.muted, marginTop: 4 }}>{pendientes}</div>
        <div style={{ fontSize: 10.5, color: C.muted, lineHeight: 1.45, marginTop: 2 }}>
          {pendientes ? "movimientos pagados sin cuadrar contra cartola" : "todo cuadrado contra cartola"}
        </div>
      </div>
      <div style={{ padding: "0 16px", fontSize: 10, color: C.muted, lineHeight: 1.5 }}>
        <div style={{ borderTop: `1px solid ${C.ruleSoft}`, paddingTop: 12 }}>
          El flujo de caja se lleva sólo en CLP. Las cuentas en dólares se muestran en su moneda y quedan fuera del flujo, salvo que actives la conversión.
        </div>
      </div>
    </aside>
  );
}
const Rotulo = ({ texto, pad }) => (
  <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: ".1em", textTransform: "uppercase", color: C.muted, padding: pad ? "0 16px 8px" : 0 }}>{texto}</div>
);

/* ─────────────────────────  FLUJO SEMANAL  ───────────────────────── */
function Flujo({ movs, efectivo, editar, editarLinea, tc }) {
  const { cats, subs, subsDe } = useCat();
  const [gran, setGran] = useState("semana");
  const [rango, setRango] = useState("fut");
  const [desde, setDesde] = useState(iso(lunesDe(hoy)));
  const [hasta, setHasta] = useState(`${AÑO}-12-31`);
  const [estados, setEstados] = useState(["conciliado", "pagado", "proyectado"]);
  const [soloCLP, setSoloCLP] = useState(true);
  const [abiertas, setAbiertas] = useState([]);
  const [detalle, setDetalle] = useState(null);

  const aplicarRango = (id) => {
    const r = RANGOS.find((x) => x.id === id);
    if (!r) return setRango("libre");
    const [a, b] = r.calc();
    setRango(id); setDesde(id === "fut" ? iso(lunesDe(hoy)) : a); setHasta(b);
  };

  const periodos = useMemo(() => {
    const out = [];
    if (gran === "mes") {
      let d0 = new Date(desde + "T00:00:00");
      d0 = new Date(d0.getFullYear(), d0.getMonth(), 1);
      while (iso(d0) <= hasta && out.length < 40) {
        const fin = new Date(d0.getFullYear(), d0.getMonth() + 1, 0);
        out.push({ desde: iso(d0) < desde ? desde : iso(d0), hasta: iso(fin) > hasta ? hasta : iso(fin),
          etiq: MESC[d0.getMonth()], año: d0.getFullYear() });
        d0 = new Date(d0.getFullYear(), d0.getMonth() + 1, 1);
      }
    } else {
      let a = lunesDe(new Date(desde + "T00:00:00"));
      while (iso(a) <= hasta && out.length < 40) {
        const b = addD(a, 6);
        const ini = iso(a) < desde ? desde : iso(a), fin = iso(b) > hasta ? hasta : iso(b);
        const dd = (f) => f.slice(8) + "-" + f.slice(5, 7);
        out.push({ desde: ini, hasta: fin, etiq: `${dd(ini)}–${dd(fin)}`, año: a.getFullYear() });
        a = addD(a, 7);
      }
    }
    return out;
  }, [desde, hasta, gran]);

  const enRango = useMemo(() => expandir(movs.filter((m) => m.fecha >= desde && m.fecha <= hasta && estados.includes(m.estado))), [movs, desde, hasta, estados]);
  const datos = useMemo(() => (soloCLP ? enRango.filter((m) => m.moneda === "CLP") : enRango), [enRango, soloCLP]);
  const fueraUSD = useMemo(() => enRango.filter((m) => m.moneda !== "CLP"), [enRango]);
  const val = (m) => (m.moneda === "USD" ? m.monto * (m.tc || tc) : m.monto);
  const suma = (ids, p) => datos.reduce((s, m) => (ids.includes(m.sub) && m.fecha >= p.desde && m.fecha <= p.hasta ? s + val(m) : s), 0);
  const abrir = (titulo, ids, p) => setDetalle({
    titulo, periodo: p ? `${p.etiq} ${p.año}` : `${desde} a ${hasta}`, ids,
    items: datos.filter((m) => ids.includes(m.sub) && (!p || (m.fecha >= p.desde && m.fecha <= p.hasta)))
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || val(a) - val(b)),
  });
  const conMov = useMemo(() => new Set(datos.map((m) => m.sub)), [datos]);

  const secciones = NATURALEZAS.map((n) => ({
    nat: n,
    grupos: cats.map((c) => ({ c, ss: subsDe(c.id, n.id).filter((s) => conMov.has(s.id)) })).filter((g) => g.ss.length),
  })).filter((x) => x.grupos.length);

  const totNat = (nat, p) => suma(subs.filter((s) => s.nat === nat).map((s) => s.id), p);
  const ingresos = periodos.map((p) => totNat("ingreso", p));
  const egresos = periodos.map((p, i) => totNat("inversion", p) + totNat("operativo", p));
  const neto = periodos.map((_, i) => ingresos[i] + egresos[i]);
  let acu = 0;
  const acumulado = neto.map((v) => (acu += v));
  const proyeccion = desde >= iso(hoy);

  const W = gran === "mes" ? 88 : 112;
  const celda = (v, k, o = {}) => (
    <td key={k} style={{ fontFamily: MONO, fontSize: 11, textAlign: "right", padding: 0, whiteSpace: "nowrap",
      fontVariantNumeric: "tabular-nums", minWidth: W, background: o.bg, borderTop: o.borderTop,
      borderLeft: o.borderLeft ? `1px solid ${C.rule}` : undefined }}>
      {v === 0 || !o.abrir ? (
        <span style={{ display: "block", padding: "5px 9px", color: o.color || (v === 0 ? "#C9CDC6" : v < 0 ? C.brick : C.ink), fontWeight: o.bold ? 600 : 400 }}>
          {v === 0 ? "$0" : clpK(v)}</span>
      ) : (
        <button onClick={o.abrir} title="Ver el detalle de este monto"
          style={{ width: "100%", textAlign: "right", padding: "5px 9px", background: "none", border: "none",
            fontFamily: MONO, fontSize: 11, fontVariantNumeric: "tabular-nums", borderRadius: 2,
            color: o.color || (v < 0 ? C.brick : C.ink), fontWeight: o.bold ? 600 : 400, textDecoration: "underline",
            textDecorationColor: "#D8DCD6", textUnderlineOffset: 3 }}>
          {clpK(v)}</button>
      )}</td>
  );
  const filaTotal = (label, vals, o = {}) => (
    <tr key={label}>
      <td style={{ ...tdSticky, fontWeight: 600, color: o.color, borderTop: o.borderTop, background: o.bg || C.surface }}>{label}</td>
      {vals.map((v, i) => celda(v, i, { bold: true, color: o.color, borderTop: o.borderTop, bg: o.bg, abrir: o.abrir && (() => o.abrir(i)) }))}
      {celda(vals.reduce((a, b) => a + b, 0), "t", { bold: true, color: o.color, borderTop: o.borderTop, bg: o.bg,
        borderLeft: true, abrir: o.abrir && (() => o.abrir(null)) })}
    </tr>
  );

  return (
    <>
      <Cabecera titulo="Flujo de caja"
        bajada="Sólo aparecen las categorías y subcategorías con movimiento en el rango elegido. Despliega una categoría para ver su detalle." />

      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap", alignItems: "center",
        border: `1px solid ${C.rule}`, background: C.surface, borderRadius: 4, padding: "10px 12px" }}>
        {RANGOS.map((r) => <Chip key={r.id} chico activo={rango === r.id} onClick={() => aplicarRango(r.id)}>{r.nombre}</Chip>)}
        <input type="date" value={desde} onChange={(e) => { setDesde(e.target.value); setRango("libre"); }} style={inpFecha} />
        <span style={{ color: C.muted, fontSize: 11 }}>a</span>
        <input type="date" value={hasta} onChange={(e) => { setHasta(e.target.value); setRango("libre"); }} style={inpFecha} />
        <span style={{ width: 1, height: 18, background: C.rule, margin: "0 4px" }} />
        <Chip chico activo={gran === "semana"} onClick={() => setGran("semana")}>Semanal</Chip>
        <Chip chico activo={gran === "mes"} onClick={() => setGran("mes")}>Mensual</Chip>
        <span style={{ width: 1, height: 18, background: C.rule, margin: "0 4px" }} />
        {["conciliado", "pagado", "proyectado"].map((e) => (
          <Chip key={e} chico activo={estados.includes(e)}
            onClick={() => setEstados(estados.includes(e) ? estados.filter((x) => x !== e) : [...estados, e])}>{e.slice(0, 4)}</Chip>))}
        <span style={{ width: 1, height: 18, background: C.rule, margin: "0 4px" }} />
        <Chip chico activo={soloCLP} onClick={() => setSoloCLP(!soloCLP)}>{soloCLP ? "Sólo CLP" : `CLP + USD @${TC_USD}`}</Chip>
        <button onClick={() => setAbiertas(abiertas.length ? [] : cats.map((c) => c.id))} style={{ ...btnGhost, marginLeft: "auto" }}>
          {abiertas.length ? "Colapsar todo" : "Expandir todo"}</button>
      </div>

      {soloCLP && fueraUSD.length > 0 && (
        <Aviso tono={C.muted} bg={C.paper}>
          <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".06em", textTransform: "uppercase", color: C.muted }}>Fuera del flujo</span>{" "}
          {fueraUSD.length} movimiento{fueraUSD.length > 1 ? "s" : ""} en dólares por US${clp(fueraUSD.reduce((s, m) => s + m.monto, 0))}.
          El saldo de las cuentas en USD tampoco entra.
        </Aviso>
      )}
      {proyeccion && acumulado.length > 0 && efectivo + Math.min(...acumulado) < 0 && (
        <Aviso tono={C.brick} bg={C.brickSoft}>
          Con este flujo el saldo estimado cae a {clpK(efectivo + Math.min(...acumulado))} dentro del período.
        </Aviso>
      )}

      <div style={{ overflowX: "auto", border: `1px solid ${C.rule}`, background: C.surface, borderRadius: 4 }}>
        <table style={{ borderCollapse: "collapse", width: "max-content", minWidth: "100%" }}>
          <thead><tr>
            <th style={thSticky}>Categoría</th>
            {periodos.map((p, i) => (
              <th key={i} style={{ fontFamily: MONO, fontSize: 10, fontWeight: 500, textAlign: "right", padding: "7px 9px", minWidth: W,
                color: C.muted, whiteSpace: "nowrap", borderBottom: `1px solid ${C.rule}` }}>
                <div style={{ fontSize: 9, color: "#B8BDB6" }}>{p.año}</div>{p.etiq}</th>))}
            <th style={{ ...thBase, textAlign: "right", borderLeft: `1px solid ${C.rule}`, minWidth: 110 }}>Total</th>
          </tr></thead>
          <tbody>
            {secciones.map(({ nat, grupos }) => {
              const idsNat = grupos.flatMap((g) => g.ss.map((s) => s.id));
              const vals = periodos.map((p) => suma(idsNat, p));
              const esIng = nat.id === "ingreso";
              return (
                <Frag key={"sec" + nat.id}>
                  <tr>
                    <td colSpan={periodos.length + 2} style={{ background: C.seccion, fontFamily: MONO, fontSize: 10, letterSpacing: ".12em",
                      textTransform: "uppercase", fontWeight: 600, padding: "7px 12px", borderTop: `1px solid ${C.rule}`,
                      position: "sticky", left: 0 }}>{nat.nombre}</td>
                  </tr>
                  {grupos.map(({ c, ss }) => {
                    const ids = ss.map((s) => s.id);
                    const v = periodos.map((p) => suma(ids, p));
                    const desplegada = abiertas.includes(c.id);
                    return (
                      <Frag key={nat.id + c.id}>
                        <tr className="row">
                          <td style={{ ...tdSticky, fontWeight: 500 }}>
                            <button onClick={() => setAbiertas(desplegada ? abiertas.filter((x) => x !== c.id) : [...abiertas, c.id])}
                              style={{ background: "none", border: "none", padding: 0, marginRight: 6, color: C.muted, fontSize: 9 }}>
                              {desplegada ? "▾" : "▸"}</button>
                            {c.nombre}<span style={{ color: "#B8BDB6", fontFamily: MONO, fontSize: 9, marginLeft: 6 }}>{ss.length}</span>
                          </td>
                          {v.map((x, i) => celda(x, i, { bold: true, abrir: () => abrir(c.nombre, ids, periodos[i]) }))}
                          {celda(v.reduce((a, b) => a + b, 0), "t", { bold: true, borderLeft: true, abrir: () => abrir(c.nombre, ids, null) })}
                        </tr>
                        {desplegada && ss.map((s) => {
                          const vs = periodos.map((p) => suma([s.id], p));
                          return (
                            <tr className="row" key={nat.id + s.id} style={{ background: "#FCFCFA" }}>
                              <td style={{ ...tdSticky, paddingLeft: 34, fontSize: 11.5, color: C.muted, background: "#FCFCFA" }}>{s.nombre}</td>
                              {vs.map((x, i) => celda(x, i, { color: x === 0 ? "#D2D6CF" : undefined, abrir: () => abrir(s.nombre, [s.id], periodos[i]) }))}
                              {celda(vs.reduce((a, b) => a + b, 0), "t", { borderLeft: true, abrir: () => abrir(s.nombre, [s.id], null) })}
                            </tr>);
                        })}
                      </Frag>);
                  })}
                  {filaTotal(`Total ${nat.nombre}`, vals, { color: esIng ? C.teal : C.brick, borderTop: `1px solid ${C.rule}`,
                    abrir: (i) => abrir(`Total ${nat.nombre}`, idsNat, i === null ? null : periodos[i]) })}
                </Frag>);
            })}
            {filaTotal("Flujo neto del período", neto, { borderTop: `2px solid ${C.ink}` })}
            {filaTotal("Flujo acumulado", acumulado, { color: C.muted })}
            {proyeccion && filaTotal("Saldo estimado", acumulado.map((v) => efectivo + v), { bg: C.tealSoft })}
          </tbody>
        </table>
      </div>
      {detalle && <PanelDetalle detalle={detalle} cerrar={() => setDetalle(null)} editar={editar} editarLinea={editarLinea} tc={tc} />}

      <Nota>
        Haz clic en cualquier monto para ver los movimientos que lo componen y reclasificarlos ahí mismo.
        El flujo se lleva <strong>sólo en CLP</strong>: los movimientos y saldos en dólares quedan fuera. Si en algún momento necesitas verlo todo junto,
        el botón <em>CLP + USD</em> los suma convertidos, dejando registrado el tipo de cambio usado.
        Con <strong>Proyectado</strong> activo la tabla mezcla real y proyección, igual que el reporte que revisan hoy.
      </Nota>
    </>
  );
}

function PanelDetalle({ detalle, cerrar, editar, editarLinea, tc }) {
  const { cats, subs } = useCat();
  const val = (m) => (m.moneda === "USD" ? m.monto * (m.tc || tc) : m.monto);
  const total = detalle.items.reduce((s, m) => s + val(m), 0);
  useEffect(() => {
    const h = (e) => e.key === "Escape" && cerrar();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [cerrar]);
  return (
    <div onClick={cerrar} style={{ position: "fixed", inset: 0, background: "rgba(20,24,28,.28)", zIndex: 80, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(680px,94vw)", background: C.surface, height: "100%", display: "flex", flexDirection: "column", boxShadow: "-8px 0 30px rgba(0,0,0,.14)" }}>
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.rule}`, display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".09em", textTransform: "uppercase", color: C.muted }}>{detalle.periodo}</div>
            <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>{detalle.titulo}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".09em", textTransform: "uppercase", color: C.muted }}>{detalle.items.length} movs</div>
            <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 600, color: total < 0 ? C.brick : C.teal, fontVariantNumeric: "tabular-nums" }}>{clp(total)}</div>
          </div>
          <button onClick={cerrar} style={{ background: "none", border: "none", fontSize: 18, color: C.muted, lineHeight: 1, padding: "0 2px" }}>×</button>
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <tbody>
              {detalle.items.map((m) => (
                <tr key={m.id + "-" + (m._linea ?? "")} className="row" style={{ borderBottom: `1px solid ${C.ruleSoft}` }}>
                  <td style={{ ...tdBase, width: 52, fontFamily: MONO, fontSize: 10.5, color: C.muted, verticalAlign: "top", paddingTop: 9 }}>
                    {m.fecha.slice(8)}-{m.fecha.slice(5, 7)}</td>
                  <td style={{ ...tdBase, paddingTop: 9, paddingBottom: 9 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
                      <span style={{ fontWeight: 500 }}>{m.payee}</span>
                      <span style={{ fontFamily: MONO, fontSize: 9, color: C.muted }}>{empDe(m.empresa).corto}</span>
                      {m.estado === "proyectado"
                        ? <span style={{ ...badge, background: C.paper }}>proyectado</span>
                        : <Pill estado={m.estado} />}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, margin: "2px 0 5px" }}>{m.memo}{m.glosa ? ` · ${m.glosa}` : ""}</div>
                    {m._padre !== undefined && (
                      <span style={{ ...badge, background: C.tealSoft, color: C.teal, marginRight: 6 }}>línea de split</span>)}
                    <select value={m.sub}
                      onChange={(e) => (m._padre !== undefined
                        ? editarLinea(m._padre, m._linea, "sub", e.target.value)
                        : editar(m.id, "sub", e.target.value))}
                      style={{ fontSize: 11, border: `1px solid ${C.rule}`, borderRadius: 2, padding: "2px 5px", background: C.paper, maxWidth: 320 }}>
                      {cats.map((c) => (
                        <optgroup key={c.id} label={c.nombre}>
                          {subs.filter((s) => s.cat === c.id).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                        </optgroup>))}
                    </select>
                  </td>
                  <td style={{ ...tdNum, verticalAlign: "top", paddingTop: 9, color: val(m) < 0 ? C.brick : C.teal, width: 130 }}>
                    {m.moneda === "USD" && <div style={{ fontSize: 9, color: C.muted }}>US${clp(m.monto)} @{m.tc || tc}</div>}
                    {clp(val(m))}</td>
                </tr>))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "9px 18px", borderTop: `1px solid ${C.rule}`, fontSize: 10.5, color: C.muted, background: C.paper }}>
Si algo está mal clasificado, cámbialo en el selector y el flujo se recalcula. Los movimientos con split aparecen como líneas separadas. Esc para salir.
        </div>
      </div>
    </div>
  );
}

const inpFecha = { padding: "4px 6px", border: `1px solid ${C.rule}`, borderRadius: 3, background: C.surface, fontSize: 11, width: 126 };

const thSticky = { fontFamily: MONO, fontSize: 10, fontWeight: 500, letterSpacing: ".08em", textTransform: "uppercase", textAlign: "left", padding: "9px 12px", color: C.muted, position: "sticky", left: 0, background: C.surface, zIndex: 3, borderBottom: `1px solid ${C.rule}`, borderRight: `1px solid ${C.rule}`, minWidth: 200 };
const tdSticky = { padding: "5px 12px", position: "sticky", left: 0, background: C.surface, zIndex: 2, borderRight: `1px solid ${C.rule}`, whiteSpace: "nowrap", fontSize: 12 };

/* ─────────────────────────  REGISTRO  ───────────────────────── */
function Registro({ movs, editar, editarLinea, agregarLinea, quitarLinea, quitarSplit, hacerSplit, cuadrar, pegarLineas, aplicarImpuesto, pagar, agregar, sel, tasas, setTasas }) {
  const { cats, subs } = useCat();
  const [q, setQ] = useState("");
  const [nuevo, setNuevo] = useState(false);
  const [soloFuturo, setSoloFuturo] = useState(true);
  const [abiertos, setAbiertos] = useState([]);
  const [pegando, setPegando] = useState(null);
  const textoPegado = useRef("");
  const hoyISO = iso(hoy);
  const lista = movs.filter((m) => !soloFuturo || m.fecha >= hoyISO)
    .filter((m) => !q || (m.payee + m.memo).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  const opciones = (
    <>{cats.map((c) => (
      <optgroup key={c.id} label={c.nombre}>
        {subs.filter((s) => s.cat === c.id).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
      </optgroup>))}</>
  );
  return (
    <>
      <Cabecera titulo="Movimientos" bajada="Un solo registro para todas las empresas. Empresa y subcategoría son campos editables." />
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar glosa o proveedor"
          style={{ flex: 1, minWidth: 180, padding: "7px 10px", border: `1px solid ${C.rule}`, borderRadius: 3, background: C.surface }} />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: C.muted }}>
          <input type="checkbox" checked={soloFuturo} onChange={(e) => setSoloFuturo(e.target.checked)} style={{ accentColor: C.teal }} /> Solo desde hoy
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4, border: `1px solid ${C.rule}`, borderRadius: 3, padding: "3px 7px", background: C.paper }}
          title="Tasa de IVA vigente">
          <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".06em", color: C.muted }}>IVA</span>
          <input value={(tasas.iva * 100).toFixed(2)} onChange={(e) => setTasas({ ...tasas, iva: (Number(e.target.value) || 0) / 100 })}
            style={{ width: 42, fontFamily: MONO, fontSize: 11, border: "none", background: "transparent", textAlign: "right" }} />
          <span style={{ fontSize: 10, color: C.muted }}>%</span>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4, border: `1px solid ${C.rule}`, borderRadius: 3, padding: "3px 7px", background: C.paper }}
          title="Retención de boletas de honorarios vigente">
          <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".06em", color: C.muted }}>BHE</span>
          <input value={(tasas.bhe * 100).toFixed(2)} onChange={(e) => setTasas({ ...tasas, bhe: (Number(e.target.value) || 0) / 100 })}
            style={{ width: 42, fontFamily: MONO, fontSize: 11, border: "none", background: "transparent", textAlign: "right" }} />
          <span style={{ fontSize: 10, color: C.muted }}>%</span>
        </label>
        <button onClick={() => setNuevo(!nuevo)}
          style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".05em", padding: "7px 14px", background: nuevo ? C.paper : C.ink, color: nuevo ? C.ink : C.surface, border: `1px solid ${C.ink}`, borderRadius: 3 }}>
          {nuevo ? "CANCELAR" : "+ NUEVO"}</button>
      </div>
      {nuevo && <FormaNuevo onGuardar={(m) => { agregar(m); setNuevo(false); }} sel={sel} opciones={opciones} tasas={tasas} />}
      <div style={{ border: `1px solid ${C.rule}`, borderRadius: 4, background: C.surface, overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 900 }}>
          <thead><tr>
            {["Fecha", "Empresa", "Proveedor / Cliente", "Glosa", "Subcategoría", "Monto", "Estado"].map((h, i) => (
              <th key={h} style={{ ...thBase, textAlign: i === 5 ? "right" : "left" }}>{h}</th>))}
          </tr></thead>
          <tbody>
            {lista.map((m, i) => {
              const prev = lista[i - 1];
              const cruza = prev && prev.fecha <= hoyISO && m.fecha > hoyISO;
              const huerfana = !m.lineas?.length && !subs.find((s) => s.id === m.sub);
              const abierto = abiertos.includes(m.id);
              const dif = m.lineas?.length ? Math.round(m.lineas.reduce((s, x) => s + x.monto, 0) - m.monto) : 0;
              return (
                <Frag key={m.id}>
                  {cruza && (
                    <tr><td colSpan={7} style={{ padding: 0 }}>
                      <div style={{ borderTop: `2px solid ${C.teal}`, position: "relative", height: 10 }}>
                        <span style={{ position: "absolute", left: 12, top: -8, background: C.teal, color: "#fff", fontFamily: MONO, fontSize: 8.5, letterSpacing: ".1em", padding: "1px 6px", borderRadius: 2 }}>FUTURO</span>
                      </div></td></tr>)}
                  <tr className="row" style={{ borderTop: `1px solid ${C.ruleSoft}` }}>
                    <td style={{ ...tdBase, fontFamily: MONO, fontSize: 11, color: C.muted }}>{m.fecha.slice(8)}-{m.fecha.slice(5, 7)}</td>
                    <td style={tdBase}>
                      <select value={m.empresa} onChange={(e) => editar(m.id, "empresa", e.target.value)} style={selMini}>
                        {EMPRESAS.map((e) => <option key={e.id} value={e.id}>{e.corto}</option>)}</select>
                    </td>
                    <td style={{ ...tdBase, fontWeight: 500 }}>{m.payee}</td>
                    <td style={{ ...tdBase, color: C.muted, fontSize: 11.5, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.memo}</td>
                    <td style={tdBase}>
                      {m.lineas?.length ? (
                        <button onClick={() => setAbiertos(abierto ? abiertos.filter((x) => x !== m.id) : [...abiertos, m.id])}
                          style={{ ...btnGhost, background: C.tealSoft, borderColor: C.tealSoft, color: C.teal, textTransform: "none", fontSize: 10.5 }}>
                          {abierto ? "▾" : "▸"} Split · {m.lineas.length} líneas
                          {dif !== 0 && <span style={{ color: C.brick, marginLeft: 5 }}>⚠</span>}
                        </button>
                      ) : (
                        <select value={huerfana ? "" : m.sub} onChange={(e) => editar(m.id, "sub", e.target.value)}
                          style={{ ...selMini, fontFamily: SANS, fontSize: 11, maxWidth: 200, borderColor: huerfana ? C.amber : C.rule, background: huerfana ? C.amberSoft : C.paper }}>
                          {huerfana && <option value="">⚠ sin clasificar</option>}
                          {opciones}
                        </select>
                      )}
                      {!m.lineas?.length && (
                        <button onClick={() => { hacerSplit(m.id); setAbiertos([...abiertos, m.id]); }} title="Convertir en split"
                          style={{ ...btnGhost, padding: "2px 5px", marginLeft: 4 }}>⊞</button>)}
                    </td>
                    <td style={{ ...tdBase, textAlign: "right", fontFamily: MONO, fontSize: 11.5, fontVariantNumeric: "tabular-nums", color: enCLP(m) < 0 ? C.brick : C.teal, whiteSpace: "nowrap" }}>
                      {m.moneda === "USD" && <div style={{ fontSize: 9, color: C.muted }}>US${clp(m.monto)} @{m.tc}</div>}
                      {clp(enCLP(m))}
                    </td>
                    <td style={tdBase}>{m.estado === "proyectado" ? <button onClick={() => pagar(m.id)} style={btnGhost}>Marcar pagado</button> : <Pill estado={m.estado} />}</td>
                  </tr>
                  {abierto && (
                    <>
                      {m.lineas.map((l, li) => (
                        <tr key={m.id + "l" + li} style={{ background: "#FBFCFA" }}>
                          <td /><td /><td />
                          <td style={{ ...tdBase, paddingLeft: 20 }}>
                            <input value={l.glosa || ""} placeholder="glosa de la línea"
                              onChange={(e) => editarLinea(m.id, li, "glosa", e.target.value)}
                              style={{ width: "100%", minWidth: 130, fontSize: 11, padding: "2px 5px", border: `1px solid ${C.ruleSoft}`, borderRadius: 2, background: C.surface }} />
                          </td>
                          <td style={tdBase}>
                            <select value={l.sub} onChange={(e) => editarLinea(m.id, li, "sub", e.target.value)}
                              style={{ ...selMini, fontFamily: SANS, fontSize: 10.5, maxWidth: 200 }}>{opciones}</select>
                          </td>
                          <td style={{ ...tdNum, fontSize: 11 }}>
                            <input value={l.monto} onChange={(e) => editarLinea(m.id, li, "monto", Number(e.target.value) || 0)}
                              style={{ width: 100, textAlign: "right", fontFamily: MONO, fontSize: 11, border: `1px solid ${C.ruleSoft}`,
                                borderRadius: 2, padding: "1px 4px", background: C.surface, color: l.monto < 0 ? C.brick : C.teal }} />
                          </td>
                          <td style={tdBase}>
                            <button onClick={() => quitarLinea(m.id, li)} title="Eliminar línea"
                              style={{ background: "none", border: "none", color: C.muted, fontSize: 13, padding: "0 4px" }}>×</button>
                          </td>
                        </tr>))}
                      <tr style={{ background: "#FBFCFA", borderBottom: `1px solid ${C.rule}` }}>
                        <td /><td /><td />
                        <td colSpan={2} style={{ ...tdBase, paddingLeft: 20 }}>
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                            <button onClick={() => agregarLinea(m.id)} style={btnGhost}>+ línea</button>
                            <button onClick={() => aplicarImpuesto(m.id, "iva")} title="Suma IVA sobre el neto y recalcula el total a pagar"
                              style={{ ...btnGhost, borderColor: C.teal, color: C.teal }}>+ IVA {pct(tasas.iva)}</button>
                            <button onClick={() => aplicarImpuesto(m.id, "bhe")} title="Resta la retención del bruto y recalcula el líquido a pagar"
                              style={{ ...btnGhost, borderColor: C.teal, color: C.teal }}>− Retención {pct(tasas.bhe)}</button>
                            <button onClick={() => setPegando(pegando === m.id ? null : m.id)} style={btnGhost}>Pegar detalle</button>
                            {dif !== 0 && <button onClick={() => cuadrar(m.id)} style={{ ...btnGhost, borderColor: C.brick, color: C.brick }}>Cuadrar diferencia</button>}
                            <button onClick={() => quitarSplit(m.id)} style={btnGhost}>Quitar split</button>
                          </div>
                          {pegando === m.id && (
                            <div style={{ marginTop: 7 }}>
                              <textarea rows={4} placeholder={"Pega el detalle de la cartola o del estado de cuenta:\nAnthropic Claude   96.400\nUber corporativo   72.100"}
                                onChange={(e) => (textoPegado.current = e.target.value)}
                                style={{ width: "100%", minWidth: 260, padding: 7, border: `1px solid ${C.rule}`, borderRadius: 3, fontFamily: MONO, fontSize: 10.5, lineHeight: 1.5, background: C.surface }} />
                              <button onClick={() => { pegarLineas(m.id, textoPegado.current); setPegando(null); textoPegado.current = ""; }}
                                style={{ ...btnGhost, borderColor: C.ink, color: C.ink, marginTop: 4 }}>Crear líneas</button>
                              <span style={{ fontSize: 10, color: C.muted, marginLeft: 8 }}>Toma el último número de cada fila como monto y el resto como glosa.</span>
                            </div>)}
                        </td>
                        <td style={{ ...tdNum, fontSize: 10.5, color: dif === 0 ? C.teal : C.brick }}>
                          {dif === 0 ? "cuadrado" : `dif ${clp(dif)}`}
                        </td>
                        <td />
                      </tr>
                    </>
                  )}
                </Frag>
              );
            })}
          </tbody>
        </table>
      </div>
      <Nota>
        Los impuestos van en su propia línea del split y viajan a <strong>4 IMPUESTOS</strong>, sumando o restando en el flujo hasta dar el monto exacto que salió del banco.
        Los botones calculan sobre la base, pero el monto queda editable: si la factura redondea distinto, manda el documento.
      </Nota>
    </>
  );
}
const selMini = { fontFamily: MONO, fontSize: 10, border: `1px solid ${C.rule}`, borderRadius: 2, padding: "2px 4px", background: C.paper };

function FormaNuevo({ onGuardar, sel, opciones, tasas }) {
  const { subs } = useCat();
  const [f, setF] = useState({ fecha: iso(hoy), empresa: sel[0] || "adap", payee: "", memo: "", sub: subs[0]?.id, monto: "", moneda: "CLP", tc: 1, estado: "proyectado", cuenta: null });
  const [doc, setDoc] = useState("exento");
  const base = Number(f.monto) || 0;
  const previo = doc === "afecta" ? { imp: Math.round(base * tasas.iva), rot: `IVA ${pct(tasas.iva)}` }
    : doc === "honorario" ? { imp: Math.round(-base * tasas.bhe), rot: `Retención ${pct(tasas.bhe)}` } : null;
  const guardar = () => {
    if (!f.payee || !f.monto) return;
    if (doc === "afecta") return onGuardar({ ...f, ...conIva(base, f.sub, tasas.iva) });
    if (doc === "honorario") return onGuardar({ ...f, ...bhe(base, f.sub, tasas.bhe) });
    onGuardar({ ...f, monto: base });
  };
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const inp = { padding: "6px 8px", border: `1px solid ${C.rule}`, borderRadius: 3, background: C.surface };
  return (
    <div style={{ border: `1px solid ${C.ink}`, borderRadius: 4, background: C.surface, padding: 14, marginBottom: 12, display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))" }}>
      <input type="date" value={f.fecha} onChange={(e) => set("fecha", e.target.value)} style={inp} />
      <select value={f.empresa} onChange={(e) => set("empresa", e.target.value)} style={inp}>{EMPRESAS.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select>
      <input placeholder="Proveedor o cliente" value={f.payee} onChange={(e) => set("payee", e.target.value)} style={inp} />
      <input placeholder="Glosa" value={f.memo} onChange={(e) => set("memo", e.target.value)} style={inp} />
      <select value={f.sub} onChange={(e) => set("sub", e.target.value)} style={inp}>{opciones}</select>
      <select value={doc} onChange={(e) => setDoc(e.target.value)} style={inp} title="Define si se agrega una línea de impuesto">
        <option value="exento">Exento — sin impuesto</option>
        <option value="afecta">Afecta — neto + IVA</option>
        <option value="honorario">Honorario — bruto − retención</option>
      </select>
      <input placeholder={doc === "afecta" ? "Neto (negativo)" : doc === "honorario" ? "Bruto (negativo)" : "Monto (negativo = egreso)"}
        value={f.monto} onChange={(e) => set("monto", e.target.value)} style={{ ...inp, fontFamily: MONO }} />
      <select value={f.moneda} onChange={(e) => setF((p) => ({ ...p, moneda: e.target.value, tc: e.target.value === "USD" ? TC_USD : 1 }))} style={inp}>
        <option value="CLP">CLP</option><option value="USD">USD</option></select>
      <button onClick={guardar}
        style={{ ...inp, background: C.ink, color: C.surface, fontFamily: MONO, fontSize: 11, letterSpacing: ".05em", border: "none" }}>GUARDAR</button>
      {previo && base !== 0 && (
        <div style={{ gridColumn: "1/-1", fontFamily: MONO, fontSize: 11, color: C.muted, display: "flex", gap: 16, flexWrap: "wrap", borderTop: `1px solid ${C.ruleSoft}`, paddingTop: 8 }}>
          <span>base {clp(base)}</span>
          <span>{previo.rot} {clp(previo.imp)}</span>
          <span style={{ color: C.ink, fontWeight: 600 }}>líquido a pagar {clp(base + previo.imp)}</span>
        </div>)}
    </div>
  );
}

/* ─────────────────────────  CONCILIACIÓN  ───────────────────────── */
function Conciliacion({ movs, conciliar, cuentas }) {
  const pagados = movs.filter((m) => m.estado === "pagado").sort((a, b) => b.fecha.localeCompare(a.fecha));
  const dif = pagados.reduce((s, m) => s + enCLP(m), 0);
  return (
    <>
      <Cabecera titulo="Conciliación bancaria" bajada="La diferencia entre el saldo del sistema y el de la cartola es exactamente esta lista." />
      <div style={{ display: "flex", gap: 28, padding: "14px 18px", border: `1px solid ${C.rule}`, background: C.surface, borderRadius: 4, marginBottom: 14, flexWrap: "wrap" }}>
        <Cifra rotulo="Movimientos por cuadrar" texto={String(pagados.length)} tono={pagados.length ? C.amber : C.teal} />
        <Cifra rotulo="Diferencia contra cartola" valor={dif} tono={dif ? C.amber : C.teal} fuerte />
      </div>
      {pagados.length === 0 ? <Vacio>Nada por conciliar. Marca movimientos como pagados en el registro.</Vacio> : (
        <div style={{ border: `1px solid ${C.rule}`, borderRadius: 4, background: C.surface, overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 700 }}>
            <thead><tr>{["", "Fecha", "Proveedor", "Cuenta de pago", "Monto"].map((h, i) => (
              <th key={i} style={{ ...thBase, textAlign: i === 4 ? "right" : "left" }}>{h}</th>))}</tr></thead>
            <tbody>
              {pagados.map((m) => {
                const cta = cuentas.find((c) => c.id === m.cuenta);
                return (
                  <tr className="row" key={m.id} style={{ borderTop: `1px solid ${C.ruleSoft}` }}>
                    <td style={{ ...tdBase, width: 34 }}>
                      <button onClick={() => conciliar(m.id)} aria-label="Cuadrar contra cartola"
                        style={{ width: 17, height: 17, borderRadius: 3, border: `1.5px solid #C3C7C0`, background: C.surface, padding: 0 }} /></td>
                    <td style={{ ...tdBase, fontFamily: MONO, fontSize: 11, color: C.muted }}>{m.fecha}</td>
                    <td style={{ ...tdBase, fontWeight: 500 }}>{m.payee}<div style={{ fontSize: 10.5, color: C.muted, fontWeight: 400 }}>{m.memo}</div></td>
                    <td style={{ ...tdBase, fontFamily: MONO, fontSize: 10.5, color: C.muted }}>{cta?.nombre ?? "sin asignar"}</td>
                    <td style={{ ...tdBase, textAlign: "right", fontFamily: MONO, fontSize: 11.5, fontVariantNumeric: "tabular-nums", color: enCLP(m) < 0 ? C.brick : C.teal }}>{clp(enCLP(m))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ─────────────────────────  PRESUPUESTO ANUAL  ───────────────────────── */
function Presupuesto({ movs, sel, ppto, setPptoCampo, subsPpto, setSubsPpto, tc, setTc }) {
  const { cats, subs, subsDe } = useCat();
  const [modo, setModo] = useState("control");
  const [incluirProy, setIncluirProy] = useState(false);
  const [nivel, setNivel] = useState("cat");

  /* el presupuesto es consolidado de las 4 empresas Adapsys, no sigue el filtro superior */
  const propias = expandir(movs.filter((m) => IDS_ADAPSYS.includes(m.empresa) && m.fecha.startsWith(String(AÑO))));
  const base = incluirProy ? propias : propias.filter((m) => m.estado !== "proyectado");
  const proyRestante = propias.filter((m) => m.estado === "proyectado");
  const filtroDistinto = sel.length !== IDS_ADAPSYS.length || !IDS_ADAPSYS.every((i) => sel.includes(i));

  const P = (sub) => ppto[sub]?.monto ?? 0;
  const A = (sub) => ppto[sub]?.anterior ?? 0;
  const val = (m) => (m.moneda === "USD" ? m.monto * tc : m.monto);
  const E = (sub, emp) => base.reduce((s, m) => (m.sub === sub && (!emp || m.empresa === emp) ? s + val(m) : s), 0);
  const K = (sub, emp) => E(sub, emp) + (incluirProy ? 0 : proyRestante.reduce((s, m) => (m.sub === sub && (!emp || m.empresa === emp) ? s + val(m) : s), 0));
  const agg = (fn, ids) => ids.reduce((s, id) => s + fn(id), 0);

  const incluidas = subs.filter((s) => subsPpto.includes(s.id));
  const excluidas = subs.filter((s) => !subsPpto.includes(s.id) && (P(s.id) || E(s.id) || K(s.id)));
  const porNat = (nat) => cats
    .map((c) => ({ c, ss: subsDe(c.id, nat).filter((s) => subsPpto.includes(s.id) && (P(s.id) || E(s.id) || K(s.id))) }))
    .filter((x) => x.ss.length);
  const idsNat = (nat) => porNat(nat).flatMap((x) => x.ss.map((s) => s.id));

  const totalInv = agg(P, idsNat("inversion")), totalOp = agg(P, idsNat("operativo")), totalIng = agg(P, idsNat("ingreso"));
  const ejecInv = agg(E, idsNat("inversion")), ejecOp = agg(E, idsNat("operativo"));
  const cierreTot = agg(K, incluidas.map((s) => s.id));

  const Barra = ({ p, e, cierre }) => {
    if (!p) return <span style={{ color: "#C3C7C0", fontSize: 11 }}>—</span>;
    const pct = Math.abs(e / p) * 100, pctC = Math.abs(cierre / p) * 100;
    const sobre = pct > pctAño * 100 + 4;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <div style={{ position: "relative", flex: 1, minWidth: 58, height: 6, background: C.ruleSoft, borderRadius: 3 }}>
          <div style={{ width: `${Math.min(pct, 120) / 1.2}%`, height: "100%", background: sobre ? C.brick : C.teal, borderRadius: 3 }} />
          <div style={{ position: "absolute", left: `${Math.min(pctC, 120) / 1.2}%`, top: -2, width: 1.5, height: 10, background: C.ink, opacity: .35 }} />
          <div style={{ position: "absolute", left: `${(pctAño * 100) / 1.2}%`, top: -3, width: 1.5, height: 12, background: C.muted }} />
        </div>
        <span style={{ fontFamily: MONO, fontSize: 10.5, color: sobre ? C.brick : C.muted, minWidth: 32, textAlign: "right" }}>{pct.toFixed(0)}%</span>
      </div>
    );
  };

  const Var = ({ p, a }) => {
    if (!a) return <span style={{ color: "#C3C7C0" }}>—</span>;
    const dif = Math.abs(p) - Math.abs(a);
    const pct = (dif / Math.abs(a)) * 100;
    return <span style={{ color: dif > 0 ? C.brick : C.teal }}>{dif > 0 ? "+" : "−"}{mag(dif)} <span style={{ color: C.muted, fontSize: 10 }}>({pct > 0 ? "+" : "−"}{Math.abs(pct).toFixed(1)}%)</span></span>;
  };

  const colsControl = ["Responsable", `Presupuesto ${AÑO}`, "Ejecutado", "% utilizado", "Disponible", "Proyección cierre"];
  const colsConstruc = ["Responsable", `Presupuesto ${AÑO - 1}`, `Presupuesto ${AÑO}`, "Variación", "Notas"];
  const cols = modo === "control" ? colsControl : colsConstruc;

  const celdasCtrl = (p, e, cierre, key) => [
    <td key={key + "p"} style={{ ...tdNum, fontWeight: 600 }}>{p ? mag(p) : "—"}</td>,
    <td key={key + "e"} style={tdNum}>{e ? mag(e) : "—"}</td>,
    <td key={key + "b"} style={tdBase}><Barra p={p} e={e} cierre={cierre} /></td>,
    <td key={key + "d"} style={{ ...tdNum, color: Math.abs(e) > Math.abs(p) ? C.brick : C.muted }}>{p ? mag(Math.abs(p) - Math.abs(e)) : "—"}</td>,
    <td key={key + "c"} style={{ ...tdNum, color: p && Math.abs(cierre) > Math.abs(p) ? C.brick : C.ink }}>{cierre ? mag(cierre) : "—"}</td>,
  ];

  const filaSeccion = (nat, titulo) => {
    const grupos = porNat(nat);
    if (!grupos.length) return null;
    const ids = idsNat(nat);
    const p = agg(P, ids), a = agg(A, ids), e = agg(E, ids), k = agg(K, ids);
    return (
      <Frag key={"sec" + nat}>
        <tr>
          <td colSpan={cols.length + 1} style={{ background: C.seccion, fontFamily: MONO, fontSize: 10, letterSpacing: ".12em",
            textTransform: "uppercase", fontWeight: 600, padding: "8px 12px", color: C.ink, borderTop: `1px solid ${C.rule}` }}>{titulo}</td>
        </tr>
        {grupos.map(({ c, ss }) => {
          const ids2 = ss.map((s) => s.id);
          const cp = agg(P, ids2), ca = agg(A, ids2), ce = agg(E, ids2), ck = agg(K, ids2);
          return (
            <Frag key={nat + c.id}>
              <tr style={{ background: "#EDEEEA", borderTop: `1px solid ${C.ruleSoft}` }}>
                <td style={{ ...tdBase, fontWeight: 600, fontSize: 11.5 }}>{c.nombre}{!c.controlado && <span style={{ ...badge, marginLeft: 7 }}>no controlada</span>}</td>
                <td style={tdBase} />
                {modo === "control" ? celdasCtrl(cp, ce, ck, c.id) : (
                  <>
                    <td style={tdNum}>{ca ? mag(ca) : "—"}</td>
                    <td style={{ ...tdNum, fontWeight: 600 }}>{cp ? mag(cp) : "—"}</td>
                    <td style={{ ...tdNum, fontSize: 11 }}><Var p={cp} a={ca} /></td>
                    <td style={tdBase} />
                  </>
                )}
              </tr>
              {nivel !== "cat" && ss.map((s) => {
                const p2 = P(s.id), a2 = A(s.id), e2 = E(s.id), k2 = K(s.id);
                const meta = ppto[s.id] || {};
                return (
                  <Frag key={nat + s.id}>
                    <tr className="row" style={{ borderTop: `1px solid ${C.ruleSoft}` }}>
                      <td style={{ ...tdBase, paddingLeft: 26 }}>{s.nombre}</td>
                      <td style={tdBase}>
                        <select value={meta.resp || ""} onChange={(ev) => setPptoCampo(s.id, "resp", ev.target.value)}
                          style={{ ...selMini, fontFamily: SANS, fontSize: 10.5, color: meta.resp ? C.ink : "#C3C7C0" }}>
                          {RESPONSABLES.map((r) => <option key={r} value={r}>{r || "—"}</option>)}</select>
                      </td>
                      {modo === "control" ? celdasCtrl(p2, e2, k2, s.id) : (
                        <>
                          <td style={tdNum}>
                            <input value={Math.abs(a2) || 0} onChange={(ev) => setPptoCampo(s.id, "anterior", -Math.abs(Number(ev.target.value) || 0))} style={inpNum} /></td>
                          <td style={tdNum}>
                            <input value={Math.abs(p2) || 0} onChange={(ev) => setPptoCampo(s.id, "monto", (P(s.id) > 0 ? 1 : -1) * Math.abs(Number(ev.target.value) || 0))}
                              style={{ ...inpNum, fontWeight: 600, borderColor: C.rule }} /></td>
                          <td style={{ ...tdNum, fontSize: 11 }}><Var p={p2} a={a2} /></td>
                          <td style={tdBase}>
                            <input value={meta.nota || ""} placeholder="—" onChange={(ev) => setPptoCampo(s.id, "nota", ev.target.value)}
                              style={{ width: "100%", minWidth: 150, fontSize: 11, padding: "3px 5px", border: "1px solid transparent", background: "transparent", borderRadius: 2 }} /></td>
                        </>
                      )}
                    </tr>
                    {nivel === "emp" && modo === "control" && IDS_ADAPSYS.filter((emp) => E(s.id, emp)).map((emp) => (
                      <tr key={s.id + emp} style={{ background: "#FCFCFA", borderTop: `1px solid ${C.ruleSoft}` }}>
                        <td style={{ ...tdBase, paddingLeft: 48, fontFamily: MONO, fontSize: 10, color: C.muted }}>{empDe(emp).corto}</td>
                        <td style={tdBase} />
                        <td style={{ ...tdNum, color: C.muted, fontSize: 10.5 }}>—</td>
                        <td style={{ ...tdNum, color: C.muted, fontSize: 10.5 }}>{mag(E(s.id, emp))}</td>
                        <td style={tdBase} /><td style={tdBase} />
                        <td style={{ ...tdNum, color: C.muted, fontSize: 10.5 }}>{mag(K(s.id, emp))}</td>
                      </tr>
                    ))}
                  </Frag>
                );
              })}
            </Frag>
          );
        })}
        <tr style={{ background: C.tealSoft, borderTop: `1px solid ${C.rule}` }}>
          <td style={{ ...tdBase, fontWeight: 600, fontSize: 11.5 }}>TOTAL {titulo}</td>
          <td style={tdBase} />
          {modo === "control" ? celdasCtrl(p, e, k, "t" + nat) : (
            <>
              <td style={{ ...tdNum, fontWeight: 600 }}>{a ? mag(a) : "—"}</td>
              <td style={{ ...tdNum, fontWeight: 600 }}>{p ? mag(p) : "—"}</td>
              <td style={{ ...tdNum, fontWeight: 600, fontSize: 11 }}><Var p={p} a={a} /></td>
              <td style={tdBase} />
            </>
          )}
        </tr>
      </Frag>
    );
  };

  return (
    <>
      <Cabecera titulo={`Presupuesto anual ${AÑO}`}
        bajada="Un solo presupuesto consolidado para las cuatro empresas Adapsys, dividido en gastos de inversión y gastos operativos." />

      {filtroDistinto && (
        <Aviso tono={C.amber} bg={C.amberSoft}>
          El presupuesto es consolidado y siempre usa las cuatro empresas Adapsys, sin importar el filtro de arriba. El resto de las vistas sí lo respeta.
        </Aviso>
      )}

      <div style={{ display: "flex", gap: 24, padding: "14px 18px", border: `1px solid ${C.rule}`, background: C.surface, borderRadius: 4, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <Cifra rotulo="Año transcurrido" texto={(pctAño * 100).toFixed(0) + "%"} tono={C.muted} />
        <Cifra rotulo="Inversión" texto={mag(totalInv)} tono={C.ink} />
        <Cifra rotulo="Operativo" texto={mag(totalOp)} tono={C.ink} />
        <Cifra rotulo="Ingresos presupuestados" texto={mag(totalIng)} tono={C.teal} />
        <Cifra rotulo="Ejecutado gasto" texto={mag(ejecInv + ejecOp)} tono={C.ink} fuerte />
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <label title="Tipo de cambio fijo del presupuesto. Se define al armarlo y no se mueve durante el año."
            style={{ display: "flex", alignItems: "center", gap: 5, border: `1px solid ${C.rule}`, borderRadius: 3, padding: "3px 7px", background: C.paper }}>
            <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".06em", textTransform: "uppercase", color: C.muted }}>TC ppto</span>
            <input value={tc} onChange={(e) => setTc(Number(e.target.value) || 0)}
              style={{ width: 46, fontFamily: MONO, fontSize: 11, border: "none", background: "transparent", textAlign: "right" }} />
          </label>
          <SelectorLineas sel={subsPpto} setSel={setSubsPpto} etiqueta="En control" />
          <Chip activo={modo === "construccion"} onClick={() => setModo(modo === "control" ? "construccion" : "control")}>
            {modo === "control" ? "Vista control" : "Vista construcción"}
          </Chip>
          {modo === "control" && <Chip activo={incluirProy} onClick={() => setIncluirProy(!incluirProy)}>{incluirProy ? "Real + proyectado" : "Solo real"}</Chip>}
          <Chip activo={nivel !== "cat"} onClick={() => setNivel(nivel === "cat" ? "sub" : nivel === "sub" && modo === "control" ? "emp" : "cat")}>
            {{ cat: "Solo categorías", sub: "Con subcategorías", emp: "Abierto por empresa" }[nivel]}
          </Chip>
        </div>
      </div>

      {excluidas.length > 0 && (
        <Aviso tono={C.muted} bg={C.paper}>
          <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".06em", textTransform: "uppercase", color: C.muted }}>Fuera del control</span>{" "}
          {excluidas.map((s) => s.nombre).join(" · ")} — <span style={{ color: C.muted }}>{mag(agg(K, excluidas.map((s) => s.id)))} sin comparar contra presupuesto.</span>
        </Aviso>
      )}

      <div style={{ border: `1px solid ${C.rule}`, borderRadius: 4, background: C.surface, overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: modo === "control" ? 940 : 900 }}>
          <thead><tr>
            <th style={{ ...thBase, textAlign: "left", minWidth: 240, background: "#2C4A4A", color: "#fff" }}>Gasto</th>
            {cols.map((h, i) => (
              <th key={h} style={{ ...thBase, textAlign: i === 0 || h === "Notas" || h === "% utilizado" ? "left" : "right",
                background: i === 0 ? "#2C4A4A" : "#5FAFA8", color: "#fff", minWidth: h === "Notas" ? 170 : undefined }}>{h}</th>))}
          </tr></thead>
          <tbody>
            {filaSeccion("ingreso", "Ingresos")}
            {filaSeccion("inversion", "Gastos de Inversión")}
            {filaSeccion("operativo", "Gastos Operativos")}
            {modo === "control" && (
              <tr style={{ borderTop: `2px solid ${C.ink}` }}>
                <td style={{ ...tdBase, fontWeight: 600 }}>Proyección de cierre del año</td>
                <td colSpan={cols.length - 1} />
                <td style={{ ...tdNum, fontWeight: 600 }}>{mag(cierreTot)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Nota>
        El <strong>TC presupuesto</strong> es un tipo de cambio fijo definido al armar el año: mantenerlo quieto separa la desviación por gasto de la desviación por dólar.
        Los montos se muestran en magnitud, como en la planilla. En <strong>vista construcción</strong> editas el presupuesto del año, el del año anterior, el responsable y las notas;
        la variación se calcula sola. En <strong>vista control</strong> la marca gris de cada barra es el avance del año ({(pctAño * 100).toFixed(0)}%) y la oscura, dónde cerraría con lo ya proyectado.
      </Nota>
    </>
  );
}
const inpNum = { width: 112, textAlign: "right", fontFamily: MONO, fontSize: 11, padding: "2px 5px", border: `1px solid ${C.ruleSoft}`, borderRadius: 2, background: C.surface };

/* ─────────────────────────  REPORTES  ───────────────────────── */
function Reportes({ movs, sel, reportes, setReportes }) {
  const { cats, subs, subDe, catDe } = useCat();
  const todasSubs = useMemo(() => subs.map((s) => s.id), [subs]);
  const [cfg, setCfg] = useState({ filas: "sub", cols: "mes", rango: "año", desde: `${AÑO}-01-01`, hasta: `${AÑO}-12-31`,
    estados: ["conciliado", "pagado", "proyectado"], signo: "todos", subs: null });
  const [nombre, setNombre] = useState("");
  const set = (k, v) => setCfg((p) => ({ ...p, [k]: v }));
  const subsSel = cfg.subs ?? todasSubs;
  const natDe = (m) => NATURALEZAS.find((n) => n.id === subDe(m.sub).nat)?.nombre || "—";

  const aplicarRango = (id) => {
    const r = RANGOS.find((x) => x.id === id);
    if (!r) return set("rango", "libre");
    const [a, b] = r.calc();
    setCfg((p) => ({ ...p, rango: id, desde: a, hasta: b }));
  };
  const datos = expandir(movs.filter((m) => m.fecha >= cfg.desde && m.fecha <= cfg.hasta && cfg.estados.includes(m.estado)))
    .filter((m) => subsSel.includes(m.sub) && (cfg.signo === "todos" || (cfg.signo === "egresos" ? enCLP(m) < 0 : enCLP(m) > 0)));

  const keyFila = (m) => cfg.filas === "sub" ? subDe(m.sub).nombre : cfg.filas === "cat" ? catDe(subDe(m.sub).cat).nombre
    : cfg.filas === "nat" ? natDe(m) : cfg.filas === "empresa" ? empDe(m.empresa).nombre : m.payee;
  const keyCol = (m) => {
    if (cfg.cols === "total") return "Total";
    if (cfg.cols === "mes") return MESC[Number(m.fecha.slice(5, 7)) - 1];
    if (cfg.cols === "trim") return "T" + Math.ceil(Number(m.fecha.slice(5, 7)) / 3);
    if (cfg.cols === "cat") return catDe(subDe(m.sub).cat).nombre;
    if (cfg.cols === "nat") return natDe(m);
    return empDe(m.empresa).corto;
  };
  const cols = useMemo(() => {
    const s = [...new Set(datos.map(keyCol))];
    if (cfg.cols === "mes") return MESC.filter((x) => s.includes(x));
    if (cfg.cols === "trim") return ["T1", "T2", "T3", "T4"].filter((t) => s.includes(t));
    if (cfg.cols === "empresa") return EMPRESAS.filter((e) => s.includes(e.corto)).map((e) => e.corto);
    if (cfg.cols === "cat") return cats.filter((c) => s.includes(c.nombre)).map((c) => c.nombre);
    if (cfg.cols === "nat") return NATURALEZAS.filter((n) => s.includes(n.nombre)).map((n) => n.nombre);
    return s;
  }, [datos, cfg.cols, cats]);
  const pivot = useMemo(() => {
    const t = {};
    datos.forEach((m) => { const f = keyFila(m), c = keyCol(m); t[f] = t[f] || {}; t[f][c] = (t[f][c] || 0) + enCLP(m); });
    return t;
  }, [datos, cfg.filas, cfg.cols]);
  const rows = Object.keys(pivot).sort((a, b) => cols.reduce((s, c) => s + (pivot[a][c] || 0), 0) - cols.reduce((s, c) => s + (pivot[b][c] || 0), 0));
  const totCol = (c) => rows.reduce((s, r) => s + (pivot[r][c] || 0), 0);
  const totFila = (r) => cols.reduce((s, c) => s + (pivot[r][c] || 0), 0);
  const granTotal = cols.reduce((s, c) => s + totCol(c), 0);

  const csv = () => {
    const l = [["Fila", ...cols, "Total"].join(";")];
    rows.forEach((r) => l.push([r, ...cols.map((c) => Math.round(pivot[r][c] || 0)), Math.round(totFila(r))].join(";")));
    l.push(["Total", ...cols.map((c) => Math.round(totCol(c))), Math.round(granTotal)].join(";"));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\uFEFF" + l.join("\n")], { type: "text/csv;charset=utf-8" }));
    a.download = `reporte-${cfg.filas}-${cfg.cols}-${cfg.desde}.csv`;
    a.click();
  };
  const guardar = () => { if (nombre.trim()) { setReportes([...reportes, { id: Date.now(), nombre: nombre.trim(), cfg, empresas: sel }]); setNombre(""); } };
  const selEstado = (e) => set("estados", cfg.estados.includes(e) ? cfg.estados.filter((x) => x !== e) : [...cfg.estados, e]);
  const lbl = { fontFamily: MONO, fontSize: 9, letterSpacing: ".09em", textTransform: "uppercase", color: C.muted, display: "block", marginBottom: 4 };
  const inp = { padding: "5px 7px", border: `1px solid ${C.rule}`, borderRadius: 3, background: C.surface, fontSize: 11.5, width: "100%" };

  return (
    <>
      <Cabecera titulo="Reportes" bajada="Elige el nivel de detalle, el período y qué subcategorías entran. Guarda la configuración para volver a correrla igual." />
      <div style={{ border: `1px solid ${C.rule}`, borderRadius: 4, background: C.surface, padding: 14, marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 5, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ ...lbl, marginBottom: 0, marginRight: 3 }}>Período</span>
          {RANGOS.map((r) => <Chip key={r.id} chico activo={cfg.rango === r.id} onClick={() => aplicarRango(r.id)}>{r.nombre}</Chip>)}
          <input type="date" value={cfg.desde} onChange={(e) => setCfg((p) => ({ ...p, desde: e.target.value, rango: "libre" }))} style={{ ...inp, width: 132 }} />
          <span style={{ color: C.muted, fontSize: 11 }}>a</span>
          <input type="date" value={cfg.hasta} onChange={(e) => setCfg((p) => ({ ...p, hasta: e.target.value, rango: "libre" }))} style={{ ...inp, width: 132 }} />
        </div>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))" }}>
          <div><label style={lbl}>Filas</label>
            <select value={cfg.filas} onChange={(e) => set("filas", e.target.value)} style={inp}>
              <option value="sub">Subcategoría</option><option value="cat">Categoría</option><option value="nat">Inversión / Operativo</option>
              <option value="empresa">Empresa</option><option value="payee">Proveedor / cliente</option></select></div>
          <div><label style={lbl}>Columnas</label>
            <select value={cfg.cols} onChange={(e) => set("cols", e.target.value)} style={inp}>
              <option value="mes">Mes</option><option value="trim">Trimestre</option><option value="empresa">Empresa</option>
              <option value="cat">Categoría</option><option value="nat">Inversión / Operativo</option><option value="total">Solo total</option></select></div>
          <div><label style={lbl}>Signo</label>
            <select value={cfg.signo} onChange={(e) => set("signo", e.target.value)} style={inp}>
              <option value="todos">Todo</option><option value="egresos">Solo egresos</option><option value="ingresos">Solo ingresos</option></select></div>
          <div><label style={lbl}>Estados</label>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {["conciliado", "pagado", "proyectado"].map((e) => (
                <Chip key={e} chico activo={cfg.estados.includes(e)} onClick={() => selEstado(e)}>{e.slice(0, 4)}</Chip>))}</div></div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center", flexWrap: "wrap", borderTop: `1px solid ${C.ruleSoft}`, paddingTop: 12 }}>
          <SelectorLineas sel={subsSel} setSel={(v) => set("subs", v)} etiqueta="Subcategorías" />
          <input placeholder="Nombre del reporte" value={nombre} onChange={(e) => setNombre(e.target.value)} style={{ ...inp, width: 178 }} />
          <button onClick={guardar} style={{ ...btnGhost, borderColor: C.ink, color: C.ink }}>Guardar</button>
          <button onClick={csv} style={{ ...btnGhost, borderColor: C.ink, color: C.ink }}>Descargar CSV</button>
          <span style={{ fontSize: 11, color: C.muted, marginLeft: "auto" }}>{datos.length} movimientos</span>
        </div>
        {reportes.length > 0 && (
          <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <Rotulo texto="Guardados" />
            {reportes.map((r) => (
              <span key={r.id} style={{ display: "flex", alignItems: "center", gap: 5, border: `1px solid ${C.rule}`, borderRadius: 3, padding: "2px 4px 2px 9px", background: C.paper }}>
                <button onClick={() => setCfg(r.cfg)} style={{ background: "none", border: "none", fontSize: 11, padding: 0 }}>{r.nombre}</button>
                <button onClick={() => setReportes(reportes.filter((x) => x.id !== r.id))} style={{ background: "none", border: "none", color: C.muted, fontSize: 12, lineHeight: 1, padding: "0 3px" }}>×</button>
              </span>))}
          </div>
        )}
      </div>
      {rows.length === 0 ? <Vacio>Ningún movimiento calza con estos filtros.</Vacio> : (
        <div style={{ border: `1px solid ${C.rule}`, borderRadius: 4, background: C.surface, overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead><tr>
              <th style={{ ...thBase, textAlign: "left", position: "sticky", left: 0, background: C.surface, minWidth: 210 }}>
                {{ sub: "Subcategoría", cat: "Categoría", nat: "Naturaleza", empresa: "Empresa", payee: "Proveedor" }[cfg.filas]}</th>
              {cols.map((c) => <th key={c} style={{ ...thBase, textAlign: "right" }}>{c}</th>)}
              <th style={{ ...thBase, textAlign: "right", borderLeft: `1px solid ${C.rule}` }}>Total</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr className="row" key={r} style={{ borderTop: `1px solid ${C.ruleSoft}` }}>
                  <td style={{ ...tdBase, position: "sticky", left: 0, background: C.surface }}>{r}</td>
                  {cols.map((c) => { const v = pivot[r][c] || 0;
                    return <td key={c} style={{ ...tdNum, color: v === 0 ? "#C3C7C0" : v < 0 ? C.brick : C.teal }}>{v ? clpK(v) : "—"}</td>; })}
                  <td style={{ ...tdNum, fontWeight: 600, borderLeft: `1px solid ${C.rule}` }}>{clp(totFila(r))}</td>
                </tr>))}
              <tr style={{ borderTop: `1.5px solid ${C.rule}` }}>
                <td style={{ ...tdBase, fontWeight: 600, position: "sticky", left: 0, background: C.surface }}>Total</td>
                {cols.map((c) => <td key={c} style={{ ...tdNum, fontWeight: 600 }}>{clpK(totCol(c))}</td>)}
                <td style={{ ...tdNum, fontWeight: 600, borderLeft: `1px solid ${C.rule}` }}>{clp(granTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ─────────────────────────  CATÁLOGO  ───────────────────────── */
function Catalogo({ movs }) {
  const { cats, subs, setCats, setSubs, subsDe } = useCat();
  const [txt, setTxt] = useState("");
  const [modo, setModo] = useState("agregar");
  const [previo, setPrevio] = useState(null);
  const [q, setQ] = useState("");
  const [abiertas, setAbiertas] = useState([]);
  const uso = useMemo(() => { const u = {}; movs.forEach((m) => (u[m.sub] = (u[m.sub] || 0) + 1)); return u; }, [movs]);
  const huerfanos = movs.filter((m) => !subs.find((s) => s.id === m.sub)).length;
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const buscando = q.trim().length > 1;
  const visibles = (cid) => (buscando ? subsDe(cid).filter((s) => norm(s.nombre).includes(norm(q))) : subsDe(cid));

  const aplicar = () => {
    if (!previo) return;
    if (modo === "reemplazar") { setCats(previo.cats); setSubs(previo.subs); }
    else {
      setCats((p) => [...p, ...previo.cats.filter((c) => !p.find((x) => x.id === c.id))]);
      setSubs((p) => [...p, ...previo.subs.filter((s) => !p.find((x) => x.id === s.id))]);
    }
    setPrevio(null); setTxt("");
  };
  const renCat = (id, v) => setCats((p) => p.map((c) => (c.id === id ? { ...c, nombre: v } : c)));
  const renSub = (id, v) => setSubs((p) => p.map((s) => (s.id === id ? { ...s, nombre: v } : s)));
  const setNat = (id, v) => setSubs((p) => p.map((s) => (s.id === id ? { ...s, nat: v } : s)));
  const setNatCat = (cid, v) => setSubs((p) => p.map((s) => (s.cat === cid ? { ...s, nat: v } : s)));
  const toggleCtrl = (id) => setCats((p) => p.map((c) => (c.id === id ? { ...c, controlado: !c.controlado } : c)));
  const nuevaSub = (catId) => { const n = prompt("Nombre de la subcategoría");
    if (n?.trim()) setSubs((p) => [...p, { id: slug(catId + "-" + n) + "-" + Date.now().toString(36).slice(-3), cat: catId, nombre: n.trim(), nat: "operativo" }]); };
  const nuevaCat = () => {
    const n = prompt("Nombre de la categoría"); if (!n?.trim()) return;
    const id = slug(n) + "-" + Date.now().toString(36).slice(-3);
    setCats((p) => [...p, { id, nombre: n.trim(), controlado: true }]);
    setSubs((p) => [...p, { id: id + "-gen", cat: id, nombre: n.trim(), nat: "operativo" }]);
  };
  const borrarSub = (id) => { if (!uso[id] || confirm(`Esa subcategoría tiene ${uso[id]} movimientos, que quedarán sin clasificar. ¿Continuar?`)) setSubs((p) => p.filter((s) => s.id !== id)); };
  const borrarCat = (id) => { if (confirm("Se elimina la categoría y sus subcategorías. ¿Continuar?")) { setSubs((p) => p.filter((s) => s.cat !== id)); setCats((p) => p.filter((c) => c.id !== id)); } };
  const inp = { padding: "5px 7px", border: "1px solid transparent", borderRadius: 3, background: "transparent", fontSize: 12 };

  return (
    <>
      <Cabecera titulo="Categorías y subcategorías" bajada="El catálogo que ordena todo: flujo, presupuesto y reportes. Cada categoría pertenece a una naturaleza: ingreso, inversión u operativo." />
      {huerfanos > 0 && (
        <Aviso tono={C.amber} bg={C.amberSoft}>
          Hay <strong>{huerfanos} movimientos</strong> apuntando a subcategorías que ya no existen. Reclasifícalos desde Movimientos.
        </Aviso>
      )}
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "minmax(340px,1fr) minmax(280px,370px)", alignItems: "start" }}>
        <div style={{ border: `1px solid ${C.rule}`, borderRadius: 4, background: C.surface }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: `1px solid ${C.rule}` }}>
            <Rotulo texto={`${cats.length} categorías · ${subs.length} subcategorías`} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar"
              style={{ marginLeft: "auto", width: 150, padding: "5px 8px", border: `1px solid ${C.rule}`, borderRadius: 3, fontSize: 11.5, background: C.paper }} />
            <button onClick={() => setAbiertas(abiertas.length ? [] : cats.map((c) => c.id))} style={btnGhost}>
              {abiertas.length ? "Colapsar" : "Expandir"}</button>
            <button onClick={nuevaCat} style={{ ...btnGhost, borderColor: C.ink, color: C.ink }}>+ Categoría</button>
          </div>
          <div style={{ maxHeight: "68vh", overflowY: "auto" }}>
          {cats.filter((c) => !buscando || visibles(c.id).length).map((c) => {
            const vs = visibles(c.id);
            const desplegada = buscando || abiertas.includes(c.id);
            const mezcla = [...new Set(subsDe(c.id).map((s) => s.nat))];
            return (
              <div key={c.id} style={{ borderBottom: `1px solid ${C.ruleSoft}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", background: C.paper }}>
                  <button onClick={() => setAbiertas(desplegada ? abiertas.filter((x) => x !== c.id) : [...abiertas, c.id])}
                    style={{ background: "none", border: "none", color: C.muted, fontSize: 9, padding: 0, width: 12, flexShrink: 0 }}>{desplegada ? "▾" : "▸"}</button>
                  <input value={c.nombre} onChange={(e) => renCat(c.id, e.target.value)} style={{ ...inp, fontWeight: 600, flex: 1, minWidth: 80 }} />
                  <span style={{ fontFamily: MONO, fontSize: 9, color: "#B8BDB6" }}>{vs.length}</span>
                  <span style={{ ...badge, background: mezcla.length > 1 ? C.amberSoft : C.ruleSoft, color: mezcla.length > 1 ? C.amber : C.muted }}
                    title="Naturaleza de sus subcategorías">{mezcla.length > 1 ? "mixta" : mezcla[0] || "—"}</span>
                  <select value="" onChange={(e) => e.target.value && setNatCat(c.id, e.target.value)} style={{ ...selMini, fontSize: 9 }} title="Aplicar naturaleza a todas">
                    <option value="">aplicar…</option>
                    {NATURALEZAS.map((x) => <option key={x.id} value={x.id}>{x.id}</option>)}</select>
                  <button onClick={() => toggleCtrl(c.id)} style={{ ...badge, cursor: "pointer", border: "none", color: c.controlado ? C.ink : C.amber, background: c.controlado ? C.ruleSoft : C.amberSoft }}>
                    {c.controlado ? "en control" : "fuera"}</button>
                  <button onClick={() => nuevaSub(c.id)} style={{ ...btnGhost, padding: "3px 6px" }}>+ sub</button>
                  <button onClick={() => borrarCat(c.id)} style={{ background: "none", border: "none", color: C.muted, fontSize: 14, padding: "0 3px" }}>×</button>
                </div>
                {desplegada && vs.map((s) => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 14px 3px 34px" }}>
                    <input value={s.nombre} onChange={(e) => renSub(s.id, e.target.value)} style={{ ...inp, flex: 1, minWidth: 90, fontSize: 11.5 }} />
                    <select value={s.nat} onChange={(e) => setNat(s.id, e.target.value)}
                      style={{ ...selMini, fontFamily: SANS, fontSize: 10, color: s.nat === "ingreso" ? C.teal : s.nat === "inversion" ? C.ink : C.muted }}>
                      {NATURALEZAS.map((x) => <option key={x.id} value={x.id}>{x.id}</option>)}</select>
                    <span style={{ fontFamily: MONO, fontSize: 9.5, color: C.muted, minWidth: 50, textAlign: "right" }}>{uso[s.id] || 0} movs</span>
                    <button onClick={() => borrarSub(s.id)} style={{ background: "none", border: "none", color: C.muted, fontSize: 13, padding: "0 3px" }}>×</button>
                  </div>))}
              </div>);
          })}
          </div>
        </div>

        <div style={{ border: `1px solid ${C.rule}`, borderRadius: 4, background: C.surface, padding: 14 }}>
          <Rotulo texto="Cargar listado" />
          <p style={{ fontSize: 11, color: C.muted, lineHeight: 1.55, margin: "6px 0 8px" }}>
            Pega tu listado. Acepta <code style={code}>Categoría:Subcategoría</code> o categorías al margen con subcategorías indentadas.
            Una línea sola que diga <code style={code}>Gastos de Inversión</code>, <code style={code}>Gastos Operativos</code> o <code style={code}>Ingresos</code> cambia la sección de ahí en adelante.
          </p>
          <textarea value={txt} onChange={(e) => { setTxt(e.target.value); setPrevio(null); }} rows={10}
            placeholder={"Gastos de Inversión\nComercial y marketing\n  Alianzas\n  Estudios públicos\n  Marketing digital\nRecursos humanos\n  Capacitación\n\nGastos Operativos\nGastos Administración:Arriendos\nSistemas Digitales operativos:Licencias"}
            style={{ width: "100%", padding: 9, border: `1px solid ${C.rule}`, borderRadius: 3, fontFamily: MONO, fontSize: 10.5, lineHeight: 1.5, resize: "vertical", background: C.paper }} />
          <div style={{ display: "flex", gap: 5, margin: "8px 0", flexWrap: "wrap" }}>
            <Chip chico activo={modo === "agregar"} onClick={() => setModo("agregar")}>Agregar</Chip>
            <Chip chico activo={modo === "reemplazar"} onClick={() => setModo("reemplazar")}>Reemplazar todo</Chip>
            <button onClick={() => txt.trim() && setPrevio(parseCatalogo(txt))} style={{ ...btnGhost, marginLeft: "auto", borderColor: C.ink, color: C.ink }}>Previsualizar</button>
          </div>
          {previo && (
            <div style={{ border: `1px solid ${C.ink}`, borderRadius: 3, padding: 10, background: C.paper }}>
              <div style={{ fontSize: 11.5, marginBottom: 7 }}>
                <strong>{previo.cats.length}</strong> categorías y <strong>{previo.subs.length}</strong> subcategorías detectadas.
                {modo === "reemplazar" && <div style={{ color: C.brick, marginTop: 4 }}>Reemplazar deja sin clasificar los movimientos cuyas subcategorías no estén en el listado nuevo.</div>}
              </div>
              <div style={{ maxHeight: 150, overflowY: "auto", fontFamily: MONO, fontSize: 10, lineHeight: 1.6, color: C.muted, marginBottom: 8 }}>
                {NATURALEZAS.map((n) => previo.subs.some((s) => s.nat === n.id) && (
                  <div key={n.id}>
                    <div style={{ color: C.teal, marginTop: 4 }}>{n.nombre.toUpperCase()}</div>
                    {previo.cats.filter((c) => previo.subs.some((s) => s.cat === c.id && s.nat === n.id)).map((c) => (
                      <div key={c.id}>
                        <span style={{ color: C.ink }}>{c.nombre}</span>
                        {previo.subs.filter((s) => s.cat === c.id && s.nat === n.id).map((s) => <div key={s.id} style={{ paddingLeft: 12 }}>{s.nombre}</div>)}
                      </div>))}
                  </div>))}
              </div>
              <button onClick={aplicar} style={{ width: "100%", padding: "7px", background: C.ink, color: C.surface, border: "none", borderRadius: 3, fontFamily: MONO, fontSize: 11, letterSpacing: ".05em" }}>
                {modo === "reemplazar" ? "REEMPLAZAR CATÁLOGO" : "AGREGAR AL CATÁLOGO"}</button>
            </div>
          )}
        </div>
      </div>
      <Nota>
        <strong>Naturaleza</strong> define si la categoría va en Ingresos, Gastos de Inversión o Gastos Operativos — es la división de primer nivel del presupuesto.
        <strong> En control</strong> define si entra al control presupuestario. Una categoría sin subcategorías recibe una con el mismo nombre, para que todo movimiento apunte a una hoja del árbol.
      </Nota>
    </>
  );
}
const code = { fontFamily: MONO, fontSize: 10, background: C.ruleSoft, padding: "1px 4px", borderRadius: 2 };

/* ─────────────────────────  PIEZAS  ───────────────────────── */
const thBase = { fontFamily: MONO, fontSize: 9.5, fontWeight: 500, letterSpacing: ".09em", textTransform: "uppercase", color: C.muted, padding: "9px 10px", borderBottom: `1px solid ${C.rule}`, whiteSpace: "nowrap" };
const tdBase = { padding: "6px 10px", verticalAlign: "middle", fontSize: 12 };
const tdNum = { ...tdBase, textAlign: "right", fontFamily: MONO, fontSize: 11.5, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
const btnGhost = { fontFamily: MONO, fontSize: 9.5, letterSpacing: ".05em", textTransform: "uppercase", padding: "5px 9px", border: `1px solid ${C.rule}`, borderRadius: 3, background: C.paper, color: C.muted };
const badge = { fontFamily: MONO, fontSize: 8.5, letterSpacing: ".07em", textTransform: "uppercase", padding: "2px 6px", borderRadius: 2, color: C.muted, background: C.ruleSoft };

const Chip = ({ activo, onClick, children, chico }) => (
  <button onClick={onClick} style={{ fontFamily: MONO, fontSize: chico ? 9 : 10, letterSpacing: ".05em", textTransform: "uppercase",
    padding: chico ? "4px 7px" : "5px 10px", borderRadius: 3, whiteSpace: "nowrap",
    border: `1px solid ${activo ? C.ink : C.rule}`, background: activo ? C.ink : C.surface, color: activo ? C.surface : C.muted }}>{children}</button>
);
function Pill({ estado }) {
  const s = estado === "conciliado" ? { t: "Conciliado", c: C.teal, b: C.tealSoft } : { t: "Pagado", c: C.amber, b: C.amberSoft };
  return <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: ".05em", textTransform: "uppercase", color: s.c, background: s.b, padding: "3px 8px", borderRadius: 3 }}>{s.t}</span>;
}
const Cabecera = ({ titulo, bajada }) => (
  <div style={{ marginBottom: 14 }}>
    <h1 style={{ fontSize: 19, fontWeight: 600, margin: 0, letterSpacing: "-0.02em" }}>{titulo}</h1>
    <p style={{ margin: "3px 0 0", color: C.muted, fontSize: 12, maxWidth: 760, lineHeight: 1.5 }}>{bajada}</p>
  </div>
);
const Aviso = ({ children, tono, bg }) => (
  <div style={{ background: bg, borderLeft: `2px solid ${tono}`, padding: "9px 13px", marginBottom: 12, fontSize: 12, borderRadius: "0 3px 3px 0" }}>{children}</div>
);
const Nota = ({ children }) => (
  <p style={{ fontSize: 11, color: C.muted, marginTop: 10, lineHeight: 1.6, maxWidth: 780 }}>{children}</p>
);
const Vacio = ({ children }) => (
  <div style={{ border: `1px dashed ${C.rule}`, borderRadius: 4, padding: 34, textAlign: "center", color: C.muted, fontSize: 12, background: C.surface }}>{children}</div>
);
