import { redirect } from "next/navigation";

// El flujo de caja es la vista con la que se entra a trabajar todos los días.
export default function Home() {
  redirect("/flujo");
}
