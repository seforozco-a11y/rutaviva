#!/bin/bash
# Genera imágenes para RutaViva: lugares de Manzanillo + fotos estilo usuario para reseñas
set -u
cd /home/z/my-project
mkdir -p public/images/places public/images/reviews

gen() {
  local prompt="$1"; local out="$2"; local size="$3"
  if [ -s "$out" ]; then echo "SKIP $out"; return 0; fi
  for i in 1 2 3; do
    echo ">>> $out (intento $i)"
    z-ai image -p "$prompt" -o "$out" -s "$size" && [ -s "$out" ] && { echo "OK $out"; return 0; }
    sleep 2
  done
  echo "FAIL $out"
  return 1
}

gen "Aerial view of Playa La Audiencia in Manzanillo Mexico, crescent-shaped golden sand beach with crystal clear turquoise water, small rocky islet near the shore, lush green jungle hillside, palm trees, sunny day, professional travel photography, high quality, detailed" "public/images/places/audiencia.png" "1344x768" &
gen "Fishing village beach of Playa Santiago in Manzanillo Mexico, colorful small fishing boats on golden sand, palapa restaurants along the shore, golden hour warm light, tropical atmosphere, travel photography, high quality" "public/images/places/santiago.png" "1344x768" &
gen "Monument to the Fisherman sculpture at the port entrance of Manzanillo Mexico, dramatic bronze statue of a fisherman beside a sailfish, coastal boulevard, blue sky with clouds, travel photography, high quality" "public/images/places/pez-vela.png" "1344x768" &
gen "Scenic viewpoint overlooking Santiago Bay in Manzanillo Mexico at sunset, panoramic ocean view with cargo ships in the distance, orange and pink sky, palm tree silhouettes, travel photography, high quality" "public/images/places/mirador.png" "1344x768" &
gen "Traditional Mexican municipal market interior with fresh seafood stalls, fish tacos, colorful fruit stands, bustling local atmosphere in Manzanillo Mexico, documentary travel photography, high quality" "public/images/places/mercado.png" "1344x768" &
gen "Mangrove lagoon eco tour in Cuyutlan Mexico, small boat on calm green water among mangroves, tropical vegetation, crocodile sanctuary, ecotourism, travel photography, high quality" "public/images/places/tortugario.png" "1344x768" &
wait

gen "Casual smartphone photo of fresh ceviche and marlin tacos on a rustic wooden table at a beach palapa restaurant in Mexico, lime wedges and salsa bottles, natural daylight, authentic amateur vacation photo" "public/images/reviews/ceviche.png" "1024x1024" &
gen "Casual smartphone photo of a sunset at La Boquita beach in Manzanillo Mexico, orange sky reflecting on calm estuary water, silhouettes of palm trees and a small boat, authentic amateur vacation photo" "public/images/reviews/atardecer.png" "1024x1024" &
gen "Casual smartphone photo of a small beachside taco stand in Manzanillo Mexico at dusk, warm string lights, smoke rising from the grill, red plastic chairs, authentic amateur photo" "public/images/reviews/tacos.png" "1024x1024" &
wait

echo "ALL DONE"
