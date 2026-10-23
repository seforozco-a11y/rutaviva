/**
 * Seed inicial de lugares singulares (CDMX) para RutaViva.
 * Ejecutar con: bun prisma/seed.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const places = [
  {
    name: "Ángel de la Independencia",
    description:
      "El monumento icónico de la Ciudad de México sobre Paseo de la Reforma. Punto de encuentro clásico para celebraciones, caminatas y fotos al atardecer.",
    category: "monumento",
    lat: 19.4270,
    lng: -99.1677,
    address: "Paseo de la Reforma y Av. Florencia, Juárez",
    tips: "Los domingos por la mañana Reforma se cierra a autos: ideal para bici.",
    featured: true,
  },
  {
    name: "Zócalo · Plaza de la Constitución",
    description:
      "Una de las plazas más grandes del mundo, rodeada por la Catedral Metropolitana y el Palacio Nacional con murales de Diego Rivera.",
    category: "plaza",
    lat: 19.4326,
    lng: -99.1332,
    address: "Plaza de la Constitución, Centro Histórico",
    tips: "Sube al mirador de la Catedral para una vista única del Centro.",
    featured: true,
  },
  {
    name: "Palacio de Bellas Artes",
    description:
      "Máxima casa de la cultura en México: fachada de mármol, cúpula de vitral Tiffany y murales de Rivera, Siqueiros y Orozco.",
    category: "cultura",
    lat: 19.4352,
    lng: -99.1414,
    address: "Av. Juárez s/n, Centro Histórico",
    tips: "Los domingos la entrada al museo es gratuita.",
    featured: true,
  },
  {
    name: "Museo Nacional de Antropología",
    description:
      "Uno de los mejores museos del mundo: la Piedra del Sol azteca, tesoros mayas y salas de todas las culturas de México.",
    category: "museo",
    lat: 19.4260,
    lng: -99.1863,
    address: "Av. Paseo de la Reforma & Calz. Gandhi, Chapultepec",
    tips: "Dedícale al menos 3 horas; no te pierdas la sala Mexica.",
    featured: true,
  },
  {
    name: "Castillo de Chapultepec",
    description:
      "El único castillo real de América Latina, con vistas espectaculares, salas de Maximiliano y Carlota y el Museo de Historia Nacional.",
    category: "monumento",
    lat: 19.4204,
    lng: -99.1820,
    address: "Bosque de Chapultepec I Sección",
    tips: "Llega temprano para evitar filas y aprovechar el bosque.",
  },
  {
    name: "Casa Azul · Frida Kahlo",
    description:
      "La casa natal de Frida Kahlo en Coyoacán, pintada de azul cobalto, con su obra, vestidos y el jardín que la inspiró.",
    category: "museo",
    lat: 19.3550,
    lng: -99.1624,
    address: "Londres 247, Del Carmen, Coyoacán",
    tips: "Compra boletos en línea: las filas pueden superar la hora.",
  },
  {
    name: "Mirador Torre Latinoamericana",
    description:
      "Rascacielos emblemático de 1956 con mirador a 360° en el piso 44: la mejor vista del Centro Histórico y los volcanes.",
    category: "mirador",
    lat: 19.4336,
    lng: -99.1406,
    address: "Eje Central Lázaro Cárdenas 2, Centro",
    tips: "Al atardecer la vista de los volcanes es espectacular.",
  },
  {
    name: "Mercado de Coyoacán",
    description:
      "Mercado tradicional con tostadas legendarias, esquites, jugos y artesanías. El sabor auténtico del sur de la ciudad.",
    category: "gastronomia",
    lat: 19.3534,
    lng: -99.1609,
    address: "Malintzi 197, Barrio del Carmen, Coyoacán",
    tips: "Prueba las tostadas de pata y el agua de horchata.",
  },
  {
    name: "Trajineras de Xochimilco",
    description:
      "Canales prehispánicos Patrimonio de la Humanidad: recorre las chinampas en trajinera con música, comida y flores.",
    category: "naturaleza",
    lat: 19.2606,
    lng: -99.1031,
    address: "Embarcadero Caltongo / Nativitas, Xochimilco",
    tips: "Ve con tiempo: los fines de semana hay mucha demanda.",
  },
  {
    name: "Parque México",
    description:
      "El corazón art déco de la Condesa: lagos, puentes, ciclistas y perritos. Perfecto para descansar entre café y cafés.",
    category: "parque",
    lat: 19.4149,
    lng: -99.1740,
    address: "Av. México s/n, Condesa",
    tips: "Cafés y taquerías excelentes rodean todo el parque.",
  },
  {
    name: "Cerro del Ajusco · Pico del Águila",
    description:
      "El techo de la ciudad (3,930 m): senderismo entre pinos con vistas al valle de México y, con suerte, a los volcanes.",
    category: "naturaleza",
    lat: 19.2106,
    lng: -99.2537,
    address: "Pico del Águila, Tlalpan",
    tips: "Lleva abrigo: la temperatura baja mucho respecto a la ciudad.",
  },
  {
    name: "Pirámides de Teotihuacán",
    description:
      "La antigua ciudad de los dioses a 1 hora de la capital: Pirámide del Sol y de la Luna, Calzada de los Muertos y templos con murales.",
    category: "monumento",
    lat: 19.6925,
    lng: -98.8438,
    address: "San Juan Teotihuacán, Estado de México",
    tips: "Sal temprano desde el Terminal Norte; sube a la Pirámide de la Luna para la mejor foto.",
    featured: true,
  },
];

async function main() {
  const count = await db.singularPlace.count();
  if (count > 0) {
    console.log(`Seed omitido: ya existen ${count} lugares singulares.`);
    return;
  }
  for (const p of places) {
    await db.singularPlace.create({ data: p });
  }
  console.log(`Seed OK: ${places.length} lugares singulares creados.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
