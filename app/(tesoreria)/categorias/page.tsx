import { Categorias } from "@/components/categorias/Categorias";
import { titulo } from "@/lib/marca";

export const metadata = { title: titulo("Categorías") };

export default function PaginaCategorias() {
  return <Categorias />;
}
