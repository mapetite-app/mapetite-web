// Categorie del pannello Filtri → tipi Google (primaryType / types).
// Usate dal server (ricerca con i filtri) e dal telefono (filtri sui salvati).
export const CATEGORY_TYPE_MAP: Record<string, string[]> = {
  restaurant: ["restaurant", "italian_restaurant", "fine_dining_restaurant"],
  cafe: ["cafe", "coffee_shop", "breakfast_restaurant"],
  pizza: ["pizza_restaurant"],
  sushi: ["sushi_restaurant", "japanese_restaurant"],
  // Niente "bar" generico: in Italia è il caffè sotto casa, non un pub.
  pub: ["pub", "wine_bar", "irish_pub", "brewpub", "beer_garden"],
  gelato: ["ice_cream_shop", "dessert_shop"],
  bakery: ["bakery"],
  fastfood: ["fast_food_restaurant", "hamburger_restaurant"],
  vegetarian: ["vegetarian_restaurant", "vegan_restaurant"],
  seafood: ["seafood_restaurant"],
  steakhouse: ["steak_house", "barbecue_restaurant"],
  wine_bar: ["wine_bar"],
};
