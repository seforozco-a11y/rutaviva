/**
 * Seed inicial de lugares singulares de MANZANILLO, COLIMA para RutaViva.
 * Estrategia: arrancamos en Manzanillo y después extendemos al resto de los
 * municipios de Colima (Armería, Tecomán, Colima, Comala, Villa de Álvarez,
 * Coquimatlán, Cuauhtémoc, Ixtlahuacán, Minatitlán).
 *
 * Este seed LIMPIA la tabla y la vuelve a poblar (útil en desarrollo).
 * Ejecutar con: bun prisma/seed.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const places = [
  {
    name: "Playa La Audiencia",
    description:
      "La bahía más querida de Manzanillo: aguas cristalinas y tranquilas en la península de Santiago, con el islote frente a la orilla. Ideal para nadar, hacer snorkel y venir en familia.",
    category: "playa",
    lat: 19.1137,
    lng: -104.3444,
    address: "Península de Santiago, Zona Hotelera Norte",
    tips: "Por la mañana el mar está como espejo: es la mejor hora para snorkel cerca del islote.",
    featured: true,
  },
  {
    name: "Playa Miramar",
    description:
      "La playa más popular del puerto: olas fuertes para surf y boogie, kilómetros de arena, palapas y restaurantes de mariscos con vista al atardecer.",
    category: "playa",
    lat: 19.0937,
    lng: -104.3290,
    address: "Blvd. Miguel de la Madrid, Santiago",
    tips: "Respeta las banderas: roja = oleaje fuerte. El atardecer desde el malecón es obligatorio.",
    featured: true,
  },
  {
    name: "Playa Salahua",
    description:
      "Playa de la zona hotelera con ambiente clásico de puerto: palapas, clubes de playa y puestos de cocadas frente a la bahía de Santiago.",
    category: "playa",
    lat: 19.1087,
    lng: -104.3400,
    address: "Blvd. Costero Miguel de la Madrid, Salahua",
    tips: "Perfecta para caminar al atardecer entre Salahua y Miramar.",
    featured: false,
  },
  {
    name: "Playa Santiago",
    description:
      "Poblado pesquero con sabor auténtico: malecón nuevo, lanchas de colores y la franja de marisquerías más querida del puerto. De aquí salen los tours del pez vela.",
    category: "playa",
    lat: 19.0732,
    lng: -104.3356,
    address: "Playa Santiago, Manzanillo",
    tips: "Pide pescado zarandeado en las palapas del malecón y pregunta por el tour de avistamiento.",
    featured: true,
  },
  {
    name: "Playa La Boquita",
    description:
      "Donde el estero abraza al mar: aguas serenas para niños, restaurantes con pieles frescas traídas de la laguna y lanchas que recorren el manglar.",
    category: "playa",
    lat: 19.0570,
    lng: -104.3520,
    address: "La Boquita, Manzanillo",
    tips: "El combo favorito: tarde de playa + lancha por el estero al atardecer.",
    featured: false,
  },
  {
    name: "Playa Ventanas",
    description:
      "Cuevas y arcos tallados por el mar en una playa semi-virgen al norte del puerto. La postal más salvaje de Manzanillo, sin desarrollos a la vista.",
    category: "playa",
    lat: 19.1490,
    lng: -104.4700,
    address: "Carretera Manzanillo–Barra de Navidad, km norte",
    tips: "Con marea baja puedes entrar a las cuevas; con marea alta desaparecen. Lleva sombra y agua.",
    featured: false,
  },
  {
    name: "Playa Carrizales",
    description:
      "Playa tortuguera donde el estero se une al mar: palapas rústicas, paseo en lancha por el manglar y liberación de crías de tortuga en temporada.",
    category: "playa",
    lat: 19.1630,
    lng: -104.5100,
    address: "Carrizales, norte de Manzanillo",
    tips: "Pregunta por la liberación de tortugas al atardecer: experiencia imperdible para niños.",
    featured: false,
  },
  {
    name: "Mirador de la Bahía de Santiago",
    description:
      "Las paradas panorámicas sobre el Blvd. Costero regalan la postal clásica del puerto: la bahía entera, los barcos y el verde de la selva baja al mar.",
    category: "mirador",
    lat: 19.0850,
    lng: -104.3330,
    address: "Blvd. Costero Miguel de la Madrid, entre Miramar y Santiago",
    tips: "Para al atardecer: el sol cae justo frente a la bahía.",
    featured: false,
  },
  {
    name: "Monumento al Pescador",
    description:
      "El ícono del Puerto de Manzanillo: la escultura que celebra a quienes le dieron el título de Capital Mundial del Pez Vela. Parada obligatoria para la foto del viaje.",
    category: "monumento",
    lat: 19.0487,
    lng: -104.3135,
    address: "Blvd. Costero Miguel de la Madrid, entrada al puerto",
    tips: "Combínalo con una caminata por el malecón del centro, está a unos minutos.",
    featured: true,
  },
  {
    name: "Centro Histórico y Malecón",
    description:
      "El corazón del puerto: Plaza Juárez, el reloj público, la glorieta con palapa y un malecón para caminar frente a la bahía entre vendedores de cocadas y agua de coco.",
    category: "plaza",
    lat: 19.0537,
    lng: -104.3148,
    address: "Plaza Juárez, Centro de Manzanillo",
    tips: "Los fines de semana hay eventos y baile en la plaza por la noche.",
    featured: true,
  },
  {
    name: "Mercado Municipal",
    description:
      "El sabor real del puerto bajo un techo: mariscos recién traídos, tacos de pescado, aguas frescas de jamaica y horchata, y artesanías de concha.",
    category: "gastronomia",
    lat: 19.0550,
    lng: -104.3125,
    address: "Centro, Manzanillo",
    tips: "Ve con hambre por la mañana: los puestos de mariscos salen frescos de la compra diaria.",
    featured: false,
  },
  {
    name: "El Tortugario · Laguna de Cuyutlán",
    description:
      "Centro de educación ambiental entre manglares y salinas: cocodrilos, tortugas e iguanas, con recorridos en lancha por la laguna. La aventura ecológica de la región (30 min del puerto).",
    category: "naturaleza",
    lat: 18.9866,
    lng: -104.3630,
    address: "Cuyutlán, municipio de Armería (30 min de Manzanillo)",
    tips: "Lleva repelente y calzado cómodo; el recorrido guiado en lancha vale cada peso.",
    featured: true,
  },
  {
    name: "Museo de la Sal de Cuyutlán",
    description:
      "La historia del oro blanco que puso a Cuyutlán en el mapa: salinas, la técnica prehispánica de la cocina de sal y el viejo ferrocarril que la llevaba al puerto.",
    category: "museo",
    lat: 18.9880,
    lng: -104.3580,
    address: "Cuyutlán, municipio de Armería",
    tips: "Combínalo con El Tortugario, están a pocos minutos uno del otro.",
    featured: false,
  },
];

async function main() {
  // Desarrollo: limpiar y re-sembrar para reflejar la región actual (Manzanillo).
  const deleted = await db.singularPlace.deleteMany({});
  for (const p of places) {
    await db.singularPlace.create({ data: p });
  }
  console.log(
    `Seed OK: ${deleted.count} lugares previos eliminados y ${places.length} lugares de Manzanillo, Colima creados.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
