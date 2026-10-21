// Catálogo real de Adapsys — 16 grupos, 290 categorías y 3 subcategorías (CLAUDE.md §5).
// Generado una vez desde tesoreria.jsx con scripts/gen_catalogo.py.
// ESTA es la fuente de verdad: scripts/gen_seed.py lee este archivo para
// producir supabase/seed.sql. Editar acá, nunca el SQL.

import type { Grupo, Cuenta, Empresa, Naturaleza, Categoria, Subcategoria } from "@/lib/tipos";

/** Etiqueta larga de cada grupo de empresas, para la UI. No confundir con GRUPOS,
 *  que son los del catálogo: acá "grupo" agrupa sociedades (§2), allá agrupa
 *  categorías (§5). */
export const GRUPOS_EMPRESA = [
  { id: "Adapsys" as const, nombre: "Adapsys" },
  { id: "Relacionadas" as const, nombre: "Empresas relacionadas" },
];

export const EMPRESAS: Empresa[] = [
  { id: "adap", nombre: "CLA ADAPTACIÓN", corto: "ADAP", grupo: "Adapsys" },
  { id: "cons", nombre: "CLA CONSULTORES", corto: "CONS", grupo: "Adapsys" },
  { id: "clting", nombre: "CLA CONSULTING", corto: "CLTG", grupo: "Adapsys" },
  { id: "ctria", nombre: "CLA CONSULTORIA", corto: "CTRIA", grupo: "Adapsys" },
  { id: "sm", nombre: "SANTA MARÍA", corto: "SM", grupo: "Relacionadas" },
];

export const IDS_ADAPSYS = EMPRESAS.filter((e) => e.grupo === "Adapsys").map((e) => e.id);

/** Presets del filtro global de empresas. */
export const PRESETS_EMPRESA = [
  { id: "ads", nombre: "Adapsys", ids: IDS_ADAPSYS },
  { id: "todas", nombre: "Todas", ids: EMPRESAS.map((e) => e.id) },
  { id: "rel", nombre: "Relacionadas", ids: ["sm"] },
];

// saldo_inicial = la fila "Opening Balance" del registro de Quicken, no el saldo
// de hoy: el saldo corriente sale de sumarle los movimientos importados. Cuatro
// cuentas traen esa fila; el resto parte de cero porque su registro empieza con
// el primer movimiento real.
export const CUENTAS: Cuenta[] = [
  { id: "a1", empresa_id: "adap", nombre: "CLA ADAPTACIÓN PESOS", moneda: "CLP", tipo: "banco", saldo_inicial: 74220512, principal: true, numero: null },
  { id: "a2", empresa_id: "adap", nombre: "CLA ADAPTACIÓN DÓLAR", moneda: "USD", tipo: "banco", saldo_inicial: 507.66, principal: false, numero: null },
  { id: "b1", empresa_id: "cons", nombre: "CLA CONSULTORES PESOS", moneda: "CLP", tipo: "banco", saldo_inicial: 53058579, principal: true, numero: null },
  { id: "b2", empresa_id: "cons", nombre: "CLA CONSULTORES DÓLAR", moneda: "USD", tipo: "banco", saldo_inicial: 72000, principal: false, numero: null },
  { id: "c1", empresa_id: "clting", nombre: "CLA CONSULTING PESOS", moneda: "CLP", tipo: "banco", saldo_inicial: 0, principal: true, numero: null },
  { id: "c2", empresa_id: "clting", nombre: "CLA CONSULTING DÓLAR", moneda: "USD", tipo: "banco", saldo_inicial: 0, principal: false, numero: null },
  { id: "d1", empresa_id: "ctria", nombre: "CLA CONSULTORIA PESOS", moneda: "CLP", tipo: "banco", saldo_inicial: 0, principal: true, numero: null },
  { id: "e1", empresa_id: "sm", nombre: "SANTA MARÍA PESOS", moneda: "CLP", tipo: "banco", saldo_inicial: 0, principal: true, numero: null },
  { id: "e2", empresa_id: "sm", nombre: "SANTA MARÍA DÓLAR", moneda: "USD", tipo: "banco", saldo_inicial: 0, principal: false, numero: null },
  // Cuentas auxiliares: no son bancos, son la cartera de lo que está por entrar.
  // Cuelgan de CLA ADAPTACIÓN por tener que colgar de alguna, pero sus movimientos
  // llevan la empresa real en `empresa_id` — la cartera es de las cuatro.
  //
  // Facturas por cobrar y proyectos aprobados van separados a propósito: la
  // factura es un documento emitido con número (FA273) y el proyecto aprobado es
  // una estimación cuya fecha se mueve semana a semana según avanza el proyecto.
  // Juntarlos haría que la proyección de ingresos trate como igual de firme algo
  // que no lo es.
  { id: "x1", empresa_id: "adap", nombre: "Facturas por cobrar CLP", moneda: "CLP", tipo: "cxc", saldo_inicial: 0, principal: false, numero: null },
  { id: "x2", empresa_id: "adap", nombre: "Facturas por cobrar USD", moneda: "USD", tipo: "cxc", saldo_inicial: 0, principal: false, numero: null },
  { id: "x3", empresa_id: "adap", nombre: "Proyectos aprobados CLP", moneda: "CLP", tipo: "cxc", saldo_inicial: 0, principal: false, numero: null },
  { id: "x4", empresa_id: "adap", nombre: "Proyectos aprobados USD", moneda: "USD", tipo: "cxc", saldo_inicial: 0, principal: false, numero: null },
  // Registro de control: lo que CLA Perú genera a cuenta nuestra y al revés. No es
  // plata nuestra en ninguna parte y no entra a ninguna vista. Cada semestre se
  // netea y el país que debe transfiere, y ese movimiento —que sí sale del banco—
  // vive en la cuenta dólar de CLA ADAPTACIÓN, no acá.
  { id: "p1", empresa_id: "adap", nombre: "CLA ADAPTACIÓN CC PERÚ", moneda: "USD", tipo: "control", saldo_inicial: 0, principal: false, numero: null },
];

/**
 * La cadena de cobranza: por dónde pasa un ingreso antes de llegar al banco.
 *
 * Un proyecto aprobado es una estimación con fecha que se mueve; cuando se emite
 * la factura pasa a ser un documento con número y fecha firme; cuando se cobra,
 * entra al banco. Son tres estados distintos de certeza y por eso son tres
 * registros y no un campo.
 *
 * Va explícito y no deducido del nombre de la cuenta: si mañana se agrega una
 * etapa o se renombra un registro, se cambia acá y en ningún otro lado.
 */
export const CADENA_COBRANZA: { desde: string; hacia: string }[] = [
  { desde: "x3", hacia: "x1" }, // Proyectos aprobados CLP → Facturas por cobrar CLP
  { desde: "x4", hacia: "x2" }, // Proyectos aprobados USD → Facturas por cobrar USD
];

/** Registros donde la plata está por entrar y todavía no pasó por el banco. */
export const CUENTAS_COBRANZA = ["x1", "x2", "x3", "x4"];

export const NATURALEZAS: { id: Naturaleza; nombre: string }[] = [
  { id: "ingreso", nombre: "Ingresos" },
  { id: "inversion", nombre: "Gastos de Inversión" },
  { id: "operativo", nombre: "Gastos Operativos" },
];

export const RESPONSABLES = [
  "", "I+D", "Analítica avanzada", "Finanzas", "Personas", "Comercial", "Gerencia",
];

// `controlado` decide qué entra al control presupuestario (§4.6). Quedan fuera las
// que no son gasto que se decida presupuestar: impuestos y comisiones bancarias
// salen de lo que se factura y de lo que se mueve, las inversiones y los préstamos
// son movimientos de tesorería, y los retiros de socios son una decisión de los
// dueños. Se excluyen del control pero se siguen mostrando aparte, para que nadie
// olvide que existen.
export const GRUPOS: Grupo[] = [
  { id: "a-ingresos-clientes", nombre: "A INGRESOS CLIENTES", orden: 0, controlado: true },
  { id: "b-otros-ingresos", nombre: "B OTROS INGRESOS", orden: 1, controlado: true },
  { id: "1-costo-de-venta", nombre: "1 COSTO DE VENTA", orden: 2, controlado: true },
  { id: "1-desarrollo-organizaciona", nombre: "1 DESARROLLO ORGANIZACIONAL", orden: 3, controlado: true },
  { id: "2-gastos-administracion", nombre: "2 GASTOS ADMINISTRACIÓN", orden: 4, controlado: true },
  { id: "2-0-comercial-y-marketing", nombre: "2.0 COMERCIAL Y MARKETING", orden: 5, controlado: true },
  { id: "2-1-posicionamiento-nueva", nombre: "2.1 POSICIONAMIENTO NUEVA MARCA", orden: 6, controlado: true },
  { id: "2-2-compra-activos", nombre: "2.2 COMPRA ACTIVOS", orden: 7, controlado: true },
  { id: "2-3-gastos-sistemas-digita", nombre: "2.3 GASTOS SISTEMAS DIGITALES", orden: 8, controlado: true },
  { id: "2-4-equipos-computacionale", nombre: "2.4 EQUIPOS COMPUTACIONALES", orden: 9, controlado: true },
  { id: "3-recursos-humanos", nombre: "3 RECURSOS HUMANOS", orden: 10, controlado: true },
  { id: "4-impuestos", nombre: "4 IMPUESTOS", orden: 11, controlado: false },
  { id: "5-bancos", nombre: "5 BANCOS", orden: 12, controlado: false },
  { id: "6-prestamos-bancarios", nombre: "6 PRESTAMOS BANCARIOS", orden: 13, controlado: false },
  { id: "7-inversiones", nombre: "7 INVERSIONES", orden: 14, controlado: false },
  { id: "8-relacionados-y-socios", nombre: "8 RELACIONADOS Y SOCIOS", orden: 15, controlado: false },
];

export const CATEGORIAS: Categoria[] = [
  { id: "aasa", grupo_id: "a-ingresos-clientes", nombre: "AASA", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "abastible", grupo_id: "a-ingresos-clientes", nombre: "ABASTIBLE", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "acciona", grupo_id: "a-ingresos-clientes", nombre: "ACCIONA", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "achs", grupo_id: "a-ingresos-clientes", nombre: "ACHS", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "adapsys-australia", grupo_id: "a-ingresos-clientes", nombre: "ADAPSYS AUSTRALIA", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "adapsys-colombia", grupo_id: "a-ingresos-clientes", nombre: "ADAPSYS COLOMBIA", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "adapsys-peru", grupo_id: "a-ingresos-clientes", nombre: "ADAPSYS PERÚ", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "adghe", grupo_id: "a-ingresos-clientes", nombre: "ADGHE", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "agrosuper", grupo_id: "a-ingresos-clientes", nombre: "AGROSUPER", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "aislapol", grupo_id: "a-ingresos-clientes", nombre: "AISLAPOL", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "albemarle", grupo_id: "a-ingresos-clientes", nombre: "ALBEMARLE", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "almagro", grupo_id: "a-ingresos-clientes", nombre: "ALMAGRO", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "aln-programa-liderazgo", grupo_id: "a-ingresos-clientes", nombre: "ALN PROGRAMA LIDERAZGO", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "alto-las-condes", grupo_id: "a-ingresos-clientes", nombre: "ALTO LAS CONDES", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "ama-time", grupo_id: "a-ingresos-clientes", nombre: "AMA TIME", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "amsa", grupo_id: "a-ingresos-clientes", nombre: "AMSA", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "anasac", grupo_id: "a-ingresos-clientes", nombre: "ANASAC", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "andritz", grupo_id: "a-ingresos-clientes", nombre: "ANDRITZ", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "angloamerican", grupo_id: "a-ingresos-clientes", nombre: "ANGLOAMERICAN", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "aon-corporation", grupo_id: "a-ingresos-clientes", nombre: "AON CORPORATION", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "arcoprime", grupo_id: "a-ingresos-clientes", nombre: "ARCOPRIME", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "asch", grupo_id: "a-ingresos-clientes", nombre: "ASCH", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "asociacion-de-empresas-familiares", grupo_id: "a-ingresos-clientes", nombre: "ASOCIACIÓN DE EMPRESAS FAMILIARES", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "astrazeneca", grupo_id: "a-ingresos-clientes", nombre: "ASTRAZENECA", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "ausenco", grupo_id: "a-ingresos-clientes", nombre: "AUSENCO", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "banchile", grupo_id: "a-ingresos-clientes", nombre: "BANCHILE", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "banco-bci", grupo_id: "a-ingresos-clientes", nombre: "BANCO BCI", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "banco-central", grupo_id: "a-ingresos-clientes", nombre: "BANCO CENTRAL", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "banco-de-chile", grupo_id: "a-ingresos-clientes", nombre: "BANCO DE CHILE", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "banco-estado-beco", grupo_id: "a-ingresos-clientes", nombre: "BANCO ESTADO BECO", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "banco-itau", grupo_id: "a-ingresos-clientes", nombre: "BANCO ITAÚ", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "banco-santander", grupo_id: "a-ingresos-clientes", nombre: "BANCO SANTANDER", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "bbk", grupo_id: "a-ingresos-clientes", nombre: "BBK", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "bbosch", grupo_id: "a-ingresos-clientes", nombre: "BBOSCH", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "bechtel", grupo_id: "a-ingresos-clientes", nombre: "BECHTEL", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "besalco", grupo_id: "a-ingresos-clientes", nombre: "BESALCO", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "betterfly", grupo_id: "a-ingresos-clientes", nombre: "BETTERFLY", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "bhp-billiton", grupo_id: "a-ingresos-clientes", nombre: "BHP BILLITON", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "bice-corp", grupo_id: "a-ingresos-clientes", nombre: "BICE CORP", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "bice-vida", grupo_id: "a-ingresos-clientes", nombre: "BICE VIDA", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "biodiversa", grupo_id: "a-ingresos-clientes", nombre: "BIODIVERSA", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "blumar", grupo_id: "a-ingresos-clientes", nombre: "BLUMAR", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "burn-to-give", grupo_id: "a-ingresos-clientes", nombre: "BURN TO GIVE", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "c-l-fruit", grupo_id: "a-ingresos-clientes", nombre: "C&L Fruit", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "caja-los-andes", grupo_id: "a-ingresos-clientes", nombre: "CAJA LOS ANDES", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "camara-de-comercio", grupo_id: "a-ingresos-clientes", nombre: "CÁMARA DE COMERCIO", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "cap", grupo_id: "a-ingresos-clientes", nombre: "CAP", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "cardif", grupo_id: "a-ingresos-clientes", nombre: "CARDIF", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "carey", grupo_id: "a-ingresos-clientes", nombre: "CAREY", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "cargill", grupo_id: "a-ingresos-clientes", nombre: "CARGILL", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "caserones-lundin-mining", grupo_id: "a-ingresos-clientes", nombre: "CASERONES LUNDIN MINING", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "cchc", grupo_id: "a-ingresos-clientes", nombre: "CCHC", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "charlas-magistrales", grupo_id: "a-ingresos-clientes", nombre: "CHARLAS MAGISTRALES", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "chilexpress", grupo_id: "a-ingresos-clientes", nombre: "CHILEXPRESS", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "cla-consulting", grupo_id: "a-ingresos-clientes", nombre: "CLA CONSULTING", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "cla-consultores", grupo_id: "a-ingresos-clientes", nombre: "CLA CONSULTORES", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "cla-consultoria", grupo_id: "a-ingresos-clientes", nombre: "CLA CONSULTORÍA", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "clinica-opia", grupo_id: "a-ingresos-clientes", nombre: "CLÍNICA OPIA", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "club-mujeres-empresarias", grupo_id: "a-ingresos-clientes", nombre: "CLUB MUJERES EMPRESARIAS", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "clue", grupo_id: "a-ingresos-clientes", nombre: "CLUE", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "cmpc", grupo_id: "a-ingresos-clientes", nombre: "CMPC", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "cmpc-softys", grupo_id: "a-ingresos-clientes", nombre: "CMPC SOFTYS", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "coasin", grupo_id: "a-ingresos-clientes", nombre: "COASIN", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "coca-cola-andina", grupo_id: "a-ingresos-clientes", nombre: "COCA COLA ANDINA", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "codelco", grupo_id: "a-ingresos-clientes", nombre: "CODELCO", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "colbun", grupo_id: "a-ingresos-clientes", nombre: "COLBUN", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "colegio-alianza-francesa", grupo_id: "a-ingresos-clientes", nombre: "COLEGIO ALIANZA FRANCESA", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "colegio-saint-joseph-school", grupo_id: "a-ingresos-clientes", nombre: "COLEGIO SAINT JOSEPH SCHOOL", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "colmena", grupo_id: "a-ingresos-clientes", nombre: "COLMENA", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "compass", grupo_id: "a-ingresos-clientes", nombre: "COMPASS", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "consalud", grupo_id: "a-ingresos-clientes", nombre: "CONSALUD", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "consorcio", grupo_id: "a-ingresos-clientes", nombre: "CONSORCIO", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "copec", grupo_id: "a-ingresos-clientes", nombre: "COPEC", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "deloitte", grupo_id: "a-ingresos-clientes", nombre: "DELOITTE", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "dfsi", grupo_id: "a-ingresos-clientes", nombre: "DFSI", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "division-andina", grupo_id: "a-ingresos-clientes", nombre: "DIVISIÓN ANDINA", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "division-salvador", grupo_id: "a-ingresos-clientes", nombre: "DIVISIÓN SALVADOR", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "duoc-uc", grupo_id: "a-ingresos-clientes", nombre: "DUOC UC", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "echeverria-izquierdo", grupo_id: "a-ingresos-clientes", nombre: "ECHEVERRÍA IZQUIERDO", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "ecometales", grupo_id: "a-ingresos-clientes", nombre: "ECOMETALES", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "edf", grupo_id: "a-ingresos-clientes", nombre: "EDF", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "egt", grupo_id: "a-ingresos-clientes", nombre: "EGT", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "el-mercurio", grupo_id: "a-ingresos-clientes", nombre: "EL MERCURIO", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "emin", grupo_id: "a-ingresos-clientes", nombre: "EMIN", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "empresas-demaria", grupo_id: "a-ingresos-clientes", nombre: "EMPRESAS DEMARIA", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "empresas-salcobrand", grupo_id: "a-ingresos-clientes", nombre: "EMPRESAS SALCOBRAND", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "empresas-sb", grupo_id: "a-ingresos-clientes", nombre: "EMPRESAS SB", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "empresas-socovesa", grupo_id: "a-ingresos-clientes", nombre: "EMPRESAS SOCOVESA", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "enap", grupo_id: "a-ingresos-clientes", nombre: "ENAP", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "energia-rio-claro", grupo_id: "a-ingresos-clientes", nombre: "ENERGÍA RÍO CLARO", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "entel", grupo_id: "a-ingresos-clientes", nombre: "ENTEL", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "enthalpy", grupo_id: "a-ingresos-clientes", nombre: "ENTHALPY", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "essbio", grupo_id: "a-ingresos-clientes", nombre: "ESSBIO", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "essilorluxottica", grupo_id: "a-ingresos-clientes", nombre: "ESSILORLUXOTTICA", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "essity", grupo_id: "a-ingresos-clientes", nombre: "ESSITY", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "esval", grupo_id: "a-ingresos-clientes", nombre: "ESVAL", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "evol", grupo_id: "a-ingresos-clientes", nombre: "EVOL", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "falabella", grupo_id: "a-ingresos-clientes", nombre: "FALABELLA", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "fedefruta", grupo_id: "a-ingresos-clientes", nombre: "FEDEFRUTA", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "ferradanehme", grupo_id: "a-ingresos-clientes", nombre: "FERRADANEHME", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "finix", grupo_id: "a-ingresos-clientes", nombre: "FINIX", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "fundacion-belen-educa", grupo_id: "a-ingresos-clientes", nombre: "FUNDACIÓN BELEN EDUCA", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "fundacion-gantz", grupo_id: "a-ingresos-clientes", nombre: "FUNDACION GANTZ", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "fundacion-nuestros-hijos", grupo_id: "a-ingresos-clientes", nombre: "FUNDACIÓN NUESTROS HIJOS", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "furoiani", grupo_id: "a-ingresos-clientes", nombre: "FUROIANI", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "goldfield", grupo_id: "a-ingresos-clientes", nombre: "GOLDFIELD", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "grupo-rcd", grupo_id: "a-ingresos-clientes", nombre: "GRUPO RCD", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "grupo-security", grupo_id: "a-ingresos-clientes", nombre: "GRUPO SECURITY", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "grylan", grupo_id: "a-ingresos-clientes", nombre: "GRYLAN", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "gtd", grupo_id: "a-ingresos-clientes", nombre: "GTD", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "hotel-talbot", grupo_id: "a-ingresos-clientes", nombre: "HOTEL TALBOT", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "iconstruye", grupo_id: "a-ingresos-clientes", nombre: "ICONSTRUYE", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "ieside", grupo_id: "a-ingresos-clientes", nombre: "IESIDE", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "iff", grupo_id: "a-ingresos-clientes", nombre: "IFF", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "inchcape", grupo_id: "a-ingresos-clientes", nombre: "INCHCAPE", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "irade", grupo_id: "a-ingresos-clientes", nombre: "IRADE", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "knauf", grupo_id: "a-ingresos-clientes", nombre: "KNAUF", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "komatsu", grupo_id: "a-ingresos-clientes", nombre: "KOMATSU", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "kpmg-chile", grupo_id: "a-ingresos-clientes", nombre: "KPMG CHILE", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "kyndryl", grupo_id: "a-ingresos-clientes", nombre: "KYNDRYL", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "laad", grupo_id: "a-ingresos-clientes", nombre: "LAAD", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "laboratorio-janssen", grupo_id: "a-ingresos-clientes", nombre: "LABORATORIO JANSSEN", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "laboratorios-saval-s-a", grupo_id: "a-ingresos-clientes", nombre: "LABORATORIOS SAVAL S.A.", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "larrain-vial", grupo_id: "a-ingresos-clientes", nombre: "LARRAÍN VIAL", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "mall-plaza", grupo_id: "a-ingresos-clientes", nombre: "MALL PLAZA", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "mas-analytics", grupo_id: "a-ingresos-clientes", nombre: "MAS ANALYTICS", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "mas-errazuriz", grupo_id: "a-ingresos-clientes", nombre: "MAS ERRAZURIZ", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "masisa", grupo_id: "a-ingresos-clientes", nombre: "MASISA", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "metagroup", grupo_id: "a-ingresos-clientes", nombre: "METAGROUP", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "metlife", grupo_id: "a-ingresos-clientes", nombre: "METLIFE", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "metso-chile", grupo_id: "a-ingresos-clientes", nombre: "METSO CHILE", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "minera-florida", grupo_id: "a-ingresos-clientes", nombre: "MINERA FLORIDA", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "minsait-indra", grupo_id: "a-ingresos-clientes", nombre: "MINSAIT INDRA", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "mitsui-auto-finance", grupo_id: "a-ingresos-clientes", nombre: "MITSUI AUTO FINANCE", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "molymet", grupo_id: "a-ingresos-clientes", nombre: "MOLYMET", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "monarch", grupo_id: "a-ingresos-clientes", nombre: "MONARCH", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "mts", grupo_id: "a-ingresos-clientes", nombre: "MTS", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "mutual-de-seguridad", grupo_id: "a-ingresos-clientes", nombre: "MUTUAL DE SEGURIDAD", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "nestle", grupo_id: "a-ingresos-clientes", nombre: "NESTLE", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "nttdata", grupo_id: "a-ingresos-clientes", nombre: "NTTDATA", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "ogilvy", grupo_id: "a-ingresos-clientes", nombre: "Ogilvy", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "ohl", grupo_id: "a-ingresos-clientes", nombre: "OHL", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "old-navy", grupo_id: "a-ingresos-clientes", nombre: "OLD NAVY", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "opia-marketing", grupo_id: "a-ingresos-clientes", nombre: "OPIA MARKETING", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "oracle", grupo_id: "a-ingresos-clientes", nombre: "ORACLE", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "oxiquim", grupo_id: "a-ingresos-clientes", nombre: "OXIQUIM", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "papa-johns", grupo_id: "a-ingresos-clientes", nombre: "PAPA JOHNS", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "papelera-lo-izquierdo", grupo_id: "a-ingresos-clientes", nombre: "PAPELERA LO IZQUIERDO", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "parque-arauco", grupo_id: "a-ingresos-clientes", nombre: "PARQUE ARAUCO", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "pflp", grupo_id: "a-ingresos-clientes", nombre: "PFLP", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "pisquera-de-chile", grupo_id: "a-ingresos-clientes", nombre: "PISQUERA DE CHILE", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "plaza-maule", grupo_id: "a-ingresos-clientes", nombre: "PLAZA MAULE", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "porsche", grupo_id: "a-ingresos-clientes", nombre: "PORSCHE", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "pragmaxion", grupo_id: "a-ingresos-clientes", nombre: "PRAGMAXION", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "prestigio", grupo_id: "a-ingresos-clientes", nombre: "PRESTIGIO", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "promigas", grupo_id: "a-ingresos-clientes", nombre: "PROMIGAS", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "pronto-espacio", grupo_id: "a-ingresos-clientes", nombre: "PRONTO ESPACIO", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "prosegur", grupo_id: "a-ingresos-clientes", nombre: "PROSEGUR", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "pucobre", grupo_id: "a-ingresos-clientes", nombre: "PUCOBRE", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "quimica-latinoamericana", grupo_id: "a-ingresos-clientes", nombre: "QUÍMICA LATINOAMERICANA", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "red-igualdad", grupo_id: "a-ingresos-clientes", nombre: "RED IGUALDAD", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "ride", grupo_id: "a-ingresos-clientes", nombre: "RIDE", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "roche", grupo_id: "a-ingresos-clientes", nombre: "ROCHE", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "salfa", grupo_id: "a-ingresos-clientes", nombre: "SALFA", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "scotiabank", grupo_id: "a-ingresos-clientes", nombre: "SCOTIABANK", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "scretting", grupo_id: "a-ingresos-clientes", nombre: "SCRETTING", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "servicio-civil", grupo_id: "a-ingresos-clientes", nombre: "SERVICIO CIVIL", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "simon-de-cirene", grupo_id: "a-ingresos-clientes", nombre: "SIMON DE CIRENE", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "sinacofi", grupo_id: "a-ingresos-clientes", nombre: "SINACOFI", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "sk", grupo_id: "a-ingresos-clientes", nombre: "SK", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "sky-airlines", grupo_id: "a-ingresos-clientes", nombre: "SKY AIRLINES", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "softys", grupo_id: "a-ingresos-clientes", nombre: "SOFTYS", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "southbridge", grupo_id: "a-ingresos-clientes", nombre: "SOUTHBRIDGE", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "starken", grupo_id: "a-ingresos-clientes", nombre: "STARKEN", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "statkraft", grupo_id: "a-ingresos-clientes", nombre: "STATKRAFT", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "sura", grupo_id: "a-ingresos-clientes", nombre: "SURA", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "systep", grupo_id: "a-ingresos-clientes", nombre: "SYSTEP", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "tanner", grupo_id: "a-ingresos-clientes", nombre: "TANNER", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "teck", grupo_id: "a-ingresos-clientes", nombre: "TECK", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "testcloud", grupo_id: "a-ingresos-clientes", nombre: "TESTCLOUD", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "tgr", grupo_id: "a-ingresos-clientes", nombre: "TGR", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "the-coca-cola-company", grupo_id: "a-ingresos-clientes", nombre: "THE COCA-COLA COMPANY", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "tigre-ads", grupo_id: "a-ingresos-clientes", nombre: "TIGRE/ADS", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "timining", grupo_id: "a-ingresos-clientes", nombre: "TIMINING", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "toctoc", grupo_id: "a-ingresos-clientes", nombre: "TOCTOC", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "tottus", grupo_id: "a-ingresos-clientes", nombre: "TOTTUS", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "transelec", grupo_id: "a-ingresos-clientes", nombre: "TRANSELEC", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "trendy", grupo_id: "a-ingresos-clientes", nombre: "TRENDY", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "tres-montes", grupo_id: "a-ingresos-clientes", nombre: "TRES MONTES", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "triciclos", grupo_id: "a-ingresos-clientes", nombre: "TRICICLOS", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "uai", grupo_id: "a-ingresos-clientes", nombre: "UAI", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "universidad-adolfo-ibanez", grupo_id: "a-ingresos-clientes", nombre: "UNIVERSIDAD ADOLFO IBAÑEZ", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "universidad-de-atacama", grupo_id: "a-ingresos-clientes", nombre: "UNIVERSIDAD DE ATACAMA", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "universidad-san-sebastian", grupo_id: "a-ingresos-clientes", nombre: "UNIVERSIDAD SAN SEBASTIAN", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "uno-salud", grupo_id: "a-ingresos-clientes", nombre: "UNO SALUD", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "vantaz", grupo_id: "a-ingresos-clientes", nombre: "VANTAZ", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "vida-camara", grupo_id: "a-ingresos-clientes", nombre: "VIDA CAMARA", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "walmart", grupo_id: "a-ingresos-clientes", nombre: "WALMART", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "wec", grupo_id: "a-ingresos-clientes", nombre: "WEC", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "zurich", grupo_id: "a-ingresos-clientes", nombre: "ZURICH", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "otros-ingresos", grupo_id: "b-otros-ingresos", nombre: "Otros ingresos", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "prestamos-bancarios", grupo_id: "b-otros-ingresos", nombre: "Prestamos bancarios", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "prestamos-relacionadas", grupo_id: "b-otros-ingresos", nombre: "Prestamos relacionadas", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "utilidades-colombia", grupo_id: "b-otros-ingresos", nombre: "Utilidades Colombia", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "utilidades-peru", grupo_id: "b-otros-ingresos", nombre: "Utilidades Perú", naturaleza: "ingreso", activa: true, controlada: true, por_cargos: false },
  { id: "conferencias", grupo_id: "1-costo-de-venta", nombre: "Conferencias", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "costos-directos-consultoria", grupo_id: "1-costo-de-venta", nombre: "Costos directos consultoría", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "costos-directos-consultoria-equipa", grupo_id: "1-costo-de-venta", nombre: "Costos directos consultoría - Equipamiento tecnológico Salvador", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "costos-directos-consultoria-examen", grupo_id: "1-costo-de-venta", nombre: "Costos directos consultoría - Exámenes y certificaciones Salvador", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "costos-directos-consultoria-logist", grupo_id: "1-costo-de-venta", nombre: "Costos directos consultoría - Logística Salvador", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "costos-directos-consultoria-materi", grupo_id: "1-costo-de-venta", nombre: "Costos directos consultoría - Materiales Salvador", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "distribucion-de-margen", grupo_id: "1-costo-de-venta", nombre: "Distribución de margen", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "generacion-de-contenido", grupo_id: "1-costo-de-venta", nombre: "Generación de contenido", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "horas", grupo_id: "1-costo-de-venta", nombre: "Horas", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "ingreso-minimo-asegurado", grupo_id: "1-costo-de-venta", nombre: "Ingreso mínimo asegurado", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "jefaturas", grupo_id: "1-costo-de-venta", nombre: "Jefaturas", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "actividades-aprendizaje-organizaci", grupo_id: "1-desarrollo-organizaciona", nombre: "Actividades aprendizaje organizacional", naturaleza: "inversion", activa: true, controlada: true, por_cargos: false },
  { id: "asesoria-proy-desarrollo-interno", grupo_id: "1-desarrollo-organizaciona", nombre: "AsesorÍa Proy. Desarrollo Interno", naturaleza: "inversion", activa: true, controlada: true, por_cargos: false },
  { id: "asesoria-proyectos-probono", grupo_id: "1-desarrollo-organizaciona", nombre: "Asesoría proyectos Probono", naturaleza: "inversion", activa: true, controlada: true, por_cargos: false },
  { id: "capacitacion-consultores", grupo_id: "1-desarrollo-organizaciona", nombre: "Capacitación Consultores", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "coalicion-de-cambio", grupo_id: "1-desarrollo-organizaciona", nombre: "Coalición de cambio", naturaleza: "inversion", activa: true, controlada: true, por_cargos: false },
  { id: "consultoria-y-gestion-de-proyectos", grupo_id: "1-desarrollo-organizaciona", nombre: "Consultoría y gestión de proyectos", naturaleza: "inversion", activa: true, controlada: true, por_cargos: false },
  { id: "direccion-ejecutiva", grupo_id: "1-desarrollo-organizaciona", nombre: "Dirección Ejecutiva", naturaleza: "inversion", activa: true, controlada: true, por_cargos: false },
  { id: "proyecto-formacion", grupo_id: "1-desarrollo-organizaciona", nombre: "Proyecto formación", naturaleza: "inversion", activa: true, controlada: true, por_cargos: false },
  { id: "reparto-de-utilidades-anuales", grupo_id: "1-desarrollo-organizaciona", nombre: "Reparto de utilidades anuales", naturaleza: "inversion", activa: true, controlada: true, por_cargos: false },
  { id: "arriendo-oficina", grupo_id: "2-gastos-administracion", nombre: "Arriendo oficina", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "asesoria-contable", grupo_id: "2-gastos-administracion", nombre: "Asesoría contable", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "beneficios-personas", grupo_id: "2-gastos-administracion", nombre: "Beneficios personas", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "caja-chica", grupo_id: "2-gastos-administracion", nombre: "Caja chica", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "certificaciones", grupo_id: "2-gastos-administracion", nombre: "Certificaciones", naturaleza: "inversion", activa: true, controlada: true, por_cargos: false },
  { id: "contribuciones", grupo_id: "2-gastos-administracion", nombre: "Contribuciones", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "equipamiento-oficina", grupo_id: "2-gastos-administracion", nombre: "Equipamiento oficina", naturaleza: "inversion", activa: true, controlada: true, por_cargos: false },
  { id: "gastos-comunes", grupo_id: "2-gastos-administracion", nombre: "Gastos comunes", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "gastos-de-representacion", grupo_id: "2-gastos-administracion", nombre: "Gastos de representación", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "gastos-legales", grupo_id: "2-gastos-administracion", nombre: "Gastos legales", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "insumos-oficina", grupo_id: "2-gastos-administracion", nombre: "Insumos oficina", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "jornadas-y-eventos-organizacion", grupo_id: "2-gastos-administracion", nombre: "Jornadas y eventos organizacion", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "mant-y-reparacion-oficina", grupo_id: "2-gastos-administracion", nombre: "Mant. y Reparación oficina", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "patente-comercial", grupo_id: "2-gastos-administracion", nombre: "Patente comercial", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "telefonia-e-internet", grupo_id: "2-gastos-administracion", nombre: "Telefonía e internet", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "agencia-comunicaciones", grupo_id: "2-0-comercial-y-marketing", nombre: "Agencia comunicaciones", naturaleza: "inversion", activa: true, controlada: true, por_cargos: false },
  { id: "alianzas-estudios-y-relacionamient", grupo_id: "2-0-comercial-y-marketing", nombre: "Alianzas, estudios y relacionamiento", naturaleza: "inversion", activa: true, controlada: true, por_cargos: false },
  { id: "asistencia-a-eventos", grupo_id: "2-0-comercial-y-marketing", nombre: "Asistencia a eventos", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "estudios-publicos", grupo_id: "2-0-comercial-y-marketing", nombre: "Estudios públicos", naturaleza: "inversion", activa: true, controlada: true, por_cargos: false },
  { id: "eventos-propios", grupo_id: "2-0-comercial-y-marketing", nombre: "Eventos propios", naturaleza: "inversion", activa: true, controlada: true, por_cargos: false },
  { id: "gastos-de-marketing", grupo_id: "2-0-comercial-y-marketing", nombre: "Gastos de marketing", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "marketing-digital", grupo_id: "2-0-comercial-y-marketing", nombre: "Marketing digital", naturaleza: "inversion", activa: true, controlada: true, por_cargos: false },
  { id: "medios-digitales", grupo_id: "2-0-comercial-y-marketing", nombre: "Medios digitales", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "pagina-web", grupo_id: "2-0-comercial-y-marketing", nombre: "Página web", naturaleza: "inversion", activa: true, controlada: true, por_cargos: false },
  { id: "branding-y-merchandising", grupo_id: "2-1-posicionamiento-nueva", nombre: "Branding y merchandising", naturaleza: "inversion", activa: true, controlada: true, por_cargos: false },
  { id: "difusion-nueva-marca", grupo_id: "2-1-posicionamiento-nueva", nombre: "Difusión nueva marca", naturaleza: "inversion", activa: true, controlada: true, por_cargos: false },
  { id: "nueva-marca-organizacional", grupo_id: "2-1-posicionamiento-nueva", nombre: "Nueva marca organizacional", naturaleza: "inversion", activa: true, controlada: true, por_cargos: false },
  { id: "2-1-posicionamiento-nueva-pagina-web", grupo_id: "2-1-posicionamiento-nueva", nombre: "Pagina web", naturaleza: "inversion", activa: true, controlada: true, por_cargos: false },
  { id: "registro-legales-nueva-marca", grupo_id: "2-1-posicionamiento-nueva", nombre: "Registro legales nueva marca", naturaleza: "inversion", activa: true, controlada: true, por_cargos: false },
  { id: "garantias", grupo_id: "2-2-compra-activos", nombre: "Garantías", naturaleza: "inversion", activa: true, controlada: true, por_cargos: false },
  { id: "infraestructura", grupo_id: "2-2-compra-activos", nombre: "Infraestructura", naturaleza: "inversion", activa: true, controlada: true, por_cargos: false },
  { id: "legales-y-puesta-en-marcha", grupo_id: "2-2-compra-activos", nombre: "Legales y puesta en marcha", naturaleza: "inversion", activa: true, controlada: true, por_cargos: false },
  { id: "muebles-y-enseres", grupo_id: "2-2-compra-activos", nombre: "Muebles y enseres", naturaleza: "inversion", activa: true, controlada: true, por_cargos: false },
  { id: "propiedades-oficina", grupo_id: "2-2-compra-activos", nombre: "Propiedades (Oficina)", naturaleza: "inversion", activa: true, controlada: true, por_cargos: false },
  { id: "gastos-sistemas-digitales", grupo_id: "2-3-gastos-sistemas-digita", nombre: "Gastos sistemas digitales", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "sistemas-analitica-avanzada-ia-y-r", grupo_id: "2-3-gastos-sistemas-digita", nombre: "Sistemas Analítica avanzada, IA y Relac.", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "sistemas-diseno", grupo_id: "2-3-gastos-sistemas-digita", nombre: "Sistemas Diseño", naturaleza: "inversion", activa: true, controlada: true, por_cargos: false },
  { id: "sistemas-operaciones", grupo_id: "2-3-gastos-sistemas-digita", nombre: "Sistemas Operaciones", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "sistemas-operaciones-y-finanzas", grupo_id: "2-3-gastos-sistemas-digita", nombre: "Sistemas Operaciones y Finanzas", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "equipos-computacionales", grupo_id: "2-4-equipos-computacionale", nombre: "Equipos Computacionales", naturaleza: "inversion", activa: true, controlada: true, por_cargos: false },
  { id: "mantenimiento-equipos", grupo_id: "2-4-equipos-computacionale", nombre: "Mantenimiento Equipos", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "capacitacion-del-personal", grupo_id: "3-recursos-humanos", nombre: "Capacitación del personal", naturaleza: "inversion", activa: true, controlada: true, por_cargos: false },
  { id: "finiquitos", grupo_id: "3-recursos-humanos", nombre: "Finiquitos", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "imposiciones", grupo_id: "3-recursos-humanos", nombre: "Imposiciones", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "jornadas-y-eventos-equipo-interno", grupo_id: "3-recursos-humanos", nombre: "Jornadas y eventos equipo interno", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "servicios-externos-rr-hh", grupo_id: "3-recursos-humanos", nombre: "Servicios externos RR.HH", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "sueldos", grupo_id: "3-recursos-humanos", nombre: "Sueldos", naturaleza: "operativo", activa: true, controlada: true, por_cargos: true },
  { id: "impuesto-a-la-renta", grupo_id: "4-impuestos", nombre: "Impuesto a la renta", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "iva-compras", grupo_id: "4-impuestos", nombre: "IVA compras", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "iva-mensual", grupo_id: "4-impuestos", nombre: "IVA mensual", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "retencion-bhe", grupo_id: "4-impuestos", nombre: "Retención BHE", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "comisiones-bancarias", grupo_id: "5-bancos", nombre: "Comisiones bancarias", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "tarjeta-de-credito", grupo_id: "5-bancos", nombre: "Tarjeta de credito", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "traspaso-entre-empresas", grupo_id: "5-bancos", nombre: "Traspaso entre empresas", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "prestamos-bancarios-pago", grupo_id: "6-prestamos-bancarios", nombre: "Prestamos bancarios (pago)", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "depositos-a-plazo", grupo_id: "7-inversiones", nombre: "Depositos a plazo", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "firmex", grupo_id: "7-inversiones", nombre: "Firmex", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "fondos-mutuos", grupo_id: "7-inversiones", nombre: "Fondos mutuos", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "invexor", grupo_id: "7-inversiones", nombre: "Invexor", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "poliglota", grupo_id: "7-inversiones", nombre: "Poliglota", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "adapsys-miami", grupo_id: "8-relacionados-y-socios", nombre: "Adapsys Miami", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "cuenta-corriente-peru-chile", grupo_id: "8-relacionados-y-socios", nombre: "Cuenta corriente Perú-Chile", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "participacion-comite", grupo_id: "8-relacionados-y-socios", nombre: "Participación Comité", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "prestamos-socios", grupo_id: "8-relacionados-y-socios", nombre: "Préstamos socios", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
  { id: "retiros-socios", grupo_id: "8-relacionados-y-socios", nombre: "Retiros socios", naturaleza: "operativo", activa: true, controlada: true, por_cargos: false },
];

/** Nivel 3 — el detalle dentro de una categoría (§5).
 *
 *  Son las tres ramas que Quicken tenía en tres niveles y que el importador aplastó
 *  a categorías hermanas del grupo: 21 movimientos sobre troncos de 342 y 202. Van a
 *  crecer, pero el nivel es opcional a propósito: una línea se clasifica en la
 *  categoría y la subcategoría solo precisa dentro de cuál. */
export const SUBCATEGORIAS: Subcategoria[] = [
  { id: "offsite-internacional", categoria_id: "jornadas-y-eventos-organizacion", nombre: "Offsite internacional", naturaleza: null, activa: true, titular: null },
  { id: "automatizacion-y-metrics", categoria_id: "sistemas-analitica-avanzada-ia-y-r", nombre: "Automatización y metrics", naturaleza: null, activa: true, titular: null },
  { id: "manejador-base-de-datos", categoria_id: "sistemas-analitica-avanzada-ia-y-r", nombre: "Manejador base de datos", naturaleza: null, activa: true, titular: null },
  // Cargos: la categoría "Sueldos" va por_cargos, así que sus subcategorías son
  // puestos y llevan el nombre de quien los ocupa. El nombre del cargo es lo que
  // se compara entre años; el titular cambia sin que el cargo cambie.
  { id: "directora-de-operaciones-y-finanzas", categoria_id: "sueldos", nombre: "Directora de Operaciones y Finanzas", naturaleza: null, activa: true, titular: "Patricia Alarcón" },
  { id: "especialista-de-finanzas", categoria_id: "sueldos", nombre: "Especialista de Finanzas", naturaleza: null, activa: true, titular: "Matías Espinoza" },
  // Un cargo vacante: existe, se presupuesta y todavía no lo ocupa nadie.
  { id: "analista-de-datos", categoria_id: "sueldos", nombre: "Analista de Datos", naturaleza: null, activa: true, titular: null },
];
