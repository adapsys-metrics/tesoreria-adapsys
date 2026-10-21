import { Registro } from "@/components/movimientos/Registro";
import { titulo } from "@/lib/marca";

export const metadata = { title: titulo("Movimientos") };

export default function PaginaMovimientos() {
  return <Registro />;
}
