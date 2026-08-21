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
export type Grupo = "Adapsys" | "Relacionadas";
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
        Row: { id: string; nombre: string; corto: string; grupo: Grupo };
        Insert: { id: string; nombre: string; corto: string; grupo: Grupo };
        Update: Partial<{ id: string; nombre: string; corto: string; grupo: Grupo }>;
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
      categorias: {
        Row: { id: string; nombre: string; orden: number; controlado: boolean };
        Insert: { id: string; nombre: string; orden: number; controlado?: boolean };
        Update: Partial<Database["public"]["Tables"]["categorias"]["Insert"]>;
        Relationships: [];
      };
      subcategorias: {
        Row: {
          id: string;
          categoria_id: string;
          nombre: string;
          naturaleza: Naturaleza;
          activa: boolean;
        };
        Insert: {
          id: string;
          categoria_id: string;
          nombre: string;
          naturaleza: Naturaleza;
          activa?: boolean;
        };
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
      movimientos: {
        Row: {
          id: number;
          fecha: string;
          empresa_id: string;
          /** Obligatoria desde que se crea: la moneda se deriva de la cuenta. */
          cuenta_id: string;
          contraparte: string | null;
          glosa: string | null;
          monto: number;
          /** Siempre igual a la moneda de la cuenta (foreign key compuesta). */
          moneda: Moneda;
          tipo_cambio: number | null;
          estado: EstadoMovimiento;
          doc_tipo: DocTipo | null;
          creado_por: string | null;
          creado_en: string;
          actualizado_en: string;
        };
        Insert: {
          id?: number;
          fecha: string;
          empresa_id: string;
          cuenta_id: string;
          contraparte?: string | null;
          glosa?: string | null;
          monto: number;
          moneda: Moneda;
          tipo_cambio?: number | null;
          estado?: EstadoMovimiento;
          doc_tipo?: DocTipo | null;
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
          subcategoria_id: string;
          monto: number;
          glosa: string | null;
          orden: number;
        };
        Insert: {
          id?: number;
          movimiento_id: number;
          subcategoria_id: string;
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
            foreignKeyName: "movimiento_lineas_subcategoria_id_fkey";
            columns: ["subcategoria_id"];
            isOneToOne: false;
            referencedRelation: "subcategorias";
            referencedColumns: ["id"];
          },
        ];
      };
      presupuesto: {
        Row: {
          id: number;
          anio: number;
          subcategoria_id: string;
          monto: number;
          monto_anterior: number;
          responsable: string | null;
          nota: string | null;
        };
        Insert: {
          id?: number;
          anio: number;
          subcategoria_id: string;
          monto?: number;
          monto_anterior?: number;
          responsable?: string | null;
          nota?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["presupuesto"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "presupuesto_subcategoria_id_fkey";
            columns: ["subcategoria_id"];
            isOneToOne: false;
            referencedRelation: "subcategorias";
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
      v_lineas_categoria_inactiva: {
        Row: Database["public"]["Tables"]["movimiento_lineas"]["Row"];
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
