// Tipos escritos a mano reflejando supabase/migrations/0001_esquema.sql.
// Cuando haya un proyecto Supabase real, reemplazar por el output de:
//   npm run db:types
// (requiere SUPABASE_PROJECT_ID en el entorno — ver package.json).
//
// El campo Relationships es obligatorio en cada tabla/vista: @supabase/supabase-js
// lo exige para poder tipar el resultado de .select() (sin él, TypeScript no logra
// resolver el tipo y cae a `never` — así se manifestó en el build de Vercel).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// Los tipos del dominio viven en lib/tipos.ts (son los mismos valores); se
// re-exportan acá para que este archivo siga siendo autocontenido cuando se
// reemplace por el output de `npm run db:types`.
export type GrupoEmpresa = "Adapsys" | "Relacionadas";
export type Moneda = "CLP" | "USD";
export type TipoCuenta = "banco" | "cxc";
export type Naturaleza = "ingreso" | "inversion" | "operativo";
export type EstadoMovimiento = "proyectado" | "pagado" | "conciliado";
export type DocTipo = "exento" | "afecta" | "honorario";
export type AccionAuditoria = "crear" | "modificar" | "anular";

export type Database = {
  public: {
    Tables: {
      empresas: {
        Row: { id: string; nombre: string; corto: string; grupo: GrupoEmpresa };
        Insert: { id: string; nombre: string; corto: string; grupo: GrupoEmpresa };
        Update: Partial<{ id: string; nombre: string; corto: string; grupo: GrupoEmpresa }>;
        Relationships: [];
      };
      cuentas: {
        Row: {
          id: string;
          empresa_id: string;
          nombre: string;
          moneda: Moneda;
          tipo: TipoCuenta;
          saldo_inicial: number;
          principal: boolean;
        };
        Insert: {
          id: string;
          empresa_id: string;
          nombre: string;
          moneda: Moneda;
          tipo: TipoCuenta;
          saldo_inicial?: number;
          principal?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["cuentas"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "cuentas_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      /** Nivel 1: "2 GASTOS ADMINISTRACIÓN" (0012). */
      grupos: {
        Row: { id: string; nombre: string; orden: number; controlado: boolean };
        Insert: { id: string; nombre: string; orden: number; controlado?: boolean };
        Update: Partial<Database["public"]["Tables"]["grupos"]["Insert"]>;
        Relationships: [];
      };
      /** Nivel 2: "Jornadas y eventos organización". Es a donde apunta toda línea. */
      categorias: {
        Row: {
          id: string;
          grupo_id: string;
          nombre: string;
          naturaleza: Naturaleza;
          activa: boolean;
        };
        Insert: {
          id: string;
          grupo_id: string;
          nombre: string;
          naturaleza: Naturaleza;
          activa?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["categorias"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "categorias_grupo_id_fkey";
            columns: ["grupo_id"];
            isOneToOne: false;
            referencedRelation: "grupos";
            referencedColumns: ["id"];
          },
        ];
      };
      /** Nivel 3, opcional: "Offsite internacional". Detalle, no nivel de reporte. */
      subcategorias: {
        Row: { id: string; categoria_id: string; nombre: string; activa: boolean };
        Insert: { id: string; categoria_id: string; nombre: string; activa?: boolean };
        Update: Partial<Database["public"]["Tables"]["subcategorias"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "subcategorias_categoria_id_fkey";
            columns: ["categoria_id"];
            isOneToOne: false;
            referencedRelation: "categorias";
            referencedColumns: ["id"];
          },
        ];
      };
      usuarios_autorizados: {
        Row: { email: string; nombre: string; activo: boolean; creado_en: string };
        Insert: { email: string; nombre: string; activo?: boolean; creado_en?: string };
        Update: Partial<Database["public"]["Tables"]["usuarios_autorizados"]["Insert"]>;
        Relationships: [];
      };
      movimientos: {
        Row: {
          id: number;
          fecha: string;
          /** Nullable desde 0003: las proyecciones que vienen del presupuesto
           *  consolidado no tienen sociedad (§4.6). */
          empresa_id: string | null;
          /** Nullable desde 0005: una proyección puede no saber todavía de qué
           *  cuenta va a salir. La moneda igual se guarda en el movimiento. */
          cuenta_id: string | null;
          contraparte: string | null;
          glosa: string | null;
          /** Número del documento: FA273, B405 (0008). */
          documento: string | null;
          monto: number;
          /** Igual a la moneda de la cuenta cuando hay cuenta (foreign key compuesta). */
          moneda: Moneda;
          tipo_cambio: number | null;
          estado: EstadoMovimiento;
          doc_tipo: DocTipo | null;
          /** Cuota del plan de pagos pactado con el cliente (0013). */
          hito: number | null;
          /** Archivo del export de Quicken del que se importó (0003). */
          origen: string | null;
          creado_por: string | null;
          creado_en: string;
          actualizado_en: string;
        };
        Insert: {
          id?: number;
          fecha: string;
          empresa_id?: string | null;
          cuenta_id?: string | null;
          contraparte?: string | null;
          glosa?: string | null;
          documento?: string | null;
          monto: number;
          moneda: Moneda;
          tipo_cambio?: number | null;
          estado?: EstadoMovimiento;
          doc_tipo?: DocTipo | null;
          hito?: number | null;
          origen?: string | null;
          creado_por?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["movimientos"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "movimientos_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "movimientos_cuenta_id_fkey";
            columns: ["cuenta_id"];
            isOneToOne: false;
            referencedRelation: "cuentas";
            referencedColumns: ["id"];
          },
        ];
      };
      movimiento_lineas: {
        Row: {
          id: number;
          movimiento_id: number;
          categoria_id: string;
          /** Opcional (0012): la enorme mayoría de las líneas se clasifica a nivel
           *  de categoría. Si viene, pertenece a esa categoría — lo valida un trigger. */
          subcategoria_id: string | null;
          monto: number;
          glosa: string | null;
          orden: number;
        };
        Insert: {
          id?: number;
          movimiento_id: number;
          categoria_id: string;
          subcategoria_id?: string | null;
          monto: number;
          glosa?: string | null;
          orden?: number;
        };
        Update: Partial<Database["public"]["Tables"]["movimiento_lineas"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "movimiento_lineas_movimiento_id_fkey";
            columns: ["movimiento_id"];
            isOneToOne: false;
            referencedRelation: "movimientos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "movimiento_lineas_categoria_id_fkey";
            columns: ["categoria_id"];
            isOneToOne: false;
            referencedRelation: "categorias";
            referencedColumns: ["id"];
          },
        ];
      };
      presupuesto_meses: {
        Row: { anio: number; categoria_id: string; mes: number; monto: number };
        Insert: { anio: number; categoria_id: string; mes: number; monto?: number };
        Update: Partial<Database["public"]["Tables"]["presupuesto_meses"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "presupuesto_meses_categoria_id_fkey";
            columns: ["categoria_id"];
            isOneToOne: false;
            referencedRelation: "categorias";
            referencedColumns: ["id"];
          },
        ];
      };
      presupuesto: {
        Row: {
          id: number;
          anio: number;
          categoria_id: string;
          monto_anterior: number;
          responsable: string | null;
          nota: string | null;
        };
        Insert: {
          id?: number;
          anio: number;
          categoria_id: string;
          monto_anterior?: number;
          responsable?: string | null;
          nota?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["presupuesto"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "presupuesto_categoria_id_fkey";
            columns: ["categoria_id"];
            isOneToOne: false;
            referencedRelation: "categorias";
            referencedColumns: ["id"];
          },
        ];
      };
      parametros: {
        Row: { clave: string; valor: number; vigencia_desde: string };
        Insert: { clave: string; valor: number; vigencia_desde: string };
        Update: Partial<{ clave: string; valor: number; vigencia_desde: string }>;
        Relationships: [];
      };
      reportes_guardados: {
        Row: {
          id: number;
          usuario_id: string;
          nombre: string;
          config: Json;
          creado_en: string;
        };
        Insert: {
          id?: number;
          usuario_id: string;
          nombre: string;
          config?: Json;
        };
        Update: Partial<Database["public"]["Tables"]["reportes_guardados"]["Insert"]>;
        Relationships: [];
      };
      auditoria: {
        Row: {
          id: number;
          tabla: string;
          registro_id: string;
          accion: AccionAuditoria;
          antes: Json | null;
          despues: Json | null;
          usuario_id: string | null;
          cuando: string;
        };
        Insert: {
          id?: number;
          tabla: string;
          registro_id: string;
          accion: AccionAuditoria;
          antes?: Json | null;
          despues?: Json | null;
          usuario_id?: string | null;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      v_lineas_expandidas: {
        Row: {
          movimiento_id: number;
          fecha: string;
          empresa_id: string;
          cuenta_id: string;
          estado: EstadoMovimiento;
          moneda: Moneda;
          tipo_cambio: number | null;
          categoria_id: string | null;
          subcategoria_id: string | null;
          monto: number;
          glosa: string | null;
        };
        Relationships: [];
      };
      v_movimientos_sin_clasificar: {
        Row: Database["public"]["Tables"]["movimientos"]["Row"];
        Relationships: [];
      };
      v_lineas_grupo_inactiva: {
        Row: Database["public"]["Tables"]["movimiento_lineas"]["Row"];
        Relationships: [];
      };
    };
    Functions: {
      /** Guarda un movimiento y reemplaza sus líneas en una transacción (0007). */
      fn_guardar_movimiento: {
        Args: { p: Json };
        Returns: number;
      };
      /** Guarda los doce meses de una línea del presupuesto y su metadata (0010,
       *  redefinida en 0012 sobre categoria_id). */
      fn_guardar_presupuesto: {
        Args: { p: Json };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
