// Built-in London discovery: official "What's on" pages of venues that match the
// original user's interests. The app reads only the event details these venues publish
// for search engines (schema.org), checks robots.txt before every page, reads slowly,
// and refreshes once a day. A venue that publishes no readable data simply contributes
// nothing; it never breaks the others. Turn the whole list off with CURATED_SOURCES=0.
export interface CuratedVenue {
  name: string;
  url: string;
}

export const CURATED_VENUES: CuratedVenue[] = [
  // Classical and opera
  { name: "Wigmore Hall", url: "https://www.wigmore-hall.org.uk/whats-on" },
  { name: "Southbank Centre", url: "https://www.southbankcentre.co.uk/whats-on" },
  { name: "Barbican", url: "https://www.barbican.org.uk/whats-on" },
  { name: "Kings Place", url: "https://www.kingsplace.co.uk/whats-on/" },
  { name: "Cadogan Hall", url: "https://cadoganhall.com/whats-on/" },
  { name: "St Martin-in-the-Fields", url: "https://www.stmartin-in-the-fields.org/whats-on/" },
  { name: "Royal Albert Hall", url: "https://www.royalalberthall.com/tickets/" },
  // Jazz
  { name: "Ronnie Scott's", url: "https://www.ronniescotts.co.uk/performances" },
  { name: "PizzaExpress Live", url: "https://www.pizzaexpresslive.com/whats-on" },
  { name: "Jazz Cafe", url: "https://thejazzcafelondon.com/whats-on/" },
  // Theatre and dance
  { name: "National Theatre", url: "https://www.nationaltheatre.org.uk/whats-on/" },
  { name: "The Old Vic", url: "https://www.oldvictheatre.com/whats-on" },
  { name: "Donmar Warehouse", url: "https://www.donmarwarehouse.com/whats-on" },
  { name: "Bridge Theatre", url: "https://bridgetheatre.co.uk/whats-on/" },
  { name: "Sadler's Wells", url: "https://www.sadlerswells.com/whats-on/" },
  // Art and exhibitions
  { name: "Royal Academy of Arts", url: "https://www.royalacademy.org.uk/exhibitions-and-events" },
  { name: "Serpentine", url: "https://www.serpentinegalleries.org/whats-on/" },
  { name: "V&A", url: "https://www.vam.ac.uk/whatson" },
  // Talks, books and ideas
  { name: "Royal Institution", url: "https://www.rigb.org/whats-on" },
  { name: "Intelligence Squared", url: "https://intelligencesquared.com/events/" },
  { name: "London Review Bookshop", url: "https://www.londonreviewbookshop.co.uk/events" },
  { name: "British Library", url: "https://www.bl.uk/events" },
  // Film
  { name: "BFI Southbank", url: "https://whatson.bfi.org.uk/" },
  { name: "Prince Charles Cinema", url: "https://princecharlescinema.com/" },
];
