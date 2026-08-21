// Tipos escritos a mano reflejando supabase/migrations/0001_esquema.sql.
// Cuando haya un proyecto Supabase real, reemplazar por el output de:
//   npm run db:types
// (requiere SUPABASE_PROJECT_ID en el entorno — ver package.json).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Grupo = "Adapsys" | "Relacionadas";
export type Moneda = "CLP" | "USD";
export type TipoCuenta = "banco" | "cxc";
export type Naturaleza = "ingreso" | "inversion" | "operativo";
export type EstadoMovimiento = "proyectado" | "pagado" | "conciliado";
export type DocTipo = "exento" | "afecta" | "honorario";
export type AccionAuditoria = "crear" | "modificar" | "anular";

export interface Database {
  public: {
    Tables: {
      empresas: {
        Row: { id: string; nombre: string; corto: string; grupo: Grupo };
        Insert: { id: string; nombre: string; corto: string; grupo: Grupo };
        Update: Partial<{ id: string; nombre: string; corto: string; grupo: Grupo }>;
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
      };
      categorias: {
        Row: { id: string; nombre: string; orden: number; controlado: boolean };
        Insert: { id: string; nombre: string; orden: number; controlado?: boolean };
        Update: Partial<Database["public"]["Tables"]["categorias"]["Insert"]>;
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
      };
      movimientos: {
        Row: {
          id: number;
          fecha: string;
          empresa_id: string;
          cuenta_id: string;
          contraparte: string | null;
          glosa: string | null;
          monto: number;
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
      };
      parametros: {
        Row: { clave: string; valor: number; vigencia_desde: string };
        Insert: { clave: string; valor: number; vigencia_desde: string };
        Update: Partial<{ clave: string; valor: number; vigencia_desde: string }>;
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
      };
      v_movimientos_sin_clasificar: {
        Row: Database["public"]["Tables"]["movimientos"]["Row"];
      };
      v_lineas_categoria_inactiva: {
        Row: Database["public"]["Tables"]["movimiento_lineas"]["Row"];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
