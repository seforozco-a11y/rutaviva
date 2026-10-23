/**
 * Seed inicial de MANZANILLO, COLIMA para RutaViva.
 * Incluye:
 *  - 13 lugares singulares publicados (status APPROVED, source ADMIN)
 *  - Reseñas aprobadas (con fotos de ejemplo) que se muestran en la app
 *  - Reseñas PENDING y una sugerencia de lugar PENDING para poblar la cola
 *    de validación del panel de administración
 *
 * Estrategia: arrancamos en Manzanillo y después extendemos al resto de los
 * municipios de Colima (Armería, Tecomán, Colima, Comala, Villa de Álvarez,
 * Coquimatlán, Cuauhtémoc, Ixtlahuacán, Minatitlán).
 *
 * Este seed LIMPIA las tablas y las vuelve a poblar (útil en desarrollo).
 * Ejecutar con: bun prisma/seed.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

type SeedPlace = {
  name: string;
  description: string;
  category: string;
  lat: number;
  lng: number;
  address: string;
  tips: string;
  featured: boolean;
  imageUrl?: string;
};

const places: SeedPlace[] = [
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
    imageUrl: "/images/places/audiencia.png",
  },
  {
    name: "Playa Miramar",
    description:
      "La playa más popular del puerto: olas fuertes para surf y boogie, kilómetros de arena, palapas y restaurantes de mariscos con vista al atardecer.",
    category: "playa",
    lat: 19.0937,
    lng: -104.329,
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
    lng: -104.34,
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
    imageUrl: "/images/places/santiago.png",
  },
  {
    name: "Playa La Boquita",
    description:
      "Donde el estero abraza al mar: aguas serenas para niños, restaurantes con piñas frescas traídas de la laguna y lanchas que recorren el manglar.",
    category: "playa",
    lat: 19.057,
    lng: -104.352,
    address: "La Boquita, Manzanillo",
    tips: "El combo favorito: tarde de playa + lancha por el estero al atardecer.",
    featured: false,
  },
  {
    name: "Playa Ventanas",
    description:
      "Cuevas y arcos tallados por el mar en una playa semi-virgen al norte del puerto. La postal más salvaje de Manzanillo, sin desarrollos a la vista.",
    category: "playa",
    lat: 19.149,
    lng: -104.47,
    address: "Carretera Manzanillo–Barra de Navidad, km norte",
    tips: "Con marea baja puedes entrar a las cuevas; con marea alta desaparecen. Lleva sombra y agua.",
    featured: false,
  },
  {
    name: "Playa Carrizales",
    description:
      "Playa tortuguera donde el estero se une al mar: palapas rústicas, paseo en lancha por el manglar y liberación de crías de tortuga en temporada.",
    category: "playa",
    lat: 19.163,
    lng: -104.51,
    address: "Carrizales, norte de Manzanillo",
    tips: "Pregunta por la liberación de tortugas al atardecer: experiencia imperdible para niños.",
    featured: false,
  },
  {
    name: "Mirador de la Bahía de Santiago",
    description:
      "Las paradas panorámicas sobre el Blvd. Costero regalan la postal clásica del puerto: la bahía entera, los barcos y el verde de la selva baja al mar.",
    category: "mirador",
    lat: 19.085,
    lng: -104.333,
    address: "Blvd. Costero Miguel de la Madrid, entre Miramar y Santiago",
    tips: "Para al atardecer: el sol cae justo frente a la bahía.",
    featured: false,
    imageUrl: "/images/places/mirador.png",
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
    imageUrl: "/images/places/pez-vela.png",
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
    lat: 19.055,
    lng: -104.3125,
    address: "Centro, Manzanillo",
    tips: "Ve con hambre por la mañana: los puestos de mariscos salen frescos de la compra diaria.",
    featured: false,
    imageUrl: "/images/places/mercado.png",
  },
  {
    name: "El Tortugario · Laguna de Cuyutlán",
    description:
      "Centro de educación ambiental entre manglares y salinas: cocodrilos, tortugas e iguanas, con recorridos en lancha por la laguna. La aventura ecológica de la región (30 min del puerto).",
    category: "naturaleza",
    lat: 18.9866,
    lng: -104.363,
    address: "Cuyutlán, municipio de Armería (30 min de Manzanillo)",
    tips: "Lleva repelente y calzado cómodo; el recorrido guiado en lancha vale cada peso.",
    featured: true,
    imageUrl: "/images/places/tortugario.png",
  },
  {
    name: "Museo de la Sal de Cuyutlán",
    description:
      "La historia del oro blanco que puso a Cuyutlán en el mapa: salinas, la técnica prehispánica de la cocina de sal y el viejo ferrocarril que la llevaba al puerto.",
    category: "museo",
    lat: 18.988,
    lng: -104.358,
    address: "Cuyutlán, municipio de Armería",
    tips: "Combínalo con El Tortugario, están a pocos minutos uno del otro.",
    featured: false,
  },
];

async function main() {
  // Desarrollo: limpiar y re-sembrar (el orden importa por las llaves foráneas).
  await db.photo.deleteMany({});
  await db.review.deleteMany({});
  const deleted = await db.singularPlace.deleteMany({});

  const created: Record<string, string> = {};
  for (const p of places) {
    const row = await db.singularPlace.create({
      data: {
        name: p.name,
        description: p.description,
        category: p.category,
        lat: p.lat,
        lng: p.lng,
        address: p.address,
        imageUrl: p.imageUrl ?? null,
        tips: p.tips,
        featured: p.featured,
        status: "APPROVED",
        source: "ADMIN",
      },
    });
    created[p.name] = row.id;
  }

  // ---- Reseñas APROBADAS (visibles en la app) ----
  const approvedReviews: Array<{
    place: string;
    authorName: string;
    rating: number;
    comment: string;
    photos?: string[];
  }> = [
    {
      place: "Playa La Audiencia",
      authorName: "Familia Herrera",
      rating: 5,
      comment:
        "La mejor playa para niños en Manzanillo. Agua tranquila y clara, llevamos snorkel y vimos peces junto al islote. Llegamos 9 am y había sombra gratis bajo las palapas.",
    },
    {
      place: "Playa La Audiencia",
      authorName: "Diego M.",
      rating: 4,
      comment:
        "Hermosa pero llega llena los dominges por la tarde. Si quieren fotos sin gente, vayan entre semana temprano. Hay renta de equipo de snorkel en la entrada.",
    },
    {
      place: "Playa Santiago",
      authorName: "Chef Viajero",
      rating: 5,
      comment:
        "El zarandeado del malecón es otro nivel. Compramos directo a los pescadores y lo prepararon en las palapas: filete fresquísimo con arroz y tortillas hechas a mano.",
      photos: ["/images/reviews/ceviche.png"],
    },
    {
      place: "Playa La Boquita",
      authorName: "Ana & Leo",
      rating: 5,
      comment:
        "Tomamos el paseo en lancha por el estero al atardecer y fue lo mejor del viaje: garzas, manglares y un sol naranja espectacular. Muy seguro para ir con niños.",
      photos: ["/images/reviews/atardecer.png"],
    },
    {
      place: "Mercado Municipal",
      authorName: "TacosLover19",
      rating: 5,
      comment:
        "Tacos de pescado en el puesto del fondo (pregunten por Doña Chelo) por 20 pesos. Aguas de jamaica y horchata recién hechas. Ambiente 100% local.",
    },
    {
      place: "El Tortugario · Laguna de Cuyutlán",
      authorName: "Profe Ramírez",
      rating: 4,
      comment:
        "Fui con un grupo de jóvenes y salieron fascinados: cocodrilos, tortugas y el guía explicando todo con mucha paciencia. Lleven repelente, es zona de manglar.",
    },
  ];

  for (const r of approvedReviews) {
    const placeId = created[r.place];
    if (!placeId) continue;
    await db.review.create({
      data: {
        placeId,
        authorName: r.authorName,
        rating: r.rating,
        comment: r.comment,
        status: "APPROVED",
        photos: {
          create: (r.photos ?? []).map((url) => ({ url, status: "APPROVED" })),
        },
      },
    });
  }

  // ---- Reseñas PENDIENTES (esperan validación del admin) ----
  await db.review.create({
    data: {
      placeId: created["Playa Miramar"],
      authorName: "TuristaBike",
      rating: 3,
      comment:
        "Olas fuertes como dicen, cuidado con niños. Las palapas bien pero el estacionamiento se satura. El atardecer sí vale la pena.",
      status: "PENDING",
    },
  });
  await db.review.create({
    data: {
      placeId: created["Monumento al Pescador"],
      authorName: "ViajeraCuriosa",
      rating: 5,
      comment:
        "Parada obligatoria para la foto clásica del puerto. Hay señalamiento nuevo y hasta un señor que toma fotos con tu celular por propina.",
      status: "PENDING",
      photos: {
        create: [{ url: "/images/reviews/atardecer.png", status: "PENDING" }],
      },
    },
  });

  // ---- Sugerencia de lugar PENDIENTE (cola de aprobación del admin) ----
  const suggestion = await db.singularPlace.create({
    data: {
      name: "Puestos de Tacos El Güero (Zona Salahua)",
      description:
        "Puesto de tacos de marlin y gobernador que arma don Güero frente a la playa de Salahua. Abre de 6 pm en adelante, las tortillas se hacen al momento y la salsa de chile de árbol es legendaria entre los locales.",
      category: "gastronomia",
      lat: 19.1073,
      lng: -104.3429,
      address: "Blvd. Costero, frente a Salahua",
      tips: null,
      status: "PENDING",
      source: "USER",
      suggestedBy: "Rosa Ibáñez",
      photos: {
        create: [{ url: "/images/reviews/tacos.png", status: "PENDING" }],
      },
    },
  });

  console.log(
    `Seed OK: ${deleted.count} previos eliminados · ${places.length} lugares publicados · ` +
      `${approvedReviews.length} reseñas aprobadas · 2 reseñas pendientes · 1 sugerencia pendiente (${suggestion.id.slice(-6)}).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
